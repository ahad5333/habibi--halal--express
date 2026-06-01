const pool = require('./src/config/db');
async function checkTacos() {
    const res = await pool.query("SELECT COUNT(*) FROM menus WHERE category ILIKE '%tacos%'");
    console.log(`Tacos count: ${res.rows[0].count}`);
    process.exit();
}
checkTacos();
