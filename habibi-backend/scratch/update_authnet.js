const fs = require('fs');

function copy() {
  const src = 'C:\\Users\\ahad5\\.gemini\\antigravity\\brain\\bc3c5c93-624d-4646-9cc6-cc3a67c28ad3\\authorizenet_seal_1780250355442.png';
  const dest = 'e:\\habibi-halal-express-project\\habibi-frontend\\public\\images\\partners\\authorize-net.png';
  const oldSvg = 'e:\\habibi-halal-express-project\\habibi-frontend\\public\\images\\partners\\authorize-net.svg';

  console.log(`Copying image from ${src} to ${dest}...`);
  fs.copyFileSync(src, dest);
  console.log('Copy successful.');

  if (fs.existsSync(oldSvg)) {
    console.log(`Deleting old SVG file ${oldSvg}...`);
    fs.unlinkSync(oldSvg);
    console.log('SVG deleted successfully.');
  }
}

try {
  copy();
} catch (e) {
  console.error(e);
}
