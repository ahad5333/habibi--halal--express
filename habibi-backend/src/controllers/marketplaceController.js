const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');
const { notifyPlatform } = require('../services/orderCallbackService');

// ── Webhook signature helpers ───────────────────────────────────────
function verifyUberSignature(rawBody, signature) {
  const secret = process.env.UBEREATS_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected;
}

function verifyGrubHubSignature(rawBody, signature) {
  const secret = process.env.GRUBHUB_WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

function verifyCaviarSignature(rawBody, signature) {
  // Caviar is DoorDash-powered — uses same HMAC-SHA256 with DOORDASH_WEBHOOK_SECRET
  const secret = process.env.DOORDASH_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

// ── Normalise an UberEats order into our schema ─────────────────────
function normaliseUberOrder(o) {
  return {
    platform:          'ubereats',
    platform_order_id: o.id,
    status:            o.current_state === 'AWAITING_RESTAURANT_ACCEPT' ? 'new' : 'accepted',
    customer_name:     `${o.eater?.first_name || ''} ${o.eater?.last_name || ''}`.trim() || 'UberEats Customer',
    customer_phone:    o.eater?.phone || '',
    items:             (o.cart?.items || []).map(i => ({
      name:     i.title,
      qty:      i.quantity,
      price:    (i.price?.unit_price_cents || 0) / 100,
    })),
    subtotal:          (o.cart?.pricing_info?.subtotal_cents || o.subtotal_price_cents || 0) / 100,
    total:             (o.cart?.pricing_info?.total_cents    || o.total_price_cents    || 0) / 100,
    delivery_address:  o.eater?.delivery?.address?.formatted_address || '',
  };
}

// ── Normalise a GrubHub order ────────────────────────────────────────
function normaliseGrubHubOrder(o) {
  return {
    platform:          'grubhub',
    platform_order_id: String(o.id || o.order_id),
    status:            'new',
    customer_name:     `${o.diner?.first_name || ''} ${o.diner?.last_name || ''}`.trim() || 'GrubHub Customer',
    customer_phone:    o.diner?.phone || '',
    items:             (o.order_items || []).map(i => ({
      name:  i.description || i.name,
      qty:   i.quantity,
      price: parseFloat(i.price || 0),
    })),
    subtotal:          parseFloat(o.pricing?.food_total || o.subtotal || 0),
    total:             parseFloat(o.pricing?.total      || o.total    || 0),
    delivery_address:  o.delivery_info?.delivery_address?.street || '',
  };
}

async function upsertMarketplaceOrder(norm, rawPayload) {
  const result = await pool.query(
    `INSERT INTO marketplace_orders
       (platform, platform_order_id, status, customer_name, customer_phone,
        items, subtotal, total, delivery_address, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (platform_order_id) DO UPDATE
       SET status=$3, updated_at=NOW()
     RETURNING id`,
    [
      norm.platform, norm.platform_order_id, norm.status,
      norm.customer_name, norm.customer_phone,
      JSON.stringify(norm.items),
      norm.subtotal, norm.total,
      norm.delivery_address,
      JSON.stringify(rawPayload),
    ]
  );
  return result.rows[0].id;
}

// ── UberEats webhook ─────────────────────────────────────────────────
const handleUberEatsWebhook = async (req, res) => {
  const sig = req.headers['x-uber-signature'] || '';
  const raw = JSON.stringify(req.body);
  if (!verifyUberSignature(raw, sig)) return res.status(401).json({ message: 'Invalid signature' });

  try {
    const orders = req.body.orders || (req.body.order ? [req.body.order] : []);
    for (const o of orders) {
      const norm = normaliseUberOrder(o);
      const id   = await upsertMarketplaceOrder(norm, o);
      const io   = req.app.get('io');
      if (io) io.emit('marketplace_order', { platform: 'ubereats', id, ...norm });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('UberEats webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── GrubHub webhook ──────────────────────────────────────────────────
const handleGrubHubWebhook = async (req, res) => {
  const sig = req.headers['x-grubhub-signature'] || req.headers['x-hub-signature-256'] || '';
  const raw = JSON.stringify(req.body);
  try {
    if (!verifyGrubHubSignature(raw, sig.replace(/^sha256=/, ''))) {
      return res.status(401).json({ message: 'Invalid signature' });
    }
    const order = req.body.order || req.body;
    if (!order?.id && !order?.order_id) return res.sendStatus(200);

    const norm = normaliseGrubHubOrder(order);
    const id   = await upsertMarketplaceOrder(norm, order);
    const io   = req.app.get('io');
    if (io) io.emit('marketplace_order', { platform: 'grubhub', id, ...norm });

    res.sendStatus(200);
  } catch (err) {
    console.error('GrubHub webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Caviar (powered by DoorDash) — webhook mirrors DoorDash format ──
const handleCaviarWebhook = async (req, res) => {
  const sig = req.headers['x-doordash-signature'] || req.headers['x-caviar-signature'] || '';
  const raw = JSON.stringify(req.body);
  if (!verifyCaviarSignature(raw, sig)) return res.status(401).json({ message: 'Invalid signature' });
  try {
    const order = req.body;
    const norm = {
      platform:          'caviar',
      platform_order_id: String(order.order_id || order.id || Date.now()),
      status:            'new',
      customer_name:     order.customer?.name || 'Caviar Customer',
      customer_phone:    order.customer?.phone || '',
      items:             (order.line_items || []).map(i => ({
        name: i.name, qty: i.quantity, price: parseFloat(i.unit_price || 0)
      })),
      subtotal: parseFloat(order.subtotal || 0),
      total:    parseFloat(order.total    || 0),
      delivery_address: order.delivery_address || '',
    };
    const id = await upsertMarketplaceOrder(norm, order);
    const io = req.app.get('io');
    if (io) io.emit('marketplace_order', { platform: 'caviar', id, ...norm });
    res.sendStatus(200);
  } catch (err) {
    console.error('Caviar webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Admin: list all marketplace orders ──────────────────────────────
const getMarketplaceOrders = async (req, res) => {
  const { platform, status } = req.query;
  try {
    let q = `SELECT * FROM marketplace_orders`;
    const vals = [];
    const conds = [];
    if (platform) { conds.push(`platform = $${vals.length + 1}`); vals.push(platform); }
    if (status)   { conds.push(`status   = $${vals.length + 1}`); vals.push(status); }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ` ORDER BY placed_at DESC LIMIT 200`;

    const result = await pool.query(q, vals);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: update marketplace order status ───────────────────────────
const updateMarketplaceOrder = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  try {
    const result = await pool.query(
      `UPDATE marketplace_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING platform, platform_order_id`,
      [status, id]
    );
    const order = result.rows[0];
    if (order) {
      // Fire-and-forget callback — never blocks the response
      notifyPlatform(order.platform, order.platform_order_id, status).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Stats summary ────────────────────────────────────────────────────
const getMarketplaceStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT platform,
             COUNT(*)::int                        AS total,
             COUNT(*) FILTER (WHERE status='new')::int AS pending,
             COALESCE(SUM(total), 0)::numeric     AS revenue
      FROM marketplace_orders
      GROUP BY platform
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  handleUberEatsWebhook,
  handleGrubHubWebhook,
  handleCaviarWebhook,
  getMarketplaceOrders,
  updateMarketplaceOrder,
  getMarketplaceStats,
};
