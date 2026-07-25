import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(100),
});

export default function LoginPanel({ onLogin, users }) {
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
      <div className="login-card">
        <img src="/ksp_emblem.png" alt="KSP Emblem" className="login-emblem"/>
        <h1>KSP Crime Intelligence</h1>
        <p className="login-subtitle">Karnataka State Police | SCRB</p>
        <p className="login-subtitle2">Intelligent Conversational AI for Crime Database</p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          <label>Officer Username</label>
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input type="text" {...register("username")} placeholder="Enter username" className="login-input" disabled={loading}/>
          </div>
          {errors.username && <p className="login-error" style={{marginTop: "4px", fontSize: "12px"}}>{errors.username.message}</p>}
          
          <label style={{ marginTop: "14px", display: "block" }}>Password</label>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input type="password" {...register("password")} placeholder="Enter password" className="login-input" disabled={loading}/>
          </div>
          {errors.password && <p className="login-error" style={{marginTop: "4px", fontSize: "12px"}}>{errors.password.message}</p>}
          
          {serverError && <p className="login-error">{serverError}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>
        
        <div className="demo-accounts">
          <p className="demo-label">Demonstration Profiles (Click to pre-fill):</p>
          {Object.entries(users).map(([u,d])=>(
            <button key={u} className="demo-chip" onClick={()=>{
              setValue("username", u);
              setValue("password", u);
              clearErrors();
              setServerError("");
            }} disabled={loading}>
              👤 {u} <span className="demo-role">({d.role.replace("_", " ").toUpperCase()})</span>
            </button>
          ))}
        </div>
        <p className="login-disclaimer">🔒 Official SCRB Portal. All logins are audited and logged in QueryAuditLog.</p>
      </div>
    </div>
  );
}
