const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'src/pages');
const IMPORT_LINE = "import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';";

const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const fpath = path.join(PAGES_DIR, file);
  let src = fs.readFileSync(fpath, 'utf8');
  const original = src;

  // Skip if no date formatting
  if (!/toLocaleString|toLocaleDateString|toLocaleTimeString/.test(src)) continue;

  // Add import after last existing import line
  if (!src.includes("from '../utils/date")) {
    src = src.replace(/(^import .+\n)(?!import)/m, (match) => {
      // Find the last import block
      return match;
    });
    // Find position of last import line
    const lines = src.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, IMPORT_LINE);
      src = lines.join('\n');
    }
  }

  // Replace: new Date(x).toLocaleString('en-US', { ... })
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleString\('en-US',\s*\{/g, (match, arg) => {
    return `fmtDateTime(${arg}, {`;
  });

  // Replace: new Date(x).toLocaleString() — no options
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)/g, (match, arg) => {
    return `fmtDateTime(${arg})`;
  });

  // Replace: new Date(x).toLocaleDateString('en-US', { ... })
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleDateString\('en-US',\s*\{/g, (match, arg) => {
    return `fmtDate(${arg}, {`;
  });

  // Replace: new Date(x).toLocaleDateString() — no options
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleDateString\(\)/g, (match, arg) => {
    return `fmtDateShort(${arg})`;
  });

  // Replace: new Date(x).toLocaleTimeString('en-US', { ... })
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleTimeString\('en-US',\s*\{/g, (match, arg) => {
    return `fmtTime(${arg}, {`;
  });

  // Replace: new Date(x).toLocaleTimeString([], { ... })
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleTimeString\(\[\],\s*\{/g, (match, arg) => {
    return `fmtTime(${arg}, {`;
  });

  // Replace: new Date(x).toLocaleTimeString() — no options
  src = src.replace(/new Date\(([^)]+)\)\.toLocaleTimeString\(\)/g, (match, arg) => {
    return `fmtTime(${arg})`;
  });

  if (src !== original) {
    fs.writeFileSync(fpath, src);
    console.log(`Updated: ${file}`);
  }
}
console.log('Done.');
