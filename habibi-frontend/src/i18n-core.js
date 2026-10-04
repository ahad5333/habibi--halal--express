// The subset of i18next the site actually uses, as plain functions. i18next
// + react-i18next were ~94 KB of the main bundle while the site has had a
// single language (English) since Arabic was removed. Behaviour matches
// i18next for every key in locales/en.json (checked key by key against the
// real library when this replaced it, 2026-10-04).
//
// Supported: dotted keys, {{var}} interpolation (no escaping -- React escapes),
// count plurals via Intl.PluralRules (key_one / key_other, falling back to the
// bare key), returnObjects, and missing/empty strings returning the key.
// To bring back real multi-language support, restore i18next in src/i18n.js;
// every t() call site stays as it is.

export function createT(resources, lng = 'en') {
  const plural = new Intl.PluralRules(lng);

  const lookup = (key) => {
    let node = resources;
    for (const part of key.split('.')) {
      if (node == null || typeof node !== 'object') return undefined;
      node = node[part];
    }
    return node;
  };

  const interpolate = (str, opts) =>
    str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name) => {
      const v = name.split('.').reduce((o, p) => (o == null ? undefined : o[p]), opts);
      return v === undefined || v === null ? match : String(v);
    });

  return function t(key, opts = {}) {
    let value;
    if (typeof opts.count === 'number') {
      value = lookup(`${key}_${plural.select(opts.count)}`);
    }
    if (value === undefined || value === '') value = lookup(key);

    if (value === undefined || value === '') return key;
    if (typeof value !== 'string') return opts.returnObjects ? value : key;
    return interpolate(value, opts);
  };
}
