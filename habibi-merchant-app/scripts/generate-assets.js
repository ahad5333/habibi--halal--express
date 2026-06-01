/**
 * Generates merchant-branded placeholder PNG assets.
 * Run: node scripts/generate-assets.js
 * Replace with final designed assets before production build.
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32 for PNG chunk checksums
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const chk = Buffer.allocUnsafe(4); chk.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, chk]);
}

/**
 * Creates a solid-color PNG with a centered gold cross-hair mark so
 * you can see it rendered (easier than a pure black square to spot).
 */
function makePNG(width, height, bgR, bgG, bgB, fgR, fgG, fgB) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const cx = Math.floor(width  / 2);
  const cy = Math.floor(height / 2);
  const markW = Math.max(4, Math.floor(width  * 0.04));
  const markH = Math.max(4, Math.floor(height * 0.04));

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(1 + width * 3);
    row[0] = 0; // filter: None
    const isMark =
      (Math.abs(y - cy) <= markH) ||
      false; // column check done per pixel below
    for (let x = 0; x < width; x++) {
      const isCenter = isMark || Math.abs(x - cx) <= markW;
      const inCross  = (Math.abs(y - cy) <= markH) || (Math.abs(x - cx) <= markW);
      const useFg    = inCross;
      row[1 + x * 3]     = useFg ? fgR : bgR;
      row[1 + x * 3 + 1] = useFg ? fgG : bgG;
      row[1 + x * 3 + 2] = useFg ? fgB : bgB;
    }
    rows.push(row);
  }

  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const OUT = path.join(__dirname, '..', 'assets');

// Brand colors
const BG  = [11,  11,  13];   // #0B0B0D
const GOLD = [242, 201, 76];  // #F2C94C

const assets = [
  { file: 'icon.png',          w: 1024, h: 1024 },
  { file: 'adaptive-icon.png', w: 1024, h: 1024 },
  { file: 'favicon.png',       w:   48, h:   48 },
  { file: 'splash.png',        w: 1284, h: 2778 },
];

for (const { file, w, h } of assets) {
  const buf = makePNG(w, h, ...BG, ...GOLD);
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`  wrote ${file}  (${w}x${h}, ${buf.length} bytes)`);
}

console.log('\nDone. Replace with final designed assets before production build.');
