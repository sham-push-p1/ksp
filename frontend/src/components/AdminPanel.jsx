import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../utils/api";
import { useToast } from "./Toast";
import { useApp } from "../context/AppContext";
import styles from "./AdminPanel.module.css";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(5, "Password must be at least 5 characters").max(100),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  role: z.string(),
  districtName: z.string().optional(),
  stationName: z.string().optional(),
});

export default function AdminPanel() {
  const { user } = useApp();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [addingKb, setAddingKb] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", password: "", name: "", role: "OFFICER", districtName: "", stationName: "" }
  });

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
    fetchKnowledgeDocs();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err) {
      toast.error("Failed to load users", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logs = await api.getAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      toast.error("Failed to load audit logs", err.message);
    }
  };

  const fetchKnowledgeDocs = async () => {
    try {
      const res = await api.getKnowledgeBase();
      setKnowledgeDocs(res.docs || []);
    } catch (err) {
      toast.error("Failed to load knowledge base", err.message);
    }
  };

  const handleAddKnowledge = async (e) => {
    e.preventDefault();
    if (!kbTitle || !kbContent) return toast.error("Missing fields", "Title and content are required.");
    setAddingKb(true);
    try {
      await api.addKnowledgeBase({ title: kbTitle, content: kbContent });
      toast.success("Knowledge Added", `Successfully indexed: ${kbTitle}`);
      setKbTitle("");
      setKbContent("");
      fetchKnowledgeDocs();
    } catch (err) {
      toast.error("Failed to add knowledge", err.message);
    } finally {
      setAddingKb(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      await api.createUser(data);
      toast.success("User Created", `Successfully created user ${data.username}`);
      reset();
      fetchUsers();
    } catch (err) {
      toast.error("Creation Failed", err.message);
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    try {
      await api.deleteUser(id);
      toast.success("User Deleted", `${username} has been removed.`);
      fetchUsers();
    } catch (err) {
      toast.error("Deletion Failed", err.message);
    }
  };

  if (user?.role !== "ADMIN") {
    return <div className="analysis-panel placeholder">You do not have permission to view this page.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Admin: User Management</h3>
        <p className={styles.subtitle}>Manage platform access, roles, and jurisdictions.</p>
      </div>

      <div className={styles.grid}>
        {/* Create User Form */}
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Create New User</h4>
          <form onSubmit={handleSubmit(handleCreate)} className={styles.form}>
            <div>
              <input placeholder="Username" {...register("username")} className={styles.input} />
              {errors.username && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.username.message}</p>}
            </div>
            
            <div>
              <input placeholder="Password" type="password" {...register("password")} className={styles.input} />
              {errors.password && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.password.message}</p>}
            </div>

            <div>
              <input placeholder="Full Name" {...register("name")} className={styles.input} />
              {errors.name && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.name.message}</p>}
            </div>

            <div>
              <select {...register("role")} className={styles.input}>
                <option value="ADMIN">ADMIN</option>
                <option value="OFFICER">OFFICER</option>
                <option value="CONSTABLE">CONSTABLE</option>
              </select>
              {errors.role && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.role.message}</p>}
            </div>

            <div>
              <input placeholder="District (Optional)" {...register("districtName")} className={styles.input} />
              {errors.districtName && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.districtName.message}</p>}
            </div>

            <div>
              <input placeholder="Station (Optional)" {...register("stationName")} className={styles.input} />
              {errors.stationName && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.stationName.message}</p>}
            </div>

            <button type="submit" className={styles.submitBtn}>Create User</button>
          </form>
        </div>

        {/* User List */}
        <div className={`${styles.card} ${styles.tableContainer}`}>
          <h4 className={styles.cardTitle}>Active Accounts</h4>
          {loading ? <p>Loading...</p> : (
            <table className="results-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.UserID}>
                    <td style={{ fontWeight: "bold" }}>{u.Username}</td>
                    <td>{u.Name}</td>
                    <td><span className="status-badge status-open">{u.Role}</span></td>
                    <td>{u.DistrictName || "State-wide"} {u.StationName ? `(${u.StationName})` : ""}</td>
                    <td>
                      {u.UserID !== user.userId && (
                        <button onClick={() => handleDelete(u.UserID, u.Username)} className={styles.deleteBtn}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* System Audit Logs */}
        <div className={`${styles.card} ${styles.tableContainer}`} style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
          <h4 className={styles.cardTitle}>System Audit Logs (ZCQL & Interactions)</h4>
          {auditLogs.length === 0 ? <p>Loading logs...</p> : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action / Intent</th>
                    <th>Query Details</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.ID}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-muted)' }}>{log.Timestamp}</td>
                      <td style={{ fontWeight: "bold" }}>{log.UserID}</td>
                      <td><span className="status-badge" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{log.Action}</span></td>
                      <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div title={log.QueryDetails} style={{ cursor: 'help' }}>{log.QueryDetails}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--teal)', fontWeight: '600' }}>{log.ExecutionTimeMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Knowledge Base Ingestion */}
        <div className={styles.card} style={{ gridColumn: '1 / -1', marginTop: '24px', display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <h4 className={styles.cardTitle}>🧠 RAG Knowledge Base Ingestion</h4>
            <p className={styles.subtitle} style={{ marginBottom: '16px' }}>Upload Standard Operating Procedures, Penal Codes, or Policy Manuals to augment the AI's intelligence.</p>
            <form onSubmit={handleAddKnowledge} className={styles.form}>
              <input 
                placeholder="Document Title (e.g., 'Cyber Crime SOP 2026')" 
                value={kbTitle} onChange={e => setKbTitle(e.target.value)} 
                className={styles.input} 
                disabled={addingKb}
              />
              <textarea 
                placeholder="Paste the full text content here. The system will automatically generate semantic embeddings for vector search." 
                value={kbContent} onChange={e => setKbContent(e.target.value)} 
                className={styles.input} 
                style={{ height: '120px', resize: 'vertical' }}
                disabled={addingKb}
              />
              <button type="submit" className={styles.submitBtn} disabled={addingKb}>
                {addingKb ? "Generating Embeddings..." : "Add to Knowledge Base"}
              </button>
            </form>
          </div>
          
          <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
            <h4 className={styles.cardTitle}>Indexed Documents</h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {knowledgeDocs.length === 0 ? <p className={styles.subtitle}>No custom documents indexed yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {knowledgeDocs.map(doc => (
                    <div key={doc.ID} style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px', marginBottom: '4px' }}>{doc.Title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Indexed: {new Date(doc.CreatedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
