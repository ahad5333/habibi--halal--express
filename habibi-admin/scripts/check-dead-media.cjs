#!/usr/bin/env node
// Fails when a rule inside @media can never apply because the SAME selector
// sets the SAME property again later in the same file, outside any media
// query. Equal specificity resolves by source order, so the later rule wins
// even when the media query matches. This silently broke the home-page
// banner and the partner login on phones (2026-09/10) with no error anywhere.
// Fix: move the @media block below the rule it overrides.
//
// Usage: node scripts/check-dead-media.cjs   (exit 1 if any are found)
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const SRC = path.join(__dirname, '..', 'src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.css')) files.push(p);
  }
})(SRC);

const norm = (s) => s.replace(/\s+/g, ' ').trim();
let found = 0;

for (const file of files) {
  const root = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
  const decls = [];
  let order = 0;
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
    let conditional = false;
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule') conditional = true;
    }
    const sels = rule.selectors.map(norm);
    rule.each((d) => {
      if (d.type !== 'decl') return;
      for (const sel of sels) {
        decls.push({ order: order++, sel, prop: d.prop.toLowerCase(), important: d.important, conditional, line: d.source.start.line, value: d.value });
      }
    });
  });

  const rel = path.relative(path.join(__dirname, '..'), file);
  for (const m of decls) {
    if (!m.conditional || m.important) continue;
    const later = decls.find((b) => !b.conditional && b.sel === m.sel && b.prop === m.prop && b.order > m.order);
    if (later) {
      found++;
      console.log(`  ${rel}:${m.line}  ${m.sel} { ${m.prop}: ${m.value} } never applies -- line ${later.line} sets ${m.prop}: ${later.value} after it`);
    }
  }
}

if (found) {
  console.log(`✗ ${found} @media override(s) cancelled by a later rule. Move each @media block below the rule it overrides.`);
  process.exit(1);
}
console.log(`  ${files.length} CSS files: no cancelled @media overrides`);
