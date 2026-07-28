import React, { useEffect, useState } from 'react';

export default function LandingPage({ onTryDemo }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="landing-page">
      <style>{`
        .landing-page {
          font-family: 'Inter', sans-serif;
          background-color: #f8f9fa;
          color: #1a1a2e;
          min-height: 100vh;
          overflow-x: hidden;
          scroll-behavior: smooth;
        }

        /* --- Navbar --- */
        .landing-nav {
          position: fixed;
          top: 0;
          width: 100%;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 48px;
          z-index: 100;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 20px;
          color: #1a1a2e;
        }
        .nav-links {
          display: flex;
          gap: 32px;
        }
        .nav-links a {
          text-decoration: none;
          color: #4b5563;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: #1a1a2e; }
        .nav-actions {
          display: flex;
          gap: 16px;
        }
        .btn-rounded {
          border-radius: 9999px;
          padding: 10px 24px;
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-outline-navy {
          background: transparent;
          border: 1.5px solid #1a1a2e;
          color: #1a1a2e;
        }
        .btn-outline-navy:hover {
          background: rgba(26, 26, 46, 0.05);
          transform: translateY(-1px);
        }
        .btn-filled-navy {
          background: #1a1a2e;
          border: 1.5px solid #1a1a2e;
          color: white;
        }
        .btn-filled-navy:hover {
          background: #2a2a4a;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(26, 26, 46, 0.2);
        }
        .btn-filled-red {
          background: #e63946;
          border: 1.5px solid #e63946;
          color: white;
        }
        .btn-filled-red:hover {
          background: #d62828;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(230, 57, 70, 0.2);
        }

        /* --- Hero Section --- */
        .hero {
          padding: 160px 24px 80px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 1200px;
          margin: 0 auto;
        }
        .hero-label {
          background: rgba(42, 157, 143, 0.1);
          color: #2a9d8f;
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 0.6s ease forwards;
        }
        .hero h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 64px;
          font-weight: 800;
          line-height: 1.1;
          color: #1a1a2e;
          margin: 0 0 24px 0;
          letter-spacing: -0.03em;
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 0.6s ease 0.1s forwards;
        }
        .hero p.subtext {
          font-size: 20px;
          color: #4b5563;
          max-width: 700px;
          margin: 0 0 40px 0;
          line-height: 1.6;
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 0.6s ease 0.2s forwards;
        }
        .hero-actions {
          display: flex;
          gap: 16px;
          margin-bottom: 40px;
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 0.6s ease 0.3s forwards;
        }
        .hero-badges {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 80px;
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 0.6s ease 0.4s forwards;
        }
        .badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 1px solid rgba(0,0,0,0.05);
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        /* --- Dashboard Mockup (Pure CSS) --- */
        .mockup-wrapper {
          width: 100%;
          max-width: 1000px;
          perspective: 1200px;
          margin-bottom: 80px;
          opacity: 0;
          animation: fadeUp 0.8s ease 0.6s forwards;
        }
        .mockup-card {
          background: white;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 20px 60px rgba(0,0,0,0.1), 0 4px 24px rgba(0,0,0,0.07);
          transform: rotateX(6deg);
          transform-style: preserve-3d;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          aspect-ratio: 16/9;
          transition: transform 0.4s ease;
        }
        .mockup-card:hover {
          transform: rotateX(2deg);
        }
        .mockup-header {
          height: 16px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 6px;
          border-bottom: 1px solid #e2e8f0;
        }
        .mockup-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #cbd5e1;
        }
        .mockup-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          background: #f8fafc;
        }
        .mockup-sidebar {
          width: 200px;
          background: #1a1a2e;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mockup-nav-item {
          height: 32px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          font-weight: 500;
        }
        .mockup-nav-item.active {
          background: rgba(230, 57, 70, 0.2);
          color: white;
          border-left: 3px solid #e63946;
        }
        .mockup-main {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
        }
        .mockup-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .mockup-stat-card {
          background: white;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .mockup-stat-card label {
          display: block;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .mockup-stat-card h4 {
          margin: 0;
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          color: #1a1a2e;
        }
        .mockup-chat-area {
          flex: 1;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .mockup-bubble-user {
          align-self: flex-end;
          background: #1a1a2e;
          color: white;
          padding: 12px 16px;
          border-radius: 12px 12px 0 12px;
          font-size: 13px;
          max-width: 80%;
        }
        .mockup-bubble-ai {
          align-self: flex-start;
          background: #f1f5f9;
          color: #1a1a2e;
          padding: 16px;
          border-radius: 12px 12px 12px 0;
          font-size: 13px;
          max-width: 80%;
          border: 1px solid #e2e8f0;
          position: relative;
        }
        .mockup-bubble-ai::before {
          content: "AI";
          position: absolute;
          top: -10px;
          left: 12px;
          background: #e63946;
          color: white;
          font-size: 9px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* --- Sections Shared --- */
        .section-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 24px;
        }
        .section-title {
          font-family: 'Outfit', sans-serif;
          font-size: 36px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 64px;
          color: #1a1a2e;
        }

        /* --- Features --- */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .feature-card {
          background: white;
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.02);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.08);
        }
        .feature-icon {
          font-size: 32px;
          margin-bottom: 20px;
        }
        .feature-title {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px 0;
        }
        .feature-desc {
          font-size: 15px;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        /* --- How It Works --- */
        .steps-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          position: relative;
        }
        .step-card {
          flex: 1;
          background: white;
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.02);
          z-index: 2;
        }
        .step-number {
          width: 40px;
          height: 40px;
          background: #e63946;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 18px;
          margin: 0 auto 20px auto;
        }
        .step-desc {
          font-size: 15px;
          color: #64748b;
          line-height: 1.5;
        }
        .steps-connector {
          position: absolute;
          top: 52px;
          left: 10%;
          right: 10%;
          height: 2px;
          background: #e2e8f0;
          z-index: 1;
        }

        /* --- Tech Stack --- */
        .tech-stack {
          text-align: center;
          background: white;
          padding: 60px 24px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .tech-tags {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          max-width: 900px;
          margin: 32px auto 0 auto;
        }
        .tech-tag {
          background: #f1f5f9;
          color: #475569;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        /* --- Footer --- */
        .footer {
          text-align: center;
          padding: 40px 24px;
          color: #64748b;
          font-size: 14px;
        }
        .footer p { margin: 8px 0; }

        @media (max-width: 900px) {
          .hero h1 { font-size: 48px; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .steps-container { flex-direction: column; }
          .steps-connector { display: none; }
          .mockup-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .hero h1 { font-size: 36px; }
          .nav-links { display: none; }
          .features-grid { grid-template-columns: 1fr; }
          .mockup-sidebar { display: none; }
        }
      `}</style>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <img src={process.env.PUBLIC_URL + "/ksp_emblem.png"} alt="KSP Emblem" style={{ height: '36px', width: 'auto' }} />
          KSP Crime Intelligence
        </div>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#architecture">Architecture</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-actions">
          <button className="btn-rounded btn-outline-navy" onClick={onTryDemo}>Login</button>
          <button className="btn-rounded btn-filled-navy" onClick={onTryDemo}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero">
        <div className="hero-label">Powered by AI | SCRB Karnataka</div>
        <h1>Intelligent Crime Analysis<br />for Karnataka Police</h1>
        <p className="subtext">
          Query 1100+ police station records in plain English or Kannada. 
          Get instant answers, trend charts, and criminal network insights.
        </p>
        <div className="hero-actions">
          <button className="btn-rounded btn-filled-red" onClick={onTryDemo}>Try Demo →</button>
          <button className="btn-rounded btn-outline-navy" onClick={() => document.getElementById('architecture').scrollIntoView()}>View Architecture</button>
        </div>
        <div className="hero-badges">
          <div className="badge">🔒 On-Premise AI</div>
          <div className="badge">🌐 Bilingual</div>
          <div className="badge">📋 Audit Logged</div>
          <div className="badge">⚡ Real-time</div>
        </div>


      </section>

      {/* Features Section */}
      <section id="features" className="section-container">
        <h2 className="section-title">Platform Capabilities</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3 className="feature-title">Natural Language Query</h3>
            <p className="feature-desc">Ask in English or Kannada, get instant SQL-backed answers.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3 className="feature-title">Crime Trend Analytics</h3>
            <p className="feature-desc">Monthly trend lines and district hotspot detection.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🕸️</div>
            <h3 className="feature-title">Criminal Network Graph</h3>
            <p className="feature-desc">Visualise connections between repeat accused across cases.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎤</div>
            <h3 className="feature-title">Voice Enabled</h3>
            <p className="feature-desc">Speak your query in English or Kannada using Web Speech API.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3 className="feature-title">Role-Based Access</h3>
            <p className="feature-desc">Constable to SCRB Analyst — each role sees only what they're allowed.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3 className="feature-title">PDF Export</h3>
            <p className="feature-desc">Export full conversation history as a confidential report.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="architecture" className="section-container" style={{ background: '#f1f5f9', borderRadius: '40px', marginBottom: '80px', padding: '80px 40px' }}>
        <h2 className="section-title">How It Works</h2>
        <div className="steps-container">
          <div className="steps-connector"></div>
          <div className="step-card">
            <div className="step-number">1</div>
            <p className="step-desc">Officer asks a question in natural language.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <p className="step-desc">AI classifies intent → runs SQL or semantic search.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <p className="step-desc">Answer returned with source records and full audit log.</p>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-stack">
        <h2 className="section-title" style={{ marginBottom: 0 }}>Built on Modern Tech</h2>
        <div className="tech-tags">
          <span className="tech-tag">Ollama</span>
          <span className="tech-tag">Qwen3:8b</span>
          <span className="tech-tag">nomic-embed-text</span>
          <span className="tech-tag">Node.js</span>
          <span className="tech-tag">React</span>
          <span className="tech-tag">SQLite</span>
          <span className="tech-tag">Chart.js</span>
          <span className="tech-tag">vis-network</span>
          <span className="tech-tag">Zoho Catalyst</span>
          <span className="tech-tag">Web Speech API</span>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="footer">
        <p><strong>KSP Crime Intelligence</strong> | Karnataka State Police SCRB</p>
        <p>All data is confidential. Authorised personnel only.</p>
      </footer>
    </div>
  );
}
