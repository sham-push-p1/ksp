import React, { useEffect, useRef, useState } from "react";
export default function NetworkGraph({ response }) {
  const containerRef = useRef(null); const networkRef = useRef(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!response?.graphData?.nodes?.length || !containerRef.current || !window.vis) return;
    const { nodes: rawNodes } = response.graphData;
    const nodes = new window.vis.DataSet(rawNodes.map(n=>({
      id:n.id, label:n.label,
      title:`${n.label}\nCases: ${n.CaseCount}\nType: ${n.PrimaryCrimeType}\nDistrict: ${n.PrimaryDistrict}`,
      value:n.CaseCount,
      color:{ background:n.CaseCount>3?"#e63946":n.CaseCount>1?"#f4a261":"#a8d8ea", border:"#1a1a2e" },
      font:{size:11,color:"#1a1a2e"}, shape:"dot",
    })));
    const edgesArr = [];
    rawNodes.forEach((n,i)=>rawNodes.forEach((m,j)=>{ if(i<j&&n.PrimaryCrimeType===m.PrimaryCrimeType&&n.PrimaryDistrict===m.PrimaryDistrict) edgesArr.push({id:`e_${i}_${j}`,from:n.id,to:m.id,color:{color:"#ccc"},font:{size:9,color:"#888"}}); }));
    const edges = new window.vis.DataSet(edgesArr.slice(0,100));
    networkRef.current?.destroy();
    networkRef.current = new window.vis.Network(containerRef.current, {nodes,edges}, {
      nodes:{borderWidth:1,shadow:true}, edges:{smooth:{type:"continuous"},width:1},
      physics:{enabled:true,stabilization:{iterations:100},barnesHut:{gravitationalConstant:-3000,springLength:80}},
      interaction:{hover:true,tooltipDelay:200},
    });
    networkRef.current.on("selectNode", params => {
      console.log("selectNode:", params);
      if (params.nodes.length > 0) {
        const found = rawNodes.find(n => n.id === params.nodes[0]);
        console.log("Found selected node:", found);
        setSelected(found || null);
      }
    });
    networkRef.current.on("deselectNode", () => {
      console.log("deselectNode");
      setSelected(null);
    });
    return () => networkRef.current?.destroy();
  }, [response]);

  if (!response?.graphData?.nodes?.length) return (
    <div className="empty-panel">
      <span className="empty-icon">🕸️</span><p>Ask about criminal networks to see the graph.</p>
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
