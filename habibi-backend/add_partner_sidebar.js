const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});
async function run() {
  try {
    const res = await pool.query("SELECT * FROM admin_sidebar WHERE path = '/admin/partners'");
    if (res.rows.length === 0) {
      await pool.query("INSERT INTO admin_sidebar (name, path, icon, sort_order) VALUES ('B2B Partners', '/admin/partners', '🤝', 5)");
      console.log("Added B2B Partners to sidebar.");
    } else {
      console.log("B2B Partners is already in the sidebar.");
    }
  } catch (err) {
    console.error("Error updating sidebar:", err);
  } finally {
    await pool.end();
  }
}
run();
