/**
 * Push notification service.
 *
 * Mobile (Expo) tokens — ExponentPushToken[...] — are sent via Expo's Push API.
 * Expo routes them through FCM (Android) and APNs (iOS) so no Firebase creds
 * are needed for mobile.
 *
 * Web browser tokens (long FCM registration tokens) are sent directly via the
 * Firebase Admin SDK (FCM HTTP v1 API), which requires the service account JSON.
 */

const pool = require('../config/db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Firebase Admin (lazy init) ────────────────────────────────────────────
let _admin = null;

function getAdmin() {
  if (_admin) return _admin;

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;

  try {
    // firebase-admin v14+ uses modular imports
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');

    if (!getApps().length) {
      const serviceAccount = typeof saJson === 'string' && saJson.trim().startsWith('/')
        ? require(saJson)
        : JSON.parse(saJson);
      initializeApp({ credential: cert(serviceAccount) });
    }
    _admin = { messaging: () => getMessaging() };
    return _admin;
  } catch (err) {
    console.error('[Push] Firebase Admin init error:', err.message);
    return null;
  }
}

// ─── Token type detection ──────────────────────────────────────────────────
const isExpoPushToken = token =>
  typeof token === 'string' && token.startsWith('ExponentPushToken[');

const isWebFCMToken = token =>
  typeof token === 'string' && token.length > 50 && !isExpoPushToken(token);

// ─── Expo push ─────────────────────────────────────────────────────────────
const sendExpoNotification = async (deviceToken, title, body, data = {}) => {
  const message = { to: deviceToken, title, body, data, sound: 'default', priority: 'high' };
  if (data?.channelId) message.channelId = data.channelId;

  try {
    const res  = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body:    JSON.stringify(message),
    });
    const json   = await res.json().catch(() => ({}));
    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!res.ok || ticket?.status === 'error') {
      const detail = ticket?.details?.error || JSON.stringify(json);
      console.error(`[Push] Expo error for ${deviceToken.slice(0, 30)}…: ${detail}`);
      return { success: false, error: detail };
    }
    console.log(`[Push] Expo sent — ticket: ${ticket?.id || 'ok'}`);
    return { success: true, ticketId: ticket?.id };
  } catch (err) {
    console.error(`[Push] Expo network error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ─── Web FCM push (Firebase Admin SDK) ─────────────────────────────────────
const sendFCMNotification = async (deviceToken, title, body, data = {}) => {
  const admin = getAdmin();
  if (!admin) {
    console.warn('[Push] Firebase Admin not configured — skipping web FCM token.');
    return { success: false, error: 'Firebase not configured' };
  }

  try {
    const message = {
      token: deviceToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: {
        notification: {
          title,
          body,
          icon:  '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        },
        fcm_options: { link: data?.url || '/' },
      },
    };

    const msgId = await admin.messaging().send(message);
    console.log(`[Push] FCM web sent — messageId: ${msgId}`);
    return { success: true, messageId: msgId };
  } catch (err) {
    console.error(`[Push] FCM error: ${err.message}`);
    // Auto-clean stale/invalid tokens
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      await pool.query('DELETE FROM user_device_tokens WHERE device_token = $1', [deviceToken])
        .catch(() => {});
      console.log('[Push] Stale FCM token removed from DB.');
    }
    return { success: false, error: err.message };
  }
};

// ─── Unified dispatcher ─────────────────────────────────────────────────────
const sendPushNotification = async (deviceToken, title, body, data = {}) => {
  if (isExpoPushToken(deviceToken)) return sendExpoNotification(deviceToken, title, body, data);
  if (isWebFCMToken(deviceToken))   return sendFCMNotification(deviceToken, title, body, data);
  console.warn(`[Push] Skipping unrecognised token: ${String(deviceToken).slice(0, 20)}…`);
  return { success: false, error: 'Unrecognised token format' };
};

// ─── Send to all devices for a user ────────────────────────────────────────
const sendPushToUser = async (userId, title, body, data = {}) => {
  if (!userId) return { success: false, error: 'No user ID provided' };
  try {
    const result = await pool.query(
      'SELECT device_token FROM user_device_tokens WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      console.log(`[Push] No device tokens for user ${userId} — skipping.`);
      return { success: true, sent_count: 0 };
    }
    console.log(`[Push] Sending to ${result.rows.length} device(s) for user ${userId}…`);
    let successCount = 0;
    for (const { device_token } of result.rows) {
      const r = await sendPushNotification(device_token, title, body, data);
      if (r.success) successCount++;
    }
    return { success: true, sent_count: successCount };
  } catch (err) {
    console.error(`[Push] User dispatch error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ─── Order status push ──────────────────────────────────────────────────────
const sendOrderPushNotification = async (userId, orderNumber, status) => {
  if (!userId) return;

  const titles = {
    pending:          'Order Received 🧾',
    accepted:         'Order Accepted ✅',
    preparing:        'Kitchen is Cooking 🍳',
    cooking:          'Kitchen is Cooking 🍳',
    ready:            'Order Ready 🔔',
    out_for_delivery: 'On the Way! 🛵',
    delivered:        'Delivered! 🎉',
    completed:        'Delivered! 🎉',
    cancelled:        'Order Cancelled 🚨',
  };
  const bodies = {
    pending:          `Your order #${orderNumber} is awaiting confirmation.`,
    accepted:         `The kitchen has accepted order #${orderNumber}.`,
    preparing:        `Your order #${orderNumber} is being prepared.`,
    cooking:          `Your order #${orderNumber} is being prepared.`,
    ready:            `Order #${orderNumber} is ready for pickup / on its way.`,
    out_for_delivery: `Order #${orderNumber} is out for delivery. Get ready!`,
    delivered:        `Order #${orderNumber} delivered. Enjoy your meal!`,
    completed:        `Order #${orderNumber} delivered. Enjoy your meal!`,
    cancelled:        `Order #${orderNumber} was cancelled. Contact us for help.`,
  };

  const key   = status.toLowerCase();
  const title = titles[key] || 'Order Update';
  const body  = bodies[key] || `Order #${orderNumber} status: ${status}.`;

  return sendPushToUser(userId, title, body, { orderNumber, status, channelId: 'orders' });
};

// ─── Send to all admin/merchant devices ────────────────────────────────────
const sendPushToAdmins = async (title, body, data = {}) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT udt.device_token
       FROM user_device_tokens udt
       JOIN users u ON u.id = udt.user_id
       WHERE u.role IN ('admin', 'merchant')`
    );
    if (result.rows.length === 0) {
      console.log('[Push] No merchant/admin device tokens registered.');
      return { success: true, sent_count: 0 };
    }
    console.log(`[Push] Alerting ${result.rows.length} merchant/admin device(s)…`);
    let successCount = 0;
    for (const { device_token } of result.rows) {
      const r = await sendPushNotification(device_token, title, body, data);
      if (r.success) successCount++;
    }
    return { success: true, sent_count: successCount };
  } catch (err) {
    console.error(`[Push] Admin dispatch error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ─── Send to all staff order-queue devices (kitchen/manager/cashier/server) ──
// Separate from sendPushToAdmins -- staff_members is not the users table, and
// this deliberately excludes role='delivery' (drivers get their own broadcast
// via dispatchController.js, not a generic new-order alert).
const sendPushToStaff = async (title, body, data = {}) => {
  try {
    const result = await pool.query(
      `SELECT driver_fcm_token FROM staff_members
       WHERE role IN ('kitchen','manager','cashier','server')
         AND is_active=TRUE AND driver_fcm_token IS NOT NULL`
    );
    if (result.rows.length === 0) return { success: true, sent_count: 0 };
    let successCount = 0;
    for (const { driver_fcm_token } of result.rows) {
      const r = await sendPushNotification(driver_fcm_token, title, body, data);
      if (r.success) successCount++;
    }
    return { success: true, sent_count: successCount };
  } catch (err) {
    console.error(`[Push] Staff dispatch error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendPushNotification,
  sendPushToUser,
  sendOrderPushNotification,
  sendPushToAdmins,
  sendPushToStaff,
};
