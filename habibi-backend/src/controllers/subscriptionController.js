const crypto = require('crypto');
const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { isOpenNow } = require('../utils/businessHours');
const { getDistance } = require('../utils/googleMaps');
const { getFeeForDistance } = require('../utils/deliveryFee');
const { getTaxRate, getServiceFeeRate, getFreeDeliveryThreshold } = require('../utils/systemSettings');
const { getUserTier } = require('../utils/loyaltyTiers');
const { chargeSavedCardEndpoint } = require('./cardProcessorController');
const emailService = require('../services/emailService');

const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || '2974 Jerome Ave, Bronx, NY 10468';
const MAX_FAILED_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────────────────
// Customer-facing: create/list/pause/resume/cancel
// ─────────────────────────────────────────────────────────────────────────

// Subscriptions are only ever created from a just-completed order paid with
// an ALREADY-saved card (Checkout.jsx only offers "Make this a weekly
// order" when selectedSavedCardId is set) -- never from a brand-new card in
// the same checkout. A new card's vaulting (SquareCardForm.jsx etc.) is a
// fire-and-forget side effect with no id returned to the caller; racing
// that would be fragile, and this sidesteps it entirely by only ever
// reusing a payment_method_id that's already confirmed to exist.
const createSubscription = async (req, res) => {
  const { order_number, interval_days } = req.body;
  if (!order_number) return res.status(400).json({ message: 'order_number is required.' });
  const intervalDays = Math.min(30, Math.max(1, parseInt(interval_days, 10) || 7));

  try {
    const orderRes = await pool.query(
      `SELECT user_id, items, delivery_method, delivery_address, delivery_city, delivery_state,
              delivery_zip, location_id, payment_intent_id, payment_processor, placed_at
         FROM guest_orders WHERE order_number = $1`,
      [order_number]
    );
    if (!orderRes.rows.length || orderRes.rows[0].user_id !== req.user.id) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    // Custom/BYO items need a much heavier per-ingredient re-pricing step
    // (see computeCustomItemPrice in byoPricing.js) that this feature
    // deliberately doesn't replicate for v1 -- regular menu items only.
    const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
    const hasCustomItem = items.some(i => typeof i.id === 'string' && i.id.startsWith('custom-'));
    if (hasCustomItem) {
      return res.status(400).json({ message: 'Subscriptions currently support regular menu items only -- Build Your Own items can’t be included yet.' });
    }
    if (!items.length) return res.status(400).json({ message: 'This order has no items to repeat.' });

    // The card that PAID for this exact order -- payment_intent_id is the
    // processor transaction id, matched back to whichever saved card
    // produced it. Guarantees the subscription only ever uses a real,
    // already-vaulted card, never a fresh one from this same checkout.
    const cardRes = await pool.query(
      `SELECT id FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!cardRes.rows.length) {
      return res.status(400).json({ message: 'No saved card found. Pay with a saved card to set up a subscription.' });
    }
    // req.body.payment_method_id was previously trusted verbatim with no
    // ownership check -- since payment_methods.id is a plain sequential
    // integer, any logged-in customer could point a new subscription at
    // another customer's card id and later read its brand/last-4 back via
    // getMySubscriptions' join below. Only honor a client-supplied id if it
    // actually belongs to this user; otherwise fall back to their own card.
    let paymentMethodId = cardRes.rows[0].id;
    if (req.body.payment_method_id) {
      const ownCard = await pool.query(
        'SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2',
        [req.body.payment_method_id, req.user.id]
      );
      if (!ownCard.rows.length) {
        return res.status(400).json({ message: 'Invalid payment method.' });
      }
      paymentMethodId = ownCard.rows[0].id;
    }

    const nextCharge = new Date(order.placed_at || Date.now());
    nextCharge.setDate(nextCharge.getDate() + intervalDays);

    const result = await pool.query(
      `INSERT INTO subscriptions
         (user_id, payment_method_id, items, delivery_method, delivery_address, delivery_city,
          delivery_state, delivery_zip, location_id, interval_days, next_charge_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [req.user.id, paymentMethodId, JSON.stringify(items), order.delivery_method,
       order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip,
       order.location_id, intervalDays, nextCharge]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getMySubscriptions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, pm.type AS card_brand, pm.last_four AS card_last4
         FROM subscriptions s
         LEFT JOIN payment_methods pm ON pm.id = s.payment_method_id AND pm.user_id = s.user_id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const setSubscriptionStatus = (newStatus) => async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
      [newStatus, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Subscription not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const pauseSubscription  = setSubscriptionStatus('paused');
const cancelSubscription = setSubscriptionStatus('cancelled');
const resumeSubscription = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE subscriptions
          SET status = 'active', failed_attempts = 0, next_charge_date = NOW() + (interval_days || ' days')::interval, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Subscription not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Admin: view + pause/cancel on a customer's behalf (no item-editing in v1
// -- a customer who wants a different order cancels and sets up a new one)
// ─────────────────────────────────────────────────────────────────────────

const getAllSubscriptionsAdmin = async (req, res) => {
  try {
    const status = req.query.status || null;
    const result = await pool.query(
      `SELECT s.*, u.name AS customer_name, u.email AS customer_email,
              pm.type AS card_brand, pm.last_four AS card_last4
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN payment_methods pm ON pm.id = s.payment_method_id
        WHERE ($1::text IS NULL OR s.status = $1)
        ORDER BY s.next_charge_date ASC`,
      [status]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const adminSetSubscriptionStatus = (newStatus) => async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Subscription not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const adminPauseSubscription  = adminSetSubscriptionStatus('paused');
const adminCancelSubscription = adminSetSubscriptionStatus('cancelled');

// ─────────────────────────────────────────────────────────────────────────
// The scheduled charge itself -- called per due subscription by
// scheduledSubscriptions.js. Re-prices from live data (createGuestOrder
// itself never recomputes pricing, only validates within a tolerance --
// see the comment on this same point in the approved plan), stages a
// pending_checkouts row exactly like a real checkout's "prepare" step does,
// then reuses chargeSavedCardEndpoint + its own internal
// finalizePendingCheckout call to charge the card AND materialize the real
// order in one shot -- the same path a live saved-card checkout already
// takes today, not a parallel reimplementation.
// ─────────────────────────────────────────────────────────────────────────

async function recomputeSubscriptionItems(items) {
  const recomputed = [];
  for (const item of items) {
    const menuId = parseInt(item.id, 10);
    if (!menuId) return { error: `"${item.name || 'An item'}" is no longer available.` };
    const r = await pool.query(`SELECT id, name, price, is_available, is_active FROM menus WHERE id = $1`, [menuId]);
    if (!r.rows.length || r.rows[0].is_available === false || r.rows[0].is_active === false) {
      return { error: `"${item.name || r.rows[0]?.name || 'An item'}" is no longer on our menu.` };
    }
    recomputed.push({ id: menuId, name: r.rows[0].name, price: parseFloat(r.rows[0].price), qty: parseInt(item.qty || item.quantity || 1, 10) || 1 });
  }
  return { items: recomputed };
}

async function computeSubscriptionPricing(sub) {
  const { items, error } = await recomputeSubscriptionItems(sub.items);
  if (error) return { error };

  const subTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const taxRate = await getTaxRate();
  const svcFeeRate = await getServiceFeeRate();
  const tax = Math.round(subTotal * taxRate * 100) / 100;
  const serviceFee = Math.round(subTotal * svcFeeRate * 100) / 100;

  let deliveryFee = 0;
  if (sub.delivery_method === 'delivery') {
    const addrStr = [sub.delivery_address, sub.delivery_city, sub.delivery_state, sub.delivery_zip].filter(Boolean).join(', ');
    let origin = RESTAURANT_ADDRESS;
    if (sub.location_id) {
      const locRes = await pool.query('SELECT exact_address FROM locations WHERE id = $1', [sub.location_id]);
      if (locRes.rows.length && locRes.rows[0].exact_address) origin = locRes.rows[0].exact_address;
    }
    const dist = await getDistance(origin, addrStr);
    if (!dist || dist.unavailable) return { error: "Couldn't verify the delivery address for this cycle." };
    const fee = await getFeeForDistance(dist.miles, sub.location_id);
    if (fee === null) return { error: 'Delivery address is now outside our delivery range.' };
    deliveryFee = fee;
    const freeThreshold = await getFreeDeliveryThreshold(sub.user_id);
    if (subTotal >= freeThreshold) deliveryFee = 0;
  }

  // Honors the customer's CURRENT VIP tier (may have improved since they
  // subscribed) -- same computation live checkout already applies.
  const tier = await getUserTier(sub.user_id);
  const discount = tier ? Math.round(subTotal * (parseFloat(tier.discount_pct) / 100) * 100) / 100 : 0;

  const total = Math.max(0, subTotal + tax + serviceFee + deliveryFee - discount);
  return { items, subTotal, tax, serviceFee, deliveryFee, discount, total };
}

async function processSubscriptionCharge(sub, io) {
  const advanceNextCharge = () => pool.query(
    `UPDATE subscriptions SET next_charge_date = next_charge_date + (interval_days || ' days')::interval, updated_at = NOW() WHERE id = $1`,
    [sub.id]
  );

  const userRes = await pool.query('SELECT name, email, phone_number FROM users WHERE id = $1', [sub.user_id]);
  const user = userRes.rows[0];
  if (!user) { await advanceNextCharge(); return; } // orphaned row, shouldn't happen (FK), skip defensively

  // Business hours -- skip this cycle only, never retry same-day. A live
  // checkout never hits this gate while closed (the site shows itself
  // closed), but an unattended scheduled charge has no such guarantee.
  const locsRes = await pool.query(`SELECT accepting_orders, working_days_hours FROM locations WHERE is_active = true`);
  const anyOpen = locsRes.rows.length === 0 || locsRes.rows.some(l => {
    if (l.accepting_orders === false) return false;
    const auto = isOpenNow(l.working_days_hours);
    return auto === true || auto === null;
  });
  if (!anyOpen) {
    await advanceNextCharge();
    emailService.sendSubscriptionSkipped(user.email, "we were closed at your usual order time").catch(() => {});
    return;
  }

  const pricing = await computeSubscriptionPricing(sub);
  if (pricing.error) {
    // Item gone / address no longer deliverable -- pause rather than retry
    // forever against the same unresolvable problem every cycle.
    await pool.query(`UPDATE subscriptions SET status = 'paused', updated_at = NOW() WHERE id = $1`, [sub.id]);
    await pool.query(
      `INSERT INTO subscription_charges (subscription_id, success, error_message) VALUES ($1, false, $2)`,
      [sub.id, pricing.error]
    );
    emailService.sendSubscriptionPaused(user.email, pricing.error).catch(() => {});
    return;
  }

  const orderNumber = `HBB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const payload = {
    customer_name: user.name, customer_phone: user.phone_number, customer_email: user.email,
    delivery_method: sub.delivery_method,
    delivery_address: sub.delivery_address, delivery_city: sub.delivery_city,
    delivery_state: sub.delivery_state, delivery_zip: sub.delivery_zip,
    payment_method: 'card',
    sub_total: pricing.subTotal, tax: pricing.tax, service_fee: pricing.serviceFee,
    delivery_fee: pricing.deliveryFee, tip: 0, discount: pricing.discount, total: pricing.total,
    items: pricing.items,
    location_id: sub.location_id,
    loyalty_points_redeemed: 0,
    _authenticated_user_id: sub.user_id,
  };

  await pool.query(
    `INSERT INTO pending_checkouts (order_number, payload, total) VALUES ($1, $2, $3)`,
    [orderNumber, JSON.stringify(payload), pricing.total]
  );

  // Reserve the next cycle BEFORE attempting the charge, not after. If this
  // process crashes/restarts between a successful charge and the bookkeeping
  // below committing, next_charge_date is already in the future, so the next
  // hourly tick can't pick this subscription up again and charge the same
  // cycle a second time. Every outcome below already ended up advancing it
  // by the same interval anyway (except the final-failure pause, where it's
  // moot since status stops being 'active') -- this just moves that one
  // advance earlier instead of leaving a crash window before it happened.
  await advanceNextCharge();

  const fakeApp = { get: (key) => (key === 'io' ? io : undefined) };
  const fakeReq = { user: { id: sub.user_id }, body: { paymentMethodId: sub.payment_method_id, orderNumber }, app: fakeApp, ip: null };
  let captured = { statusCode: 200, body: null };
  const fakeRes = { status(c) { captured.statusCode = c; return this; }, json(d) { captured.body = d; return this; } };

  await chargeSavedCardEndpoint(fakeReq, fakeRes);

  if (captured.statusCode >= 400) {
    const failCount = sub.failed_attempts + 1;
    await pool.query(
      `INSERT INTO subscription_charges (subscription_id, order_number, amount, success, error_message) VALUES ($1,$2,$3,false,$4)`,
      [sub.id, orderNumber, pricing.total, captured.body?.error || 'Payment failed.']
    );
    // pending_checkouts row is cleaned up by the existing hourly
    // cleanupAbandonedPendingCheckouts job -- no order was ever created for
    // this attempt, so nothing else references it.
    if (failCount >= MAX_FAILED_ATTEMPTS) {
      await pool.query(`UPDATE subscriptions SET status = 'paused', failed_attempts = $1, updated_at = NOW() WHERE id = $2`, [failCount, sub.id]);
      emailService.sendSubscriptionPaused(user.email, 'your card was declined 3 times in a row').catch(() => {});
    } else {
      await pool.query(`UPDATE subscriptions SET failed_attempts = $1, updated_at = NOW() WHERE id = $2`, [failCount, sub.id]);
      emailService.sendSubscriptionChargeFailed(user.email, captured.body?.error || 'Payment failed.').catch(() => {});
    }
    return;
  }

  await pool.query(
    `INSERT INTO subscription_charges (subscription_id, order_number, amount, success) VALUES ($1,$2,$3,true)`,
    [sub.id, orderNumber, pricing.total]
  );
  await pool.query(
    `UPDATE subscriptions
        SET failed_attempts = 0, last_order_number = $1, last_charged_at = NOW(), updated_at = NOW()
      WHERE id = $2`,
    [orderNumber, sub.id]
  );
  // No separate "your subscription order is on its way" email -- createGuestOrder
  // (reached via finalizePendingCheckout inside chargeSavedCardEndpoint above)
  // already sends the same order-confirmation email every regular order gets.
}

module.exports = {
  createSubscription, getMySubscriptions, pauseSubscription, resumeSubscription, cancelSubscription,
  getAllSubscriptionsAdmin, adminPauseSubscription, adminCancelSubscription,
  processSubscriptionCharge, computeSubscriptionPricing,
};
