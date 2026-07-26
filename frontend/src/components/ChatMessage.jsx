import React from "react";

const INTENT_LABELS = {
  structured_query: "Database Query",
  narrative_search: "Narrative Search",
  trend_analysis: "Trend Analysis",
  network_analysis: "Network Analysis",
  hybrid: "Hybrid",
  predictive: "Predictive",
};

function parseInlineMarkdown(text) {
  const parts = [];
  const tokenRegex = /(\*\*|`)(.*?)\1/g;
  let match;
  let lastIndex = 0;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const token = match[1];
    const content = match[2];

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    if (token === "**") {
      parts.push(<strong key={`bold-${keyIdx++}`}>{content}</strong>);
    } else if (token === "`") {
      parts.push(<code key={`code-${keyIdx++}`} className="inline-code">{content}</code>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderMarkdown(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const elements = [];
  let inList = false;
  let listItems = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${key}`} className="chat-list">{listItems}</ul>);
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      if (!inList) {
        flushList(i);
        inList = true;
      }
      const content = line.trim().substring(2);
      listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(content)}</li>);
      continue;
    } else {
      if (inList) {
        flushList(i);
      }
    }

    if (line.trim().startsWith("### ")) {
      elements.push(<h4 key={`h4-${i}`} className="chat-h4">{parseInlineMarkdown(line.trim().substring(4))}</h4>);
      continue;
    }
    if (line.trim().startsWith("## ")) {
      elements.push(<h3 key={`h3-${i}`} className="chat-h3">{parseInlineMarkdown(line.trim().substring(3))}</h3>);
      continue;
    }
    if (line.trim().startsWith("# ")) {
      elements.push(<h2 key={`h2-${i}`} className="chat-h2">{parseInlineMarkdown(line.trim().substring(2))}</h2>);
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} style={{ height: "6px" }} />);
      continue;
    }

    elements.push(<p key={`p-${i}`} className="chat-paragraph">{parseInlineMarkdown(line)}</p>);
  }

  if (inList) {
    flushList(lines.length);
  }

  return elements;
}

export default function ChatMessage({ msg }) {
  if (msg.role === "system") return (
    <div className="message system">
      <div className="system-msg"><span className="sys-icon">i</span> {msg.content}</div>
    </div>
  );

  if (msg.role === "user") return (
    <div className="message user">
      <div className="user-bubble">
        <div className="bubble">{msg.content}</div>
        <span className="timestamp">{msg.timestamp}</span>
      </div>
    </div>
  );

  if (msg.role === "assistant") return (
    <div className="message assistant">
      <div className="avatar">AI</div>
      <div className="bubble-wrapper">
        {msg.intent && <div className="intent-tag">{INTENT_LABELS[msg.intent] || msg.intent}</div>}
        <div className="bubble">{renderMarkdown(msg.content)}</div>
        
        {(msg.zcqlQuery || (msg.sources && msg.sources.length > 0)) && (
          <details className="evidence-trail" style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', outline: 'none', userSelect: 'none', fontWeight: '500', color: 'var(--navy)' }}>🧐 Why this result?</summary>
            <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              {msg.zcqlQuery && (
                <div style={{ marginBottom: msg.sources && msg.sources.length > 0 ? '12px' : '0' }}>
                  <strong>Database Query Executed:</strong>
                  <pre style={{ margin: '8px 0 0 0', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflowX: 'auto', border: '1px solid var(--border)' }}>
                    <code style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{msg.zcqlQuery}</code>
                  </pre>
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div>
                  <strong>Knowledge Base Sources Used:</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    {msg.sources.map((s, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        Case {s.CrimeNo} ({s.CrimeMinorHead}) 
                        <span style={{ marginLeft: '8px', background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '11px' }}>
                          Match: {s.relevanceScore}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="msg-meta">
          <span className="timestamp">{msg.timestamp}</span>
          {msg.latencyMs && <span className="latency">{msg.latencyMs}ms</span>}
          {msg.resultCount > 0 && <span className="result-count">{msg.resultCount} records</span>}
        </div>
      </div>
    </div>
  );

  return <div className="message error"><div className="error-msg">Error: {msg.content}</div></div>;
}
