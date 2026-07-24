const safeError = require('../utils/safeError');
const pool      = require("../config/db");
const crypto    = require("crypto");
const { refundTransaction } = require('../services/authNetService');
const { getActiveAccount } = require('./authNetController');

// ─── Ensure payment_intent_id column exists ─────────────────────────────────
pool.query(
  "ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(64)"
).catch(() => {});

// ─── Square charge (nonce-based, no client secret needed) ───────────────────
const squareCharge = async (req, res) => {
  try {
    const { sourceId, amount, order_number } = req.body;
    if (!process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_ACCESS_TOKEN === "REPLACE_ME") {
      return res.json({ success: true, mock: true, message: "Square not configured — mock charge" });
    }

    const { Client, Environment } = require("square");
    const client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Sandbox,
    });

    const result = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: order_number || String(Date.now()),
      amountMoney: { amount: Math.round(parseFloat(amount) * 100), currency: "USD" },
      locationId: process.env.SQUARE_LOCATION_ID,
    });

    const paymentId = result.result?.payment?.id;
    if (order_number) {
      await pool.query(
        "UPDATE guest_orders SET order_status='accepted', payment_intent_id=$1 WHERE order_number=$2",
        [paymentId, order_number]
      );
    }
    res.json({ success: true, paymentId });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── Square Webhook ──────────────────────────────────────────────────────────
const squareWebhook = async (req, res) => {
  // Verify Square HMAC-SHA256 signature before processing any event
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (sigKey) {
    const sig      = req.headers['x-square-hmacsha256-signature'];
    const notifUrl = `${process.env.FRONTEND_URL || ''}/api/payments/webhook/square`;
    const body     = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', sigKey).update(notifUrl + body).digest('base64');
    if (!sig || sig !== expected) {
      return res.status(401).json({ error: 'Invalid Square webhook signature.' });
    }
  }

  try {
    const event = req.body;
    if (event.type === "payment.completed") {
      const orderId = event.data?.object?.payment?.order_id;
      if (orderId) {
        await pool.query(
          "UPDATE guest_orders SET order_status='accepted', updated_at=NOW() WHERE payment_intent_id=$1",
          [orderId]
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

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
    const { amount } = req.body; // optional partial amount, defaults to the order total

    const result = await pool.query(
      "SELECT payment_intent_id, total, payment_method, order_status FROM guest_orders WHERE order_number=$1",
      [orderNumber]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Order not found." });

    const order = result.rows[0];

    if (order.order_status === "refunded") return res.status(400).json({ message: "Order already refunded." });

    let refundId;

    if (order.payment_intent_id && (order.payment_method || '').toLowerCase() === 'card') {
      // Real card charge via Authorize.net — actually refund the money.
      const account = await getActiveAccount();
      if (!account) {
        return res.status(503).json({ message: 'Payment processor not configured — cannot process card refund.' });
      }
      const refundAmount = parseFloat(amount) > 0 ? parseFloat(amount) : parseFloat(order.total);
      try {
        const refunded = await refundTransaction({
          transactionId:  order.payment_intent_id,
          amount:         refundAmount,
          cardLastFour:   '0000',
          apiLoginId:     account.api_login_id,
          transactionKey: account.transaction_key,
          environment:    account.environment,
        });
        refundId = refunded.transactionId;
      } catch (refundErr) {
        return res.status(502).json({ message: 'Authorize.net refund failed: ' + refundErr.message });
      }
    } else {
      // Cash/Zelle/CashApp/PayPal — no automated refund API, record-keeping only.
      refundId = "REFUND_MANUAL_" + Date.now();
    }

    await pool.query(
      "UPDATE guest_orders SET order_status='refunded', payment_status='refunded', updated_at=NOW() WHERE order_number=$1",
      [orderNumber]
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`order_${orderNumber}`).emit("order_status_updated", { order_id: orderNumber, status: "refunded" });
    }

    res.json({ success: true, refundId, message: "Refund processed successfully." });
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
      zelle:   { email:   zelleRow?.config?.email    || process.env.ZELLE_EMAIL      || 'payments@habibihalal.com' },
      cashapp: { cashtag: cashappRow?.config?.cashtag || process.env.CASHAPP_CASHTAG || '$HabibiHalal' },
    });
  } catch {
    // Fallback to env if DB fails
    res.json({
      zelle:   { email:   process.env.ZELLE_EMAIL      || 'payments@habibihalal.com' },
      cashapp: { cashtag: process.env.CASHAPP_CASHTAG  || '$HabibiHalal' },
    });
  }
};

// ─── PayPal create order (mobile: returns approvalUrl for WebView) ──────────
const paypalCreateOrder = async (req, res) => {
  const { amount, order_number, return_url, cancel_url } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: 'amount required' });

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
      await pool.query(
        "UPDATE guest_orders SET order_status='accepted', payment_intent_id=$1, updated_at=NOW() WHERE order_number=$2",
        [captureID, orderNumber]
      );
      const io = req.app.get('io');
      if (io) io.to(`order_${orderNumber}`).emit('order_status_updated', { order_id: orderNumber, status: 'accepted' });
    }

    res.json({ success: true, captureID, status: captureData.status });
  } catch (err) {
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
  squareCharge,
  squareWebhook,
  refundOrder,
  getOfflinePaymentInfo,
  paypalCreateOrder,
  paypalCapture,
  verifyPayment,
};
