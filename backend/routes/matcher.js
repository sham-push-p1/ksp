/**
 * routes/matcher.js — /api/match-cases
 * 
 * Takes a CrimeNo or a description of a crime, embeds it, and finds
 * the most semantically similar historical cases using RAG cosine similarity.
 */

const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { performRAG } = require("../functions/rag");
const { llmCall } = require("../functions/nl-to-zcql/ollama");
const logger = require("../utils/logger");
const { validateBody, z } = require("../middleware/validate");
const { RBAC } = require("../shared/schema");

const router = express.Router();

/**
 * Apply RBAC scope constraints using parameterized binding.
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

  if (cfg.stationScoped) {
    condition = "PoliceStationName = ?";
    params.push(ctx.stationName || "Unknown Station");
  } else if (cfg.districtScoped) {
    condition = "DistrictName = ?";
    params.push(ctx.districtName || "Unknown District");
  }

  return { sql: `${baseSql} ${conn} ${condition} ${tailSql}`, params };
}

const matcherSchema = z.object({
  query: z.string().min(1, "Query or Crime No is required").max(1000, "Query too long")
});

router.post("/match-cases", authenticateToken, validateBody(matcherSchema), async (req, res) => {
  try {
    const { query } = req.body;

    let searchTarget = query.trim();
    let sourceCase = null;

    // Check if the user entered a Crime No (e.g. '0012/2024')
    if (/^\d{4}\/\d{4}$/.test(searchTarget) || /^[A-Za-z0-9/_-]+$/.test(searchTarget) && searchTarget.length < 25) {
      // Allow searching by exact CrimeNo or by similarity of incident description
      let results = [];
      
      const caseRowRes = await db.raw('SELECT * FROM "CaseSummaryFlat" WHERE CrimeNo = ?', [searchTarget]);
      const caseRow = caseRowRes.length > 0 ? caseRowRes[0] : null;

      if (caseRow) {
        sourceCase = caseRow;
        // Use the Brief Facts of this case to find similar ones
        searchTarget = caseRow.BriefFacts;
      }
    }

    // Perform vector similarity search
    const results = await performRAG(db, searchTarget, req.user, applyRBAC, 5); // get top 5

    // If we used a source case, remove it from the results so it doesn't match itself
    let finalResults = results;
    if (sourceCase) {
      finalResults = results.filter(r => r.CaseMasterID !== sourceCase.CaseMasterID).slice(0, 5);
    }

    let investigativeLeads = "";
    if (finalResults.length > 0) {
      const casesText = finalResults.map(m => `CrimeNo: ${m.CrimeNo}\nFacts: ${m.BriefFacts}`).join("\n\n");
      const prompt = `You are a senior Karnataka Police investigator. Analyze the target case/description and the historical similar cases provided.
Generate 3 actionable "Investigative Leads" or common patterns (e.g. modus operandi, locations, potential suspects) based on the similarities.
Keep it concise, bulleted, and professional.

Target: "${searchTarget}"

Historical Matches:
${casesText}`;
      investigativeLeads = await llmCall("smart", prompt, "Generate leads.", { temperature: 0.3 });
    }

    res.json({
      sourceCase,
      targetQuery: searchTarget,
      matches: finalResults,
      investigativeLeads
    });

  } catch (err) {
    logger.error("[MATCHER ERROR] " + err.message, { userId: req.user?.userId });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
