require("dotenv").config();

const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === 'production';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      user:     process.env.DB_USER,
      host:     process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port:     process.env.DB_PORT,
      ssl:      isProduction ? { rejectUnauthorized: false } : false,
    });

pool.on('connect', client => {
  client.query("SET timezone = 'America/New_York'");
});

module.exports = pool;