const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');

// Shared core: look up + validate a coupon and compute its real discount,
// WITHOUT touching used_count (callers that actually consume the coupon --
// currently only the /validate preview endpoint below -- do that increment
// themselves, in their own transaction, after this resolves). Used by
// order-creation (createGuestOrder/createPendingCheckout) to verify a
// client-claimed discount against what the coupon actually computes to,
// rather than trusting `discount` bounded only by "not more than the
// subtotal" -- previously an order could claim ANY coupon_code plus almost
// any discount up to the full subtotal and nothing ever checked the coupon
// was real, active, or actually worth that much.
// Throws an Error with .statusCode set (same convention as
// resolveChargeAmount.js) on any validation failure.
async function computeCouponDiscount({ code, amount, userId, locationId, cart = [] }) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    const err = new Error('Coupon code is required.'); err.statusCode = 400; throw err;
  }

  const result = await pool.query(
    "SELECT * FROM coupons WHERE code=$1 AND is_active=TRUE",
    [code.toUpperCase()]
  );
  if (result.rows.length === 0) {
    const err = new Error('Invalid or expired coupon code.'); err.statusCode = 404; throw err;
  }
  const coupon = result.rows[0];

  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    const err = new Error('This coupon has expired.'); err.statusCode = 400; throw err;
  }
  if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
    const err = new Error('This coupon is not yet active.'); err.statusCode = 400; throw err;
  }
  if (coupon.condition_type === 'min_order' && parseFloat(amount) < parseFloat(coupon.condition_value || 0)) {
    const err = new Error(`Minimum order amount for this coupon is $${parseFloat(coupon.condition_value).toFixed(2)}`); err.statusCode = 400; throw err;
  }
  if (coupon.customer_email) {
    if (!userId) { const err = new Error('Please log in to use this coupon.'); err.statusCode = 401; throw err; }
    const userRow  = await pool.query('SELECT email FROM users WHERE id=$1', [userId]);
    const userEmail = userRow.rows[0]?.email || '';
    if (coupon.customer_email.toLowerCase() !== userEmail.toLowerCase()) {
      const err = new Error('This coupon is not valid for your account.'); err.statusCode = 400; throw err;
    }
  }
  if (coupon.location_id && locationId) {
    if (parseInt(coupon.location_id) !== parseInt(locationId)) {
      const err = new Error('This coupon is only valid at a specific location.'); err.statusCode = 400; throw err;
    }
  }
  if (coupon.is_first_order_only) {
    if (!userId) { const err = new Error('Please log in to use this coupon.'); err.statusCode = 401; throw err; }
    const priorOrders = await pool.query(
      `SELECT COUNT(*)::int AS n FROM guest_orders WHERE user_id=$1 AND order_status != 'cancelled'`,
      [userId]
    );
    if (priorOrders.rows[0].n > 0) {
      const err = new Error('This coupon is only valid on your first order.'); err.statusCode = 400; throw err;
    }
  }
  // used_count vs usage_limit is checked (read-only, no lock) here too --
  // callers that actually consume the coupon still do their own FOR UPDATE
  // increment afterward, which is the real atomic enforcement.
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    const err = new Error('This coupon has reached its usage limit.'); err.statusCode = 400; throw err;
  }

  let discount = 0;
  let isFreeDelivery = false;
  let message = '';

  const FAMILY_TRAY_KEYWORDS = ['family tray', 'family-tray', 'familytray'];
  const isFamilyTray = (item) => {
    const hay = `${item.name || ''} ${item.category || ''}`.toLowerCase();
    return FAMILY_TRAY_KEYWORDS.some(k => hay.includes(k));
  };
  const cartItems = (cart || [])
    .map(i => ({
      price:    parseFloat(i.price || i.unit_price || 0),
      quantity: parseInt(i.quantity || i.qty || 1),
      name:     i.name || '',
      category: i.category || '',
    }))
    .filter(i => i.price > 0);
  const bogoItems     = cartItems.filter(i => !isFamilyTray(i));
  const bogoSorted    = [...bogoItems].sort((a, b) => a.price - b.price);
  const bogoMinPrice  = bogoSorted[0]?.price || 0;
  const allSorted     = [...cartItems].sort((a, b) => a.price - b.price);
  const cheapestPrice = allSorted[0]?.price || 0;

  switch (coupon.discount_type) {
      case 'percentage':
        discount = (parseFloat(amount) * Number(coupon.discount_value)) / 100;
        message = `${coupon.discount_value}% off applied!`;
        break;
      case 'fixed_amount':
      case 'fixed':
        discount = Number(coupon.discount_value);
        message = `$${discount.toFixed(2)} off applied!`;
        break;
      case 'free_delivery':
        isFreeDelivery = true;
        message = 'Free delivery applied!';
        break;
      case 'bogo':
        // Buy one get one free — cheapest non-family-tray item free
        discount = bogoMinPrice;
        message = 'Buy One Get One Free applied!';
        break;
      case 'bogo_half':
        // Buy one get one half price — half price of cheapest non-family-tray item
        discount = bogoMinPrice / 2;
        message = 'Buy One Get One 50% Off applied!';
        break;
      case 'free_item':
        // Free cheapest item in cart
        discount = cheapestPrice;
        message = 'Free item applied!';
        break;
      case 'free_item_from_category': {
        // Free cheapest item in the specified category
        const targetCat = (coupon.free_item_category || '').toLowerCase().trim();
        const catItems  = targetCat
          ? cartItems.filter(i => i.category.toLowerCase().includes(targetCat) || i.name.toLowerCase().includes(targetCat))
          : cartItems;
        const catSorted = [...catItems].sort((a, b) => a.price - b.price);
        discount = catSorted[0]?.price || 0;
        message  = discount > 0
          ? `Free ${coupon.free_item_category || 'item'} applied!`
          : `No matching ${coupon.free_item_category || 'item'} found in cart.`;
        break;
      }
      default:
        discount = 0;
    }

  // Cap discount at the coupon's configured max, if any
  if (coupon.max_discount != null && parseFloat(coupon.max_discount) > 0) {
    discount = Math.min(discount, parseFloat(coupon.max_discount));
  }
  // Cap discount at order amount
  discount = Math.min(discount, parseFloat(amount));

  // A custom admin-set message (coupon.description) always wins over the
  // auto-generated discount-type message when present.
  const customMessage = (coupon.description || '').trim();

  return {
    coupon,
    discount: parseFloat(discount.toFixed(2)),
    isFreeDelivery,
    message: customMessage || message || `Coupon applied — you saved $${discount.toFixed(2)}! 🎉`,
  };
}

