const safeError = require('../utils/safeError');
const pool   = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");


// ─── GET /api/users/me ───────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone_number, role, loyalty_points, avatar_url, date_of_birth, created_at FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "User not found." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── PUT /api/users/me ───────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone_number, avatar_url, date_of_birth } = req.body;
    const result = await pool.query(
      `UPDATE users
          SET name=$1,
              phone_number=$2,
              avatar_url=COALESCE($3, avatar_url),
              date_of_birth=COALESCE($5::date, date_of_birth),
              updated_at=NOW()
        WHERE id=$4
        RETURNING id, name, email, phone_number, role, loyalty_points, avatar_url, date_of_birth`,
      [name || null, phone_number || null, avatar_url || null, req.user.id, date_of_birth || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── PUT /api/users/me/password ──────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 8)
      return res.status(400).json({ message: "New password must be at least 8 characters." });

    const userResult = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
    if (!userResult.rows[0]) return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(current_password || "", userResult.rows[0].password_hash);
    if (!match) return res.status(400).json({ message: "Current password is incorrect." });

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [hashed, req.user.id]);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── DELETE /api/users/me ────────────────────────────────────────────────────
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userResult = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
    if (!userResult.rows[0]) return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(password || "", userResult.rows[0].password_hash);
    if (!match) return res.status(400).json({ message: "Incorrect password." });

    // GDPR: anonymize and deactivate rather than hard-delete to preserve order records
    await pool.query(
      `UPDATE users
          SET is_active=FALSE,
              email=CONCAT('deleted_', id, '@habibi.removed'),
              name='Deleted User',
              phone_number=NULL,
              password_hash=$2,
              reset_token=NULL,
              reset_token_expires=NULL,
              updated_at=NOW()
        WHERE id=$1`,
      [req.user.id, crypto.randomBytes(64).toString('hex')]
    );
    res.json({ message: "Account deleted. You have been signed out." });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── GET /api/users/me/orders ────────────────────────────────────────────────
const getMyOrders = async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT email, phone_number FROM users WHERE id=$1",
      [req.user.id]
    );
    const email = userResult.rows[0]?.email;
    const phone = userResult.rows[0]?.phone_number;
    if (!email && !phone) return res.json([]);

    // Match by user_id (most reliable) OR email (case-insensitive) OR phone number.
    // user_id covers orders placed while logged in; email/phone cover guest orders
    // and orders placed before the user_id column was added.
    const result = await pool.query(
      `SELECT order_number, customer_name, delivery_method,
              order_status, total, sub_total, tax, service_fee,
              delivery_fee, tip, discount, coupon_code, payment_method,
              delivery_address, delivery_city, delivery_state, delivery_zip,
              placed_at, items
         FROM guest_orders
        WHERE user_id = $3
           OR ($1::text IS NOT NULL AND LOWER(customer_email) = LOWER($1))
           OR ($2::text IS NOT NULL AND customer_phone = $2)
        ORDER BY placed_at DESC`,
      [email || null, phone || null, req.user.id]
    );

    // Enrich items with menu names so the mobile reorder feature works
    const allMenuItemIds = new Set();
    const rawOrders = result.rows.map(o => {
      let items = [];
      try { items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []); } catch (_) {}
      items.forEach(it => { const id = parseInt(it.menu_item_id); if (!isNaN(id)) allMenuItemIds.add(id); });
      return { ...o, items };
    });

    let nameMap = {};
    if (allMenuItemIds.size > 0) {
      const ids = Array.from(allMenuItemIds);
      const menuResult = await pool.query(
        `SELECT id, name, image_url FROM menus WHERE id = ANY($1)`,
        [ids]
      );
      menuResult.rows.forEach(row => { nameMap[row.id] = { name: row.name, image_url: row.image_url }; });
    }

    const orders = rawOrders.map(o => ({
      ...o,
      items: o.items.map(it => ({
        ...it,
        name: nameMap[it.menu_item_id]?.name || it.name || 'Item',
        image_url: nameMap[it.menu_item_id]?.image_url || null,
      })),
    }));

    res.json(orders);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── GET /api/users/me/addresses ─────────────────────────────────────────────
const getAddresses = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, receiver_name, street_address, second_line, city, state, zip_code,
              driver_instruction, is_default, created_at
         FROM addresses
        WHERE user_id=$1
        ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── POST /api/users/me/addresses ────────────────────────────────────────────
const MAX_ADDRESSES = 12;

