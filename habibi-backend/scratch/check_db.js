const pool = require("../src/config/db");

async function checkDatabase() {
  try {
    const res = await pool.query("SELECT COUNT(*) as count FROM menus");
    console.log("menus count: " + res.rows[0].count);
    
    const itemsRes = await pool.query("SELECT COUNT(*) as count FROM menu_items");
    console.log("menu_items count: " + itemsRes.rows[0].count);
  } catch (e) {
    console.log("Error: " + e.message);
  }
  process.exit(0);
}

checkDatabase();
