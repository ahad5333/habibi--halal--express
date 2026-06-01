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
    const res = await pool.query("SELECT * FROM admin_sidebar WHERE path = '/admin/business-menus'");
    if (res.rows.length === 0) {
      await pool.query("INSERT INTO admin_sidebar (name, path, icon, sort_order) VALUES ('Businesses Menu', '/admin/business-menus', '💼', 4)");
      console.log("Added Businesses Menu to sidebar.");
    } else {
      console.log("Businesses Menu is already in the sidebar.");
    }
  } catch (err) {
    console.error("Error updating sidebar:", err);
  } finally {
    await pool.end();
  }
}
run();