// Public: Validate coupon (preview, called as the customer types/applies a
// code in the cart -- this is the ONLY place used_count actually increments).
const validateCoupon = async (req, res) => {
  try {
    const { code, location_id, cart = [] } = req.body;
    // Accept 'amount' or 'subtotal' — frontend sends subtotal
    const amount = req.body.amount ?? req.body.subtotal ?? 0;
    const userId = req.user ? req.user.id : null;

    let result;
    try {
      result = await computeCouponDiscount({ code, amount, userId, locationId: location_id, cart });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message || 'Could not validate coupon.' });
    }
    const { coupon, discount, isFreeDelivery, message } = result;

    // Read-only preview — does NOT increment used_count. This is a cart
    // "Apply Coupon" click, not a completed order; incrementing here let
    // usage_limit get consumed by abandoned carts, and (the real problem)
    // was also the ONLY place usage_limit was ever enforced with a lock —
    // an order submitted directly to /api/orders/guest without ever calling
    // this endpoint first skipped enforcement entirely. The real, atomic
    // lock+increment now happens once, in createGuestOrder, at the point an
    // order is actually committed.

    res.json({
      valid: true,
      discount,
      is_free_delivery: isFreeDelivery,
      code: coupon.code,
      discount_type: coupon.discount_type,
      message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json(safeError(error));
  }
};

