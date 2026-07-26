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
    client: 'pg', // PostgreSQL (Local Docker)
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
    },
    postProcessResponse: (result) => {
      if (result && result.command && Array.isArray(result.rows)) {
        return result.rows;
      }
      return result;
    }
  },
  
  catalyst: {
    client: 'pg', // Cloud PostgreSQL (Supabase / Neon / Aiven)
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'postgres',
      ssl: { rejectUnauthorized: false } // Required for most managed cloud DBs
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
