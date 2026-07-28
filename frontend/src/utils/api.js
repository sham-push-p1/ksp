/**
 * api.js — Thin HTTP client for the KSP backend.
 *
 * Authentication is handled transparently via the `ksp_session` HttpOnly
 * cookie that the server sets on login. The browser sends it automatically
 * with every request when credentials:'include' is present — no manual token
 * management needed and JavaScript cannot read the cookie (XSS-safe).
 */

let BASE = process.env.REACT_APP_API_URL;
if (!BASE) {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    BASE = "http://localhost:3001";
  } else {
    // Hardcoded to correct Catalyst AppSail backend URL
    BASE = "https://ksp-backend-50044366382.development.catalystappsail.in";
  }
}

async function request(method, endpoint, body) {
  const options = {
    method,
    headers: { "Content-Type": "text/plain" },
    credentials: "include",
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${endpoint}`, options);
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || "API error");
  }
  return res.json();
}

const get  = (endpoint)       => request("GET",  endpoint);
const post = (endpoint, body) => request("POST", endpoint, body);

export const api = {
  login:        (username, password) => post("/api/login",      { username, password }),
  logout:       ()                   => post("/api/logout",     {}),
  getMe:        ()                   => get("/api/me"),
  chat: async (question, conversationHistory, lang, dateRange) => {
    try {
      return await post("/api/chat", { question, conversationHistory, lang, dateRange });
    } catch (err) {
      console.warn("Backend chat failed, using direct Gemini fallback:", err);
      try {
        const apiKey = "AQ.Ab8RN6K-pbpx7Bx1I731EUiEC7EGqnD4snZYCtRIo_qv_4LEMQ";
        const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.0-flash"];
        const historyText = (conversationHistory || []).map(h => `User: ${h.question}\nAI: ${h.answer}`).join("\n");
        const prompt = `${historyText ? historyText + '\n\n' : ''}User: ${question}`;
        
        let answer = null;
        let lastError = "";

        for (const model of modelsToTry) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: `You are a helpful Karnataka State Police (KSP) Crime Analyst Assistant. ${lang === 'kn' ? 'Respond in Kannada.' : 'Respond in English.'} Since the live database is currently offline in this prototype, answer questions based on general knowledge of police procedures, common statistics, or provide a simulated helpful response.` }] }
            })
          });
          
          const data = await geminiRes.json();
          if (geminiRes.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            answer = data.candidates[0].content.parts[0].text;
            break; // Success! Exit loop.
          } else {
            lastError = data.error?.message || "Unknown error";
          }
        }
        
        if (!answer) {
          answer = `The AI service is currently experiencing extremely high demand across all models. Please try again in a few minutes. (Error: ${lastError})`;
        }
        
        return {
          intent: "general",
          answer: answer + "\n\n*(Prototype Mode: Live database offline)*",
          resultCount: 0
        };
      } catch (geminiErr) {
        return {
          intent: "general",
          answer: "AI Backend is completely unreachable right now. You asked: " + question,
          resultCount: 0
        };
      }
    }
  },
  exportPDF:    (conversation) => post("/api/export-pdf", { conversation }),
  getAnalytics: (dateRange)    => get(`/api/analytics?start=${dateRange?.start||""}&end=${dateRange?.end||""}`),
  getMapData:   (dateRange)    => get(`/api/map-data?start=${dateRange?.start||""}&end=${dateRange?.end||""}`),
  getDashboard: (dateRange)    => get(`/api/dashboard?start=${dateRange?.start||""}&end=${dateRange?.end||""}`),
  matchCases:   (query)        => post("/api/match-cases", { query }),
  getAuditLog:  ()             => get("/api/audit-log"),
  // --- Admin ---
  getUsers:     ()             => get("/api/admin/users"),
  createUser:   (user)         => post("/api/admin/users", user),
  deleteUser:   (id)           => request("DELETE", `/api/admin/users/${id}`),
  getKnowledgeBase: ()         => get("/api/admin/knowledge"),
  addKnowledgeBase: (doc)      => post("/api/admin/knowledge", doc)
};
