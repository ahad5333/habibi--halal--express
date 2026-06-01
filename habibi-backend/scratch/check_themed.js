const pool = require('../src/config/db');

async function run() {
  try {
    const res = await pool.query(
      "SELECT name, price, category FROM menus WHERE name ILIKE '%Sultan%' OR name ILIKE '%Saffron%' OR name ILIKE '%Truffle%' OR name ILIKE '%Noir%' OR name ILIKE '%Feast%'"
    );
    console.log("Matching items:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
