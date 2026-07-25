const { z } = require("zod");
const logger = require("../utils/logger");

/**
 * Express middleware to validate request bodies against a Zod schema.
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    // parse() will throw if validation fails
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
      logger.warn(`[VALIDATION FAILED] ${req.method} ${req.originalUrl} - ${errorMessages}`, { ip: req.ip });
      return res.status(400).json({ error: `Validation failed: ${errorMessages}` });
    }
    logger.error("[VALIDATION ERROR]", error.message);
    return res.status(500).json({ error: "Internal server validation error" });
  }
};

module.exports = { validateBody, z };
