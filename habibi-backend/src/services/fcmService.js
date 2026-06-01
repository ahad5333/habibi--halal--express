const pool = require('../config/db');

const fcmServerKey = process.env.FCM_SERVER_KEY;

/**
 * Sends a push notification to a specific device token (FCM Legacy HTTP Protocol)
 */
const sendPushNotification = async (deviceToken, title, body, data = {}) => {
  console.log(`[FCM Push] Attempting push transmission to token: ${deviceToken.slice(0, 15)}...`);

  if (!fcmServerKey) {
    // Premium simulation console output
    console.log('\n┌────────────────────────────────────────────────────────┐');
    console.log(`│                📲  SIMULATED PUSH NOTIFICATION          │`);
    console.log(`├────────────────────────────────────────────────────────┤`);
    console.log(`│ TOKEN: ${deviceToken.slice(0, 48).padEnd(46)}... │`);
    console.log(`│ TITLE: ${title.slice(0, 48).padEnd(46)} │`);
    console.log(`│ BODY:  ${body.slice(0, 48).padEnd(46)} │`);
    if (Object.keys(data).length) {
      console.log(`│ DATA:  ${JSON.stringify(data).slice(0, 48).padEnd(46)} │`);
    }
    console.log('└────────────────────────────────────────────────────────┘\n');
    return { success: true, simulated: true };
  }

  try {
    const endpoint = 'https://fcm.googleapis.com/fcm/send';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: {
          title,
          body,
          sound: 'default'
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      })
    });

    const responseText = await response.text();
    let result = {};
    try { result = JSON.parse(responseText); } catch (_) {}

    if (!response.ok || (result.failure && result.failure > 0)) {
      console.error(`[FCM Push] FCM API returned failure: ${responseText}`);
      return { success: false, error: responseText };
    }

    console.log(`[FCM Push] Push notification successfully sent! ID: ${result.results?.[0]?.message_id || 'unknown'}`);
    return { success: true, messageId: result.results?.[0]?.message_id };
  } catch (err) {
    console.error(`[FCM Push] Transmission FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Fetches all registered device tokens for a user and pushes the message to each
 */
const sendPushToUser = async (userId, title, body, data = {}) => {
  if (!userId) return { success: false, error: 'No user ID provided' };

  try {
    const result = await pool.query(
      'SELECT device_token FROM user_device_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`[FCM Push] User ID ${userId} has no registered push tokens. Skipping push notification.`);
      return { success: true, sent_count: 0 };
    }

    console.log(`[FCM Push] Found ${result.rows.length} device token(s) for User ID ${userId}. Dispatching...`);
    let successCount = 0;

    for (const row of result.rows) {
      const res = await sendPushNotification(row.device_token, title, body, data);
      if (res.success) successCount++;
    }

    return { success: true, sent_count: successCount };
  } catch (err) {
    console.error(`[FCM Push] User dispatch error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Generates and triggers push notifications specific to order updates
 */
const sendOrderPushNotification = async (userId, orderNumber, status) => {
  if (!userId) return;

  const statusTitles = {
    'preparing': 'Kitchen is Cooking! 🍳',
    'in-transit': 'Order on the Way! 🛵',
    'out-for-delivery': 'Order on the Way! 🛵',
    'delivered': 'Feast Delivered! 🎉',
    'completed': 'Feast Delivered! 🎉',
    'cancelled': 'Order Cancelled 🚨'
  };

  const statusBodies = {
    'preparing': `Your order #${orderNumber} is now being crafted by our chef.`,
    'in-transit': `Your order #${orderNumber} is out for delivery. Get ready to eat!`,
    'out-for-delivery': `Your order #${orderNumber} is out for delivery. Get ready to eat!`,
    'delivered': `Your order #${orderNumber} has been dropped off. Enjoy your meal!`,
    'completed': `Your order #${orderNumber} has been dropped off. Enjoy your meal!`,
    'cancelled': `Your order #${orderNumber} has been cancelled. Contact support for assistance.`
  };

  const title = statusTitles[status.toLowerCase()] || 'Order Update';
  const body = statusBodies[status.toLowerCase()] || `Your order #${orderNumber} status changed to ${status}.`;

  return await sendPushToUser(userId, title, body, { orderNumber, status });
};

module.exports = {
  sendPushNotification,
  sendPushToUser,
  sendOrderPushNotification
};
