const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function verify() {
  try {
    console.log('--- VERIFYING LOCATIONS TABLE ---');
    const locRes = await pool.query("SELECT * FROM information_schema.tables WHERE table_name = 'locations'");
    if (locRes.rows.length > 0) {
      console.log('✅ Table "locations" exists.');
      const dataRes = await pool.query("SELECT COUNT(*) FROM locations");
      console.log(`📊 Total locations in DB: ${dataRes.rows[0].count}`);
    } else {
      console.log('❌ Table "locations" MISSING.');
    }

    console.log('\n--- VERIFYING ADMIN SIDEBAR ---');
    const sideRes = await pool.query("SELECT * FROM admin_sidebar WHERE name = 'Locations'");
    if (sideRes.rows.length > 0) {
      console.log('✅ "Locations" link found in admin_sidebar.');
    } else {
      console.log('⚠️ "Locations" link MISSING in admin_sidebar. Fixing now...');
      await pool.query("INSERT INTO admin_sidebar (name, path, icon, sort_order) VALUES ('Locations', '/admin/locations', '📍', 7) ON CONFLICT DO NOTHING");
      console.log('✅ "Locations" link added successfully.');
    }

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    pool.end();
  }
}

verify();
