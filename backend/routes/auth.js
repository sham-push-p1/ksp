/**
 * routes/auth.js — Authentication routes: login, logout, session check.
 */

const express = require("express");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, z } = require("../middleware/validate");
const logger = require("../utils/logger");

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
    const user = await db("SystemUsers").where({ Username: username }).first();
    if (!user) {
      // Dummy compare to prevent username enumeration via timing attack
      await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotectionXXXXXXXXXXXXXXXXXXXXXXXX");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db("UserSessions").insert({
      Token: token,
      UserID: user.UserID,
      Username: user.Username,
      Role: user.Role,
      Name: user.Name,
      DistrictName: user.DistrictName || null,
      StationName: user.StationName || null,
      CreatedAt: new Date().toISOString(),
      ExpiresAt: expiresAt
    });

    // Set HttpOnly cookie — JS cannot read this, protecting against XSS token theft.
    // In production set Secure:true (requires HTTPS).
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("ksp_session", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure:   isProduction,
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

  res.clearCookie("ksp_session", { path: "/" });
  res.json({ success: true, message: "Logged out successfully" });
});

// GET /api/me
router.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
