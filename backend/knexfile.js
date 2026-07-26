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
    client: 'mysql2', // Zoho Catalyst Data Store
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ksp_crime_intel'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
