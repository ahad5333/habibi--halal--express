const pool = require('../src/config/db');

async function run() {
  try {
    const res = await pool.query(
      "SELECT count(*) FROM menu_items"
    );
    console.log("Count in menu_items:", res.rows[0].count);
  } catch (e) {
    console.error("Error querying menu_items:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
