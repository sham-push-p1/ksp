import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(100),
});

const DEMO_USERS = {
  admin:     { role: "scrb_analyst", password: "Ksp@Scrb#2025!Adm" },
  sp_blr:    { role: "sp", password: "Ksp@Sp#Blr2025!" },
  insp_wf:   { role: "inspector", password: "Ksp@Insp#Wf2025!" },
  constable: { role: "constable", password: "Ksp@Const#2025!" }
};

export default function LoginPanel({ onLogin, onBack, users = DEMO_USERS }) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, clearErrors } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setServerError("");
    const res = await onLogin(data.username, data.password);
    setLoading(false);
    if (!res.success) {
      setServerError(res.error || "Invalid credentials");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-glow-1"></div>
      <div className="login-glow-2"></div>
      
      <div className="login-container">
        <div className="login-left-panel">
          <div className="login-bg-overlay" style={{ backgroundImage: `url(${process.env.PUBLIC_URL + '/ksp_emblem.png'})` }}></div>
          <div className="login-brand">
            <div className="login-emblem-container">
               <img src={process.env.PUBLIC_URL + "/ksp_emblem.png"} alt="KSP Emblem" className="login-emblem-large"/>
            </div>
            <h2>Karnataka State Police</h2>
            <div className="login-divider"></div>
            <p>State Crime Records Bureau</p>
            <span className="login-badge">Restricted Access Portal</span>
          </div>
        </div>

        <div className="login-right-panel">
          <div className="login-header" style={{ position: 'relative' }}>
            {onBack && (
              <button 
                onClick={onBack}
                type="button"
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                ← Back to Home
              </button>
            )}
            <h1>Officer Login</h1>
            <p>Enter your credentials to access the Crime Intelligence system.</p>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <div className="input-group-modern">
              <input 
                type="text" 
                {...register("username")} 
                placeholder=" " 
                className="login-input-modern" 
                disabled={loading}
              />
              <label>Officer Username</label>
              <span className="input-icon-modern">👤</span>
            </div>
            {errors.username && <p className="login-error-modern">{errors.username.message}</p>}
            
            <div className="input-group-modern" style={{ marginTop: "24px" }}>
              <input 
                type="password" 
                {...register("password")} 
                placeholder=" " 
                className="login-input-modern" 
                disabled={loading}
              />
              <label>Password</label>
              <span className="input-icon-modern">🔒</span>
            </div>
            {errors.password && <p className="login-error-modern">{errors.password.message}</p>}
            
            {serverError && (
              <div className="login-server-error">
                <span>⚠️</span> {serverError}
              </div>
            )}
            
            <button type="submit" className={`login-btn-modern ${loading ? 'loading' : ''}`} disabled={loading}>
              <span className="btn-text">{loading ? "Authenticating..." : "Secure Login"}</span>
              <span className="btn-icon">➔</span>
            </button>
          </form>
          
          <div className="demo-accounts-modern">
            <p className="demo-label-modern">Quick Access (Demo):</p>
            <div className="demo-chips-grid">
              {Object.entries(users).map(([u,d])=>(
                <button key={u} type="button" className="demo-chip-modern" onClick={()=>{
                  setValue("username", u);
                  setValue("password", d.password);
                  clearErrors();
                  setServerError("");
                }} disabled={loading}>
                  <span className="demo-avatar">{u.charAt(0).toUpperCase()}</span>
                  <div className="demo-info">
                    <span className="demo-name">{u}</span>
                    <span className="demo-role-modern">{d.role.replace("_", " ")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <p className="login-disclaimer-modern">
            🔒 Official SCRB Portal. Unauthorized access is prohibited. All actions are audited.
          </p>
        </div>
      </div>
    </div>
  );
}
