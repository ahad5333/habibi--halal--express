const pool = require('../config/db');

// A payment charge that references a real order must be charged for that
// order's own server-validated total — never a client-supplied amount.
// Order creation already recomputes and locks in `total` from DB prices
// (see orderController.js), but the separate charge step used to trust
// whatever `amount` the client sent and mark the order paid regardless,
// letting a client create a legitimate order and then pay a fraction of it.
async function resolveChargeAmount(orderNumber, clientAmount) {
  if (!orderNumber) {
    // No order to reconcile against — ad-hoc payment (Make a Payment /
    // catering deposit / wholesale invoice), the typed amount is authoritative.
    return { amount: parseFloat(clientAmount) || 0, order: null };
  }

  const result = await pool.query(
    `SELECT total, payment_status FROM guest_orders WHERE order_number = $1`,
    [orderNumber]
  );
  if (result.rows.length) {
    const order = result.rows[0];
    if (order.payment_status === 'paid') {
      const err = new Error('Order has already been paid.');
      err.statusCode = 400;
      throw err;
    }
    return { amount: parseFloat(order.total), order };
  }

  // Not a real order yet -- check the pending-checkout holding table. The
  // real, correct checkout flow (Checkout.jsx's "prepare" step) always
  // creates one of these BEFORE charging, since a real guest_orders row
  // only gets materialized once the charge actually succeeds (see
  // finalizePendingCheckout in orderController.js). A 404 here means
  // neither exists — genuinely not a real order/checkout.
  const pending = await pool.query(
    `SELECT total FROM pending_checkouts WHERE order_number = $1`,
    [orderNumber]
  );
  if (pending.rows.length) {
    return { amount: parseFloat(pending.rows[0].total), order: null };
  }

  const err = new Error('Order not found.');
  err.statusCode = 404;
  throw err;
}

module.exports = { resolveChargeAmount };
