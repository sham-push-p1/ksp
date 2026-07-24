import React, { useState } from "react";
export default function ResultsPanel({ response }) {
  const [filter, setFilter] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  if (!response?.results?.length) return (
    <div className="empty-panel"><span className="empty-icon">📋</span><p>Ask a structured query to see data here.</p></div>
  );
  const columns = Object.keys(response.results[0]);
  let data = [...response.results];
  if (filter) { const f=filter.toLowerCase(); data=data.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(f))); }
  if (sortCol) { data.sort((a,b)=>{ const c=String(a[sortCol]).localeCompare(String(b[sortCol]),undefined,{numeric:true}); return sortDir==="asc"?c:-c; }); }
  const handleSort = col => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} };
  const exportCSV = () => {
    const hdr=columns.join(",");
    const rows=data.map(r=>columns.map(c=>`"${String(r[c]||"").replace(/"/g,'""')}"`).join(","));
    const blob=new Blob([[hdr,...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`ksp_results_${Date.now()}.csv`; a.click();
  };
  return (
    <div className="results-panel">
      <div className="panel-header">
        <h3>Results <span className="count-badge">{data.length} records</span></h3>
        <div className="panel-actions">
          <input placeholder="Filter..." value={filter} onChange={e=>setFilter(e.target.value)} className="filter-input"/>
          <button className="btn-sm" onClick={exportCSV}>⬇ CSV</button>
        </div>
      </div>
      {response.zcqlQuery && <div className="zcql-strip"><code>{response.zcqlQuery}</code></div>}
      <div className="table-wrapper">
        <table className="results-table">
          <thead><tr>{columns.map(col=>(
            <th key={col} onClick={()=>handleSort(col)} className="sortable">
              {col}{sortCol===col&&(sortDir==="asc"?" ↑":" ↓")}
            </th>))}</tr>
          </thead>
          <tbody>{data.slice(0,100).map((row,i)=>(
            <tr key={i}>{columns.map(col=>(
              <td key={col} title={String(row[col]||"")}>
                {col==="CaseStatus"
                  ? <span className={`status-badge status-${(row[col]||"").replace(/\s+/g,"-").toLowerCase()}`}>{row[col]}</span>
                  : col==="GravityOffence"
                  ? <span className={row[col]==="Heinous"?"heinous":"non-heinous"}>{row[col]}</span>
                  : String(row[col]||"")}
              </td>))}</tr>))}</tbody>
        </table>
      </div>
      {data.length>100&&<p className="truncation-note">Showing 100 of {data.length}. Export CSV for all.</p>}
    </div>
  );
}
