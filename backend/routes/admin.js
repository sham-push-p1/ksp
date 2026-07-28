const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, z } = require("../middleware/validate");
const logger = require("../utils/logger");
const { getEmbedding } = require("../functions/nl-to-zcql/ollama");

const router = express.Router();

// Middleware to ensure user is an ADMIN
const requireAdmin = (req, res, next) => {
  const role = req.user?.role?.toUpperCase();
  if (role !== "ADMIN" && role !== "SCRB_ANALYST") {
    logger.warn(`[ADMIN] Unauthorized access attempt by ${req.user?.username}`, { userId: req.user?.userId });
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  next();
};

const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100).optional(),
  name: z.string().min(2).max(100),
  role: z.enum(["ADMIN", "OFFICER", "CONSTABLE"]),
  districtName: z.string().max(100).optional().nullable(),
  stationName: z.string().max(100).optional().nullable(),
});

// GET /api/admin/users
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db("SystemUsers")
      .select("UserID", "Username", "Role", "Name", "DistrictName", "StationName")
      .orderBy("Username", "asc");
    res.json({ users });
  } catch (err) {
    logger.error("[ADMIN ERROR]", err.message, { userId: req.user?.userId });
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/users
router.post("/users", authenticateToken, requireAdmin, validateBody(userSchema), async (req, res) => {
  const { username, password, name, role, districtName, stationName } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required for new users" });

  try {
    // Check if username exists
    const exists = await db("SystemUsers").where({ Username: username }).first();
    if (exists) return res.status(409).json({ error: "Username already exists" });

    const hash = await bcrypt.hash(password, 12);
    const result = await db("SystemUsers").insert({
      Username: username,
      PasswordHash: hash,
      Role: role,
      Name: name,
      DistrictName: districtName || null,
      StationName: stationName || null
    });

    res.status(201).json({ success: true, userId: result[0] });
  } catch (err) {
    logger.error("[ADMIN ERROR]", err.message, { userId: req.user?.userId });
    res.status(500).json({ error: "Failed to create user" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id, 10) === req.user.userId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const deleted = await db("SystemUsers").where({ UserID: id }).del();
    if (!deleted) return res.status(404).json({ error: "User not found" });
    
    // Invalidate their sessions
    await db("UserSessions").where({ UserID: id }).del();

    res.json({ success: true });
  } catch (err) {
    logger.error("[ADMIN ERROR]", err.message, { userId: req.user?.userId });
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ==========================================
// KNOWLEDGE BASE MANAGEMENT
// ==========================================

const knowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10)
});

// GET /api/admin/knowledge
router.get("/knowledge", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const docs = await db("KnowledgeBase")
      .select("ID", "Title", "CreatedAt")
      .orderBy("CreatedAt", "desc");
    res.json({ docs });
  } catch (err) {
    logger.error("[ADMIN ERROR] Failed to fetch knowledge docs", err.message);
    res.status(500).json({ error: "Failed to fetch knowledge docs" });
  }
});

// POST /api/admin/knowledge
router.post("/knowledge", authenticateToken, requireAdmin, validateBody(knowledgeSchema), async (req, res) => {
  const { title, content } = req.body;
  try {
    // Generate embedding for the new knowledge document
    const emb = await getEmbedding(title + "\n" + content);
    if (!emb || emb.length === 0) {
      return res.status(500).json({ error: "Failed to generate embeddings for document." });
    }

    const result = await db("KnowledgeBase").insert({
      Title: title,
      Content: content,
      EmbeddingVec: JSON.stringify(emb),
      CreatedAt: new Date().toISOString()
    });

    logger.info(`[ADMIN] Added new knowledge document: ${title}`, { userId: req.user.userId });
    res.status(201).json({ success: true, id: result[0] });
  } catch (err) {
    logger.error("[ADMIN ERROR] Failed to add knowledge doc", err.message);
    res.status(500).json({ error: "Failed to add knowledge doc" });
  }
});

// DELETE /api/admin/knowledge/:id
router.delete("/knowledge/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db("KnowledgeBase").where({ ID: id }).del();
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    
    logger.info(`[ADMIN] Deleted knowledge document ID: ${id}`, { userId: req.user.userId });
    res.json({ success: true });
  } catch (err) {
    logger.error("[ADMIN ERROR] Failed to delete knowledge doc", err.message);
    res.status(500).json({ error: "Failed to delete knowledge doc" });
  }
});

module.exports = router;
