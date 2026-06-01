const fs = require('fs');
const path = require('path');

function copy() {
  const src = 'C:\\Users\\ahad5\\.gemini\\antigravity\\brain\\bc3c5c93-624d-4646-9cc6-cc3a67c28ad3\\realistic_3d_bowl_1780251353116.png';
  const destDir = 'e:\\habibi-halal-express-project\\habibi-frontend\\public\\images\\builder';
  const dest = path.join(destDir, 'realistic-3d-bowl.png');

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`Copying image from ${src} to ${dest}...`);
  fs.copyFileSync(src, dest);
  console.log('Copy successful.');
}

try {
  copy();
} catch (e) {
  console.error(e);
}
