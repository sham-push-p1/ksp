import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../utils/api";

export default function FactorAnalysis() {
  const { dateRange } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subTab, setSubTab] = useState("social"); // "social" or "behavioural"

  const victimChartRef = useRef(null);
  const moChartRef = useRef(null);
  const temporalChartRef = useRef(null);

  const victimChart = useRef(null);
  const moChart = useRef(null);
  const temporalChart = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await api.getAnalytics();
        if (active) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    fetchAnalytics();
    return () => { active = false; };
  }, []);

  // --- 1. Victim Demographics Grouped Bar Chart (Social tab) ---
  useEffect(() => {
    if (!data || loading || subTab !== "social" || !victimChartRef.current || !window.Chart) return;
    victimChart.current?.destroy();
    const ageGroups = ["Under 18", "18-35", "36-60", "Above 60"];
    const maleData   = ageGroups.map(age => { const f = data.victimDemographics.find(d => d.AgeGroup === age && d.Gender === "Male");   return f ? f.Count : 0; });
    const femaleData = ageGroups.map(age => { const f = data.victimDemographics.find(d => d.AgeGroup === age && d.Gender === "Female"); return f ? f.Count : 0; });
    victimChart.current = new window.Chart(victimChartRef.current, {
      type: "bar",
      data: {
        labels: ageGroups,
        datasets: [
          { label: "Male",   data: maleData,   backgroundColor: "rgba(42,157,143,0.8)",  borderColor: "#2a9d8f", borderWidth: 1.5, borderRadius: 4 },
          { label: "Female", data: femaleData, backgroundColor: "rgba(230,57,70,0.8)",   borderColor: "#e63946", borderWidth: 1.5, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title:  { display: true, text: "Victim Profile by Age & Gender", font: { size: 14, weight: "bold" } },
          legend: { position: "top" },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Number of Victims" } } },
      },
    });
    return () => { victimChart.current?.destroy(); victimChart.current = null; };
  }, [data, loading, subTab]);

  // --- 2. Modus Operandi Doughnut Chart (Behavioural tab) ---
  useEffect(() => {
    if (!data || loading || subTab !== "behavioural" || !moChartRef.current || !window.Chart) return;
    moChart.current?.destroy();
    const mo = data.modusOperandi || {};
    moChart.current = new window.Chart(moChartRef.current, {
      type: "doughnut",
      data: {
        labels: ["Weapon Attack", "Burglary / Break-in", "Transit Robbery", "Financial / Cyber Fraud", "Narcotics Offence", "Harassment / Assault"],
        datasets: [{
          data: [mo.WeaponAttack||0, mo.Burglary||0, mo.TransitRobbery||0, mo.CyberFraud||0, mo.NarcoticsOffence||0, mo.HarassmentAssault||0],
          backgroundColor: [
            "rgba(230,57,70,0.85)", "rgba(244,162,97,0.85)", "rgba(42,157,143,0.85)",
            "rgba(22,33,62,0.85)",  "rgba(142,68,173,0.85)", "rgba(52,152,219,0.85)",
          ],
          borderColor: "#ffffff",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          title:  { display: true, text: "Modus Operandi Frequency Breakdown", font: { size: 14, weight: "bold" } },
          legend: { position: "right" },
        },
        cutout: "60%",
      },
    });
    return () => { moChart.current?.destroy(); moChart.current = null; };
  }, [data, loading, subTab]);

  // --- 3. Temporal time-of-day Line Chart (Behavioural tab) ---
  useEffect(() => {
    if (!data || loading || subTab !== "behavioural" || !temporalChartRef.current || !window.Chart) return;
    temporalChart.current?.destroy();
    const timeSlots = ["Morning (04:00 - 10:00)", "Afternoon (10:00 - 16:00)", "Evening (16:00 - 22:00)", "Night (22:00 - 04:00)"];
    const counts = timeSlots.map(slot => { const f = data.temporalPatterns.find(t => t.TimeOfDay === slot); return f ? f.Count : 0; });
    temporalChart.current = new window.Chart(temporalChartRef.current, {
      type: "line",
      data: {
        labels: ["Morning", "Afternoon", "Evening", "Night"],
        datasets: [{
          label: "Incident Frequency",
          data: counts,
          borderColor: "#1a1a2e",
          backgroundColor: "rgba(26,26,46,0.08)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#e63946",
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          title:  { display: true, text: "Crime Distribution by Time of Day", font: { size: 14, weight: "bold" } },
          legend: { display: false },
        },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => { temporalChart.current?.destroy(); temporalChart.current = null; };
  }, [data, loading, subTab]);

  if (loading) return (
    <div className="empty-panel">
      <div className="bubble loading-bubble"><span className="dot"/><span className="dot"/><span className="dot"/></div>
      <p>Compiling Crime Factor Analysis...</p>
    </div>
  );

  if (error) return (
    <div className="empty-panel">
      <span className="empty-icon">❌</span>
      <p>Failed to load analytics: {error}</p>
    </div>
  );

  const totalComplainants = data?.complainantOccupations.reduce((acc, c) => acc + c.Count, 0) || 1;

  // Calculate high-impact metrics
  const mo = data?.modusOperandi || {};
  const entries = [
    { label: "Weapon Attack", count: mo.WeaponAttack || 0 },
    { label: "Burglary / Break-in", count: mo.Burglary || 0 },
    { label: "Transit Robbery", count: mo.TransitRobbery || 0 },
    { label: "Financial / Cyber Fraud", count: mo.CyberFraud || 0 },
    { label: "Narcotics Offence", count: mo.NarcoticsOffence || 0 },
    { label: "Harassment / Assault", count: mo.HarassmentAssault || 0 }
  ];
  entries.sort((a, b) => b.count - a.count);
  const primaryMO = entries[0]?.label || "N/A";

  const tempPatterns = data?.temporalPatterns ? [...data.temporalPatterns] : [];
  tempPatterns.sort((a, b) => b.Count - a.Count);
  const peakTimeRaw = tempPatterns[0]?.TimeOfDay || "N/A";
  const peakTime = peakTimeRaw.split(" ")[0] || "N/A";

  const occup = data?.complainantOccupations ? [...data.complainantOccupations] : [];
  occup.sort((a, b) => b.Count - a.Count);
  const topOccupation = occup[0]?.Occupation || "N/A";

  return (
    <div className="factor-panel">
      <div className="panel-header">
        <h3>Crime Factor Analysis</h3>
        <div className="sub-tab-nav">
          <button className={`sub-tab-btn ${subTab === "social" ? "active" : ""}`} onClick={() => setSubTab("social")}>
            👥 Social Risk Factors
          </button>
          <button className={`sub-tab-btn ${subTab === "behavioural" ? "active" : ""}`} onClick={() => setSubTab("behavioural")}>
            🧠 Behavioural Analysis
          </button>
        </div>
      </div>

      <div className="metric-highlight-grid">
        <div className="metric-card">
          <span className="metric-icon">🎯</span>
          <div className="metric-info">
            <span className="metric-label">Primary Modus Operandi</span>
            <span className="metric-value">{primaryMO}</span>
            <span className="metric-subtext">Most frequent criminal setting</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon">⏰</span>
          <div className="metric-info">
            <span className="metric-label">Peak Incident Window</span>
            <span className="metric-value">{peakTime}</span>
            <span className="metric-subtext">Highest crime density hour</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon">👤</span>
          <div className="metric-info">
            <span className="metric-label">Primary Reporter Profile</span>
            <span className="metric-value">{topOccupation}</span>
            <span className="metric-subtext">Dominant complaining class</span>
          </div>
        </div>
      </div>

      <div className="analytics-body">
        {subTab === "social" && (
          <div className="social-risk-view">
            <div className="insights-box">
              <h4>Social Risk Summary</h4>
              <p>
                Social risk analysis profiles victim vulnerability and complainant socio-economic demographics. 
                This intelligence aids in targeting community policing efforts and designing victim support initiatives.
              </p>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <canvas ref={victimChartRef} />
              </div>

              <div className="chart-card list-card">
                <h4>Complainant Occupational Risk Profile</h4>
                <p className="card-subtitle">Distribution of complaints filed by socio-economic class</p>
                <div className="occupation-list">
                  {data.complainantOccupations.slice(0, 7).map((occ, i) => {
                    const percentage = ((occ.Count / totalComplainants) * 100).toFixed(1);
                    return (
                      <div key={i} className="occupation-row">
                        <span className="occ-name">{occ.Occupation}</span>
                        <div className="occ-bar-bg">
                          <div className="occ-bar-fill" style={{ width: `${percentage}%`, background: "var(--navy)" }} />
                        </div>
                        <span className="occ-count">{occ.Count} ({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === "behavioural" && (
          <div className="behavioural-view">
            <div className="insights-box">
              <h4>Offender Behaviour & Modus Operandi Insights</h4>
              <p>
                Modus Operandi (MO) and temporal pattern analysis examines the offender's behavioral choices—methods 
                of entry, weapons used, and timing of attacks. This analysis aids in prediction, patrol scheduling, and investigator briefing.
              </p>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <canvas ref={moChartRef} />
              </div>

              <div className="chart-card">
                <canvas ref={temporalChartRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
