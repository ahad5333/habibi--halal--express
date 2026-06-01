const pool = require('../src/config/db');

async function run() {
  try {
    const res = await pool.query(
      "SELECT id, name, price, category FROM menus ORDER BY category, id"
    );
    console.log(`Total items found: ${res.rows.length}`);
    res.rows.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.category}] ${item.name} ($${item.price})`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
