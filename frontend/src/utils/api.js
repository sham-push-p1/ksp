/**
 * api.js — Thin HTTP client for the KSP backend.
 *
 * Authentication is handled transparently via the `ksp_session` HttpOnly
 * cookie that the server sets on login. The browser sends it automatically
 * with every request when credentials:'include' is present — no manual token
 * management needed and JavaScript cannot read the cookie (XSS-safe).
 */

const BASE = process.env.REACT_APP_API_URL !== undefined 
  ? process.env.REACT_APP_API_URL 
  : "http://localhost:3001";

async function request(method, endpoint, body) {
  const options = {
    method,
    credentials: "include",            // send the HttpOnly ksp_session cookie
    headers: { "Content-Type": "application/json" },
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
  chat:         (question, conversationHistory, lang, dateRange) =>
                  post("/api/chat", { question, conversationHistory, lang, dateRange }),
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
