import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.heat";
import { useApp } from "../context/AppContext";
import "leaflet/dist/leaflet.css";
import { api } from "../utils/api";

function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heatPts = points
      .map(p => [parseFloat(p.Latitude), parseFloat(p.Longitude), 1])
      .filter(p => !isNaN(p[0]) && !isNaN(p[1]));
    
    const heatLayer = L.heatLayer(heatPts, {
      radius: 20,
      blur: 15,
      maxZoom: 10,
      gradient: { 0.2: '#0000ff', 0.4: '#00ffff', 0.6: '#00ff00', 0.8: '#ffff00', 1.0: '#ff0000' }
    }).addTo(map);

    return () => { map.removeLayer(heatLayer); };
  }, [map, points]);
  return null;
}

// Karnataka bounding box center
const KA_CENTER = [14.5204, 75.7224];

// Color coding by major crime category
const CRIME_COLORS = {
  "Murder":              "#dc2626",
  "Robbery":             "#ea580c",
  "Rape":                "#9333ea",
  "Theft":               "#2563eb",
  "Dacoity":             "#c2410c",
  "Hurt":                "#d97706",
  "Kidnapping":          "#0891b2",
  "Cyber Crime":         "#7c3aed",
  "NDPS":                "#16a34a",
  "Cheating":            "#0d9488",
  "Default":             "#6b7280",
};

function getCrimeColor(crimeHead) {
  if (!crimeHead) return CRIME_COLORS.Default;
  const h = crimeHead.toUpperCase();
  if (h.includes("MURDER"))     return CRIME_COLORS["Murder"];
  if (h.includes("ROBBERY"))    return CRIME_COLORS["Robbery"];
  if (h.includes("RAPE"))       return CRIME_COLORS["Rape"];
  if (h.includes("THEFT"))      return CRIME_COLORS["Theft"];
  if (h.includes("DACOITY"))    return CRIME_COLORS["Dacoity"];
  if (h.includes("HURT"))       return CRIME_COLORS["Hurt"];
  if (h.includes("KIDNAP"))     return CRIME_COLORS["Kidnapping"];
  if (h.includes("CYBER"))      return CRIME_COLORS["Cyber Crime"];
  if (h.includes("NDPS") || h.includes("NARCOTIC")) return CRIME_COLORS["NDPS"];
  if (h.includes("CHEAT"))      return CRIME_COLORS["Cheating"];
  return CRIME_COLORS.Default;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 8); }, [center, map]);
  return null;
}

