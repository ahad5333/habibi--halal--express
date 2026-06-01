const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function update() {
  const src = 'C:\\Users\\ahad5\\.gemini\\antigravity\\brain\\bc3c5c93-624d-4646-9cc6-cc3a67c28ad3\\pepsi_2liter_bottle_1780250098734.png';
  const dest = 'e:\\habibi-halal-express-project\\habibi-frontend\\public\\images\\menu\\pepsi-2liter.png';

  console.log(`Copying image from ${src} to ${dest}...`);
  fs.copyFileSync(src, dest);
  console.log('Copy successful.');

  console.log('Updating database record...');
  const res = await pool.query(
    "UPDATE menus SET image_url = '/images/menu/pepsi-2liter.png' WHERE name = '2-Liter Pepsi Soda' RETURNING *"
  );
  console.log('Updated rows:', res.rows);

  pool.end();
}

update().catch(e => { console.error(e); pool.end(); });
