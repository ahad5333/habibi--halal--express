const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BASE = path.join(__dirname, 'public/images');

const jobs = [
  // hero food image (transparent background) → webp
  { src: 'hero/round_food.png',         dest: 'hero/round_food.webp',         format: 'webp', quality: 85 },
  // story section chef image → webp
  { src: 'story-chef.png',              dest: 'story-chef.webp',              format: 'webp', quality: 85, width: 900 },
  // about page kitchen story → jpeg
  { src: 'our_story_kitchen.png',       dest: 'our_story_kitchen.jpg',        format: 'jpeg', quality: 82, width: 1000 },
  // nav dropdown thumbnails → webp
  { src: 'nav/menu.png',       dest: 'nav/menu.webp',       format: 'webp', quality: 80, width: 400 },
  { src: 'nav/about.png',      dest: 'nav/about.webp',      format: 'webp', quality: 80, width: 400 },
  { src: 'nav/locations.png',  dest: 'nav/locations.webp',  format: 'webp', quality: 80, width: 400 },
  { src: 'nav/staff.png',      dest: 'nav/staff.webp',      format: 'webp', quality: 80, width: 400 },
  // builder ingredient images (transparency) → webp
  { src: 'builder/base_rice.png',         dest: 'builder/base_rice.webp',         format: 'webp', quality: 85 },
  { src: 'builder/base_salad.png',        dest: 'builder/base_salad.webp',        format: 'webp', quality: 85 },
  { src: 'builder/base_hummus.png',       dest: 'builder/base_hummus.webp',       format: 'webp', quality: 85 },
  { src: 'builder/protein_chicken.png',   dest: 'builder/protein_chicken.webp',   format: 'webp', quality: 85 },
  { src: 'builder/protein_beef.png',      dest: 'builder/protein_beef.webp',      format: 'webp', quality: 85 },
  { src: 'builder/protein_falafel.png',   dest: 'builder/protein_falafel.webp',   format: 'webp', quality: 85 },
  { src: 'builder/topping_feta.png',      dest: 'builder/topping_feta.webp',      format: 'webp', quality: 85 },
  { src: 'builder/topping_olives.png',    dest: 'builder/topping_olives.webp',    format: 'webp', quality: 85 },
  { src: 'builder/sauce_white.png',       dest: 'builder/sauce_white.webp',       format: 'webp', quality: 85 },
  { src: 'builder/sauce_hot.png',         dest: 'builder/sauce_hot.webp',         format: 'webp', quality: 85 },
  { src: 'builder/empty-bowl.png',        dest: 'builder/empty-bowl.webp',        format: 'webp', quality: 85 },
  { src: 'builder/realistic-3d-bowl.png', dest: 'builder/realistic-3d-bowl.webp', format: 'webp', quality: 85 },
];

async function run() {
  for (const job of jobs) {
    const src = path.join(BASE, job.src);
    const dest = path.join(BASE, job.dest);
    if (!fs.existsSync(src)) { console.log(`SKIP (missing): ${job.src}`); continue; }
    const before = fs.statSync(src).size;
    let pipe = sharp(src);
    if (job.width) pipe = pipe.resize({ width: job.width, withoutEnlargement: true });
    if (job.format === 'webp') pipe = pipe.webp({ quality: job.quality });
    else pipe = pipe.jpeg({ quality: job.quality, mozjpeg: true });
    await pipe.toFile(dest);
    const after = fs.statSync(dest).size;
    console.log(`${job.src} → ${job.dest}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (${Math.round((1-after/before)*100)}% savings)`);
  }
}

run().catch(console.error);
