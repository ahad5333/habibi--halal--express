const pool = require('../src/config/db');

async function run() {
  try {
    const res = await pool.query(
      "SELECT id, name, description, price, category FROM menus LIMIT 20"
    );
    console.log("First 20 items in DB:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
