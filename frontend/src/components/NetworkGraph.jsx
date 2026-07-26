import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";

export default function NetworkGraph() {
  const { lastResponse: response } = useApp();
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!response?.graphData?.nodes?.length || !containerRef.current) return;

    const { nodes: rawNodes } = response.graphData;

    // Build node dataset
    const nodes = new window.vis.DataSet(rawNodes.map(n => ({
      id:    n.id,
      label: n.label,
      title: `${n.label}\nCases: ${n.CaseCount}\nType: ${n.PrimaryCrimeType}\nDistrict: ${n.PrimaryDistrict}`,
      value: n.CaseCount,
      color: {
        background: n.CaseCount > 3 ? "#ef4444" : n.CaseCount > 1 ? "#f59e0b" : "#3b82f6",
        border: "#0f172a",
        highlight: { background: "#ffffff", border: "#3b82f6" },
        hover: { background: "#ffffff", border: "#ef4444" }
      },
      font:  { size: 12, color: "#1e293b", face: "Inter", strokeWidth: 2, strokeColor: "#ffffff" },
      shape: "dot",
      scaling: { min: 10, max: 30 }
    })));

    // Build edges efficiently using a district+crime group index (O(n) instead of O(n²)).
    // We group nodes by their (PrimaryCrimeType, PrimaryDistrict) key, then link within each
    // group using a hub-and-spoke pattern (first node → all others) to cap edge count.
    const MAX_EDGES = 120;
    const groups = {};
    rawNodes.forEach(n => {
      const key = `${n.PrimaryCrimeType}||${n.PrimaryDistrict}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });

    const edgesArr = [];
    for (const members of Object.values(groups)) {
      if (members.length < 2) continue;
      const hub = members[0];
      for (let i = 1; i < members.length; i++) {
        if (edgesArr.length >= MAX_EDGES) break;
        edgesArr.push({
          id:    `e_${hub.id}_${members[i].id}`,
          from:  hub.id,
          to:    members[i].id,
          color: { color: "#ccc" },
        });
      }
      if (edgesArr.length >= MAX_EDGES) break;
    }

    const edges = new window.vis.DataSet(edgesArr);

    networkRef.current?.destroy();
    networkRef.current = new window.vis.Network(
      containerRef.current,
      { nodes, edges },
      {
        nodes: { borderWidth: 1, shadow: true },
        edges: { smooth: { type: "continuous" }, width: 1 },
        physics: {
          enabled: true,
          solver: "barnesHut",
          barnesHut: { 
            gravitationalConstant: -2000, 
            centralGravity: 0.3, 
            springLength: 95 
          },
        },
        interaction: { hover: true, tooltipDelay: 200 },
      }
    );

    networkRef.current.on("selectNode", params => {
      if (params.nodes.length > 0) {
        const found = rawNodes.find(n => n.id === params.nodes[0]);
        setSelected(found || null);
      }
    });

    networkRef.current.on("deselectNode", () => setSelected(null));

    // Ensure the canvas fully paints before fitting
    setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.fit({ animation: { duration: 800, easingFunction: "easeInOutQuad" } });
      }
    }, 800);

    return () => networkRef.current?.destroy();
  }, [response]);

  if (!response?.graphData?.nodes?.length) return (
    <div className="empty-panel">
      <span className="empty-icon">🕸️</span>
      <p>Ask about criminal networks to see the graph.</p>
      <div className="sample-queries"><p>Try:</p><ul>
        <li>"Which accused have multiple cases?"</li>
        <li>"Show repeat offenders in drug cases"</li>
      </ul></div>
    </div>
  );

  return (
    <div className="network-panel">
      <div className="panel-header">
        <h3>Criminal Network Graph</h3>
        <div className="legend">
          <span className="legend-dot" style={{background:"#e63946"}}/> High risk (3+ cases)
          <span className="legend-dot" style={{background:"#f4a261"}}/> Medium (2 cases)
          <span className="legend-dot" style={{background:"#a8d8ea"}}/> Single case
        </div>
      </div>
      {response.graphData.summary && <div className="graph-summary">{response.graphData.summary}</div>}
      <div ref={containerRef} className="network-canvas"/>
      {selected && (
        <div className="node-detail">
          <h4>{selected.label}</h4>
          <p>Cases: <strong>{selected.CaseCount}</strong></p>
          <p>Crime: <strong>{selected.PrimaryCrimeType}</strong></p>
          <p>District: <strong>{selected.PrimaryDistrict}</strong></p>
        </div>
      )}
    </div>
  );
}
