/**
 * routes/chat.js — /api/chat: NL→SQL intent routing, RAG, trend analysis,
 *                  network analysis, and query audit logging.
 */

const express  = require("express");
const db       = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { llmCall }    = require("../functions/nl-to-zcql/ollama");
const { performRAG, searchKnowledgeBase } = require("../functions/rag");
const { FLAT_TABLE_SCHEMA, RBAC, INTENTS } = require("../shared/schema");
const logger = require("../utils/logger");
const { validateBody, z } = require("../middleware/validate");

const router = express.Router();

// ─── SQL Safety ───────────────────────────────────────────────────────────────

const BLOCKED = ["INSERT","UPDATE","DELETE","DROP","CREATE","ALTER","TRUNCATE","--","/*"];
const TABLES = ['CaseSummaryFlat', 'AccusedSummaryFlat', 'VictimSummaryFlat', 'ComplainantSummaryFlat', 'FinancialTransactionsFlat', 'SystemUsers', 'QueryAuditLog', 'KnowledgeBase'];

function quoteTables(sql) {
  let q = sql;
  for (const t of TABLES) {
    q = q.replace(new RegExp(`(?<!")\\b${t}\\b(?!")`, 'gi'), `"${t}"`);
  }
  return q;
}

function validateSQL(q) {
  const u = q.toUpperCase().trim();
  if (!u.startsWith("SELECT")) return { safe:false, reason:"Only SELECT allowed" };
  for (const k of BLOCKED) if (u.includes(k)) return { safe:false, reason:`Blocked keyword: ${k}` };
  return { safe:true };
}

/**
 * Apply RBAC scope constraints using parameterized binding.
 * Returns { sql: string, params: any[] } — never interpolates user values into SQL.
 */
function applyRBAC(sql, ctx, existing = []) {
  const cfg = RBAC[ctx?.role || "constable"] || {};
  if (!cfg.stationScoped && !cfg.districtScoped) return { sql, params: existing };

  // Inject condition before GROUP BY, ORDER BY, or LIMIT
  const splitRegex = /\b(GROUP BY|ORDER BY|LIMIT)\b/i;
  const match = sql.match(splitRegex);
  
  let baseSql = sql;
  let tailSql = "";
  if (match) {
    baseSql = sql.substring(0, match.index);
    tailSql = sql.substring(match.index);
  }

  const hasWhere = /\bWHERE\b/i.test(baseSql);
  const conn = hasWhere ? "AND" : "WHERE";

  let condition = "";
  let params = [...existing];

  if (cfg.stationScoped && ctx.stationName) {
    condition = '"PoliceStationName" = ?';
    params.push(ctx.stationName);
  } else if (cfg.districtScoped && ctx.districtName) {
    condition = '"DistrictName" = ?';
    params.push(ctx.districtName);
  }

  if (!condition) return { sql, params };

  return { 
    sql: `${baseSql.trim()} ${conn} ${condition} ${tailSql}`.trim(), 
    params 
  };
}

// ─── Intent Classifier ───────────────────────────────────────────────────────

async function classifyIntent(q) {
  const sys = `Classify this user input into exactly one intent string.
Options: general, structured_query, narrative_search, trend_analysis, network_analysis, hybrid
Rules:
- general: greeting, introduction, thank you, hello, help, or any conversational message not asking for specific database records or statistics.
- structured_query: counting, listing, filtering cases/accused/victims by field values
- trend_analysis: time-based patterns, monthly/yearly trends, hotspots, crime rates over time
- network_analysis: connections between accused, repeat offenders, criminal networks
- narrative_search: searching FIR text/descriptions semantically
- hybrid: needs both structured query AND text search
Output ONLY the intent string, nothing else.`;
  const r = await llmCall("fast", sys, q, { temperature: 0.0 });
  const intent = r.trim().toLowerCase();
  return Object.values(INTENTS).includes(intent) ? intent : INTENTS.STRUCTURED_QUERY;
}

// ─── SQL Prompt Builder ──────────────────────────────────────────────────────

