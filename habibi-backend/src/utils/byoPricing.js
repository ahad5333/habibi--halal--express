// Server-side mirror of the BYO pricing formula in
// habibi-frontend/src/pages/CustomOrder.jsx (`total` useMemo). Keep the two
// in sync if either changes. Ingredient prices always come from the
// `byo_ingredients` / `menus` tables here, never from the client payload.

const VEG_QTY_MULT    = { low: 1, regular: 1, extra: 1.5, double: 2 };
const SAUCE_FOOD_MULT = { low: 0.5, regular: 1, extra: 2 };

const PROTEIN_BASE_TIERED = new Set([
  'chicken', 'lamb-gyro', 'mix', 'bacon', 'tuna', 'shrimp', 'turkey',
]);

function getBaseMultipliers(baseId) {
  const isFamilyTray = baseId === '39j';
  const isHero       = baseId === '39a';
  const isPlatter    = baseId === '39i';
  return {
    cheese:  (isHero || isFamilyTray) ? 2 : 1,
    veg:     isFamilyTray ? 3 : 1,
    protein: isFamilyTray ? 4 : (isHero || isPlatter) ? 1 : 0.8,
  };
}

function calcProteinPrice(unitPrice, qtyType, qty) {
  switch (qtyType) {
    case 'low-extra':
      return unitPrice * ({ low: 0.75, regular: 1, extra: 4 / 3, double: 2 }[qty] ?? 1);
    case 'eggs':
      return unitPrice * (parseInt(qty, 10) || 1);
    case 'single-double':
      return unitPrice * (qty === 'double' ? 2 : 1);
    case 'single-triple':
      return unitPrice * (qty === 'triple' ? 3 : qty === 'double' ? 2 : 1);
    default:
      return unitPrice;
  }
}

/**
 * Recomputes a custom BYO item's per-unit total price from its raw
 * configuration (`customCfg`, forwarded verbatim from the cart) using only
 * DB-sourced ingredient prices. Throws with message 'unavailable_ingredient'
 * if the config references a base/ingredient/menu id that isn't active —
 * the caller treats that the same as "cart is stale, please refresh".
 */
function computeCustomItemPrice(cfg, ingredientMaps, menuPriceMap) {
  const { baseMap, cheeseMap, vegMap, proteinMap, sauceMap } = ingredientMaps;

  const baseId = cfg?.base?.id;
  const base = baseId && baseMap.get(baseId);
  if (!base) throw new Error('unavailable_ingredient');
  const mult = getBaseMultipliers(baseId);
  let t = base.price;

  if (cfg.cheese?.type && cfg.cheese.type !== 'none') {
    const c = cheeseMap.get(cfg.cheese.type);
    if (!c) throw new Error('unavailable_ingredient');
    t += c.price * mult.cheese;
  }

  for (const [id, v] of Object.entries(cfg.vegetables || {})) {
    const veg = vegMap.get(id);
    if (!veg) throw new Error('unavailable_ingredient');
    t += veg.price * (VEG_QTY_MULT[v?.qty] || 1) * mult.veg;
  }

  for (const [id, p] of Object.entries(cfg.proteins || {})) {
    const protein = proteinMap.get(id);
    if (!protein) throw new Error('unavailable_ingredient');
    const m = PROTEIN_BASE_TIERED.has(id) ? mult.protein : 1;
    t += calcProteinPrice(protein.price, protein.qty_type, p?.qty) * m;
  }

  for (const [id, s] of Object.entries(cfg.sauces || {})) {
    const sauce = sauceMap.get(id);
    if (!sauce) throw new Error('unavailable_ingredient');
    t += s?.placement === 'on_side'
      ? sauce.price * (s.count || 1)
      : sauce.price * (SAUCE_FOOD_MULT[s?.qty] || 1);
  }

  for (const [id, cnt] of Object.entries(cfg.extras || {})) {
    const price = menuPriceMap.get(parseInt(id, 10));
    if (price == null) throw new Error('unavailable_ingredient');
    t += price * (parseInt(cnt, 10) || 0);
  }

  for (const [id, cnt] of Object.entries(cfg.drinks || {})) {
    const price = menuPriceMap.get(parseInt(id, 10));
    if (price == null) throw new Error('unavailable_ingredient');
    t += price * (parseInt(cnt, 10) || 0);
  }

  return Math.max(0, t);
}

module.exports = {
  computeCustomItemPrice,
  getBaseMultipliers,
  calcProteinPrice,
  VEG_QTY_MULT,
  SAUCE_FOOD_MULT,
  PROTEIN_BASE_TIERED,
};
