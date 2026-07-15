const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BASE = path.join(__dirname, 'public/images');

const jobs = [
  { src: 'food/kitchen-hero.png',     dest: 'food/kitchen-hero.webp',     width: 1920, quality: 80 },
  { src: 'food/stories-hero.png',     dest: 'food/stories-hero.webp',     width: 1920, quality: 80 },
  { src: 'food/journey-hero.png',     dest: 'food/journey-hero.webp',     width: 1920, quality: 80 },
  { src: 'articles/articles-hero.png', dest: 'articles/articles-hero.webp', width: 1920, quality: 80 },
];

async function run() {
  for (const job of jobs) {
    const src = path.join(BASE, job.src);
    const dest = path.join(BASE, job.dest);
    if (!fs.existsSync(src)) { console.log(`SKIP (missing): ${job.src}`); continue; }
    const before = fs.statSync(src).size;
    await sharp(src).resize({ width: job.width, withoutEnlargement: true }).webp({ quality: job.quality }).toFile(dest);
    const after = fs.statSync(dest).size;
    console.log(`${job.src} → ${job.dest}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (${Math.round((1-after/before)*100)}% saved)`);
  }
}

run().catch(console.error);
