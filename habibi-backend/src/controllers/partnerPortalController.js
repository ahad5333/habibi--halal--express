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
                address, status, price_tier, notes, payment_methods, credit_balance, created_at
         FROM partner_applications WHERE id=$1`,
        [user.partner_id]
      );
      application = appRes.rows[0] || null;
      if (application) {
        application.payment_methods = Array.isArray(application.payment_methods) ? application.payment_methods
          : (typeof application.payment_methods === 'string' ? JSON.parse(application.payment_methods || '[]') : []);
      }
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

    const [regularMenus, businessMenus, tacoMenus] = await Promise.all([
      // Regular menu with partner pricing
      pool.query(`
        SELECT id, name, description, price, partner_price,
               image_url, category, is_available, quota_required
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
      // Taco types for quota picker (all active tacos regardless of partner_price)
      pool.query(`
        SELECT id, name, price, image_url
        FROM menus
        WHERE is_active = TRUE AND is_available = TRUE
          AND LOWER(category) = 'tacos'
        ORDER BY sort_order, id
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
      taco_types: tacoMenus.rows,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Place Order ───────────────────────────────────────────────────
// Prices/totals are never trusted from the client — every submitted line is
// re-resolved here against the live catalog (regular menu partner_price, or
// business_menus with this partner's tier applied) and priced server-side.
// "Dozen of Tacos" quota bundles arrive as a composite cart id (`q<menuId>-t<tacoId>`)
// that PartnerPortal.jsx generates client-side; the price is the quota menu item's
// own partner_price, so we parse out menuId and resolve it the same way.
exports.placeOrder = async (req, res) => {
  try {
    const { items, delivery_address, notes, payment_method } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

    const orderNumber = 'PO-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Resolve business name/tier + enforce the payment methods approved for this partner
    let businessName = 'Partner';
    let appId = null;
    let priceTier = 'tier_1';
    if (req.user.partner_id) {
      const appRes = await pool.query(
        'SELECT id, business_name, price_tier, payment_methods FROM partner_applications WHERE id=$1',
        [req.user.partner_id]
      );
      const app = appRes.rows[0];
      if (app) {
        businessName = app.business_name;
        appId = app.id;
        priceTier = app.price_tier || 'tier_1';
        const allowed = Array.isArray(app.payment_methods) ? app.payment_methods
          : (typeof app.payment_methods === 'string' ? JSON.parse(app.payment_methods || '[]') : []);
        if (allowed.length > 0 && payment_method && !allowed.includes(payment_method)) {
          return res.status(400).json({ error: `"${payment_method}" is not an approved payment method for your account. Allowed: ${allowed.join(', ')}` });
        }
      }
    }
    const tierField = priceTier === 'tier_3' ? 'price_tier_3' : priceTier === 'tier_2' ? 'price_tier_2' : null;

    const resolvedItems = [];
    let subTotal = 0;

    for (const raw of items) {
      const qty = parseInt(raw.quantity ?? raw.qty, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Every item needs a valid quantity.' });
      }

      const quotaMatch = typeof raw.id === 'string' && raw.id.match(/^q(\d+)-t\d+$/);
      let row, unitPrice, minQty = 1, itemName, itemUnit = 'ea', source;

      if (quotaMatch) {
        const r = await pool.query(
          `SELECT id, name, partner_price, is_active, is_available FROM menus WHERE id=$1`,
          [parseInt(quotaMatch[1], 10)]
        );
        row = r.rows[0];
        if (!row || !row.is_active || !row.is_available || row.partner_price == null) {
          return res.status(400).json({ error: `"${raw.name || 'An item'}" is no longer available.` });
        }
        unitPrice = parseFloat(row.partner_price);
        itemName = raw.name || row.name;
        source = 'regular';
      } else if (raw.source === 'wholesale') {
        const r = await pool.query(
          `SELECT id, name, price, price_tier_2, price_tier_3, min_quantity, unit, is_active FROM business_menus WHERE id=$1`,
          [raw.id]
        );
        row = r.rows[0];
        if (!row || !row.is_active) {
          return res.status(400).json({ error: `"${raw.name || 'An item'}" is no longer available.` });
        }
        unitPrice = parseFloat(tierField && row[tierField] != null ? row[tierField] : row.price);
        minQty = row.min_quantity || 1;
        itemUnit = row.unit || 'case';
        itemName = row.name;
        source = 'wholesale';
      } else {
        const r = await pool.query(
          `SELECT id, name, partner_price, is_active, is_available FROM menus WHERE id=$1`,
          [raw.id]
        );
        row = r.rows[0];
        if (!row || !row.is_active || !row.is_available || row.partner_price == null) {
          return res.status(400).json({ error: `"${raw.name || 'An item'}" is no longer available.` });
        }
        unitPrice = parseFloat(row.partner_price);
        itemName = row.name;
        source = 'regular';
      }

      if (qty < minQty) {
        return res.status(400).json({ error: `"${itemName}" requires a minimum order of ${minQty}.` });
      }

      subTotal += Math.round(unitPrice * qty * 100) / 100;
      resolvedItems.push({ menu_item_id: row.id, name: itemName, quantity: qty, unit_price: unitPrice, unit: itemUnit, source });
    }

    subTotal = Math.round(subTotal * 100) / 100;

    const result = await pool.query(
      `INSERT INTO partner_orders
         (order_number, partner_user_id, application_id, business_name,
          items, sub_total, tax, total, delivery_address, notes, price_tier, payment_method, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'unpaid')
       RETURNING *`,
      [orderNumber, req.user.id, appId, businessName,
       JSON.stringify(resolvedItems), subTotal, 0,
       subTotal, delivery_address || '', notes || '', priceTier,
       payment_method || null]
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
              delivery_address, notes, price_tier, status,
              payment_status, payment_method, placed_at, updated_at
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

// ── Single Order ──────────────────────────────────────────────────
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, order_number, business_name, items, sub_total, tax, total,
              delivery_address, notes, price_tier, status,
              payment_status, payment_method, placed_at, updated_at
       FROM partner_orders
       WHERE id=$1 AND partner_user_id=$2`,
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Order not found' });
    const o = result.rows[0];
    res.json({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []),
    });
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
       LEFT JOIN partner_applications pa ON pa.id = po.application_id
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