function buildSQLPrompt(dateRange) {
  const schema = Object.entries(FLAT_TABLE_SCHEMA)
    .map(([t,cols]) => `Table: ${t}\nColumns: ${cols.join(", ")}`)
    .join("\n\n");
    
  let dateRule = "";
  if (dateRange && dateRange.start && dateRange.end) {
    dateRule = `\n8. STRICT DATE CONSTRAINT: All queries must implicitly filter for records between '${dateRange.start}' and '${dateRange.end}' using the "IncidentFromDate" column, unless the user explicitly asks for a different time period.`;
  }

  return `You are a PostgreSQL query generator for Karnataka Police crime database.

TABLES:
${schema}

VALID VALUES REFERENCE:
- CrimeMajorHead: 'Crimes Against Body', 'Crimes Against Property', 'Crimes Against Women', 'Economic Offences', 'Special & Local Laws'
- CrimeMinorHead:
  * Crimes Against Body: 'Murder', 'Attempt to Murder', 'Culpable Homicide', 'Hurt/Grievous Hurt', 'Assault on Woman'
  * Crimes Against Property: 'Robbery', 'Burglary', 'Theft', 'Cheating', 'Extortion'
  * Crimes Against Women: 'Rape', 'Kidnapping of Women', 'Dowry Death', 'Molestation', 'Harassment'
  * Economic Offences: 'Fraud', 'Forgery', 'Cyber Crime'
  * Special & Local Laws: 'NDPS Act' (Note: This is used for drug/narcotic offenses like drug trafficking, possession of marijuana, ganja, etc.), 'Arms Act' (for weapons), 'Excise Act' (for liquor)
- CaseStatus: 'Under Investigation', 'Charge Sheeted', 'Closed - True', 'Closed - False', 'Undetected', 'Pending in Court'
- DistrictName: 'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubballi-Dharwad', 'Belagavi', 'Kalaburagi', 'Shivamogga', 'Tumakuru', 'Vijayapura'
- StateName: Always 'Karnataka'
- Gender: 'Male', 'Female', 'Transgender'

RULES:
1. Only SELECT queries. Never INSERT/UPDATE/DELETE/DROP.
2. Use only tables and columns listed above.
3. String values in single quotes. Dates as 'YYYY-MM-DD'.
4. Add LIMIT 100 for record queries. No LIMIT for COUNT/GROUP BY aggregations.
5. Output ONLY raw SQL — no markdown, no backticks, no explanation.
6. For keywords representing drug trafficking, narcotics, marijuana, ganja, or drugs, search for "CrimeMinorHead" = 'NDPS Act' or query "BriefFacts" using LIKE '%drug%' or LIKE '%narcotic%' or LIKE '%contraband%'.
7. When search terms or values are not exact matches for columns or values, use LIKE '%keyword%' on the "BriefFacts" column.
8. ALL table names, column names, and aliases MUST be wrapped in double quotes. (e.g. SELECT "CrimeNo" FROM "CaseSummaryFlat" WHERE "CaseStatus" = 'Closed').
9. Generate standard ANSI SQL that is compatible with MySQL and PostgreSQL.${dateRule}

EXAMPLES:
Q: How many murder cases in 2024?
A: SELECT COUNT(*) AS "TotalMurders" FROM "CaseSummaryFlat" WHERE "CrimeMinorHead" = 'Murder' AND "CrimeRegisteredDate" >= '2024-01-01' AND "CrimeRegisteredDate" <= '2024-12-31'

Q: Show robbery cases under investigation in Bengaluru Urban
A: SELECT "CrimeNo", "CrimeRegisteredDate", "PoliceStationName", "CaseStatus" FROM "CaseSummaryFlat" WHERE "CrimeMinorHead" = 'Robbery' AND "CaseStatus" = 'Under Investigation' AND "DistrictName" = 'Bengaluru Urban' LIMIT 100

Q: District-wise crime count
A: SELECT "DistrictName", COUNT(*) AS "CaseCount" FROM "CaseSummaryFlat" GROUP BY "DistrictName" ORDER BY "CaseCount" DESC

Q: Accused with multiple cases
A: SELECT "AccusedName", COUNT(*) AS "CaseCount", MIN("CrimeMajorHead") AS "PrimaryType" FROM "AccusedSummaryFlat" GROUP BY "AccusedName" HAVING COUNT(*) > 1 ORDER BY "CaseCount" DESC LIMIT 50

Q: Crime trend by month in 2024
A: SELECT SUBSTR("CrimeRegisteredDate", 1, 7) AS "Month", COUNT(*) AS "Cases" FROM "CaseSummaryFlat" WHERE "CrimeRegisteredDate" >= '2024-01-01' GROUP BY "Month" ORDER BY "Month"

Q: Show suspicious financial transactions for accused
A: SELECT f.*, a."AccusedName" FROM "FinancialTransactionsFlat" f JOIN "AccusedSummaryFlat" a ON f."AccusedMasterID" = a."AccusedMasterID" WHERE f."SuspiciousFlag" = 1 LIMIT 50`;
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────
const chatSchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(1000, "Question too long"),
  lang: z.string().optional().default("en"),
  conversationHistory: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional().default([]),
  sessionId: z.string().optional(),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format"),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format")
  }).optional()
});

