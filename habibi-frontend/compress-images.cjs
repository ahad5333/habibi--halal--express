const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BASE = path.join(__dirname, 'public/images');

const jobs = [
  // hero background → webp
  { src: 'hero/slate_bg.png',        dest: 'hero/slate_bg.webp',        format: 'webp', quality: 80, width: 1920 },
  // menu page title → webp
  { src: 'title/menu-title.png',     dest: 'title/menu-title.webp',     format: 'webp', quality: 82, width: 1920 },
  // about hero → jpeg
  { src: 'title/about-hero.png',     dest: 'title/about-hero.jpg',      format: 'jpeg', quality: 82, width: 1920 },
  // food fallback images → jpeg
  { src: 'food/food-1.png', dest: 'food/food-1.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-2.png', dest: 'food/food-2.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-3.png', dest: 'food/food-3.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-4.png', dest: 'food/food-4.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-5.png', dest: 'food/food-5.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-6.png', dest: 'food/food-6.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-7.png', dest: 'food/food-7.jpg', format: 'jpeg', quality: 82, width: 800 },
  { src: 'food/food-8.png', dest: 'food/food-8.jpg', format: 'jpeg', quality: 82, width: 800 },
];

async function run() {
  for (const job of jobs) {
    const src = path.join(BASE, job.src);
    const dest = path.join(BASE, job.dest);
    if (!fs.existsSync(src)) { console.log(`SKIP (missing): ${job.src}`); continue; }
    const before = fs.statSync(src).size;
    let pipe = sharp(src).resize({ width: job.width, withoutEnlargement: true });
    if (job.format === 'webp') pipe = pipe.webp({ quality: job.quality });
    else pipe = pipe.jpeg({ quality: job.quality, mozjpeg: true });
    await pipe.toFile(dest);
    const after = fs.statSync(dest).size;
    console.log(`${job.src} → ${job.dest}: ${(before/1024/1024).toFixed(1)}MB → ${(after/1024).toFixed(0)}KB (${Math.round((1-after/before)*100)}% savings)`);
  }
}

run().catch(console.error);
