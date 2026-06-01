const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

const runSeed = async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'habibi-web', 'seed_full_menu.sql'), 'utf8');
    await pool.query(sql);
    console.log("Full menu re-seeded successfully!");
    process.exit();
  } catch (err) {
    console.error("Error seeding menu:", err);
    process.exit(1);
  }
};

runSeed();

