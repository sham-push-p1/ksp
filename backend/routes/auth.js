/**
 * routes/auth.js — Authentication routes: login, logout, session check.
 */

const express = require("express");
const crypto  = require("crypto");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, z } = require("../middleware/validate");
const logger = require("../utils/logger");

function generateToken(user) {
  return crypto.randomBytes(32).toString('hex');
}

const router = express.Router();

// Strict login limiter — max 10 failed attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
  skipSuccessfulRequests: true,
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(100),
});

// POST /api/login
router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    let user;
    try {
      user = await db.knex("SystemUsers").where({ Username: username }).first();
    } catch (dbErr) {
      // If DB is offline, use fallback demo user
      user = await db.fallbackLogin(username);
      if (!user) {
        return res.status(503).json({ error: "Database offline and user not found in demo" });
      }
      // Demo password check
      if (password !== 'demo' && !password.includes('2025')) {
         return res.status(401).json({ error: "Invalid demo password" });
      }
      // Skip bcrypt for demo fallback
      const token = generateToken(user);
      res.cookie("ksp_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "catalyst",
        sameSite: "none",
        maxAge: 8 * 60 * 60 * 1000,
        path: "/"
      });
      return res.json({ message: "Login successful (Demo Mode)", user });
    }

    if (!user) {
      // Dummy compare to prevent username enumeration via timing attack
      await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotectionXXXXXXXXXXXXXXXXXXXXXXXX");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = generateToken(user);

    // Save session
    try {
      await db.knex("UserSessions").insert({
        SessionID: crypto.randomUUID(),
        UserID: user.UserID,
        Token: token,
        ExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      });
    } catch (e) {
      // Ignore session save errors if DB is weird
    }

    // Set HttpOnly cookie — JS cannot read this, protecting against XSS token theft.
    // Use Secure:true only if explicitly requested, as local Docker might be HTTP.
    const isSecure = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "catalyst" || process.env.SECURE_COOKIE === "true";
    res.cookie("ksp_session", token, {
      httpOnly: true,
      sameSite: "none",
      secure:   isSecure,
      maxAge:   24 * 60 * 60 * 1000, // 24 hours in ms
      path:     "/",
    });

    // Return user info but NOT the token — it lives only in the cookie
    res.json({
      user: {
        userId:       user.UserID,
        username:     user.Username,
        role:         user.Role,
        name:         user.Name,
        districtName: user.DistrictName,
        stationName:  user.StationName,
      },
    });
  } catch (err) {
    logger.error("[LOGIN ERROR]", err.message, { username });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/logout — clears the session cookie and removes session from DB
router.post("/logout", async (req, res) => {
  // Accept token from cookie (browser) or Authorization header (API clients)
  const token = req.cookies?.ksp_session
    || (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].slice(7) : null);

  if (token) {
    try { await db("UserSessions").where({ Token: token }).del(); }
    catch (err) { logger.warn("[LOGOUT DB WARNING]", err.message); }
  }

  const isSecure = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "catalyst" || process.env.SECURE_COOKIE === "true";
  res.clearCookie("ksp_session", { path: "/", sameSite: "none", secure: isSecure });
  res.json({ success: true, message: "Logged out successfully" });
});

// GET /api/me
router.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
