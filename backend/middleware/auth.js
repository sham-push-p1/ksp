/**
 * middleware/auth.js — HttpOnly cookie-based session authentication.
 *
 * Reads the session token from the `ksp_session` HttpOnly cookie (set by
 * /api/login), validates it against UserSessions in the DB, and populates
 * req.user. Falls back to the Authorization header for backward compatibility
 * with API clients that cannot use cookies.
 */

const db = require("../db");

/**
 * Express middleware: authenticate request via session cookie or Bearer token.
 * Sets req.user on success; returns 401/500 on failure.
 */
async function authenticateToken(req, res, next) {
  // Primary: HttpOnly cookie (browser clients)
  // Fallback: Authorization: Bearer <token> (API / curl clients)
  const cookieToken = req.cookies?.ksp_session;
  const authHeader  = req.headers["authorization"];
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token       = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: "Access token is missing. Please log in." });
  }

  try {
    const sessionRes = await db.raw("SELECT * FROM UserSessions WHERE Token = ?", [token]);
    const session = sessionRes.length > 0 ? sessionRes[0] : null;

    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    }

    const now = new Date().toISOString();
    if (session.ExpiresAt && session.ExpiresAt < now) {
      try { await db.raw("DELETE FROM UserSessions WHERE Token = ?", [token]); } catch {}
      // Clear stale cookie if it was a cookie request
      if (cookieToken) res.clearCookie("ksp_session");
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }

    req.user = {
      userId:       session.UserID,
      username:     session.Username,
      role:         session.Role,
      name:         session.Name,
      districtName: session.DistrictName === "null" || !session.DistrictName ? null : session.DistrictName,
      stationName:  session.StationName  === "null" || !session.StationName  ? null : session.StationName,
    };
    next();
  } catch (err) {
    console.error("[AUTH MIDDLEWARE ERROR]", err);
    return res.status(500).json({ error: "Authentication server error" });
  }
}

module.exports = { authenticateToken };
