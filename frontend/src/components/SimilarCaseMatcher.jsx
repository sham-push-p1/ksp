import React, { useState } from "react";
import { api } from "../utils/api";

export default function SimilarCaseMatcher() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.matchCases(query);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-panel">
      <div className="panel-header">
        <h3>AI Modus Operandi (M.O.) Matcher</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
          Enter a Crime Number (e.g. 0012/2024) or describe a crime scene to find historical cases with similar patterns.
        </p>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input 
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Enter Crime No. or description..." 
          style={{ 
            flex: 1, padding: "12px 16px", borderRadius: "8px", 
            border: "1px solid var(--border)", background: "var(--bg)", 
            color: "var(--text)", fontSize: "15px", outline: "none" 
          }}
          disabled={loading}
        />
        <button 
          onClick={handleSearch} 
          disabled={loading || !query.trim()}
          style={{
            padding: "0 24px", borderRadius: "8px", border: "none",
            background: "var(--navy)", color: "white", fontWeight: "600",
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            opacity: loading || !query.trim() ? 0.7 : 1
          }}
        >
          {loading ? "Matching..." : "Find Matches"}
        </button>
      </div>

      {error && <div className="error-message" style={{ color: "#e63946", marginBottom: "16px", padding: "12px", background: "rgba(230,57,70,0.1)", borderRadius: "6px" }}>{error}</div>}

      {result && (
        <div className="matcher-results">
          {result.sourceCase && (
            <div style={{ marginBottom: "24px", padding: "16px", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border)", borderLeft: "4px solid var(--navy)" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--navy)" }}>Target Case: {result.sourceCase.CrimeNo}</h4>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                {result.sourceCase.PoliceStationName} • {result.sourceCase.CrimeMajorHead} • {result.sourceCase.IncidentFromDate?.substring(0, 10)}
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{result.sourceCase.BriefFacts}</p>
            </div>
          )}

          {!result.sourceCase && (
            <div style={{ marginBottom: "24px", padding: "16px", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--navy)" }}>Target Description</h4>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5", fontStyle: "italic" }}>"{result.targetQuery}"</p>
            </div>
          )}

          {result.investigativeLeads && (
            <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(42,157,143,0.05)", borderRadius: "8px", border: "1px solid rgba(42,157,143,0.3)" }}>
              <h4 style={{ margin: "0 0 12px 0", color: "#2a9d8f", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🧠</span> AI Investigative Leads
              </h4>
              <div style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                {result.investigativeLeads}
              </div>
            </div>
          )}

          <h4 style={{ margin: "0 0 16px 0" }}>Top Semantic Matches</h4>
          
          {result.matches.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No similar cases found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {result.matches.map((match, i) => (
                <div key={match.CaseMasterID || i} style={{ padding: "16px", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border)", position: "relative" }}>
                  {match.similarity !== undefined && (
                    <div style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(42,157,143,0.1)", color: "#2a9d8f", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                      Match {(match.similarity * 100).toFixed(1)}%
                    </div>
                  )}
                  <h5 style={{ margin: "0 0 8px 0", fontSize: "15px" }}>{match.CrimeNo}</h5>
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", flexWrap: "wrap" }}>
                    <span>📍 {match.PoliceStationName}, {match.DistrictName}</span>
                    <span>🏷️ {match.CrimeMajorHead}</span>
                    <span>📅 {match.IncidentFromDate?.substring(0, 10) || "Unknown date"}</span>
                    <span>⚖️ {match.CaseStatus}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{match.BriefFacts}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
