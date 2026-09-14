const pool = require('../config/db');
const { isOpenNow } = require('./businessHours');

// Which store serves an order. The owner's rules, in order (spec section D):
//   1. the store carries every item in the cart. A store carries an item unless
//      CPanel marks it Sold Out or Inactive there, so new stores carry everything;
//   2. the nearest store to the customer, when we know where they are;
//   3. the lowest preference number.
// Stores switched off in CPanel never appear. Stores not taking online orders,
// or missing an item, are still listed so checkout can say why, but can't serve.

const BLOCKING_STATUSES = ['sold_out', 'inactive'];

function milesBetween(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Menu ids a cart needs from its store: regular items, plus the sides and drinks
// bundled into Build-Your-Own items (their ids live in customCfg, the same way
// orderController's price lookup reads them). Accepts cart items or bare ids.
function cartMenuIds(items) {
  const ids = new Set();
  const add = (v) => {
    const id = parseInt(v, 10);
    if (id > 0) ids.add(id);
  };
  for (const item of Array.isArray(items) ? items : []) {
    if (typeof item === 'number' || typeof item === 'string') {
      if (!String(item).startsWith('custom-')) add(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    if (typeof item.id === 'string' && item.id.startsWith('custom-')) {
      Object.keys(item.customCfg?.extras || {}).forEach(add);
      Object.keys(item.customCfg?.drinks || {}).forEach(add);
    } else {
      add(item.id || item.menu_id);
    }
  }
  return [...ids];
}

// Pure, so the rules can be tested without a database. `blocked` holds one row
// per item a store lacks: { location_id, menu_id, name, status }.
function rankLocations(locations, blocked, { lat, lng, isOpen = isOpenNow } = {}) {
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const preference = (l) => {
    const n = parseInt(l.preference_level, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };

  const ranked = locations.map((l) => {
    const la = parseFloat(l.latitude);
    const ln = parseFloat(l.longitude);
    const miles = hasPoint && Number.isFinite(la) && Number.isFinite(ln) ? milesBetween(lat, lng, la, ln) : null;
    const missing = blocked
      .filter((b) => Number(b.location_id) === Number(l.id))
      .map((b) => ({ menu_id: b.menu_id, name: b.name, status: b.status }));
    const acceptingOrders = l.accepting_orders !== false;
    return {
      row: l,
      miles,
      entry: {
        id: l.id,
        title: l.title,
        brief_address: l.brief_address,
        exact_address: l.exact_address,
        phone_number: l.phone_number,
        image_url: l.image_url,
        latitude: l.latitude,
        longitude: l.longitude,
        preference_level: l.preference_level,
        working_days_hours: l.working_days_hours,
        delivery_addresses: l.delivery_addresses,
        distance_miles: miles === null ? null : Math.round(miles * 10) / 10,
        accepting_orders: acceptingOrders,
        open_now: isOpen(l.working_days_hours), // true, false, or null when the hours can't be read
        missing_items: missing,
        can_serve: acceptingOrders && missing.length === 0,
      },
    };
  });

  // Stores that can serve first, open ones before closed ones, then nearest,
  // then lowest preference number. A store with no coordinates, or no customer
  // location yet, sorts on preference alone.
  ranked.sort((a, b) => (
    Number(b.entry.can_serve) - Number(a.entry.can_serve)
    || Number(a.entry.open_now === false) - Number(b.entry.open_now === false)
    || (a.miles ?? Infinity) - (b.miles ?? Infinity)
    || preference(a.row) - preference(b.row)
    || a.row.id - b.row.id
  ));

  const out = ranked.map((r) => r.entry);
  // A closed store is only recommended when no open one can serve (a scheduled
  // order may still be fine); the closed-hours gate at order time decides.
  const recommended = out.find((l) => l.can_serve && l.open_now !== false)
    || out.find((l) => l.can_serve)
    || null;
  return { recommended_id: recommended ? recommended.id : null, locations: out };
}

async function rankServingLocations({ items, lat, lng } = {}) {
  const menuIds = cartMenuIds(items);
  const [locs, blocked] = await Promise.all([
    pool.query(
      `SELECT id, title, brief_address, exact_address, phone_number, image_url, latitude, longitude,
              preference_level, accepting_orders, working_days_hours, delivery_addresses
         FROM locations
        WHERE is_active = TRUE`
    ),
    menuIds.length
      ? pool.query(
        `SELECT a.location_id, a.menu_id, m.name, a.status
           FROM menu_location_availability a
           JOIN menus m ON m.id = a.menu_id
          WHERE a.menu_id = ANY($1::int[]) AND a.status = ANY($2::text[])`,
        [menuIds, BLOCKING_STATUSES]
      )
      : Promise.resolve({ rows: [] }),
  ]);
  return rankLocations(locs.rows, blocked.rows, { lat, lng });
}

// Why a store can't take this order, or null if it can. The order endpoints use
// it so a stale checkout, or a direct API call, can't send an order to a store
// that is switched off, not taking online orders, or missing an item.
async function locationProblem(locationId, items) {
  const id = parseInt(locationId, 10);
  if (!(id > 0)) return null;
  const { rows } = await pool.query(
    'SELECT id, title, is_active, accepting_orders FROM locations WHERE id = $1',
    [id]
  );
  const loc = rows[0];
  if (!loc || loc.is_active === false) {
    return 'That store isn’t available any more. Please choose another store.';
  }
  if (loc.accepting_orders === false) {
    return `${loc.title} isn’t taking online orders right now. Please choose another store.`;
  }
  const menuIds = cartMenuIds(items);
  if (!menuIds.length) return null;
  const missing = await pool.query(
    `SELECT DISTINCT m.name
       FROM menu_location_availability a
       JOIN menus m ON m.id = a.menu_id
      WHERE a.location_id = $1 AND a.menu_id = ANY($2::int[]) AND a.status = ANY($3::text[])
      ORDER BY m.name`,
    [id, menuIds, BLOCKING_STATUSES]
  );
  if (!missing.rows.length) return null;
  const names = missing.rows.map((r) => r.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${loc.title} doesn’t have ${list} right now. Please choose another store, or remove ${names.length === 1 ? 'it' : 'them'} from your cart.`;
}

module.exports = { cartMenuIds, rankLocations, rankServingLocations, locationProblem, milesBetween };
