const { randomUUID } = require('crypto');
const pool         = require('../config/db');
const platformAuth = require('./platformAuthService');

const UBEREATS_API = 'https://api.uber.com/v1/eats';
const DOORDASH_API = 'https://openapi.doordash.com/marketplace/v1';
const GRUBHUB_API  = 'https://api.grubhub.com';

// ── Fetch live menu from DB ─────────────────────────────────────────
async function fetchHabibiMenu() {
  const [cats, items] = await Promise.all([
    pool.query('SELECT DISTINCT category FROM menus WHERE is_available = true ORDER BY category'),
    pool.query('SELECT * FROM menus WHERE is_available = true ORDER BY category, name'),
  ]);
  return { categories: cats.rows.map(r => r.category), items: items.rows };
}

// ── UberEats format ─────────────────────────────────────────────────
function transformForUberEats({ categories, items }) {
  const cats = categories.map(catName => ({
    id:    randomUUID(),
    title: catName,
    entities: items
      .filter(i => i.category === catName)
      .map(item => ({
        id:          randomUUID(),
        title:       item.name,
        description: item.description || '',
        price: {
          amount:        Math.round(parseFloat(item.price || 0) * 100),
          currency_code: 'USD',
        },
        quantity_info: { overrides: [] },
        ...(item.image_url ? { media_info: { media: [{ url: item.image_url }] } } : {}),
      })),
  }));

  return {
    menus: [{
      id:    randomUUID(),
      title: 'Habibi Halal Express',
      service_availability: [{
        day_of_week:  'everyday',
        time_periods: [{ start_time: '00:00', end_time: '23:59' }],
      }],
      category_ids_with_entities: cats,
    }],
  };
}

// ── DoorDash format ─────────────────────────────────────────────────
function transformForDoorDash({ categories, items }) {
  return {
    merchant_supplied_id: 'habibi-main-menu',
    name:       'Habibi Halal Express',
    is_active:  true,
    open_hours: [{ day_of_week: 'everyday', open_time: '0000', close_time: '2359' }],
    categories: categories.map(catName => ({
      merchant_supplied_id: `cat-${catName.toLowerCase().replace(/\s+/g, '-')}`,
      name: catName,
      items: items
        .filter(i => i.category === catName)
        .map(item => ({
          merchant_supplied_id: `item-${item.id}`,
          name:                 item.name,
          description:          item.description || '',
          price:                Math.round(parseFloat(item.price || 0) * 100),
          is_active:            true,
          ...(item.image_url ? { photo_url: item.image_url } : {}),
        })),
    })),
  };
}

// ── GrubHub format ──────────────────────────────────────────────────
function transformForGrubHub({ categories, items }) {
  return {
    menu_category_list: categories.map(catName => ({
      name: catName,
      menu_item_list: items
        .filter(i => i.category === catName)
        .map(item => ({
          name:        item.name,
          description: item.description || '',
          price:       parseFloat(item.price || 0).toFixed(2),
          enabled:     true,
          ...(item.image_url ? { image_url: item.image_url } : {}),
        })),
    })),
  };
}

// ── Platform push functions ─────────────────────────────────────────
async function pushToUberEats(storeId, menu) {
  const token = await platformAuth.getUberEatsToken();
  if (!token) return { success: false, reason: 'UberEats credentials not configured' };
  try {
    const res = await fetch(`${UBEREATS_API}/stores/${storeId}/menus`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(menu),
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, body };
  } catch (err) { return { success: false, reason: err.message }; }
}

async function pushToDoorDash(storeId, menu) {
  const token = await platformAuth.getDoorDashJWT();
  if (!token) return { success: false, reason: 'DoorDash credentials not configured' };
  try {
    const res = await fetch(`${DOORDASH_API}/menus`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...menu, store_id: storeId }),
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, body };
  } catch (err) { return { success: false, reason: err.message }; }
}

async function pushToGrubHub(restaurantId, menu) {
  const headers = await platformAuth.getGrubHubHeaders();
  if (!headers) return { success: false, reason: 'GrubHub credentials not configured' };
  try {
    const res = await fetch(`${GRUBHUB_API}/partnerapi/restaurant/${restaurantId}/menu`, {
      method: 'PUT', headers, body: JSON.stringify(menu),
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, body };
  } catch (err) { return { success: false, reason: err.message }; }
}

// ── Main entry points ───────────────────────────────────────────────
async function syncMenuToPlatform(platform, storeId) {
  const menuData = await fetchHabibiMenu();
  switch (platform) {
    case 'ubereats': return pushToUberEats(storeId, transformForUberEats(menuData));
    case 'doordash': return pushToDoorDash(storeId, transformForDoorDash(menuData));
    case 'grubhub':  return pushToGrubHub(storeId,  transformForGrubHub(menuData));
    case 'caviar':   return pushToDoorDash(storeId,  transformForDoorDash(menuData));
    default:         return { success: false, reason: `Unknown platform: ${platform}` };
  }
}

async function getMenuPreview(platform) {
  const menuData = await fetchHabibiMenu();
  switch (platform) {
    case 'ubereats':  return transformForUberEats(menuData);
    case 'doordash':
    case 'caviar':    return transformForDoorDash(menuData);
    case 'grubhub':   return transformForGrubHub(menuData);
    default:          return null;
  }
}

module.exports = {
  syncMenuToPlatform,
  getMenuPreview,
  transformForUberEats,
  transformForDoorDash,
  transformForGrubHub,
};
