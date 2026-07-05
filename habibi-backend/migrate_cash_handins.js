/**
 * Migration: create driver_cash_handins table for end-of-shift reconciliation
 * Run once on the server:  node migrate_cash_handins.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  console.log('Creating driver_cash_handins table…');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_cash_handins (
      id            SERIAL PRIMARY KEY,
      driver_id     INTEGER,
      driver_name   VARCHAR(255),
      amount        DECIMAL(10,2) NOT NULL,
      order_count   INTEGER DEFAULT 0,
      confirmed_by  VARCHAR(255),
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Done.');
  await pool.end();
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
