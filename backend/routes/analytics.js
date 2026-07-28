/**
 * routes/analytics.js — /api/analytics (socio-behavioral factor analysis)
 *                       /api/audit-log   (SCRB admin query log)
 *                       /api/export-pdf  (conversation PDF report)
 */

const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { generateAnomalyAlerts } = require("../functions/anomaly");

const router = express.Router();

// Helper: build date/RBAC filters for analytics queries
function buildFilters(req) {
  const { start, end } = req.query;
  const user = req.user;
  let where = "1=1";
  const params = [];

  if (start) { where += ' AND CAST("IncidentFromDate" AS DATE) >= CAST(? AS DATE)'; params.push(start); }
  if (end)   { where += ' AND CAST("IncidentFromDate" AS DATE) <= CAST(? AS DATE)'; params.push(end); }
  
  if (user.stationName) {
    where += ' AND "PoliceStationName" = ?';
    params.push(user.stationName);
  } else if (user.districtName) {
    where += ' AND "DistrictName" = ?';
    params.push(user.districtName);
  }
  return { where, params };
}

// GET /api/dashboard — High-level KPIs and overview charts
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const { where, params } = buildFilters(req);

    const kpisResult = await db.raw(`
      SELECT 
        COUNT(*) AS "TotalCases",
        SUM(CASE WHEN "CaseStatus" = 'Under Investigation' THEN 1 ELSE 0 END) AS "PendingCases",
        SUM(CASE WHEN "GravityOffence" = 'Heinous' THEN 1 ELSE 0 END) AS "HeinousCrimes"
      FROM "CaseSummaryFlat"
      WHERE ${where}
    `, params);
    const kpis = kpisResult[0] || { TotalCases: 0, PendingCases: 0, HeinousCrimes: 0 };

    const arrestStatsResult = await db.raw(`
      SELECT COUNT(*) AS "TotalArrests"
      FROM "AccusedSummaryFlat"
      WHERE "CaseMasterID" IN (SELECT "CaseMasterID" FROM "CaseSummaryFlat" WHERE ${where})
        AND "ArrestDate" IS NOT NULL AND "ArrestDate" != ''
    `, params);
    kpis.TotalArrests = arrestStatsResult[0]?.TotalArrests || 0;

    const statusBreakdown = await db.raw(`
      SELECT "CaseStatus", COUNT(*) AS "Count"
      FROM "CaseSummaryFlat"
      WHERE ${where}
      GROUP BY "CaseStatus"
      ORDER BY "Count" DESC
    `, params);

    const topCrimes = await db.raw(`
      SELECT "CrimeMajorHead", COUNT(*) AS "Count"
      FROM "CaseSummaryFlat"
      WHERE ${where}
      GROUP BY "CrimeMajorHead"
      ORDER BY "Count" DESC
      LIMIT 5
    `, params);

    // Dynamic predictive anomaly generation
    let anomalyAlerts = await generateAnomalyAlerts(where, params);
    
    // Fallback just in case there is not enough historical data for Z-score calculation
    if (anomalyAlerts.length === 0) {
      anomalyAlerts = [
        { id: 1, type: "Info", message: "Insufficient historical data to generate reliable predictive anomaly models for this region.", severity: "low" }
      ];
    }

    res.json({ kpis, statusBreakdown, topCrimes, anomalyAlerts });
  } catch (err) {
    logger.error("[DASHBOARD ERROR]", err.message, { userId: req.user?.userId });
    res.json({
      kpis: { TotalCases: 0, PendingCases: 0, HeinousCrimes: 0 },
      statusBreakdown: [],
      topCrimes: [],
      anomalyAlerts: [{ id: 1, type: "Info", message: "Database offline in demo mode.", severity: "low" }]
    });
  }
});

