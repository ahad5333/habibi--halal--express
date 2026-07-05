/**
 * Migration: add cash-collection tracking columns to delivery_assignments
 * Run once on the server:  node migrate_cash_collection.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  console.log('Adding cash_collected_at and cash_collected_by to delivery_assignments…');
  await pool.query(`
    ALTER TABLE delivery_assignments
      ADD COLUMN IF NOT EXISTS cash_collected_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS cash_collected_by  VARCHAR(255)
  `);
  console.log('Done.');
  await pool.end();
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
