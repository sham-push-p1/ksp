import React, { useState, useRef, useEffect } from "react";
import { api } from "./utils/api";
import ChatMessage from "./components/ChatMessage";
import ResultsPanel from "./components/ResultsPanel";
import NetworkGraph from "./components/NetworkGraph";
import ChartPanel from "./components/ChartPanel";
import LoginPanel from "./components/LoginPanel";
import FactorAnalysis from "./components/FactorAnalysis";
import CrimeMap from "./components/CrimeMap";
import "./App.css";

const DEMO_USERS = {
  "admin":     { userId:"EMP001", role:"scrb_analyst", name:"SCRB Analyst",         districtName:null,              stationName:null },
  "sp_blr":   { userId:"EMP002", role:"sp",           name:"SP Bengaluru Urban",    districtName:"Bengaluru Urban", stationName:null },
  "insp_wf":  { userId:"EMP003", role:"inspector",    name:"Inspector Whitefield",  districtName:"Bengaluru Urban", stationName:"Whitefield" },
  "constable":{ userId:"EMP004", role:"constable",    name:"Constable Sharma",      districtName:"Bengaluru Urban", stationName:"Cubbon Park" },
};

const SUGGESTIONS = [
  "How many murder cases were registered in 2024?",
  "Show crime trends by district for the last 2 years",
  "List all robbery cases still under investigation in Bengaluru Urban",
  "Which accused persons have appeared in multiple cases?",
  "Find cases involving drug trafficking",
  "District-wise crime count ranked by total cases",
];

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("en");
  const [activeTab, setActiveTab] = useState("chat");
  const [lastResponse, setLastResponse] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("ksp_theme") || "light");
  const chatEndRef = useRef(null);
  const recRef = useRef(null);

  // Sync data-theme attribute on <html> and persist preference
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ksp_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false;
    rec.lang = lang === "kn" ? "kn-IN" : "en-IN";
    rec.onresult = e => { setInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recRef.current = rec;
  }, [lang]);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("ksp_token");
      if (!token) return;
      try {
        const res = await api.getMe();
        setUser(res.user);
        setMessages([{ role: "system", content: `Welcome back, ${res.user.name}. Scoped to: ${res.user.districtName ? res.user.districtName : "Karnataka-wide"}.`, timestamp: new Date().toLocaleTimeString() }]);
      } catch (err) {
        console.warn("Session restore failed, clearing credentials:", err);
        localStorage.removeItem("ksp_token");
        localStorage.removeItem("ksp_user");
        setUser(null);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (username, password) => {
    try {
      const res = await api.login(username, password);
      localStorage.setItem("ksp_token", res.token);
      localStorage.setItem("ksp_user", JSON.stringify(res.user));
      setUser(res.user);
      setMessages([{ role: "system", content: `Welcome, ${res.user.name}. ${res.user.role.toUpperCase()} access. ${res.user.districtName ? `Scoped to: ${res.user.districtName}.` : "Karnataka-wide access."}`, timestamp: new Date().toLocaleTimeString() }]);
      return { success: true };
    } catch (err) {
      console.error("[LOGIN FAILED]", err);
      return { success: false, error: err.message };
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    localStorage.removeItem("ksp_token");
    localStorage.removeItem("ksp_user");
    setUser(null);
    setMessages([]);
    setLastResponse(null);
    setActiveTab("chat");
  };

  const sendMessage = async questionText => {
    const q = (questionText || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", content:q, timestamp:new Date().toLocaleTimeString() }]);
    setLoading(true);
    try {
      const history = messages.filter(m=>m.role==="user"||m.role==="assistant").slice(-6)
        .map(m=>({ question:m.content, answer:m.answer||"" }));
      const res = await api.chat(q, history, lang);
      setLastResponse(res);
      setMessages(prev => [...prev, { role:"assistant", content:res.answer||res.error||"No response", answer:res.answer, zcqlQuery:res.zcqlQuery, sources:res.sources, intent:res.intent, resultCount:res.resultCount, latencyMs:res.latencyMs, timestamp:new Date().toLocaleTimeString() }]);
      if (res.intent==="trend_analysis"||res.chartData) setActiveTab("chart");
      else if (res.intent==="network_analysis") setActiveTab("network");
      else if (res.results?.length) setActiveTab("results");
    } catch(err) {
      setMessages(prev => [...prev, { role:"error", content:`Error: ${err.message}`, timestamp:new Date().toLocaleTimeString() }]);
    } finally { setLoading(false); }
  };

  const handleExportPDF = async () => {
    const conversation = messages.filter(m=>m.role==="user"||m.role==="assistant")
      .reduce((acc,m,i,arr) => { if(m.role==="user"&&arr[i+1]?.role==="assistant") acc.push({question:m.content,answer:arr[i+1].content,zcqlQuery:arr[i+1].zcqlQuery,timestamp:m.timestamp}); return acc; },[]);
    const res = await api.exportPDF(conversation);
    if (res.html) { const w=window.open("","_blank"); w.document.write(res.html); w.document.close(); w.print(); }
  };

  if (!user) return <LoginPanel onLogin={handleLogin} users={DEMO_USERS}/>;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <img src="/ksp_emblem.png" alt="KSP Logo" className="header-emblem"/>
          <div><h1>KSP Crime Intelligence</h1><span className="subtitle">Karnataka State Police | SCRB</span></div>
        </div>
        <div className="header-right">
          <span className="role-badge">{user.role.toUpperCase()}</span>
          <span className="officer-name">{user.name}</span>
          <select value={lang} onChange={e=>setLang(e.target.value)} className="lang-select">
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}>
            <span className="theme-toggle-icon">{theme === "light" ? "🌙" : "☀️"}</span>
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button className="btn-outline" onClick={handleExportPDF}>📄 PDF</button>
          <button className="btn-outline" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <nav className="tab-nav">
        {["chat","results","chart","network","map","analysis"].map(tab=>(
          <button key={tab} className={`tab-btn ${activeTab===tab?"active":""}`} onClick={()=>setActiveTab(tab)}>
            {tab==="chat"&&"💬 Chat"}{tab==="results"&&`📋 Results${lastResponse?.resultCount>0?` (${lastResponse.resultCount})`:""}`}{tab==="chart"&&"📊 Trends"}{tab==="network"&&"🕸️ Network"}{tab==="map"&&"🗺️ Map"}{tab==="analysis"&&"🎯 Analysis"}
          </button>
        ))}
      </nav>

      <div className="main">
        <div className="chat-panel">
          <div className="messages">
            {messages.map((msg,i)=><ChatMessage key={i} msg={msg}/>)}
            {loading && <div className="message assistant"><div className="avatar">🚔</div><div className="bubble-wrapper"><div className="bubble loading-bubble"><span className="dot"/><span className="dot"/><span className="dot"/></div></div></div>}
            <div ref={chatEndRef}/>
          </div>
          {messages.length<=1&&(
            <div className="suggestions">
              <p className="suggestions-label">Suggested queries:</p>
              <div className="suggestion-chips">
                {SUGGESTIONS.map((q,i)=><button key={i} className="chip" onClick={()=>sendMessage(q)}>{q}</button>)}
              </div>
            </div>
          )}
          <div className="input-bar">
            <button className={`voice-btn ${isListening?"listening":""}`} onClick={()=>{if(isListening){recRef.current?.stop();setIsListening(false);}else{recRef.current?.start();setIsListening(true);}}} title="Voice input">🎤</button>
            {isListening ? (
              <div className="voice-wave-container">
                <span className="voice-wave-bar bar-1"/>
                <span className="voice-wave-bar bar-2"/>
                <span className="voice-wave-bar bar-3"/>
                <span className="voice-wave-bar bar-4"/>
                <span className="voice-wave-bar bar-5"/>
                <span className="voice-wave-text">Listening... Speak now</span>
              </div>
            ) : (
              <input className="chat-input" value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
                placeholder={lang==="kn"?"ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ...":"Ask about crime records..."}
                disabled={loading}/>
            )}
            <button className="send-btn" onClick={()=>sendMessage()} disabled={loading||!input.trim()||isListening}>{loading?"...":"Send"}</button>
          </div>
        </div>

        <div className="right-panel">
          {activeTab==="results"&&<ResultsPanel response={lastResponse}/>}
          {activeTab==="chart"&&<ChartPanel response={lastResponse}/>}
          {activeTab==="network"&&<NetworkGraph response={lastResponse}/>}
          {activeTab==="analysis"&&<FactorAnalysis/>}
          {activeTab==="map"&&<CrimeMap/>}
          {activeTab==="chat"&&!lastResponse&&(
            <div className="welcome-dashboard">
              <div className="welcome-header">
                <img src="/ksp_emblem.png" alt="KSP Crest" className="welcome-crest"/>
                <h2>Karnataka State Police</h2>
                <h3>State Crime Record Bureau (SCRB)</h3>
                <div className="status-indicator">
                  <span className="status-dot online"></span>
                  <span className="status-label">Operational Database & AI Node Online</span>
                </div>
              </div>
              <div className="welcome-grid">
                <div className="welcome-card">
                  <span className="card-badge-icon">💬</span>
                  <h4>Conversational Crime Analytics</h4>
                  <p>Query using natural language in English or Kannada to instantly extract statistics, specific case details, and trends.</p>
                </div>
                <div className="welcome-card">
                  <span className="card-badge-icon">📊</span>
                  <h4>Automated Visual Trends</h4>
                  <p>Visualize hotspots, district rank charts, and monthly crime breakdowns instantly in dynamic graphs.</p>
                </div>
                <div className="welcome-card">
                  <span className="card-badge-icon">🕸️</span>
                  <h4>Offender Network Graphs</h4>
                  <p>Analyze links between accomplice networks, recidivism rates, and geographical repeat offenders.</p>
                </div>
                <div className="welcome-card">
                  <span className="card-badge-icon">🎯</span>
                  <h4>Socio-Behavioral Analytics</h4>
                  <p>Examine crime distributions based on victim vulnerability, complainant occupations, and modus operandi factors.</p>
                </div>
              </div>
              <div className="welcome-footer">
                <p>🔒 Session context is secure and encrypted. Officers must log out to clear active tokens.</p>
              </div>
            </div>
          )}
          {activeTab==="chat"&&lastResponse&&(
            <div className="info-panel">
              <h3>Query Details</h3>
              {lastResponse.zcqlQuery&&<div className="zcql-box"><label>SQL Generated</label><pre>{lastResponse.zcqlQuery}</pre></div>}
              {lastResponse.sources?.length>0&&(
                <div className="sources-box"><label>Source Records</label>
                  {lastResponse.sources.map((s,i)=>(
                    <div key={i} className="source-item">
                      <span className="crime-no">{s.CrimeNo}</span>
                      <span>{s.CrimeMinorHead} · {s.DistrictName}</span>
                      <span className="relevance">{s.relevanceScore}</span>
                    </div>))}
                </div>)}
              <div className="meta-tags">
                <span className="meta-tag">Intent: {lastResponse.intent}</span>
                <span className="meta-tag">Latency: {lastResponse.latencyMs}ms</span>
                <span className="meta-tag">Records: {lastResponse.resultCount||0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
