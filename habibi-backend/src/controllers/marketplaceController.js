const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');
const { notifyPlatform } = require('../services/orderCallbackService');

// ── Webhook signature helpers ───────────────────────────────────────
function verifyUberSignature(rawBody, signature) {
  const secret = process.env.UBEREATS_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected)); }
  catch { return false; }
}

function verifyGrubHubSignature(rawBody, signature) {
  const secret = process.env.GRUBHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

function verifyCaviarSignature(rawBody, signature) {
  const secret = process.env.DOORDASH_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

// ── Resolve location_id from platform store ID ──────────────────────
async function resolveLocationId(platform, storeId) {
  if (!storeId) return null;
  const res = await pool.query(
    `SELECT location_id FROM platform_location_mappings
     WHERE platform = $1 AND (platform_store_id = $2 OR platform_restaurant_id = $2) AND is_active = true
     LIMIT 1`,
    [platform, String(storeId)]
  );
  return res.rows[0]?.location_id || null;
}

// ── Normalise orders ────────────────────────────────────────────────
function normaliseUberOrder(o) {
  return {
    platform:          'ubereats',
    platform_order_id: o.id,
    platform_store_id: o.restaurant?.id || o.store_id || null,
    status:            o.current_state === 'AWAITING_RESTAURANT_ACCEPT' ? 'new' : 'accepted',
    customer_name:     `${o.eater?.first_name || ''} ${o.eater?.last_name || ''}`.trim() || 'UberEats Customer',
    customer_phone:    o.eater?.phone || '',
    items:             (o.cart?.items || []).map(i => ({ name: i.title, qty: i.quantity, price: (i.price?.unit_price_cents || 0) / 100 })),
    subtotal:          (o.cart?.pricing_info?.subtotal_cents || o.subtotal_price_cents || 0) / 100,
    total:             (o.cart?.pricing_info?.total_cents    || o.total_price_cents    || 0) / 100,
    delivery_address:  o.eater?.delivery?.address?.formatted_address || '',
  };
}

function normaliseGrubHubOrder(o) {
  return {
    platform:          'grubhub',
    platform_order_id: String(o.id || o.order_id),
    platform_store_id: o.restaurant_id || o.location_id || null,
    status:            'new',
    customer_name:     `${o.diner?.first_name || ''} ${o.diner?.last_name || ''}`.trim() || 'GrubHub Customer',
    customer_phone:    o.diner?.phone || '',
    items:             (o.order_items || []).map(i => ({ name: i.description || i.name, qty: i.quantity, price: parseFloat(i.price || 0) })),
    subtotal:          parseFloat(o.pricing?.food_total || o.subtotal || 0),
    total:             parseFloat(o.pricing?.total      || o.total    || 0),
    delivery_address:  o.delivery_info?.delivery_address?.street || '',
  };
}

async function upsertMarketplaceOrder(norm, rawPayload) {
  const locationId = await resolveLocationId(norm.platform, norm.platform_store_id);
  const result = await pool.query(
    `INSERT INTO marketplace_orders
       (platform, platform_order_id, platform_store_id, location_id,
        status, customer_name, customer_phone,
        items, subtotal, total, delivery_address, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (platform_order_id) DO UPDATE
       SET status=$5, updated_at=NOW()
     RETURNING id`,
    [
      norm.platform, norm.platform_order_id, norm.platform_store_id, locationId,
      norm.status, norm.customer_name, norm.customer_phone,
      JSON.stringify(norm.items), norm.subtotal, norm.total,
      norm.delivery_address, JSON.stringify(rawPayload),
    ]
  );
  return { id: result.rows[0].id, locationId };
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
      const { id, locationId } = await upsertMarketplaceOrder(norm, o);
      const io = req.app.get('io');
      if (io) io.emit('marketplace_order', { platform: 'ubereats', id, location_id: locationId, ...norm });
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
    if (!verifyGrubHubSignature(raw, sig.replace(/^sha256=/, ''))) return res.status(401).json({ message: 'Invalid signature' });
    const order = req.body.order || req.body;
    if (!order?.id && !order?.order_id) return res.sendStatus(200);
    const norm = normaliseGrubHubOrder(order);
    const { id, locationId } = await upsertMarketplaceOrder(norm, order);
    const io = req.app.get('io');
    if (io) io.emit('marketplace_order', { platform: 'grubhub', id, location_id: locationId, ...norm });
    res.sendStatus(200);
  } catch (err) {
    console.error('GrubHub webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Caviar webhook ───────────────────────────────────────────────────
const handleCaviarWebhook = async (req, res) => {
  const sig = req.headers['x-doordash-signature'] || req.headers['x-caviar-signature'] || '';
  const raw = JSON.stringify(req.body);
  if (!verifyCaviarSignature(raw, sig)) return res.status(401).json({ message: 'Invalid signature' });
  try {
    const order = req.body;
    const norm = {
      platform:          'caviar',
      platform_order_id: String(order.order_id || order.id || Date.now()),
      platform_store_id: order.store_id || order.restaurant_id || null,
      status:            'new',
      customer_name:     order.customer?.name || 'Caviar Customer',
      customer_phone:    order.customer?.phone || '',
      items:             (order.line_items || []).map(i => ({ name: i.name, qty: i.quantity, price: parseFloat(i.unit_price || 0) })),
      subtotal:          parseFloat(order.subtotal || 0),
      total:             parseFloat(order.total    || 0),
      delivery_address:  order.delivery_address || '',
    };
    const { id, locationId } = await upsertMarketplaceOrder(norm, order);
    const io = req.app.get('io');
    if (io) io.emit('marketplace_order', { platform: 'caviar', id, location_id: locationId, ...norm });
    res.sendStatus(200);
  } catch (err) {
    console.error('Caviar webhook error:', err.message);
    res.sendStatus(500);
  }
};

// ── Admin: list marketplace orders ───────────────────────────────────
const getMarketplaceOrders = async (req, res) => {
  const { platform, status, location_id } = req.query;
  try {
    let q = `
      SELECT mo.*, l.title AS location_name, l.brief_address AS location_address
      FROM marketplace_orders mo
      LEFT JOIN locations l ON l.id = mo.location_id
    `;
    const vals = [];
    const conds = [];
    if (platform)    { conds.push(`mo.platform = $${vals.length + 1}`);    vals.push(platform); }
    if (status)      { conds.push(`mo.status = $${vals.length + 1}`);      vals.push(status); }
    if (location_id) { conds.push(`mo.location_id = $${vals.length + 1}`); vals.push(location_id); }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ` ORDER BY mo.placed_at DESC LIMIT 200`;
    const result = await pool.query(q, vals);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Admin: update marketplace order status ────────────────────────────
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
    if (order) notifyPlatform(order.platform, order.platform_order_id, status).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Stats summary ─────────────────────────────────────────────────────
const getMarketplaceStats = async (req, res) => {
  try {
    const [platformStats, locationStats] = await Promise.all([
      pool.query(`
        SELECT platform,
               COUNT(*)::int                                   AS total,
               COUNT(*) FILTER (WHERE status='new')::int      AS pending,
               COALESCE(SUM(total), 0)::numeric                AS revenue
        FROM marketplace_orders GROUP BY platform
      `),
      pool.query(`
        SELECT l.id, l.title, l.brief_address,
               COUNT(mo.id)::int                               AS total_orders,
               COALESCE(SUM(mo.total), 0)::numeric             AS revenue
        FROM locations l
        LEFT JOIN marketplace_orders mo ON mo.location_id = l.id
        GROUP BY l.id, l.title, l.brief_address
        ORDER BY l.id
      `),
    ]);
    res.json({ platforms: platformStats.rows, locations: locationStats.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Location mappings CRUD ────────────────────────────────────────────
const getLocationMappings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, l.title AS location_name, l.brief_address
      FROM platform_location_mappings m
      JOIN locations l ON l.id = m.location_id
      ORDER BY l.id, m.platform
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const saveLocationMapping = async (req, res) => {
  const { location_id, platform, platform_store_id, platform_restaurant_id, platform_menu_id, is_active, notes } = req.body;
  if (!location_id || !platform) return res.status(400).json({ message: 'location_id and platform are required' });
  try {
    const result = await pool.query(
      `INSERT INTO platform_location_mappings
         (location_id, platform, platform_store_id, platform_restaurant_id, platform_menu_id, is_active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (location_id, platform) DO UPDATE SET
         platform_store_id      = EXCLUDED.platform_store_id,
         platform_restaurant_id = EXCLUDED.platform_restaurant_id,
         platform_menu_id       = EXCLUDED.platform_menu_id,
         is_active              = EXCLUDED.is_active,
         notes                  = EXCLUDED.notes,
         updated_at             = NOW()
       RETURNING *`,
      [location_id, platform, platform_store_id || null, platform_restaurant_id || null, platform_menu_id || null, is_active ?? false, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  handleUberEatsWebhook,
  handleGrubHubWebhook,
  handleCaviarWebhook,
  getMarketplaceOrders,
  updateMarketplaceOrder,
  getMarketplaceStats,
  getLocationMappings,
  saveLocationMapping,
};
