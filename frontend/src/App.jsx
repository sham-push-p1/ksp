import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import { api } from "./utils/api";
import ChatMessage from "./components/ChatMessage";
import LoginPanel from "./components/LoginPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import { useToast } from "./components/Toast";
import { useApp } from "./context/AppContext";
import "./App.css";

const ResultsPanel = lazy(() => import("./components/ResultsPanel"));
const NetworkGraph = lazy(() => import("./components/NetworkGraph"));
const ChartPanel = lazy(() => import("./components/ChartPanel"));
const FactorAnalysis = lazy(() => import("./components/FactorAnalysis"));
const CrimeMap = lazy(() => import("./components/CrimeMap"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const SimilarCaseMatcher = lazy(() => import("./components/SimilarCaseMatcher"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));

const SUGGESTIONS = [
  "How many murder cases were registered in 2024?",
  "Show crime trends by district for the last 2 years",
  "List all robbery cases still under investigation in Bengaluru Urban",
  "Which accused persons have appeared in multiple cases?",
  "Find cases involving drug trafficking",
  "District-wise crime count ranked by total cases",
];

export default function App() {
  const toast = useToast();
  const { 
    user, setUser, 
    activeTab, setActiveTab, 
    theme, setTheme, 
    dateRange, setDateRange, 
    lastResponse, setLastResponse 
  } = useApp();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("en");
  const [isListening, setIsListening] = useState(false);
  
  const chatEndRef = useRef(null);
  const recRef = useRef(null);

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
    // Only set welcome message once user is loaded
    if (user && messages.length === 0) {
      setMessages([{ 
        role: "system", 
        content: `Welcome back, ${user.name}. Scoped to: ${user.districtName ? user.districtName : "Karnataka-wide"}.`, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  }, [user, messages.length]);

  const handleLogin = async (username, password) => {
    try {
      const res = await api.login(username, password);
      // Token lives in the HttpOnly cookie — we only store display-only user info
      setUser(res.user);
      setMessages([{ role: "system", content: `Welcome, ${res.user.name}. ${res.user.role.toUpperCase()} access. ${res.user.districtName ? `Scoped to: ${res.user.districtName}.` : "Karnataka-wide access."}`, timestamp: new Date().toLocaleTimeString() }]);
      toast.success("Authenticated", `Welcome, ${res.user.name}. Logged in as ${res.user.role.toUpperCase()}.`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch (err) { console.warn("Logout request failed:", err); }
    // Cookie is cleared server-side; just reset local state
    setUser(null);
    setMessages([]);
    setLastResponse(null);
    setActiveTab("chat");
    toast.info("Logged Out", "Your session has been terminated securely.");
  };

  const sendMessage = useCallback(async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", content:q, timestamp:new Date().toLocaleTimeString() }]);
    setLoading(true);
    try {
      const history = messages.filter(m=>m.role==="user"||m.role==="assistant").slice(-6)
        .map(m=>({ question:m.content, answer:m.answer||"" }));
      const res = await api.chat(q, history, lang, dateRange);
      setLastResponse(res);
      setMessages(prev => [...prev, { role:"assistant", content:res.answer||res.error||"No response", answer:res.answer, zcqlQuery:res.zcqlQuery, sources:res.sources, intent:res.intent, resultCount:res.resultCount, latencyMs:res.latencyMs, timestamp:new Date().toLocaleTimeString() }]);
      if (res.intent==="trend_analysis"||res.chartData) setActiveTab("chart");
      else if (res.intent==="network_analysis") setActiveTab("network");
      else if (res.results?.length) setActiveTab("results");
    } catch(err) {
      setMessages(prev => [...prev, { role:"error", content:`Error: ${err.message}`, timestamp:new Date().toLocaleTimeString() }]);
      toast.error("Query Failed", err.message);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, lang, messages]);

  const handleExportPDF = async () => {
    const conversation = messages.filter(m => m.role==="user" || m.role==="assistant")
      .reduce((acc, m, i, arr) => {
        if (m.role==="user" && arr[i+1]?.role==="assistant")
          acc.push({ question:m.content, answer:arr[i+1].content, zcqlQuery:arr[i+1].zcqlQuery, timestamp:m.timestamp });
        return acc;
      }, []);
    if (conversation.length === 0) {
      toast.warning("Nothing to Export", "Have a conversation first before exporting.");
      return;
    }
    try {
      const res = await api.exportPDF(conversation);
      if (res.html) {
        // Download as a self-contained HTML file — avoids popup blockers and
        // lets the officer open it in any browser and use Ctrl+P to print/save as PDF.
        const blob = new Blob([res.html], { type: "text/html" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `KSP_Report_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Report Downloaded", `${conversation.length} query/queries saved. Open the .html file and press Ctrl+P to print/save as PDF.`);
      }
    } catch (err) {
      toast.error("Export Failed", err.message);
    }
  };

  if (!user) return <LoginPanel onLogin={handleLogin}/>;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <img src="/ksp_emblem.png" alt="KSP Logo" className="header-emblem"/>
          <div><h1>KSP Crime Intelligence</h1><span className="subtitle">Karnataka State Police | SCRB</span></div>
        </div>
        <div className="header-right">
          <div className="date-filter">
            <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="date-input"/>
            <span>to</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="date-input"/>
          </div>
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
        {["dashboard","chat","results","chart","network","map","analysis","matcher"].map(tab=>(
          <button key={tab} className={`tab-btn ${activeTab===tab?"active":""}`} onClick={()=>setActiveTab(tab)}>
            {tab==="dashboard"&&"🏠 Dashboard"}{tab==="chat"&&"💬 Chat"}{tab==="results"&&`📋 Results${lastResponse?.resultCount>0?` (${lastResponse.resultCount})`:""}`}{tab==="chart"&&"📊 Trends"}{tab==="network"&&"🕸️ Network"}{tab==="map"&&"🗺️ Map"}{tab==="analysis"&&"🎯 Analysis"}{tab==="matcher"&&"🔍 Matcher"}
          </button>
        ))}
        {user?.role === "ADMIN" && (
          <button className={`tab-btn ${activeTab==="admin"?"active":""}`} onClick={()=>setActiveTab("admin")}>
            ⚙️ Admin
          </button>
        )}
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
          <ErrorBoundary>
            <Suspense fallback={<div className="analysis-panel"><div className="loading-spinner"><div className="spinner"></div><p>Loading module...</p></div></div>}>
              {activeTab==="dashboard"&&<Dashboard/>}
              {activeTab==="results"&&<ResultsPanel/>}
              {activeTab==="chart"&&<ChartPanel/>}
              {activeTab==="network"&&<NetworkGraph/>}
              {activeTab==="analysis"&&<FactorAnalysis/>}
              {activeTab==="map"&&<CrimeMap/>}
              {activeTab==="matcher"&&<SimilarCaseMatcher/>}
              {activeTab==="admin"&&<AdminPanel/>}
            </Suspense>
          </ErrorBoundary>
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
