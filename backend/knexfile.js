const path = require('path');

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || path.join(__dirname, 'local-dev.db')
    },
    useNullAsDefault: true,
  },
  
  test: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || path.join(__dirname, 'local-dev.db')
    },
    useNullAsDefault: true,
  },

  production: {
    client: 'pg', // PostgreSQL
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
