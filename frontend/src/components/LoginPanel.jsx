import React, { useState } from "react";
export default function LoginPanel({ onLogin, users }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    setError("");
    const res = await onLogin(username, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || "Invalid credentials");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/ksp_emblem.png" alt="KSP Emblem" className="login-emblem"/>
        <h1>KSP Crime Intelligence</h1>
        <p className="login-subtitle">Karnataka State Police | SCRB</p>
        <p className="login-subtitle2">Intelligent Conversational AI for Crime Database</p>
        
        <div className="login-form">
          <label>Officer Username</label>
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input type="text" value={username} onChange={e=>{setUsername(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleLoginSubmit()} placeholder="Enter username" className="login-input" disabled={loading}/>
          </div>
          
          <label style={{ marginTop: "14px", display: "block" }}>Password</label>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleLoginSubmit()} placeholder="Enter password" className="login-input" disabled={loading}/>
          </div>
          
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" onClick={handleLoginSubmit} disabled={loading}>
            {loading ? "Authenticating..." : "Login"}
          </button>
        </div>
        
        <div className="demo-accounts">
          <p className="demo-label">Demostration Profiles (Click to pre-fill):</p>
          {Object.entries(users).map(([u,d])=>(
            <button key={u} className="demo-chip" onClick={()=>{setUsername(u);setPassword(u);setError("");}} disabled={loading}>
              👤 {u} <span className="demo-role">({d.role.replace("_", " ").toUpperCase()})</span>
            </button>
          ))}
        </div>
        <p className="login-disclaimer">🔒 Official SCRB Portal. All logins are audited and logged in QueryAuditLog.</p>
      </div>
    </div>
  );
}
