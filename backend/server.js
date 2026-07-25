/**
 * server.js — KSP Crime Intelligence API Server
 *
 * This is the entry point. All business logic lives in:
 *   db/index.js          — Database init, seeding, migrations, session sweeper
 *   middleware/auth.js   — HttpOnly cookie authentication middleware
 *   functions/rag.js     — Shared RAG (embedding + cosine ranking) pipeline
 *   routes/auth.js       — POST /api/login, POST /api/logout, GET /api/me
 *   routes/chat.js       — POST /api/chat (NL→SQL + intent routing + RAG)
 *   routes/analytics.js  — GET /api/analytics, GET /api/audit-log, POST /api/export-pdf
 *   routes/map.js        — GET /api/map-data (Leaflet heatmap points)
 */

require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit    = require("express-rate-limit");
const logger       = require("./utils/logger");

// Initialize DB (runs seeding and migrations on first import)
require("./db");

const authRoutes      = require("./routes/auth");
const chatRoutes      = require("./routes/chat");
const analyticsRoutes = require("./routes/analytics");
const mapRoutes       = require("./routes/map");
const matcherRoutes   = require("./routes/matcher");
const adminRoutes     = require("./routes/admin");

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow frontend on different port
  contentSecurityPolicy: false,                          // disabled for Vite dev HMR
}));

// ─── CORS — must specify origin explicitly when credentials: true ─────────────
// Frontend runs on :3000 in dev; set FRONTEND_ORIGIN in .env for production.

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,                // allow cookies cross-origin
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// General: 120 req/min per IP for all API routes (login excluded — has its own)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before retrying." },
  skip: (req) => req.path === "/api/login",
});
app.use("/api/", generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", mapRoutes);
app.use("/api", matcherRoutes);
app.use("/api/admin", adminRoutes);

// ─── Static Frontend (Production) ─────────────────────────────────────────────
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

// Fallback all other GET requests to the React index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => logger.info(`
\x1b[36m🚔 KSP Crime Intelligence — Local Dev Server\x1b[0m
  API:      http://localhost:${PORT}/api/chat
  Audit:    http://localhost:${PORT}/api/audit-log
  Ollama:   http://localhost:11434
  Frontend: ${FRONTEND_ORIGIN}
`));
}

module.exports = app;
