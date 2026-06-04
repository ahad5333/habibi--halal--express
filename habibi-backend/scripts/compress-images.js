/**
 * Run once on the server to compress all images + generate WebP versions.
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
const WEBP_QUALITY = 78;

let totalBefore = 0;
let totalAfter = 0;
let totalWebpSaved = 0;
let count = 0;
let webpCount = 0;
const promises = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      promises.push(compress(full));
    }
  }
}

async function compress(filePath) {
  const sizeBefore = fs.statSync(filePath).size;
  const ext = path.extname(filePath).toLowerCase();
  const webpPath = filePath.replace(/\.(jpe?g|png)$/i, '.webp');

  try {
    const img = sharp(filePath).resize({ width: MAX_WIDTH, withoutEnlargement: true });

    // Re-compress original if not already done
    if (sizeBefore > 100 * 1024) {
      let buf;
      if (ext === '.png') {
        buf = await img.clone().png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer();
      } else {
        buf = await img.clone().jpeg({ quality: JPEG_QUALITY, progressive: true }).toBuffer();
      }
      if (buf.length < sizeBefore) {
        fs.writeFileSync(filePath, buf);
        totalBefore += sizeBefore;
        totalAfter += buf.length;
        count++;
      } else {
        totalBefore += sizeBefore;
        totalAfter += sizeBefore;
      }
    }

    // Generate WebP version if it doesn't exist or is outdated
    if (!fs.existsSync(webpPath)) {
      const webpBuf = await img.clone().webp({ quality: WEBP_QUALITY }).toBuffer();
      fs.writeFileSync(webpPath, webpBuf);
      const saved = sizeBefore - webpBuf.length;
      totalWebpSaved += Math.max(0, saved);
      webpCount++;
      console.log(`✓ WebP: ${path.relative(IMAGES_DIR, webpPath)} — ${kb(webpBuf.length)} (was ${kb(sizeBefore)})`);
    }
  } catch (e) {
    console.error(`✗ ${filePath}: ${e.message}`);
  }
}

function kb(bytes) { return Math.round(bytes / 1024) + 'KB'; }

(async () => {
  console.log('Processing images in', IMAGES_DIR, '\n');
  walk(IMAGES_DIR);
  await Promise.all(promises);
  console.log(`\n✓ ${count} originals re-compressed`);
  console.log(`✓ ${webpCount} WebP versions created (saved ~${Math.round(totalWebpSaved/1024/1024)}MB vs originals)`);
  console.log(`Total: ${Math.round(totalBefore/1024/1024)}MB → ${Math.round(totalAfter/1024/1024)}MB`);
})();
