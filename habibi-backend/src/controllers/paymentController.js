const safeError = require('../utils/safeError');
const pool      = require("../config/db");
const { refundTransaction } = require('../services/authNetService');
const { getActiveAccount } = require('./authNetController');
const { getCardProcessorAccountByProvider } = require('./cardProcessorController');
const squareService = require('../services/squareService');
const cloverService = require('../services/cloverService');
const { logAudit } = require('./auditController');
const { normalizeZelleHandle, displayZelleHandle, zelleHandleFromConfig } = require('../utils/zelleHandle');
const paypalApi = require('../utils/paypalApi');
const { resolveChargeAmount } = require('../utils/resolveChargeAmount');
const { restockOrderItems } = require('./inventoryController');
const { finalizePendingCheckout } = require('./orderController');

// ─── Ensure payment_intent_id column exists ─────────────────────────────────
pool.query(
  "ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(64)"
).catch(() => {});

// ─── Refund (admin) ───────────────────────────────────────────────────────────
// This is the endpoint the admin Payments page's Refund button actually calls
// (POST /api/admin/payments/:orderNumber/refund). It used to only flip
// order_status to 'refunded' and return a fake success message — even for
// card orders, despite the admin UI's own confirmation modal explicitly
// promising "the refund will be processed automatically via Authorize.net".
// A second, real implementation (authNetController.refundEndpoint, which
// actually calls Authorize.net) existed but was only reachable at a
// different, unused route (POST /api/payments/authnet/refund/:orderNumber)
// that nothing in any frontend ever calls. Card orders clicked "Refund" here
// and got told it succeeded while the customer's money never moved.
const refundOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { amount } = req.body || {}; // optional partial amount, defaults to the order total

    const result = await pool.query(
      "SELECT id, payment_intent_id, total, payment_method, payment_processor, order_status, items FROM guest_orders WHERE order_number=$1",
      [orderNumber]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Order not found." });

    const order = result.rows[0];

    if (order.order_status === "refunded") return res.status(400).json({ message: "Order already refunded." });

    // Never refund more than the order took. The processors should reject an
    // over-refund themselves, but that shouldn't be the only line of defence.
    const orderTotal   = parseFloat(order.total) || 0;
    const refundAmount = parseFloat(amount) > 0 ? parseFloat(amount) : orderTotal;
    if (refundAmount > orderTotal + 0.005) {
      return res.status(400).json({ message: `Refund can't exceed the order total ($${orderTotal.toFixed(2)}).` });
    }

    const method = (order.payment_method || '').toLowerCase();
    let refundId;
    let resultMessage = 'Refund processed successfully.';
    let manual = false;

    // PayPal and Google Pay (which is carried by PayPal) refund through
    // PayPal's API. Routed on the processor that actually took the money, so
    // an order mis-recorded as 'card' by the old checkout bug still refunds
    // through PayPal rather than failing against a card processor.
    const isPayPal = order.payment_processor === 'paypal' || method === 'paypal' || method === 'googlepay';

    if (isPayPal) {
      if (!order.payment_intent_id) {
        return res.status(409).json({
          message: 'No PayPal transaction is recorded for this order, so it can’t be refunded from here. Refund it in the PayPal dashboard.',
        });
      }
      if (!paypalApi.isConfigured()) {
        return res.status(503).json({ message: 'PayPal is not configured — cannot process this refund.' });
      }
      try {
        const r = await paypalApi.refundCapture({
          captureId: order.payment_intent_id, amount: refundAmount, orderNumber,
        });
        refundId = r.refundId;
        resultMessage = r.status === 'COMPLETED'
          ? `Refunded $${refundAmount.toFixed(2)} to the customer’s ${method === 'googlepay' ? 'Google Pay' : 'PayPal'}.`
          : `Refund of $${refundAmount.toFixed(2)} submitted to PayPal (status: ${r.status}). PayPal will complete it.`;
      } catch (refundErr) {
        // Nothing is marked refunded unless PayPal actually accepted it.
        return res.status(502).json({ message: 'PayPal refund failed: ' + refundErr.message });
      }
    } else if (order.payment_intent_id && method === 'card') {
      // Refund through whichever processor actually charged this order —
      // NOT whatever's currently active in the admin panel. An order
      // charged via Square yesterday must still refund through Square even
      // if the admin has since switched to Clover. Orders from before this
      // column existed have no payment_processor recorded; they were all
      // Authorize.net (the only processor that existed then), hence the fallback.
      const provider = order.payment_processor || 'authorize_net';
      const account  = provider === 'authorize_net' ? await getActiveAccount() : await getCardProcessorAccountByProvider(provider);
      if (!account) {
        return res.status(503).json({ message: `Payment processor (${provider}) not configured — cannot process card refund.` });
      }
      try {
        let refunded;
        if (provider === 'authorize_net') {
          refunded = await refundTransaction({
            transactionId:  order.payment_intent_id,
            amount:         refundAmount,
            cardLastFour:   '0000',
            apiLoginId:     account.api_login_id,
            transactionKey: account.transaction_key,
            environment:    account.environment,
          });
        } else if (provider === 'square') {
          refunded = await squareService.refundPayment({
            paymentId:   order.payment_intent_id,
            amount:      refundAmount,
            accessToken: account.credentials.accessToken,
            environment: account.environment,
          });
        } else if (provider === 'clover') {
          refunded = await cloverService.refundPayment({
            chargeId:     order.payment_intent_id,
            amount:       refundAmount,
            privateToken: account.credentials.privateToken,
            environment:  account.environment,
          });
        } else {
          return res.status(400).json({ message: 'Unknown payment processor.' });
        }
        refundId = refunded.transactionId;
      } catch (refundErr) {
        return res.status(502).json({ message: `${provider} refund failed: ` + refundErr.message });
      }
    } else {
      // Zelle, Cash App and cash have no refund API: the money has to be sent
      // back by hand. The order is still marked refunded for the records, but
      // the admin is told plainly that nothing was sent -- previously this
      // branch also said "Refund processed successfully", which for a
      // customer still waiting on their money is worse than saying nothing.
      refundId = "REFUND_MANUAL_" + Date.now();
      manual = true;
      const label = { zelle: 'Zelle', cashapp: 'Cash App', cash: 'Cash' }[method] || (order.payment_method || 'This payment method');
      resultMessage = `Marked as refunded — but ${label} payments can’t be refunded automatically. ` +
                      `Send $${refundAmount.toFixed(2)} back to the customer yourself.`;
    }

    await pool.query(
      "UPDATE guest_orders SET order_status='refunded', payment_status='refunded', updated_at=NOW() WHERE order_number=$1",
      [orderNumber]
    );

    // Skip restocking if this order was already cancelled -- cancelOrder
    // already returned its stock at that point, and this refund is just
    // the money catching up to a fulfillment decision made earlier.
    // Anything else (a direct refund with no prior cancellation) restocks
    // here, since this is the only point that ever signals the food isn't
    // being made.
    if (order.order_status !== 'cancelled') {
      restockOrderItems(order.id, orderNumber, order.items, 'refund_restock')
        .catch(err => console.error('[Inventory] Restock failed for refunded order', orderNumber, ':', err.message));
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`order_${orderNumber}`).emit("order_status_updated", { order_id: orderNumber, status: "refunded" });
    }

    logAudit(pool, req.user?.id, req.user?.name, 'refund_order', 'payment', orderNumber,
      { refundId, amount: refundAmount, payment_method: order.payment_method, manual }, req.ip);

    res.json({ success: true, refundId, manual, message: resultMessage });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── Get Zelle / CashApp payment info — reads from DB, falls back to env ────
