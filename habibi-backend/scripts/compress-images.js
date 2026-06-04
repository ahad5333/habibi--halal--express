/**
 * Run once on the server to compress all images in public/images/
 * Usage: node scripts/compress-images.js
 * Requires: npm install sharp
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../public/images');
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
const WEBP_QUALITY = 80;

let totalBefore = 0;
let totalAfter = 0;
let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      compress(full);
    }
  }
}

async function compress(filePath) {
  const sizeBefore = fs.statSync(filePath).size;
  const ext = path.extname(filePath).toLowerCase();

  try {
    const img = sharp(filePath).resize({ width: MAX_WIDTH, withoutEnlargement: true });
    let buf;
    if (ext === '.png') {
      buf = await img.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer();
    } else {
      buf = await img.jpeg({ quality: JPEG_QUALITY, progressive: true }).toBuffer();
    }

    if (buf.length < sizeBefore) {
      fs.writeFileSync(filePath, buf);
      const saved = sizeBefore - buf.length;
      totalBefore += sizeBefore;
      totalAfter += buf.length;
      count++;
      console.log(`✓ ${path.relative(IMAGES_DIR, filePath)} — ${kb(sizeBefore)} → ${kb(buf.length)} (saved ${kb(saved)})`);
    } else {
      totalBefore += sizeBefore;
      totalAfter += sizeBefore;
      console.log(`- ${path.relative(IMAGES_DIR, filePath)} — already optimal`);
    }
  } catch (e) {
    console.error(`✗ ${filePath}: ${e.message}`);
  }
}

function kb(bytes) { return Math.round(bytes / 1024) + 'KB'; }

(async () => {
  console.log('Compressing images in', IMAGES_DIR, '\n');
  walk(IMAGES_DIR);
  await new Promise(r => setTimeout(r, 100));
  console.log(`\nDone: ${count} files compressed`);
  console.log(`Before: ${Math.round(totalBefore/1024/1024)}MB → After: ${Math.round(totalAfter/1024/1024)}MB`);
  console.log(`Saved: ${Math.round((totalBefore - totalAfter)/1024/1024)}MB`);
})();