// GET /api/analytics — Victim demographics, occupations, MO, temporal patterns
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const { where, params } = buildFilters(req);

    const victimDemographics = await db.raw(`
      SELECT
        CASE
          WHEN "AgeYear" < 18 THEN 'Under 18'
          WHEN "AgeYear" BETWEEN 18 AND 35 THEN '18-35'
          WHEN "AgeYear" BETWEEN 36 AND 60 THEN '36-60'
          ELSE 'Above 60'
        END AS "AgeGroup",
        "Gender",
        COUNT(*) AS "Count"
      FROM "VictimSummaryFlat"
      WHERE "CaseMasterID" IN (SELECT "CaseMasterID" FROM "CaseSummaryFlat" WHERE ${where})
      GROUP BY "AgeGroup", "Gender"
    `, params);

    const complainantOccupations = await db.raw(`
      SELECT "Occupation", COUNT(*) AS "Count"
      FROM "ComplainantSummaryFlat"
      WHERE "CaseMasterID" IN (SELECT "CaseMasterID" FROM "CaseSummaryFlat" WHERE ${where})
      GROUP BY "Occupation"
      ORDER BY "Count" DESC
    `, params);

    const moResult = await db.raw(`
      SELECT
        SUM(CASE WHEN "BriefFacts" LIKE '%sharp weapon%' OR "BriefFacts" LIKE '%knife%' THEN 1 ELSE 0 END) AS "WeaponAttack",
        SUM(CASE WHEN "BriefFacts" LIKE '%broke into%' OR "BriefFacts" LIKE '%lock%' THEN 1 ELSE 0 END) AS "Burglary",
        SUM(CASE WHEN "BriefFacts" LIKE '%highway%' OR "BriefFacts" LIKE '%bus stand%' OR "BriefFacts" LIKE '%main road%' THEN 1 ELSE 0 END) AS "TransitRobbery",
        SUM(CASE WHEN "BriefFacts" LIKE '%cyber%' OR "BriefFacts" LIKE '%online%' OR "BriefFacts" LIKE '%bank%' OR "BriefFacts" LIKE '%forged%' THEN 1 ELSE 0 END) AS "CyberFraud",
        SUM(CASE WHEN "BriefFacts" LIKE '%drug%' OR "BriefFacts" LIKE '%narcotic%' OR "BriefFacts" LIKE '%ganja%' THEN 1 ELSE 0 END) AS "NarcoticsOffence",
        SUM(CASE WHEN "BriefFacts" LIKE '%harassed%' OR "BriefFacts" LIKE '%dowry%' OR "BriefFacts" LIKE '%assaulted%' THEN 1 ELSE 0 END) AS "HarassmentAssault"
      FROM "CaseSummaryFlat"
      WHERE ${where}
    `, params);
    const modusOperandi = moResult[0] || {};

    const isPg = db.client.config.client === 'pg';
    const isMysql = db.client.config.client === 'mysql2';
    
    let extractHour = "CAST(strftime('%H', \"IncidentFromDate\") AS INTEGER)";
    if (isPg) extractHour = 'EXTRACT(HOUR FROM CAST("IncidentFromDate" AS TIMESTAMP))';
    else if (isMysql) extractHour = 'HOUR("IncidentFromDate")';
    
    const temporalPatterns = await db.raw(`
      SELECT 
        CASE 
          WHEN ${extractHour} IN (22, 23, 0, 1, 2, 3) THEN 'Night (22:00 - 04:00)'
          WHEN ${extractHour} IN (4, 5, 6, 7, 8, 9) THEN 'Morning (04:00 - 10:00)'
          WHEN ${extractHour} IN (10, 11, 12, 13, 14, 15) THEN 'Afternoon (10:00 - 16:00)'
          ELSE 'Evening (16:00 - 22:00)'
        END AS "TimeOfDay",
        COUNT(*) AS "Count"
      FROM "CaseSummaryFlat"
      WHERE ${where}
      GROUP BY "TimeOfDay"
    `, params);

    res.json({ victimDemographics, complainantOccupations, modusOperandi, temporalPatterns });
  } catch (err) {
    logger.error("[ANALYTICS ERROR]", err.message, { userId: req.user?.userId });
    res.json({
      victimDemographics: [],
      complainantOccupations: [],
      modusOperandi: {},
      temporalPatterns: []
    });
  }
});

// GET /api/audit-log — SCRB analyst only
router.get("/audit-log", authenticateToken, async (req, res) => {
  if (req.user.role !== "scrb_analyst" && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Access denied. Admin access only." });
  }
  const logs = await db.raw('SELECT * FROM "QueryAuditLog" ORDER BY ID DESC LIMIT 200');
  res.json(logs);
});

// POST /api/export-pdf — Generate HTML report for browser print
router.post("/export-pdf", authenticateToken, (req, res) => {
  const { conversation = [] } = req.body;
  const userContext = req.user;

  const rows = conversation.map((t, i) => `
    <div class="turn">
      <div class="num">Query ${i+1} &mdash; ${t.timestamp||""}</div>
      <div class="q"><b>Q:</b> ${(t.question||"").replace(/</g,"&lt;")}</div>
      <div class="a"><b>A:</b> ${(t.answer||"").replace(/</g,"&lt;")}</div>
      ${t.zcqlQuery ? `<div class="sql"><b>SQL:</b> <code>${t.zcqlQuery.replace(/</g,"&lt;")}</code></div>` : ""}
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#1a1a2e}
    h1{color:#1a1a2e;border-bottom:3px solid #e63946;padding-bottom:8px;margin-bottom:16px}
    .meta{background:#f1f1f1;padding:10px;border-radius:4px;margin-bottom:20px;font-size:11px}
    .turn{border:1px solid #ddd;border-radius:6px;padding:12px;margin:12px 0;page-break-inside:avoid}
    .num{font-size:10px;color:#888;margin-bottom:4px}
    .q{background:#e8f4fd;padding:8px;border-radius:4px;margin-bottom:6px}
    .a{background:#f0f7f0;padding:8px;border-radius:4px;margin-bottom:6px}
    .sql{background:#1a1a2e;color:#a8d8ea;padding:8px;border-radius:4px;font-size:10px}
    code{font-family:monospace}
    .footer{font-size:10px;color:#888;margin-top:30px;border-top:1px solid #ddd;padding-top:10px}
  </style></head><body>
  <h1>&#128662; KSP Crime Intelligence &mdash; Conversation Report</h1>
  <div class="meta">
    <b>Officer:</b> ${userContext.name||userContext.userId||"Unknown"} &nbsp;|&nbsp;
    <b>Role:</b> ${userContext.role||"Unknown"} &nbsp;|&nbsp;
    <b>Generated:</b> ${new Date().toLocaleString("en-IN")} &nbsp;|&nbsp;
    <b>Queries:</b> ${conversation.length}
  </div>
  ${rows}
  <div class="footer">CONFIDENTIAL &mdash; Karnataka State Police | SCRB. Unauthorised disclosure is prohibited.</div>
  </body></html>`;

  res.json({ success: true, html });
});

module.exports = router;