// Admin: Get all coupons
const getCoupons = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM coupons ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: Create coupon
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      // accept both naming conventions from admin form and API callers
      min_order, min_order_amount,
      max_uses, usage_limit,
      expires_at, expiry_date, valid_until,
      valid_from, starts_at,
      title, description,
      customer_email,
      location_id,
      free_item_category,
      max_discount,
      is_first_order_only,
    } = req.body;

    const minOrder = parseFloat(min_order || min_order_amount || 0);
    const conditionType  = minOrder > 0 ? 'min_order' : null;
    const conditionValue = minOrder > 0 ? minOrder : null;
    const usageLimit     = parseInt(max_uses || usage_limit || 0) || null;
    const validUntil     = expires_at || expiry_date || valid_until || null;
    const validFrom      = valid_from || starts_at || null;
    const maxDiscount    = parseFloat(max_discount) > 0 ? parseFloat(max_discount) : null;

    // Validate discount_value — must be non-negative for types that use it
    const needsValue = ['percentage', 'fixed_amount', 'fixed'].includes(discount_type);
    const parsedValue = parseFloat(discount_value) || 0;
    if (needsValue && parsedValue < 0) {
      return res.status(400).json({ message: 'Discount value must be 0 or greater.' });
    }
    if (discount_type === 'percentage' && parsedValue > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%.' });
    }

    const result = await pool.query(
      `INSERT INTO coupons (
        code, discount_type, discount_value,
        condition_type, condition_value,
        usage_limit, valid_from, valid_until,
        title, description,
        customer_email, location_id, free_item_category,
        max_discount, is_first_order_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        code.toUpperCase(),
        discount_type || 'percentage',
        parsedValue,
        conditionType,
        conditionValue,
        usageLimit,
        validFrom || null,
        validUntil || null,
        title || null,
        description || null,
        customer_email || null,
        location_id ? parseInt(location_id) : null,
        free_item_category || null,
        maxDiscount,
        !!is_first_order_only,
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'create_coupon', 'coupon', String(result.rows[0].id), { code: result.rows[0].code }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: Toggle status — flips server-side so it doesn't depend on the
// client sending the current value (the toggle button call sends no body).
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE coupons SET is_active = NOT is_active WHERE id=$1 RETURNING *",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Coupon not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: Update coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      discount_type, discount_value,
      min_order, min_order_amount,
      max_uses, usage_limit,
      expires_at, expiry_date, valid_until,
      valid_from, starts_at,
      title, description,
      customer_email, location_id, free_item_category,
      max_discount, is_first_order_only,
    } = req.body;

    const cur = await pool.query('SELECT * FROM coupons WHERE id=$1', [id]);
    if (cur.rows.length === 0) return res.status(404).json({ message: 'Coupon not found.' });
    const c = cur.rows[0];

    const minOrder = parseFloat(min_order || min_order_amount || 0);
    const conditionType  = minOrder > 0 ? 'min_order' : null;
    const conditionValue = minOrder > 0 ? minOrder : null;
    const usageLimit     = parseInt(max_uses || usage_limit || 0) || null;
    const validUntil     = expires_at || expiry_date || valid_until || c.valid_until || null;
    const validFrom      = valid_from || starts_at || c.valid_from || null;
    const parsedValue    = discount_value !== undefined ? (parseFloat(discount_value) || 0) : parseFloat(c.discount_value);
    const dtype          = discount_type || c.discount_type;
    const maxDiscount    = max_discount !== undefined
      ? (parseFloat(max_discount) > 0 ? parseFloat(max_discount) : null)
      : c.max_discount;
    const firstOrderOnly = is_first_order_only !== undefined ? !!is_first_order_only : c.is_first_order_only;

    if (dtype === 'percentage' && parsedValue > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%.' });
    }

    const result = await pool.query(
      `UPDATE coupons
       SET discount_type=$1, discount_value=$2, condition_type=$3, condition_value=$4,
           usage_limit=$5, valid_from=$6, valid_until=$7,
           title=$8, description=$9, customer_email=$10, location_id=$11, free_item_category=$12,
           max_discount=$13, is_first_order_only=$14
       WHERE id=$15 RETURNING *`,
      [
        dtype, parsedValue, conditionType, conditionValue, usageLimit,
        validFrom, validUntil,
        title !== undefined ? (title || null) : c.title,
        description !== undefined ? (description || null) : c.description,
        customer_email !== undefined ? (customer_email || null) : c.customer_email,
        location_id !== undefined ? (location_id ? parseInt(location_id) : null) : c.location_id,
        free_item_category !== undefined ? (free_item_category || null) : c.free_item_category,
        maxDiscount,
        firstOrderOnly,
        id,
      ]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'update_coupon', 'coupon', String(id), { code: result.rows[0].code }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM coupons WHERE id=$1", [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_coupon', 'coupon', String(id), {}, req.ip);
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  validateCoupon,
  computeCouponDiscount,
  getCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon
};