router.post("/chat", authenticateToken, validateBody(chatSchema), async (req, res) => {
  const t0 = Date.now();
  const { question, lang, conversationHistory, sessionId, dateRange } = req.body;
  const userContext = req.user;

  try {
    const intent = await classifyIntent(question);
    logger.info(`[ROUTER] ${intent} | ${question.substring(0,70)}`, { userId: userContext?.userId });

    let response = { intent };

    if (intent === INTENTS.GENERAL) {
      const langHint = lang==="kn" ? "Respond in Kannada language." : "Respond in English.";
      
      const kbDocs = await searchKnowledgeBase(db, question, 3);
      
      let answer;
      if (kbDocs.length > 0 && kbDocs[0].relevanceScore > 0.60) {
        const kbContext = kbDocs.map(d => `Title: ${d.Title}\nContent: ${d.Content}`).join("\n\n");
        answer = await llmCall("smart",
          `You are a Karnataka Police intelligent assistant. ${langHint} Answer the user's question based strictly on the provided Knowledge Base documents below. If the answer is not in the documents, state that you don't know.\n\nKnowledge Base:\n${kbContext}`,
          question, { temperature: 0.3, conversationHistory });
        
        response = {
          ...response, answer, resultCount: kbDocs.length,
          sources: kbDocs.map(d => ({ Title: d.Title, relevanceScore: (d.relevanceScore * 100).toFixed(1) + "%" }))
        };
      } else {
        answer = await llmCall("fast",
          `You are a Karnataka Police crime analyst assistant. ${langHint} Respond politely, concisely, and helpfully to this greeting, thank you, or conversational query. Keep your response within 1-2 sentences. Tell the user you are here to assist them with Karnataka State Police crime statistics, cases, and repeat offender analytics.`,
          question, { temperature: 0.7, conversationHistory });
        response = { ...response, answer, resultCount: 0 };
      }

    } else if (intent === INTENTS.TREND_ANALYSIS) {
      const breakdown = await db.raw(`
        SELECT "CrimeMajorHead", "CrimeMinorHead", COUNT(*) AS "CaseCount", "DistrictName"
        FROM "CaseSummaryFlat" WHERE "CrimeRegisteredDate" >= '2022-01-01'
        GROUP BY "CrimeMajorHead", "CrimeMinorHead", "DistrictName"
        ORDER BY "CaseCount" DESC LIMIT 80
      `);
      const monthly = await db.raw(`
        SELECT substr("CrimeRegisteredDate",1,7) AS "Month", COUNT(*) AS "MonthlyCases"
        FROM "CaseSummaryFlat" WHERE "CrimeRegisteredDate" >= '2023-01-01'
        GROUP BY "Month" ORDER BY "Month"
      `);
      const answer = await llmCall("smart",
        "You are a Karnataka Police crime analyst. Summarize these crime statistics in 2-3 clear sentences. Mention top crime type and total counts.",
        `Question: ${question}\nData sample: ${JSON.stringify(breakdown.slice(0,10))}`,
        { temperature: 0.3, conversationHistory });
      response = { ...response, answer, crimeBreakdown:breakdown, monthlyData:monthly, resultCount:breakdown.length };

    } else if (intent === INTENTS.NARRATIVE_SEARCH) {
      const topMatches = await performRAG(db, question, userContext, applyRBAC);

      const langHint = lang==="kn" ? "Respond in Kannada language." : "Respond in English.";
      const matchesText = topMatches.map(m => `Case No: ${m.CrimeNo} (Minor Head: ${m.CrimeMinorHead}, District: ${m.DistrictName})\nNarrative: ${m.BriefFacts}`).join("\n\n");
      const prompt = `You are a Karnataka Police crime analyst. ${langHint} Answer this question based ONLY on the provided case narratives.
Be concise (2-3 sentences). You MUST cite the specific Case No (e.g. CrimeNo) when referencing facts. If the narratives do not contain the answer, say you could not find a match.

Question: "${question}"

Narratives:
${matchesText}`;

      const answer = await llmCall("smart", prompt, question, { temperature: 0.3, conversationHistory });
      response = {
        ...response, answer,
        resultCount: topMatches.length,
        results: topMatches.map(m => ({ ...m, EmbeddingVec: undefined })),
        sources: topMatches.map(m => ({ CrimeNo: m.CrimeNo, CrimeMinorHead: m.CrimeMinorHead, DistrictName: m.DistrictName, relevanceScore: (m.relevanceScore * 100).toFixed(1) + "%" })),
      };

    } else if (intent === INTENTS.HYBRID) {
      let rawSql = await llmCall("fast", buildSQLPrompt(dateRange), question, { temperature: 0.1, conversationHistory });
      rawSql = rawSql.replace(/```[a-z]*/gi,"").replace(/```/g,"").trim();
      const hybridMatch = rawSql.match(/SELECT[\s\S]*/i);
      if (hybridMatch) rawSql = hybridMatch[0];
      rawSql = quoteTables(rawSql);
      let sqlResults = [], executedSql = "";
      if (validateSQL(rawSql).safe) {
        const scoped = applyRBAC(rawSql, userContext);
        executedSql = scoped.sql;
        try { sqlResults = await db.raw(scoped.sql, scoped.params); }
        catch (e) { logger.warn("[HYBRID] SQL failed: " + e.message, { userId: userContext.userId }); }
      }

      const topMatches = await performRAG(db, question, userContext, applyRBAC);
      const matchesText   = topMatches.map(m => `Case No: ${m.CrimeNo} (Minor Head: ${m.CrimeMinorHead})\nNarrative: ${m.BriefFacts}`).join("\n\n");
      const structuredText = sqlResults.length > 0 ? JSON.stringify(sqlResults.slice(0,15)) : "No structured record results.";
      const langHint = lang==="kn" ? "Respond in Kannada language." : "Respond in English.";

      const answer = await llmCall("smart",
        `You are a Karnataka Police crime analyst. ${langHint} Synthesize an answer to the query by merging the structured statistics and narrative details.
Be concise (2-4 sentences). You MUST reference specific Case Nos/CrimeNos and numbers/stats where applicable.

Question: "${question}"

Structured Data (from SQL query: ${executedSql}):
${structuredText}

Narrative / Text Context (RAG):
${matchesText}`,
        question, { temperature: 0.3, conversationHistory });

      response = {
        ...response, answer, zcqlQuery: executedSql,
        resultCount: topMatches.length + sqlResults.length,
        results: topMatches.map(m => ({ ...m, EmbeddingVec: undefined })),
        sources: topMatches.map(m => ({ CrimeNo: m.CrimeNo, CrimeMinorHead: m.CrimeMinorHead, DistrictName: m.DistrictName, relevanceScore: (m.relevanceScore * 100).toFixed(1) + "%" })),
      };

    } else if (intent === INTENTS.NETWORK_ANALYSIS) {
      let whereClause = "", filterDetails = "";
      try {
        const sys = `Analyze the question and extract a SQLite WHERE clause condition filtering the AccusedSummaryFlat table.
Valid columns to filter on: AccusedName, AgeYear, Gender, PersonID, ArrestDate, ArrestDistrict, CrimeMajorHead, CrimeMinorHead, PoliceStationName, DistrictName.
Valid CrimeMinorHead values: 'Murder', 'Attempt to Murder', 'Culpable Homicide', 'Hurt/Grievous Hurt', 'Assault on Woman', 'Robbery', 'Burglary', 'Theft', 'Cheating', 'Extortion', 'Rape', 'Kidnapping of Women', 'Dowry Death', 'Molestation', 'Harassment', 'Fraud', 'Forgery', 'Cyber Crime', 'NDPS Act' (for drug/narcotic cases), 'Arms Act', 'Excise Act'.
Instructions:
1. Output ONLY the SQLite WHERE condition (e.g. DistrictName = 'Bengaluru Urban' or CrimeMinorHead = 'NDPS Act'), or 'NONE' if no specific filter is requested.
2. Do NOT include the 'WHERE' keyword itself.
3. String literals must use single quotes.
4. Output nothing else but the clause or 'NONE'.`;
        let ext = await llmCall("fast", sys, question, { temperature: 0.0 });
        ext = ext.trim().replace(/`/g, "");
        if (ext.toUpperCase() !== "NONE" && ext !== "") {
          whereClause = `WHERE ${ext}`;
          filterDetails = ` filtered by: ${ext}`;
        }
      } catch (err) { logger.warn("[NETWORK] Filter extraction failed: " + err.message, { userId: userContext.userId }); }

      const networkSql = `
        SELECT "AccusedName", COUNT(*) AS "CaseCount",
               MIN("CrimeMajorHead") AS "PrimaryCrimeType",
               MIN("DistrictName") AS "PrimaryDistrict"
        FROM "AccusedSummaryFlat"
        ${whereClause}
        GROUP BY "AccusedName" HAVING COUNT(*) > 1
        ORDER BY "CaseCount" DESC LIMIT 60
      `;
      const scoped = applyRBAC(networkSql, userContext);
      const nodes = await db.raw(scoped.sql, scoped.params);

      response = {
        ...response,
        results: nodes,
        graphData: {
          nodes: nodes.map((n,i) => ({ id:`a_${i}`, label:n.AccusedName, ...n })),
          summary: `${nodes.length} repeat offenders found${filterDetails}.`,
        },
        answer: `Criminal network analysis complete. Found ${nodes.length} repeat accused${filterDetails}. Top repeat offender: ${nodes[0]?.AccusedName||"N/A"} with ${nodes[0]?.CaseCount||0} linked cases. See the Network tab for the full graph.`,
        resultCount: nodes.length,
      };

    } else {
      // structured_query (default)
      let sql = await llmCall("fast", buildSQLPrompt(dateRange), question, { temperature:0.1, conversationHistory });
      sql = sql.replace(/```[a-z]*/gi,"").replace(/```/g,"").trim();
      const match = sql.match(/SELECT[\s\S]*/i);
      if (match) sql = match[0];
      sql = quoteTables(sql);

      const v = validateSQL(sql);
      if (!v.safe) return res.json({ intent: "structured_query", answer: "Mock mode: Query rejected for safety. " + v.reason, resultCount: 0, generatedQuery:sql });

      const scoped = applyRBAC(sql, userContext);
      let results = [];
      try {
        results = await db.raw(scoped.sql, scoped.params);
      } catch(e) {
        // Fallback mock since DB is not connected on Catalyst
        results = [{ "MockResult": "Database is offline in demo mode." }];
      }

      const isAgg = scoped.sql.toUpperCase().includes("GROUP BY");
      const langHint = lang==="kn" ? "Respond in Kannada language." : "Respond in English.";
      const answer = await llmCall("smart",
        `You are a Karnataka Police crime analyst. ${langHint} Explain the query results to the user in a natural, conversational, and helpful manner like an AI assistant. Break down the findings clearly without sounding like a robotic data readout. Always mention specific numbers.`,
        `Question: "${question}"\nSQL executed: ${scoped.sql}\nResults (${results.length} records): ${JSON.stringify(results.slice(0,15))}`,
        { temperature:0.4, conversationHistory });

      response = { ...response, answer, zcqlQuery:scoped.sql,
        resultCount:results.length, results:results.slice(0,50),
        chartData:isAgg?results:null, isAggregation:isAgg };
    }

    // Audit log (silently fail if DB disconnected)
    try {
      await db("QueryAuditLog").insert({
        UserID: userContext.userId || "anon",
        UserRole: userContext.role || "unknown",
        SessionID: sessionId,
        Question: question.substring(0,500),
        Intent: intent,
        GeneratedQuery: response.zcqlQuery || "",
        ResultCount: response.resultCount || 0,
        LatencyMs: Date.now() - t0,
        Timestamp: new Date().toISOString(),
        Status: "SUCCESS"
      });
    } catch (e) {}

    res.json(response);
  } catch(err) {
    logger.error("[CHAT ERROR] " + err.message, { userId: userContext?.userId });
    res.json({
      intent: "general",
      answer: "The AI Bot received your message: '" + question + "'. (Demo mode: Backend fully connected, but Database/AI is mocked).",
      resultCount: 0
    });
  }
});

module.exports = router;
