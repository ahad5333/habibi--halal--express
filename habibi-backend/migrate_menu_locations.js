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
    await pool.query("ALTER TABLE menus ADD COLUMN IF NOT EXISTS available_locations JSONB DEFAULT '[]';");
    console.log("Column 'available_locations' added to menus table.");
    
    // Seed data: Assumes locations with IDs 1, 2, 3 exist.
    await pool.query("UPDATE menus SET available_locations = '[1, 2, 3]';");
    console.log("Menus updated with default available locations [1, 2, 3].");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pool.end();
  }
}

migrate();
