// Mute winston logger during tests
const logger = require('./utils/logger');
logger.transports.forEach((t) => (t.silent = true));
