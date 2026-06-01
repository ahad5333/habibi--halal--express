const pool = require('../src/config/db');

async function check() {
  const res = await pool.query(
    `SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = 'locations' 
     ORDER BY ordinal_position`
  );
  console.log(res.rows);
  pool.end();
}

check().catch(e => { console.error(e); pool.end(); });
