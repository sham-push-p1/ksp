/**
 * rag.js — Shared RAG (Retrieval-Augmented Generation) pipeline
 *
 * Extracts the duplicated keyword → candidate retrieval → embedding → cosine
 * scoring pipeline that was copy-pasted between narrative_search and hybrid
 * intents into a single reusable async function.
 */

const { llmCall, getEmbedding } = require("./nl-to-zcql/ollama");
const logger = require("../utils/logger");

/**
 * Cosine similarity between two equal-length numeric arrays.
 * Returns 0 if either vector is null/empty or lengths differ.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA  += a[i] * a[i];
    mB  += b[i] * b[i];
  }
  if (mA === 0 || mB === 0) return 0;
  return dot / (Math.sqrt(mA) * Math.sqrt(mB));
}

/**
 * Ensures every record in `records` has its EmbeddingVec populated and parsed.
 * Generates embeddings on-demand and persists them to CaseSummaryFlat.
 *
 * @param {object}   db      - better-sqlite3 Database instance
 * @param {object[]} records - rows from CaseSummaryFlat (must include CaseMasterID, BriefFacts)
 */
async function ensureEmbeddingsCached(db, records) {
  for (const r of records) {
    if (!r.EmbeddingVec) {
      try {
        const text = r.BriefFacts || "";
        if (text) {
          const emb = await getEmbedding(text);
          if (emb && emb.length > 0) {
            await db("CaseSummaryFlat").where({ CaseMasterID: r.CaseMasterID }).update({ EmbeddingVec: JSON.stringify(emb) });
            r.EmbeddingVec = emb;
          }
        }
      } catch (err) {
        logger.error(`[RAG] Failed to embed case ${r.CaseMasterID}: ${err.message}`);
      }
    } else if (typeof r.EmbeddingVec === "string") {
      try {
        r.EmbeddingVec = JSON.parse(r.EmbeddingVec);
      } catch {
        r.EmbeddingVec = null;
      }
    }
  }
}

/**
 * Full RAG pipeline: keyword extraction → candidate retrieval → embedding
 * generation → cosine re-ranking → return top-k matches.
 *
 * @param {object} db             - better-sqlite3 Database instance
 * @param {string} question       - raw user question
 * @param {object} userContext    - RBAC context (role, districtName, stationName)
 * @param {function} applyRBAC    - function(sql, userContext) → { sql, params }
 * @param {number} [topK=5]       - number of top matches to return
 *
 * @returns {Promise<object[]>} Array of case records enriched with `relevanceScore`
 */
async function performRAG(db, question, userContext, applyRBAC, topK = 5) {
  const BASE_SELECT = `
    SELECT CaseMasterID, CrimeNo, BriefFacts, CaseNo,
           CrimeRegisteredDate, IncidentFromDate, IncidentToDate,
           CaseCategoryName, GravityOffence, CrimeMajorHead, CrimeMinorHead,
           CaseStatus, PoliceStationName, DistrictName,
           RegisteringOfficerName, RegisteringOfficerRank, CourtName, EmbeddingVec
    FROM CaseSummaryFlat`;

  // 1. Extract keywords via LLM
  let candidates = [];
  try {
    const kwPrompt = `Extract 2-4 space-separated English keywords from this police query to search in crime narratives (BriefFacts). Exclude stop words. Focus on specific nouns/actions (e.g. 'bus stand', 'knife', 'highway', 'drunk'). Output ONLY the keywords separated by spaces, nothing else.`;
    const kwStr = await llmCall("fast", kwPrompt, question, { temperature: 0.0 });
    const keywords = kwStr.trim().split(/\s+/).filter(k => k.length > 2);

    // 2. Keyword-filtered candidate retrieval with parameterized RBAC
    if (keywords.length > 0) {
      const conditions = keywords.map(() => "BriefFacts LIKE ?").join(" OR ");
      const kwParams   = keywords.map(kw => `%${kw}%`);
      const rbac = applyRBAC(`${BASE_SELECT} WHERE (${conditions})`, userContext, kwParams);
      candidates = await db.raw(`${rbac.sql} LIMIT 150`, rbac.params);
    }
  } catch (err) {
    logger.warn(`[RAG] Keyword candidate retrieval failed: ${err.message}`);
  }

  // 3. Fallback: fetch a broader set if keyword results are thin
  if (candidates.length < 30) {
    try {
      const rbac = applyRBAC(BASE_SELECT, userContext, []);
      const fallback = await db.raw(`${rbac.sql} LIMIT 100`, rbac.params);
      const seen = new Set(candidates.map(c => c.CaseMasterID));
      for (const f of fallback) {
        if (!seen.has(f.CaseMasterID)) candidates.push(f);
      }
    } catch (err) {
      logger.warn(`[RAG] Fallback retrieval failed: ${err.message}`);
    }
  }

  // 4. Generate/load embeddings
  await ensureEmbeddingsCached(db, candidates);

  // 5. Embed the query and cosine-rank candidates
  const queryEmbedding = await getEmbedding(question);
  let topMatches;
  if (queryEmbedding && queryEmbedding.length > 0) {
    const scored = candidates.map(c => ({
      ...c,
      relevanceScore: cosineSimilarity(queryEmbedding, c.EmbeddingVec),
    }));
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    topMatches = scored.slice(0, topK);
  } else {
    topMatches = candidates.slice(0, topK).map(c => ({ ...c, relevanceScore: 0 }));
  }

  return topMatches;
}

/**
 * Searches the KnowledgeBase table using vector embeddings.
 * @param {object} db - Database instance
 * @param {string} question - User question to embed
 * @param {number} topK - Number of docs to return
 */
async function searchKnowledgeBase(db, question, topK = 3) {
  try {
    const queryEmbedding = await getEmbedding(question);
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    const docs = await db("KnowledgeBase").select("*");
    const scoredDocs = [];
    
    for (const doc of docs) {
      if (doc.EmbeddingVec) {
        try {
          const vec = JSON.parse(doc.EmbeddingVec);
          const score = cosineSimilarity(queryEmbedding, vec);
          scoredDocs.push({ ...doc, relevanceScore: score });
        } catch (e) {
          // Ignore malformed JSON
        }
      }
    }
    
    scoredDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scoredDocs.slice(0, topK);
  } catch (err) {
    logger.error(`[RAG] searchKnowledgeBase failed: ${err.message}`);
    return [];
  }
}

module.exports = { performRAG, cosineSimilarity, ensureEmbeddingsCached, searchKnowledgeBase };
