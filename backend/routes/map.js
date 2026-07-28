/**
 * routes/map.js — /api/map-data: returns geolocated crime points for the
 *                 Leaflet heatmap, filtered by RBAC scope.
 *
 * Karnataka bounding box: lat 11.5–18.5, lng 74.0–78.5
 */

const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");

// Karnataka geographic bounds (named constants — avoids magic numbers)
const KA_LAT = { min: 11.5, max: 18.5 };
const KA_LNG = { min: 74.0, max: 78.5 };

const router = express.Router();

// GET /api/map-data
router.get("/map-data", authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    const { start, end } = req.query;

    let query = `
      SELECT
        "CaseMasterID", "CrimeNo", "Latitude", "Longitude",
        "CrimeMajorHead", "CaseStatus", "PoliceStationName", "DistrictName",
        "IncidentFromDate", "CaseCategoryName", "GravityOffence"
      FROM "CaseSummaryFlat"
      WHERE "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
        AND "Latitude" != 0 AND "Longitude" != 0
        AND "Latitude" BETWEEN ? AND ?
        AND "Longitude" BETWEEN ? AND ?
    `;
    const params = [KA_LAT.min, KA_LAT.max, KA_LNG.min, KA_LNG.max];

    if (start) { query += ' AND CAST("IncidentFromDate" AS DATE) >= CAST(? AS DATE)'; params.push(start); }
    if (end)   { query += ' AND CAST("IncidentFromDate" AS DATE) <= CAST(? AS DATE)'; params.push(end); }

    if (user.stationName) {
      query += ' AND "PoliceStationName" = ?';
      params.push(user.stationName);
    } else if (user.districtName) {
      query += ' AND "DistrictName" = ?';
      params.push(user.districtName);
    }

    query += " LIMIT 2000";

    const points = await db.raw(query, params);
    res.json({ points, total: points.length });
  } catch (err) {
    logger.error("[MAP DATA ERROR]", err.message, { userId: req.user?.userId });
    res.json({ points: [], total: 0 });
  }
});

module.exports = router;
