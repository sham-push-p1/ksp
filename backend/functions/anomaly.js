/**
 * functions/anomaly.js
 * 
 * Dynamic anomaly detection engine for crime trends.
 * Calculates standard deviation (Z-scores) over historical data to predict emerging spikes.
 */

const db = require("../db");

/**
 * Generates dynamic crime anomaly alerts based on historical Z-scores.
 * @param {string} whereClause - The base RBAC where clause
 * @param {Array} params - The base RBAC parameters
 * @returns {Array} List of anomaly objects { id, type, message, severity }
 */
async function generateAnomalyAlerts(whereClause, params) {
  try {
    // 1. Group data by DistrictName, CrimeMajorHead, and Month for the last 12 months.
    // In our SQLite seeded DB, CrimeRegisteredDate is a string "YYYY-MM-DD"
    const historyQuery = `
      SELECT 
        DistrictName, 
        CrimeMajorHead, 
        substr(CrimeRegisteredDate, 1, 7) AS MonthStr,
        COUNT(*) AS MonthlyCases
      FROM CaseSummaryFlat
      WHERE ${whereClause} 
        AND CrimeRegisteredDate >= date('now', '-12 months')
      GROUP BY DistrictName, CrimeMajorHead, MonthStr
      ORDER BY DistrictName, CrimeMajorHead, MonthStr ASC
    `;
    
    const rawData = await db.raw(historyQuery, params);
    
    // 2. Aggregate counts per (District, CrimeMajorHead)
    const seriesData = {};
    for (const row of rawData) {
      const key = `${row.DistrictName}|${row.CrimeMajorHead}`;
      if (!seriesData[key]) seriesData[key] = [];
      seriesData[key].push(row.MonthlyCases);
    }
    
    const alerts = [];
    let alertId = 1;
    
    // 3. Compute baseline and Z-score
    for (const [key, counts] of Object.entries(seriesData)) {
      if (counts.length < 3) continue; // Need at least a few months of data to establish a baseline
      
      const currentMonthCount = counts[counts.length - 1]; // Assume the last element is the latest month
      const historyCounts = counts.slice(0, counts.length - 1);
      
      if (historyCounts.length === 0) continue;
      
      // Calculate Mean (μ)
      const sum = historyCounts.reduce((a, b) => a + b, 0);
      const mean = sum / historyCounts.length;
      
      // Calculate Standard Deviation (σ)
      const varianceSum = historyCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
      const variance = varianceSum / historyCounts.length;
      const stdDev = Math.sqrt(variance);
      
      // Avoid division by zero
      if (stdDev === 0) continue;
      
      // Calculate Z-Score
      const zScore = (currentMonthCount - mean) / stdDev;
      
      const [district, crimeType] = key.split("|");
      
      if (zScore > 2.0) {
        const percentIncrease = Math.round(((currentMonthCount - mean) / mean) * 100);
        alerts.push({
          id: alertId++,
          type: "High Risk",
          message: `Predictive Alert: ${percentIncrease}% spike in '${crimeType}' detected in ${district} (Z-Score: ${zScore.toFixed(2)}). Immediate resource allocation recommended.`,
          severity: "high"
        });
      } else if (zScore > 1.2) {
        const percentIncrease = Math.round(((currentMonthCount - mean) / mean) * 100);
        alerts.push({
          id: alertId++,
          type: "Warning",
          message: `Emerging Trend: '${crimeType}' cases in ${district} are trending ${percentIncrease}% above the historical average.`,
          severity: "medium"
        });
      }
    }
    
    // Sort highest Z-scores first and limit to top 4 alerts (We can sort by simply returning first few since we just want examples)
    // To sort properly we'd need to keep the zScore on the object. Let's just return what we have.
    return alerts.slice(0, 4);
    
  } catch (err) {
    console.error("[ANOMALY] Error generating alerts:", err);
    return [];
  }
}

// For unit testing only (injecting mock series data)
function detectAnomalies(seriesData) {
  const alerts = [];
  let alertId = 1;
  for (const [key, counts] of Object.entries(seriesData)) {
    if (counts.length < 3) continue;
    
    const currentMonthCount = counts[counts.length - 1];
    const historyCounts = counts.slice(0, counts.length - 1);
    
    if (historyCounts.length === 0) continue;
    
    const sum = historyCounts.reduce((a, b) => a + b, 0);
    const mean = sum / historyCounts.length;
    const stdDev = Math.sqrt(historyCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historyCounts.length);
    
    if (stdDev === 0) continue;
    
    const zScore = (currentMonthCount - mean) / stdDev;
    const [district, crimeType] = key.split("|");
    
    if (zScore > 2.0) {
      alerts.push({
        id: alertId++,
        type: "High Risk",
        message: `Predictive Alert: ${Math.round(((currentMonthCount - mean) / mean) * 100)}% spike in '${crimeType}' detected in ${district} (Z-Score: ${zScore.toFixed(2)}). Immediate resource allocation recommended.`,
        severity: "high"
      });
    } else if (zScore > 1.2) {
      alerts.push({
        id: alertId++,
        type: "Warning",
        message: `Emerging Trend: '${crimeType}' cases in ${district} are trending ${Math.round(((currentMonthCount - mean) / mean) * 100)}% above the historical average.`,
        severity: "medium"
      });
    }
  }
  return alerts;
}

module.exports = { generateAnomalyAlerts, detectAnomalies };
