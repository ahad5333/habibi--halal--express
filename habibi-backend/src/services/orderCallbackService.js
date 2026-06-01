const platformAuth = require('./platformAuthService');

const UBEREATS_API = 'https://api.uber.com/v1/eats';
const DOORDASH_API = 'https://openapi.doordash.com/marketplace/v1';
const GRUBHUB_API  = 'https://api.grubhub.com';

// Our status → UberEats action endpoint suffix
const UBER_ACTIONS = {
  accepted:  'acceptOrderFulfillment',
  cancelled: 'denyOrderFulfillment',
  ready:     'orderReadyForPickup',
};

// Our status → DoorDash marketplace status string
const DD_STATUS = {
  accepted:  'MERCHANT_ACCEPTED',
  cancelled: 'MERCHANT_DECLINED',
  ready:     'READY_FOR_PICKUP',
  completed: 'ORDER_COMPLETE',
};

async function notifyUberEats(platformOrderId, status) {
  const action = UBER_ACTIONS[status];
  if (!action) return;

  const token = await platformAuth.getUberEatsToken();
  if (!token) { console.warn('[UberEats Callback] Skipped — credentials not set'); return; }

  try {
    const res = await fetch(`${UBEREATS_API}/orders/${platformOrderId}/${action}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    '{}',
    });
    if (res.ok) console.log(`[UberEats] ${action} → order ${platformOrderId}`);
    else        console.error(`[UberEats] ${action} failed ${res.status} → order ${platformOrderId}`);
  } catch (err) { console.error('[UberEats Callback]', err.message); }
}

async function notifyDoorDash(platformOrderId, status) {
  const ddStatus = DD_STATUS[status];
  if (!ddStatus) return;

  const token = await platformAuth.getDoorDashJWT();
  if (!token) { console.warn('[DoorDash Callback] Skipped — credentials not set'); return; }

  try {
    const res = await fetch(`${DOORDASH_API}/orders/${platformOrderId}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: ddStatus }),
    });
    if (res.ok) console.log(`[DoorDash] ${ddStatus} → order ${platformOrderId}`);
    else        console.error(`[DoorDash] Status update failed ${res.status}`);
  } catch (err) { console.error('[DoorDash Callback]', err.message); }
}

async function notifyGrubHub(platformOrderId, status, restaurantId) {
  const rid = await platformAuth.getGrubHubRestaurantId(restaurantId);
  if (!rid) { console.warn('[GrubHub Callback] Skipped — no restaurant ID'); return; }

  const headers = await platformAuth.getGrubHubHeaders();
  if (!headers) { console.warn('[GrubHub Callback] Skipped — credentials not set'); return; }

  let endpoint, method, body;
  if (status === 'accepted') {
    endpoint = `/partnerapi/restaurant/${rid}/order/${platformOrderId}/lines/1/acceptance`;
    method = 'POST'; body = JSON.stringify({ reason: 'accepted' });
  } else if (status === 'cancelled') {
    endpoint = `/partnerapi/restaurant/${rid}/order/${platformOrderId}/lines/1/rejection`;
    method = 'POST'; body = JSON.stringify({ reason: 'RESTAURANT_REJECT' });
  } else if (status === 'ready') {
    endpoint = `/partnerapi/restaurant/${rid}/order/${platformOrderId}/status`;
    method = 'PUT'; body = JSON.stringify({ status: 'READY_FOR_PICKUP' });
  } else { return; }

  try {
    const res = await fetch(`${GRUBHUB_API}${endpoint}`, { method, headers, body });
    if (res.ok) console.log(`[GrubHub] ${status} → order ${platformOrderId}`);
    else        console.error(`[GrubHub] Status update failed ${res.status}`);
  } catch (err) { console.error('[GrubHub Callback]', err.message); }
}

async function notifyPlatform(platform, platformOrderId, status, meta = {}) {
  // Only fire for meaningful status transitions
  if (!['accepted', 'cancelled', 'ready', 'completed'].includes(status)) return;

  try {
    switch (platform) {
      case 'ubereats': return await notifyUberEats(platformOrderId, status);
      case 'doordash': return await notifyDoorDash(platformOrderId, status);
      case 'grubhub':  return await notifyGrubHub(platformOrderId, status, meta.restaurantId);
      case 'caviar':   return await notifyDoorDash(platformOrderId, status); // Caviar = DoorDash
      default: console.warn(`[Callback] Unknown platform: ${platform}`);
    }
  } catch (err) {
    // Never let a callback failure crash the main request
    console.error(`[Callback] ${platform} error:`, err.message);
  }
}

module.exports = { notifyPlatform };
