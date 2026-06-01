const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    console.log("Adding expanded partner columns to users table...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS representative_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS business_address TEXT,
      ADD COLUMN IF NOT EXISTS delivery_address TEXT,
      ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS preferred_delivery_days JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS preferred_delivery_hours JSONB DEFAULT '{"start": "08:00", "end": "17:00"}',
      ADD COLUMN IF NOT EXISTS deliveries_per_week VARCHAR(50),
      ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(50);
    `);
    console.log("✅ Users table updated with partner fields.");

  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    pool.end();
  }
}

migrate();

