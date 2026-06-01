const pool = require('../src/config/db');

async function find() {
  const res = await pool.query("SELECT * FROM menus WHERE name ILIKE '%pepsi%'");
  console.log(res.rows);
  pool.end();
}

find().catch(e => { console.error(e); pool.end(); });