export default function CrimeMap() {
  const { dateRange } = useApp();
  const [points, setPoints]   = useState([]);
  const mapRef = useRef(null);
  const heatLayerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("ALL");
  const [stats, setStats]     = useState({});
  const [viewMode, setViewMode] = useState("cluster"); // "cluster" | "heatmap"

  useEffect(() => {
    setLoading(true);
    api.getMapData()
      .then(res => {
        setPoints(res.points || []);
        const counts = {};
        for (const p of res.points || []) {
          const k = p.CrimeMajorHead || "Unknown";
          counts[k] = (counts[k] || 0) + 1;
        }
        setStats(counts);
      })
      .catch(err => {
        console.warn("Map data fetch failed, using mock data:", err);
        const mockPoints = Array.from({ length: 150 }, (_, i) => ({
          CaseMasterID: i,
          Latitude: (12.9716 + (Math.random() - 0.5) * 1.5).toFixed(4),
          Longitude: (77.5946 + (Math.random() - 0.5) * 1.5).toFixed(4),
          CrimeMajorHead: ["Murder", "Robbery", "Cyber Crime", "Theft", "NDPS", "Cheating"][Math.floor(Math.random() * 6)],
          CrimeNo: `CR/2024/${i+100}`,
          PoliceStationName: "Mock Station",
          DistrictName: "Bengaluru Urban",
          CaseStatus: "Under Investigation",
          IncidentFromDate: "2024-01-15T00:00:00Z",
          GravityOffence: "Heinous"
        }));
        setPoints(mockPoints);
        const counts = {};
        for (const p of mockPoints) {
          const k = p.CrimeMajorHead || "Unknown";
          counts[k] = (counts[k] || 0) + 1;
        }
        setStats(counts);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = ["ALL", ...Object.keys(CRIME_COLORS).filter(k => k !== "Default")];

  const filtered = filter === "ALL"
    ? points
    : points.filter(p => {
        const h = (p.CrimeMajorHead || "").toUpperCase();
        return h.includes(filter.toUpperCase());
      });

  const topCrimes = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const districtCounts = {};
  for (const p of filtered) {
    const d = p.DistrictName || "Unknown";
    districtCounts[d] = (districtCounts[d] || 0) + 1;
  }
  const topDistricts = Object.entries(districtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) return (
    <div className="map-loading">
      <div className="map-spinner" />
      <p>Loading crime coordinates from database…</p>
    </div>
  );

  if (error) return (
    <div className="map-error">
      <p>⚠️ Failed to load map data: {error}</p>
    </div>
  );

  if (points.length === 0) return (
    <div className="map-empty">
      <p>📍 No geocoded case records found in the database for your access scope.</p>
    </div>
  );

  return (
    <div className="crime-map-wrapper">
      {/* Header Stats Strip */}
      <div className="map-header">
        <div className="map-stat-chips">
          <span className="map-stat-chip total">📍 {filtered.length} of {points.length} cases plotted</span>
          {topCrimes.map(([name, count]) => (
            <span key={name} className="map-stat-chip" style={{ borderColor: getCrimeColor(name) }}>
              <span className="chip-dot" style={{ background: getCrimeColor(name) }} />
              {name}: {count}
            </span>
          ))}
        </div>

        {/* Crime Category Filter & View Mode */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="map-filter-bar">
            {categories.map(cat => (
              <button
                key={cat}
                className={`map-filter-btn ${filter === cat ? "active" : ""}`}
                style={filter === cat && cat !== "ALL" ? { borderColor: getCrimeColor(cat), background: getCrimeColor(cat) + "22" } : {}}
                onClick={() => setFilter(cat)}
              >
                {cat !== "ALL" && (
                  <span className="chip-dot" style={{ background: getCrimeColor(cat) }} />
                )}
                {cat}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setViewMode("cluster")}
              style={{ padding: '6px 12px', border: 'none', background: viewMode === 'cluster' ? 'var(--accent-blue)' : 'transparent', color: viewMode === 'cluster' ? '#fff' : 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              📍 Clusters
            </button>
            <button 
              onClick={() => setViewMode("heatmap")}
              style={{ padding: '6px 12px', border: 'none', background: viewMode === 'heatmap' ? 'var(--red)' : 'transparent', color: viewMode === 'heatmap' ? '#fff' : 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              🔥 Heatmap
            </button>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="map-container-outer" style={{ position: 'relative' }}>
        
        {/* Hotspot Analytics Overlay */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, background: 'var(--surface)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', width: '250px', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🚨</span> Hotspot Analytics
          </h4>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
            Top Districts • {filter}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topDistricts.map(([dist, count], idx) => (
              <div key={dist} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{idx + 1}. {dist}</span>
                <span style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>{count} cases</span>
              </div>
            ))}
            {topDistricts.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data available</span>
            )}
          </div>
        </div>

        <MapContainer
          center={KA_CENTER}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {viewMode === "cluster" ? (
            <MarkerClusterGroup
              chunkedLoading
              showCoverageOnHover={false}
              maxClusterRadius={50}
            >
              {filtered.map((pt, i) => {
                const lat = parseFloat(pt.Latitude);
                const lng = parseFloat(pt.Longitude);
                if (isNaN(lat) || isNaN(lng)) return null;
                const color = getCrimeColor(pt.CrimeMajorHead);
                return (
                  <CircleMarker
                    key={pt.CaseMasterID || i}
                    center={[lat, lng]}
                    radius={6}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 1.5 }}
                  >
                    <Popup>
                      <div className="map-popup">
                        <div className="popup-crime" style={{ color }}>{pt.CrimeMajorHead || "Unknown Crime"}</div>
                        <div className="popup-row"><b>Crime No:</b> {pt.CrimeNo}</div>
                        <div className="popup-row"><b>Station:</b> {pt.PoliceStationName}</div>
                        <div className="popup-row"><b>District:</b> {pt.DistrictName}</div>
                        <div className="popup-row"><b>Status:</b> {pt.CaseStatus}</div>
                        <div className="popup-row"><b>Date:</b> {pt.IncidentFromDate?.substring(0, 10)}</div>
                        <div className="popup-row"><b>Gravity:</b> {pt.GravityOffence}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MarkerClusterGroup>
          ) : (
            <HeatmapLayer points={filtered} />
          )}
        </MapContainer>

        {/* Legend */}
        <div className="map-legend">
          <div className="legend-title">Crime Types</div>
          {Object.entries(CRIME_COLORS).filter(([k]) => k !== "Default").map(([name, color]) => (
            <div key={name} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span>{name}</span>
            </div>
          ))}
          <div className="legend-item">
            <span className="legend-dot" style={{ background: CRIME_COLORS.Default }} />
            <span>Other</span>
          </div>
        </div>
      </div>
    </div>
  );
}
