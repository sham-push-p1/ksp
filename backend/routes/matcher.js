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
const logger = require("../utils/logger");
const { validateBody, z } = require("../middleware/validate");

const router = express.Router();

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
      // Try to find the case in the DB
      const caseRow = db.prepare("SELECT * FROM CaseSummaryFlat WHERE CrimeNo = ?").get(searchTarget);
      if (caseRow) {
        sourceCase = caseRow;
        // Use the Brief Facts of this case to find similar ones
        searchTarget = caseRow.BriefFacts;
      }
    }

    // Perform vector similarity search
    const { results } = await performRAG(searchTarget, 5); // get top 5

    // If we used a source case, remove it from the results so it doesn't match itself
    let finalResults = results;
    if (sourceCase) {
      finalResults = results.filter(r => r.CaseMasterID !== sourceCase.CaseMasterID).slice(0, 5);
    }

    res.json({
      sourceCase,
      targetQuery: searchTarget,
      matches: finalResults
    });

  } catch (err) {
    logger.error("[MATCHER ERROR]", err.message, { userId: req.user?.userId });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
