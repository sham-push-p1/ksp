import React, { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

// Stable ordered list of column keys to try for chart labels and values.
// Using a priority list is far safer than Object.values(r)[0] which depends on
// non-guaranteed column insertion order.
const LABEL_KEYS  = ["CrimeMinorHead","CrimeMajorHead","DistrictName","PoliceStationName","Month","Gender","AgeGroup","Occupation","TimeOfDay","AccusedName"];
const VALUE_KEYS  = ["CaseCount","TotalCases","TotalMurders","Count","MonthlyCases","Cases"];

function extractLabel(row) {
  for (const k of LABEL_KEYS) if (row[k] != null) return String(row[k]);
  // fallback: first string-valued column
  const strCol = Object.entries(row).find(([,v]) => typeof v === "string");
  return strCol ? strCol[1] : "?";
}

function extractValue(row) {
  for (const k of VALUE_KEYS) if (typeof row[k] === "number") return row[k];
  // fallback: first numeric-valued column
  const numCol = Object.entries(row).find(([,v]) => typeof v === "number");
  return numCol ? numCol[1] : 0;
}

export default function ChartPanel() {
  const { lastResponse: response } = useApp();
  const barRef  = useRef(null); const lineRef  = useRef(null);
  const barChart = useRef(null); const lineChart = useRef(null);

  useEffect(() => {
    if (!window.Chart) return;

    const breakdown = response?.crimeBreakdown || response?.chartData;
    if (breakdown?.length && barRef.current) {
      barChart.current?.destroy();
      const labels = breakdown.slice(0, 15).map(extractLabel);
      const values = breakdown.slice(0, 15).map(extractValue);
      barChart.current = new window.Chart(barRef.current, {
        type: "bar",
        data: { labels, datasets: [{ label: "Case Count", data: values, backgroundColor: "rgba(230,57,70,0.8)", borderColor: "#e63946", borderWidth: 1 }] },
        options: { responsive: true, plugins: { title: { display: true, text: "Crime Distribution", font: { size: 14 } }, legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 45 } } } },
      });
    }

    const monthly = response?.monthlyData;
    if (monthly?.length && lineRef.current) {
      lineChart.current?.destroy();
      const monthMap = {};
      monthly.forEach(r => {
        const m = r.Month || (r.CrimeRegisteredDate || "").substring(0, 7);
        if (m) monthMap[m] = (monthMap[m] || 0) + extractValue(r);
      });
      const sortedMonths = Object.keys(monthMap).sort();
      lineChart.current = new window.Chart(lineRef.current, {
        type: "line",
        data: { labels: sortedMonths, datasets: [{ label: "Monthly Cases", data: sortedMonths.map(m => monthMap[m]), borderColor: "#1a1a2e", backgroundColor: "rgba(26,26,46,0.1)", fill: true, tension: 0.4, pointRadius: 3 }] },
        options: { responsive: true, plugins: { title: { display: true, text: "Monthly Crime Trend", font: { size: 14 } } }, scales: { y: { beginAtZero: true } } },
      });
    }

    return () => { barChart.current?.destroy(); lineChart.current?.destroy(); };
  }, [response]);

  const hasData = response?.crimeBreakdown?.length || response?.chartData?.length || response?.monthlyData?.length;
  if (!hasData) return (
    <div className="empty-panel">
      <span className="empty-icon">📊</span><p>Ask about crime trends to see charts here.</p>
      <div className="sample-queries"><p>Try:</p><ul>
        <li>"Show crime trend for last 6 months"</li>
        <li>"District-wise crime breakdown"</li>
        <li>"Which crime type is most common?"</li>
      </ul></div>
    </div>
  );

  return (
    <div className="chart-panel">
      <div className="panel-header"><h3>Crime Analytics</h3></div>
      {(response?.crimeBreakdown?.length || response?.chartData?.length) && <div className="chart-container"><canvas ref={barRef}/></div>}
      {response?.monthlyData?.length > 0 && <div className="chart-container"><canvas ref={lineRef}/></div>}
      {response?.crimeBreakdown && (
        <div className="hotspot-section">
          <h4>Hotspots by District</h4>
          <div className="hotspot-grid">
            {Object.entries(response.crimeBreakdown.reduce((acc, r) => { if (r.DistrictName) { acc[r.DistrictName] = (acc[r.DistrictName] || 0) + (r.CaseCount || 0); } return acc; }, {}))
              .sort((a, b) => b[1] - a[1]).slice(0, 10)
              .map(([dist, cnt], i) => {
                const max = Math.max(...Object.values(response.crimeBreakdown.reduce((a, r) => { if (r.DistrictName) a[r.DistrictName] = (a[r.DistrictName] || 0) + (r.CaseCount || 0); return a; }, {})));
                const pct = Math.min(100, (cnt / (max || 1)) * 100);
                return (<div key={i} className="hotspot-row">
                  <span className="district-name">{dist}</span>
                  <div className="hotspot-bar-bg"><div className="hotspot-bar-fill" style={{ width: `${pct}%`, background: pct > 70 ? "#e63946" : pct > 40 ? "#f4a261" : "#2a9d8f" }}/></div>
                  <span className="hotspot-count">{cnt}</span>
                </div>);
              })}
          </div>
        </div>
      )}
    </div>
  );
}
