const pool = require('../src/config/db');
async function checkCount() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM menus");
    console.log(`TOTAL MENU ITEMS IN DATABASE: ${res.rows[0].count}`);
  } catch (err) {
    console.error("Database query failed:", err);
  }
  process.exit();
}
checkCount();
