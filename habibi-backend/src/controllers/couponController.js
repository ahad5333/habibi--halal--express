const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');

// Public: Validate coupon
const validateCoupon = async (req, res) => {
  try {
    const { code, location_id, cart = [] } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ message: 'Coupon code is required.' });
    }
    // Accept 'amount' or 'subtotal' — frontend sends subtotal
    const amount = req.body.amount ?? req.body.subtotal ?? 0;
    const userId = req.user ? req.user.id : null;

    const result = await pool.query(
      "SELECT * FROM coupons WHERE code=$1 AND is_active=TRUE",
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Invalid or expired coupon code." });
    }

    const coupon = result.rows[0];

    // Check expiry (column is valid_until)
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ message: "This coupon has expired." });
    }

    // Check valid_from
    if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
      return res.status(400).json({ message: "This coupon is not yet active." });
    }

    // All validation checks FIRST — then increment inside a transaction
    // Check condition_type / condition_value (min order amount)
    if (coupon.condition_type === 'min_order' && parseFloat(amount) < parseFloat(coupon.condition_value || 0)) {
      return res.status(400).json({
        message: `Minimum order amount for this coupon is $${parseFloat(coupon.condition_value).toFixed(2)}`
      });
    }

    // Check customer-specific restriction
    if (coupon.customer_email) {
      if (!req.user) {
        return res.status(401).json({ message: "Please log in to use this coupon." });
      }
      if (coupon.customer_email.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(400).json({ message: "This coupon is not valid for your account." });
      }
    }

    // Check location-specific restriction
    if (coupon.location_id && location_id) {
      if (parseInt(coupon.location_id) !== parseInt(location_id)) {
        return res.status(400).json({ message: "This coupon is only valid at a specific location." });
      }
    }

    // All checks passed — now atomically lock + verify + increment in one transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockedCoupon = await client.query(
        "SELECT id, used_count, usage_limit FROM coupons WHERE id=$1 FOR UPDATE",
        [coupon.id]
      );
      const lc = lockedCoupon.rows[0];
      if (lc.usage_limit !== null && lc.used_count >= lc.usage_limit) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: "This coupon has reached its usage limit." });
      }
      await client.query("UPDATE coupons SET used_count = used_count + 1 WHERE id = $1", [coupon.id]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      client.release();
      throw txErr;
    }
    client.release();

    let discount = 0;
    let isFreeDelivery = false;
    let message = '';

    // Normalise cart items for BOGO/free-item calculations
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
    // For BOGO purposes, exclude family tray items
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

    // Cap discount at order amount
    discount = Math.min(discount, parseFloat(amount));

    res.json({
      valid: true,
      discount: parseFloat(discount.toFixed(2)),
      is_free_delivery: isFreeDelivery,
      code: coupon.code,
      discount_type: coupon.discount_type,
      message: message || `Coupon applied — you saved $${discount.toFixed(2)}! 🎉`
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
    } = req.body;

    const minOrder = parseFloat(min_order || min_order_amount || 0);
    const conditionType  = minOrder > 0 ? 'min_order' : null;
    const conditionValue = minOrder > 0 ? minOrder : null;
    const usageLimit     = parseInt(max_uses || usage_limit || 0) || null;
    const validUntil     = expires_at || expiry_date || valid_until || null;
    const validFrom      = valid_from || starts_at || null;

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
        customer_email, location_id, free_item_category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
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
      ]
    );

    logAudit(pool, req.user?.id, req.user?.name, 'create_coupon', 'coupon', String(result.rows[0].id), { code: result.rows[0].code }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Admin: Toggle status
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await pool.query(
      "UPDATE coupons SET is_active=$1 WHERE id=$2 RETURNING *",
      [is_active, id]
    );

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
  getCoupons,
  createCoupon,
  toggleCouponStatus,
  deleteCoupon
};