const addAddress = async (req, res) => {
  try {
    const { receiver_name, street_address, second_line, city, state, zip_code, driver_instruction, is_default } = req.body;
    if (!street_address || !city || !state || !zip_code)
      return res.status(400).json({ message: "Street address, city, state and ZIP are required." });

    // Enforce 12-address limit per spec
    const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM addresses WHERE user_id=$1", [req.user.id]);
    if (countRes.rows[0].cnt >= MAX_ADDRESSES) {
      return res.status(400).json({ message: `You can save up to ${MAX_ADDRESSES} addresses. Please remove one before adding a new one.` });
    }

    if (is_default) {
      await pool.query("UPDATE addresses SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
    }

    const result = await pool.query(
      `INSERT INTO addresses (user_id, receiver_name, street_address, second_line, city, state, zip_code, driver_instruction, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, receiver_name || null, street_address, second_line || null, city, state, zip_code, driver_instruction || null, !!is_default]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── PUT /api/users/me/addresses/:id/default ─────────────────────────────────
const setDefaultAddress = async (req, res) => {
  try {
    await pool.query("UPDATE addresses SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
    const result = await pool.query(
      "UPDATE addresses SET is_default=TRUE WHERE id=$1 AND user_id=$2 RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Address not found." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── DELETE /api/users/me/addresses/:id ──────────────────────────────────────
const deleteAddress = async (req, res) => {
  try {
    await pool.query("DELETE FROM addresses WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ message: "Address removed." });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── POST /api/users/me/device-token ─────────────────────────────────────────
const registerDeviceToken = async (req, res) => {
  try {
    const { device_token, device_type } = req.body;
    if (!device_token) return res.status(400).json({ message: "Device token is required." });

    await pool.query(
      `INSERT INTO user_device_tokens (user_id, device_token, device_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (device_token)
       DO UPDATE SET user_id = EXCLUDED.user_id, device_type = EXCLUDED.device_type, updated_at = NOW()`,
      [req.user.id, device_token, device_type || 'web']
    );

    res.json({ success: true, message: "Device token registered successfully." });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── GET /api/users/me/loyalty ───────────────────────────────────────────────
const getLoyalty = async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT loyalty_points FROM users WHERE id=$1',
      [req.user.id]
    );
    const pts = userRes.rows[0]?.loyalty_points || 0;

    // Tier thresholds
    const tiers = [
      { name: 'Bronze', min: 0,    max: 999,  next: 1000, color: '#CD7F32' },
      { name: 'Silver', min: 1000, max: 2499, next: 2500, color: '#A8A9AD' },
      { name: 'Gold',   min: 2500, max: Infinity, next: null, color: '#F2C94C' },
    ];
    const tier = tiers.find(t => pts >= t.min && pts <= t.max) || tiers[0];

    // Recent orders that earned points (delivered orders)
    const email = (await pool.query('SELECT email FROM users WHERE id=$1', [req.user.id])).rows[0]?.email;
    let history = [];
    if (email) {
      const ordRes = await pool.query(
        `SELECT order_number, placed_at, total, order_status
           FROM guest_orders
          WHERE customer_email=$1
          ORDER BY placed_at DESC
          LIMIT 10`,
        [email]
      );
      history = ordRes.rows.map(o => ({
        order_number: o.order_number,
        date: o.placed_at,
        points_earned: o.order_status === 'delivered' ? Math.floor(parseFloat(o.total) || 0) : 0,
        status: o.order_status,
        total: o.total,
      }));
    }

    res.json({
      points: pts,
      tier: tier.name,
      tier_color: tier.color,
      next_tier: tier.next,
      next_tier_pts_needed: tier.next ? Math.max(0, tier.next - pts) : 0,
      progress_pct: tier.next ? Math.min(100, Math.round(((pts - tier.min) / (tier.next - tier.min)) * 100)) : 100,
      history,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const createUser = async (req, res) => res.status(501).json({ message: "Use /api/auth/register" });

const getUsers = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const rawSearch = String(req.query.search || '').slice(0, 100); // cap to prevent ReDoS
    const { limit = 50, offset = 0 } = req.query;
    const search = rawSearch;
    const searchClause = search
      ? `AND (name ILIKE $3 OR email ILIKE $3 OR phone_number ILIKE $3)`
      : '';
    const params = search
      ? [Math.min(parseInt(limit) || 50, 200), Math.max(parseInt(offset) || 0, 0), `%${search}%`]
      : [Math.min(parseInt(limit) || 50, 200), Math.max(parseInt(offset) || 0, 0)];
    const result = await pool.query(
      `SELECT id, name, email, phone_number, role, loyalty_points, created_at
       FROM users
       WHERE role != 'admin' ${searchClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  getProfile, updateProfile, changePassword, deleteAccount,
  getMyOrders, getLoyalty,
  getAddresses, addAddress, setDefaultAddress, deleteAddress,
  createUser, getUsers,
  registerDeviceToken,
};
