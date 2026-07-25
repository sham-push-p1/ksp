import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import styles from "./ResultsPanel.module.css";

const PAGE_SIZE = 50;

export default function ResultsPanel() {
  const { lastResponse: response } = useApp();
  const [filter,  setFilter]  = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page,    setPage]    = useState(1);

  if (!response?.results?.length) return (
    <div className="empty-panel"><span className="empty-icon">📋</span><p>Ask a structured query to see data here.</p></div>
  );

  const columns = Object.keys(response.results[0]);

  // Filter
  let data = [...response.results];
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(f)));
  }

  // Sort
  if (sortCol) {
    data.sort((a, b) => {
      const c = String(a[sortCol]).localeCompare(String(b[sortCol]), undefined, { numeric: true });
      return sortDir === "asc" ? c : -c;
    });
  }

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageData    = data.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const handleFilter = e => { setFilter(e.target.value); setPage(1); };

  const exportCSV = () => {
    const hdr  = columns.join(",");
    const rows = data.map(r => columns.map(c => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ksp_results_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Results <span className={styles.countBadge}>{data.length} records</span></h3>
        <div className={styles.actions}>
          <input placeholder="Filter..." value={filter} onChange={handleFilter} className={styles.filterInput}/>
          <button className="btn-sm" onClick={exportCSV}>⬇ CSV</button>
        </div>
      </div>

      {response.zcqlQuery && <div className="zcql-strip"><code>{response.zcqlQuery}</code></div>}

      <div className={styles.tableWrapper}>
        <table className="results-table">
          <thead><tr>{columns.map(col => (
            <th key={col} onClick={() => handleSort(col)} className="sortable">
              {col}{sortCol === col && (sortDir === "asc" ? " ↑" : " ↓")}
            </th>
          ))}</tr></thead>
          <tbody>{pageData.map((row, i) => (
            <tr key={i}>{columns.map(col => (
              <td key={col} title={String(row[col] || "")}>
                {col === "CaseStatus"
                  ? <span className={`status-badge status-${(row[col] || "").replace(/\s+/g, "-").toLowerCase()}`}>{row[col]}</span>
                  : col === "GravityOffence"
                  ? <span className={row[col] === "Heinous" ? "heinous" : "non-heinous"}>{row[col]}</span>
                  : String(row[col] || "")}
              </td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage(1)}       disabled={safePage === 1}>«</button>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
          <span className={styles.pageInfo}>Page {safePage} of {totalPages} · {data.length} records</span>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          <button className={styles.pageBtn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
        </div>
      )}
    </div>
  );
}
