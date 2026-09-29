#!/usr/bin/env node
// Makes the main CSS bundle non-render-blocking, after the build, not during it.
//
// Why this exists: index-*.css (188KB) is a normal <link rel="stylesheet"> that
// Vite injects into dist/index.html. A blocking stylesheet holds up first paint
// of the WHOLE document, not just the elements it styles -- so the boot loading
// screen (index.html's own inline <style>, unrelated to this file) could not
// appear until this 188KB file had downloaded. Flagged since the loader was
// built (2026-09-27), deliberately left alone at the time because the fix
// usually means a Vite plugin or config change that runs DURING the build --
// more moving parts, another way the build itself could quietly break.
//
// This takes the opposite shape on purpose: vite.config.js and `npm run build`
// are completely untouched, so the build's own output is byte-for-byte what it
// always was. This script only rewrites the ALREADY-BUILT dist/index.html
// afterwards, using the exact preload+onload-swap technique already in this
// file for Google Fonts. If Vite ever changes how it injects the stylesheet
// link, this script refuses to touch anything and exits non-zero rather than
// silently shipping a broken page -- deploy.sh stops right there.
'use strict';
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const LINK_RE = /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/;

const html = fs.readFileSync(INDEX_PATH, 'utf8');
const matches = html.match(new RegExp(LINK_RE, 'g')) || [];

if (matches.length !== 1) {
  console.error(
    `  !! expected exactly one main-bundle stylesheet link in dist/index.html, found ${matches.length}.\n` +
    `     Vite's HTML output may have changed shape -- refusing to guess. Fix this script before deploying.`
  );
  process.exit(1);
}

const href = html.match(LINK_RE)[1];
const replacement =
  `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
  `<noscript><link rel="stylesheet" href="${href}"></noscript>`;

const out = html.replace(LINK_RE, replacement);
if (out === html) {
  console.error('  !! replacement did not change the file -- aborting.');
  process.exit(1);
}
fs.writeFileSync(INDEX_PATH, out);
console.log(`  deferred ${href} (no longer render-blocking)`);
