/**
 * Push notification service — uses Expo Push Notification API.
 *
 * The mobile app registers Expo push tokens (ExponentPushToken[...]) which
 * route through Expo's servers to FCM (Android) and APNs (iOS). No FCM
 * server key or Apple certificates are needed here; Expo handles that layer.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const pool = require('../config/db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

/**
 * Send a single push notification to one Expo push token.
 */
const sendPushNotification = async (deviceToken, title, body, data = {}) => {
  if (!isExpoPushToken(deviceToken)) {
    console.warn(`[Push] Skipping non-Expo token: ${String(deviceToken).slice(0, 20)}...`);
    return { success: false, error: 'Not an Expo push token' };
  }

  const message = {
    to:       deviceToken,
    title,
    body,
    data,
    sound:    'default',
    priority: 'high',
  };

  // Android channel — only sent when the channelId field is present
  if (data?.channelId) message.channelId = data.channelId;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const json = await res.json().catch(() => ({}));
    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;

    if (!res.ok || ticket?.status === 'error') {
      const detail = ticket?.details?.error || JSON.stringify(json);
      console.error(`[Push] Expo API error for token ${deviceToken.slice(0, 30)}...: ${detail}`);
      return { success: false, error: detail };
    }

    console.log(`[Push] Sent — ticket: ${ticket?.id || 'ok'}`);
    return { success: true, ticketId: ticket?.id };
  } catch (err) {
    console.error(`[Push] Network error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Send a push notification to every registered device for a user ID.
 */
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

/**
 * Send an order-status push notification to a user.
 */
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

  const key = status.toLowerCase();
  const title = titles[key] || 'Order Update';
  const body  = bodies[key] || `Order #${orderNumber} status: ${status}.`;

  return sendPushToUser(userId, title, body, {
    orderNumber,
    status,
    channelId: 'orders',
  });
};

/**
 * Send a push notification to every registered device for admin/merchant users.
 * Called when a new customer order arrives so kitchen tablets wake up.
 */
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

module.exports = { sendPushNotification, sendPushToUser, sendOrderPushNotification, sendPushToAdmins };
