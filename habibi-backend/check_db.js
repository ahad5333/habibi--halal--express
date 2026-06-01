require('dotenv').config();
const pool = require('./src/config/db');

async function check() {
  // Check users table columns
  const cols = await pool.query(
    `SELECT column_name, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'users'
     ORDER BY ordinal_position`
  );
  console.log('\n=== USERS TABLE COLUMNS ===');
  cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(30)} default=${String(r.column_default).padEnd(20)} nullable=${r.is_nullable}`));

  // Count records
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM guest_orders) as orders,
      (SELECT COUNT(*) FROM menus) as menus,
      (SELECT COUNT(*) FROM locations) as locations
  `);
  console.log('\n=== ROW COUNTS ===');
  console.log(counts.rows[0]);

  // Check if admin exists
  const admin = await pool.query(`SELECT id, email, role FROM users WHERE role='admin' LIMIT 5`);
  console.log('\n=== ADMIN USERS ===');
  console.log(admin.rows.length ? admin.rows : 'NONE');

  pool.end();
}

check().catch(e => { console.error(e.message); pool.end(); });
