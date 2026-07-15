const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE = path.join(__dirname, 'public/images');

function getAllImages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllImages(full));
    else if (/\.(png|jpe?g)$/i.test(entry.name)) results.push(full);
  }
  return results;
}

async function run() {
  const images = getAllImages(BASE);
  console.log(`Found ${images.length} images to convert\n`);

  let totalBefore = 0, totalAfter = 0, skipped = 0;

  for (const src of images) {
    const dest = src.replace(/\.(png|jpe?g)$/i, '.webp');
    if (fs.existsSync(dest)) {
      // Already has webp — skip if webp is newer than source
      const srcMtime = fs.statSync(src).mtimeMs;
      const destMtime = fs.statSync(dest).mtimeMs;
      if (destMtime >= srcMtime) { skipped++; continue; }
    }

    const before = fs.statSync(src).size;
    const rel = path.relative(BASE, src);

    try {
      // Hero/title backgrounds: resize to max 1920px wide
      const isBig = /hero|title|background|slate_bg|about|hiring|kitchen/i.test(src);
      // Menu/food thumbnails: resize to max 800px wide
      const isThumb = /\/menu\/|\/food\/|\/byo\/|staff/i.test(src);
      const width = isBig ? 1920 : isThumb ? 800 : 1200;

      await sharp(src)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(dest);

      const after = fs.statSync(dest).size;
      totalBefore += before;
      totalAfter  += after;
      const pct = Math.round((1 - after / before) * 100);
      console.log(`✓ ${rel}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB  (-${pct}%)`);
    } catch (err) {
      console.log(`✗ FAILED ${rel}: ${err.message}`);
    }
  }

  console.log(`\nSkipped (already up-to-date): ${skipped}`);
  console.log(`\nTotal: ${(totalBefore/1024/1024).toFixed(1)}MB → ${(totalAfter/1024/1024).toFixed(1)}MB`);
  console.log(`Saved: ${((totalBefore-totalAfter)/1024/1024).toFixed(1)}MB (${Math.round((1-totalAfter/totalBefore)*100)}%)`);
}

run().catch(console.error);