const getOfflinePaymentInfo = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT provider, config FROM payment_settings WHERE provider IN ('zelle','cashapp')`
    );
    const rows       = result.rows;
    const zelleRow   = rows.find(r => r.provider === 'zelle');
    const cashappRow = rows.find(r => r.provider === 'cashapp');
    res.json({
      zelle:   zelleInfo(zelleHandleFromConfig(zelleRow?.config) || normalizeZelleHandle(process.env.ZELLE_EMAIL)),
      cashapp: { cashtag: cashappRow?.config?.cashtag || process.env.CASHAPP_CASHTAG || '$HabibiHalal' },
    });
  } catch {
    // Fallback to env if DB fails
    res.json({
      zelle:   zelleInfo(normalizeZelleHandle(process.env.ZELLE_EMAIL)),
      cashapp: { cashtag: process.env.CASHAPP_CASHTAG  || '$HabibiHalal' },
    });
  }
};

// There is deliberately NO hardcoded Zelle fallback any more. It used to be
// 'payments@habibihalal.com' -- a domain Habibi does not own, so a customer
// with nothing configured was told to send real money to a stranger. If no
// destination is set, `handle` is null and checkout says Zelle is unavailable.
function zelleInfo(handle) {
  return {
    handle:  displayZelleHandle(handle),                  // "(347) 459-7103"
    copy:    handle ? handle.value : null,                // what to paste into Zelle
    type:    handle ? handle.type : null,                 // 'phone' | 'email'
    email:   handle && handle.type === 'email' ? handle.value : null, // legacy readers
  };
}

// ─── PayPal create order (mobile: returns approvalUrl for WebView) ──────────
const paypalCreateOrder = async (req, res) => {
  const { amount: clientAmount, order_number, return_url, cancel_url } = req.body;

  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'REPLACE_ME') {
    // Dev mock — return a fake orderID and approval URL
    return res.json({
      mock: true,
      orderID:     'PAYPAL_MOCK_ORDER_' + Date.now(),
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCK',
    });
  }

  try {
    // Amount comes from the order's own server-side total when an
    // order_number is given — never trust a client-supplied amount for a real
    // order (PayPal's whole create→approve→capture flow is anchored on
    // whatever amount is set here, so this is the one place that matters).
    const { amount } = await resolveChargeAmount(order_number, clientAmount);
    if (!amount || amount <= 0) return res.status(400).json({ message: 'amount required' });

    const base = process.env.PAYPAL_ENV === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const authRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await authRes.json();
    if (!access_token) return res.status(502).json({ message: 'PayPal auth failed' });

    const createRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'PayPal-Request-Id': order_number || String(Date.now()),
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order_number || 'habibi-order',
          amount: { currency_code: 'USD', value: parseFloat(amount).toFixed(2) },
          description: 'Habibi Halal Express order',
        }],
        application_context: {
          brand_name:          'Habibi Halal Express',
          landing_page:        'LOGIN',
          user_action:         'PAY_NOW',
          return_url: return_url || 'habibi://paypal-return',
          cancel_url: cancel_url || 'habibi://paypal-cancel',
        },
      }),
    });
    const order = await createRes.json();
    if (order.status !== 'CREATED') return res.status(502).json({ message: 'PayPal order creation failed', detail: order });

    const approvalUrl = order.links?.find(l => l.rel === 'approve')?.href;
    res.json({ orderID: order.id, approvalUrl });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json(safeError(err));
  }
};

// ─── PayPal server-side order capture ──────────────────────────────────────
const paypalCapture = async (req, res) => {
  const { orderID, orderNumber } = req.body;
  if (!orderID) return res.status(400).json({ message: 'orderID required' });

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'REPLACE_ME') {
    if (orderNumber) {
      await pool.query(
        "UPDATE guest_orders SET order_status='accepted', payment_intent_id=$1, updated_at=NOW() WHERE order_number=$2",
        ['PAYPAL_MOCK_' + Date.now(), orderNumber]
      ).catch(() => {});
    }
    return res.json({ success: true, mock: true, captureID: 'PAYPAL_MOCK_' + Date.now() });
  }

  try {
    // Resolve the order's own server-side total BEFORE trusting anything
    // PayPal returns -- this is what the capture is actually checked
    // against below. Without this, a client could capture their own
    // unrelated (e.g. far cheaper) PayPal order and pass a victim's
    // orderNumber in the same request, flipping that order to
    // accepted/paid for the wrong amount with no auth required. Mirrors
    // the same resolveChargeAmount() guard paypalCreateOrder and the
    // card-charge endpoints already use.
    let expectedAmount = null;
    if (orderNumber) {
      ({ amount: expectedAmount } = await resolveChargeAmount(orderNumber, null));
    }

    const base = process.env.PAYPAL_ENV === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const authRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const authData = await authRes.json();
    if (!authData.access_token) {
      return res.status(502).json({ message: 'PayPal authentication failed' });
    }

    const captureRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`,
      },
    });
    const captureData = await captureRes.json();

    if (captureData.status !== 'COMPLETED') {
      return res.status(402).json({ message: `PayPal capture failed: ${captureData.status}` });
    }

    const captureID = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;

    if (orderNumber) {
      // The captured PayPal order must actually have been created FOR this
      // exact order_number, at this exact order's real total -- not just
      // any PayPal order the caller happens to be able to capture.
      const referenceId     = captureData.purchase_units?.[0]?.reference_id;
      const capturedAmount  = parseFloat(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value);
      if (referenceId !== orderNumber || !(Math.abs(capturedAmount - expectedAmount) < 0.01)) {
        return res.status(400).json({ message: 'This payment does not match the order.' });
      }

      // Materializes the pending_checkouts row staged by the frontend's
      // "prepare" step into a real, paid guest_orders row (or, if none
      // exists -- e.g. a saved-card recharge against an order that already
      // exists -- falls back to a plain UPDATE). See finalizePendingCheckout.
      await finalizePendingCheckout(req, orderNumber, { transactionId: captureID, processor: 'paypal' });
      // 'pending' -- matches the real order_status createGuestOrder always
      // sets (Square/Clover/Authorize.net never touched order_status at
      // all, so 'pending' was already the true status for every OTHER
      // payment method; this used to claim 'accepted' here specifically,
      // a stale PayPal-only broadcast that no longer matched the DB once
      // finalizePendingCheckout started routing every processor through
      // the same createGuestOrder insert).
      const io = req.app.get('io');
      if (io) io.to(`order_${orderNumber}`).emit('order_status_updated', { order_id: orderNumber, status: 'pending' });
    }

    res.json({ success: true, captureID, status: captureData.status });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json(safeError(err));
  }
};

// ─── Legacy verify (kept for backwards compat) ───────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { transaction_id } = req.body;
    const payment = await pool.query("SELECT * FROM payments WHERE transaction_id=$1", [transaction_id]);
    if (payment.rows.length === 0) return res.status(404).json({ message: "Payment not found" });
    res.json({ payment: payment.rows[0] });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  refundOrder,
  getOfflinePaymentInfo,
  paypalCreateOrder,
  paypalCapture,
  verifyPayment,
};
