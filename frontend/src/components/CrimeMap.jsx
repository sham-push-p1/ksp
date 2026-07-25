import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.heat";
import { useApp } from "../context/AppContext";
import "leaflet/dist/leaflet.css";
import { api } from "../utils/api";

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

  useEffect(() => {
    setLoading(true);
    api.getMapData()
      .then(res => {
        setPoints(res.points || []);
        // Compute crime type breakdown
        const counts = {};
        for (const p of res.points || []) {
          const k = p.CrimeMajorHead || "Unknown";
          counts[k] = (counts[k] || 0) + 1;
        }
        setStats(counts);
      })
      .catch(err => setError(err.message))
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

        {/* Crime Category Filter */}
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
      </div>

      {/* Leaflet Map */}
      <div className="map-container-outer">
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
