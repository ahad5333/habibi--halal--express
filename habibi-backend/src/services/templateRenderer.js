const fs   = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const TEMPLATES_DIR = path.join(__dirname, '../templates/email');
const cache = new Map();

Handlebars.registerHelper('currency', (val) => parseFloat(val || 0).toFixed(2));
Handlebars.registerHelper('join',     (arr)  => Array.isArray(arr) ? arr.join(', ') : '');
Handlebars.registerHelper('upper',    (str)  => (str || '').toUpperCase());

function load(name) {
  if (!cache.has(name)) {
    const src = fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.hbs`), 'utf-8');
    cache.set(name, Handlebars.compile(src));
  }
  return cache.get(name);
}

// Render a single template (content or base wrapper)
function renderBody(templateName, data) {
  return load(templateName)(data);
}

// Render content template then wrap it in a base layout
function renderEmail(templateName, data, baseTemplate = 'base-light') {
  const content = renderBody(templateName, data);
  return renderBody(baseTemplate, { ...data, content, year: new Date().getFullYear() });
}

module.exports = { renderBody, renderEmail };
