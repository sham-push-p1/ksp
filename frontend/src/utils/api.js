const BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

function getHeaders() {
  const token = localStorage.getItem("ksp_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) { 
    const e = await res.json().catch(() => ({ error: res.statusText })); 
    throw new Error(e.error || "API error"); 
  }
  return res.json();
}

async function get(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) { 
    const e = await res.json().catch(() => ({ error: res.statusText })); 
    throw new Error(e.error || "API error"); 
  }
  return res.json();
}

export const api = {
  login: (username, password) => 
    post("/api/login", { username, password }),
  logout: () => 
    post("/api/logout"),
  getMe: () => 
    get("/api/me"),
  chat: (question, conversationHistory, lang) =>
    post("/api/chat", { question, conversationHistory, lang }),
  exportPDF: (conversation) =>
    post("/api/export-pdf", { conversation }),
  getAnalytics: () =>
    get("/api/analytics"),
  getMapData: () =>
    get("/api/map-data"),
};
