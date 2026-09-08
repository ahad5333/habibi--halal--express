// Everything that must happen for the CUSTOMER when an order's status changes,
// regardless of which screen changed it.
//
// This exists because there are two status-change paths and only one of them
// did any of this. The admin panel (orderController.updateGuestOrderStatus)
// emailed, texted, pushed, wrote an in-app notification, awarded loyalty points
// on delivery and completed referrals. The staff order queue
// (dineInRoutes PATCH /kitchen/orders/:id/status) -- which is the path kitchen
// and counter staff actually use all day -- notified other STAFF and drivers
// and told the customer nothing at all. It also emitted its socket event only
// to the 'admins' room, so a customer sitting on /order-tracking watched a
// screen that never moved while their food was cooked and handed over.
//
// The loyalty consequence was the quiet one: a pickup order completed at the
// counter awarded no points and completed no referral, because only the admin
// path ever ran that code.
//
// Keep this the single place that answers "what does the customer get when an
// order moves?", so the next screen that changes a status inherits it.

const pool = require('../config/db');
const emailService = require('./emailService');
const smsService = require('./smsService');
const fcmService = require('./fcmService');

const STATUS_BODY = {
  pending:          'Your order is awaiting confirmation.',
  accepted:         'Great news — the kitchen has accepted your order!',
  preparing:        'The kitchen is now preparing your food.',
  cooking:          'Your food is being cooked to perfection.',
  ready:            'Your order is ready! Pickup or on its way.',
  out_for_delivery: 'Your order is out for delivery. Hang tight!',
  delivered:        'Your order has been delivered. Enjoy your meal! 🍽️',
  cancelled:        'Your order has been cancelled. Contact us if you need help.',
};

const REFERRAL_BONUS = 500;

/**
 * @param {object}  opts
 * @param {object}  opts.io              socket.io server (optional)
 * @param {number}  opts.orderId
 * @param {string}  opts.orderNumber
 * @param {string}  opts.status          the status just applied
 * @param {string}  opts.previousStatus  status before the change (loyalty guard)
 * @param {string}  opts.customerEmail
 * @param {string}  opts.customerPhone
 * @param {number}  opts.total
 *
 * Never throws: a notification problem must not fail the status change that
 * triggered it. Every branch logs and moves on.
 */
async function applyOrderStatusEffects({
  io, orderId, orderNumber, status, previousStatus,
  customerEmail, customerPhone, total,
}) {
  // ── 1. Live tracking page ────────────────────────────────────────────────
  // The customer's /order-tracking joins room `order_<id>`. Without this the
  // page only updates when its own poll happens to come round.
  if (io && orderId) {
    try {
      io.to(`order_${orderId}`).emit('order_status_updated', { order_id: orderId, status });
    } catch (err) {
      console.error('[OrderStatus] socket emit failed:', err.message);
    }
  }

  // ── 2. Email ─────────────────────────────────────────────────────────────
  if (customerEmail) {
    emailService.sendOrderStatusUpdate(customerEmail, orderNumber, status)
      .catch(err => console.error('[OrderStatus] status email failed:', err.message));
  }

  // ── 3. SMS ───────────────────────────────────────────────────────────────
  if (customerPhone) {
    smsService.sendOrderUpdate(customerPhone, orderNumber, status)
      .catch(err => console.error('[OrderStatus] status SMS failed:', err.message));
  }

  // ── 4. Push + in-app notification (registered customers only) ────────────
  let userId = null;
  if (customerEmail) {
    try {
      const userRes = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [customerEmail]
      );
      userId = userRes.rows[0]?.id || null;
    } catch (err) {
      console.error('[OrderStatus] user lookup failed:', err.message);
    }
  }

  if (userId) {
    fcmService.sendOrderPushNotification(userId, orderNumber, status)
      .catch(err => console.error('[OrderStatus] push failed:', err.message));

    const body = STATUS_BODY[status] || `Your order status is now: ${status}.`;
    pool.query(
      'INSERT INTO user_notifications (user_id, title, body) VALUES ($1, $2, $3)',
      [userId, `Order Update — #${orderNumber}`, body]
    ).catch(err => console.error('[OrderStatus] notification insert failed:', err.message));
  }

  // ── 4b. Guest push ───────────────────────────────────────────────────────
  // Someone who ordered without an account has no user_id and therefore no row
  // in user_device_tokens, so steps above reach them by email/SMS only. Tokens
  // registered against this specific order cover them.
  try {
    const guestTokens = await pool.query(
      'SELECT device_token FROM guest_push_tokens WHERE order_number = $1', [orderNumber]
    );
    if (guestTokens.rows.length) {
      const body = STATUS_BODY[status] || `Your order status is now: ${status}.`;
      for (const { device_token } of guestTokens.rows) {
        fcmService.sendPushNotification(
          device_token,
          `Order Update — #${orderNumber}`,
          body,
          { orderNumber, status, url: `/order-tracking?order=${orderNumber}` }
        ).catch(err => console.error('[OrderStatus] guest push failed:', err.message));
      }
    }
    // Once the order is finished these tokens have nothing left to say.
    if (['delivered', 'cancelled', 'refunded', 'completed'].includes(status)) {
      pool.query('DELETE FROM guest_push_tokens WHERE order_number = $1', [orderNumber])
        .catch(err => console.error('[OrderStatus] guest token cleanup failed:', err.message));
    }
  } catch (err) {
    console.error('[OrderStatus] guest push lookup failed:', err.message);
  }

  // ── 5. Loyalty points on delivery ────────────────────────────────────────
  // Guarded on the previous status so re-saving 'delivered' can't award twice.
  if (status === 'delivered' && previousStatus !== 'delivered' && customerEmail && total) {
    const pts = Math.floor(parseFloat(total) || 0);
    if (pts > 0) {
      pool.query(
        'UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE LOWER(email) = LOWER($2)',
        [pts, customerEmail]
      ).catch(err => console.error('[OrderStatus] loyalty award failed:', err.message));
    }

    // ── 6. Complete a pending referral on the referee's FIRST delivered order
    completeReferralIfFirstDelivery(customerEmail)
      .catch(err => console.error('[OrderStatus] referral completion failed:', err.message));
  }
}

async function completeReferralIfFirstDelivery(customerEmail) {
  const countRes = await pool.query(
    `SELECT id FROM guest_orders WHERE customer_email = $1 AND order_status = 'delivered'`,
    [customerEmail]
  );
  if (countRes.rows.length !== 1) return; // not their first delivered order

  const userRes = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [customerEmail]
  );
  if (!userRes.rows[0]) return;
  const refereeId = userRes.rows[0].id;

  const refRow = await pool.query(
    `SELECT id, referrer_id FROM referrals WHERE referee_user_id = $1 AND status = 'pending' LIMIT 1`,
    [refereeId]
  );
  if (!refRow.rows[0]) return;

  const { id: refId, referrer_id } = refRow.rows[0];
  await pool.query(
    `UPDATE referrals SET status = 'completed', points_awarded = $1, completed_at = NOW() WHERE id = $2`,
    [REFERRAL_BONUS, refId]
  );
  await pool.query(
    'UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2',
    [REFERRAL_BONUS, referrer_id]
  );
  console.log(`[Referral] Awarded ${REFERRAL_BONUS} pts to user ${referrer_id} for referring user ${refereeId}`);
}

module.exports = { applyOrderStatusEffects, STATUS_BODY, REFERRAL_BONUS };
