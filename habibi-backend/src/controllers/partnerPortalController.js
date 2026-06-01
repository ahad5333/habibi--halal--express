const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');

// ── Profile ───────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userRes = await pool.query(
      `SELECT id, name, email, phone_number, is_partner, partner_id, created_at FROM users WHERE id=$1`,
      [req.user.id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    let application = null;
    if (user.partner_id) {
      const appRes = await pool.query(
        `SELECT id, business_name, ein_number, contact_name, email, phone,
                address, status, price_tier, notes, created_at
         FROM partner_applications WHERE id=$1`,
        [user.partner_id]
      );
      application = appRes.rows[0] || null;
    }

    res.json({ user, application });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Catalog (menus with partner_price + business_menus) ───────────
exports.getCatalog = async (req, res) => {
  try {
    // Get the partner's price tier to determine which tier price to show
    let priceTier = 'tier_1';
    if (req.user.partner_id) {
      const appRes = await pool.query(
        'SELECT price_tier FROM partner_applications WHERE id=$1',
        [req.user.partner_id]
      );
      priceTier = appRes.rows[0]?.price_tier || 'tier_1';
    }

    const [regularMenus, businessMenus] = await Promise.all([
      // Regular menu with partner pricing
      pool.query(`
        SELECT id, name, description, price, partner_price,
               image_url, category, is_available
        FROM menus
        WHERE is_active = TRUE AND is_available = TRUE
          AND partner_price IS NOT NULL AND partner_price > 0
        ORDER BY category, sort_order, id
      `),
      // Business-specific wholesale catalog
      pool.query(`
        SELECT id, name, description, category,
               price, price_tier_2, price_tier_3,
               min_quantity, unit, image_url
        FROM business_menus
        WHERE is_active = TRUE
        ORDER BY category, sort_order, id
      `),
    ]);

    // Apply tier pricing to business menus
    const tierField = priceTier === 'tier_3' ? 'price_tier_3'
                    : priceTier === 'tier_2' ? 'price_tier_2'
                    : null;

    const businessItems = businessMenus.rows.map(item => ({
      ...item,
      display_price: tierField && item[tierField] ? item[tierField] : item.price,
      source: 'wholesale',
    }));

    const regularItems = regularMenus.rows.map(item => ({
      ...item,
      display_price: item.partner_price,
      source: 'regular',
    }));

    res.json({
      price_tier: priceTier,
      regular_menu: regularItems,
      wholesale_catalog: businessItems,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Place Order ───────────────────────────────────────────────────
exports.placeOrder = async (req, res) => {
  try {
    const { items, delivery_address, notes, sub_total, tax, total } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

    const orderNumber = 'PO-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Resolve business name
    let businessName = 'Partner';
    let appId = null;
    if (req.user.partner_id) {
      const appRes = await pool.query(
        'SELECT id, business_name, price_tier FROM partner_applications WHERE id=$1',
        [req.user.partner_id]
      );
      const app = appRes.rows[0];
      if (app) { businessName = app.business_name; appId = app.id; }
    }

    const result = await pool.query(
      `INSERT INTO partner_orders
         (order_number, partner_user_id, partner_application_id, business_name,
          items, sub_total, tax, total, delivery_address, notes, price_tier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         (SELECT price_tier FROM partner_applications WHERE id=$3))
       RETURNING *`,
      [orderNumber, req.user.id, appId, businessName,
       JSON.stringify(items), sub_total || 0, tax || 0,
       total || 0, delivery_address || '', notes || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Order History ─────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_number, business_name, items, sub_total, tax, total,
              delivery_address, notes, price_tier, status, placed_at
       FROM partner_orders
       WHERE partner_user_id=$1
       ORDER BY placed_at DESC`,
      [req.user.id]
    );
    const orders = result.rows.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []),
    }));
    res.json(orders);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Invoice (single order detail) ────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT po.*, u.name AS partner_name, u.email AS partner_email,
              pa.business_name AS app_business_name, pa.ein_number, pa.address AS business_address
       FROM partner_orders po
       JOIN users u ON u.id = po.partner_user_id
       LEFT JOIN partner_applications pa ON pa.id = po.partner_application_id
       WHERE po.id=$1 AND po.partner_user_id=$2`,
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Invoice not found' });
    const o = result.rows[0];
    res.json({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []),
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
