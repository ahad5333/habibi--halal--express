const pool = require('../src/config/db');

async function find() {
  const res = await pool.query("SELECT id, title, brief_address, exact_address, phone_number, working_days_hours FROM locations");
  console.log(res.rows);
  pool.end();
}

find().catch(e => { console.error(e); pool.end(); });
