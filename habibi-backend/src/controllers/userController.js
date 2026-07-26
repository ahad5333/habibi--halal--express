const safeError = require('../utils/safeError');
const pool   = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { revokeToken } = require('../middleware/authMiddleware');


// ─── GET /api/users/me ───────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone_number, role, loyalty_points, avatar_url, date_of_birth, dietary_prefs, receive_sms_updates, created_at FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "User not found." });
    const user = result.rows[0];

    // Email opt-out lives in newsletter_subscribers (email-keyed, shared with
    // guest checkout and the broadcast sender's CAN-SPAM unsubscribe link) --
    // no row yet means never explicitly unsubscribed, so default to true.
    let receive_email_updates = true;
    if (user.email) {
      const sub = await pool.query(
        `SELECT is_subscribed FROM newsletter_subscribers WHERE email = $1`,
        [user.email]
      );
      if (sub.rows[0]) receive_email_updates = sub.rows[0].is_subscribed !== false;
    }

    res.json({ ...user, receive_email_updates });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── PUT /api/users/me ───────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone_number, avatar_url, date_of_birth, dietary_prefs } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      if (name.trim().length > 100) return res.status(400).json({ message: 'Name cannot exceed 100 characters.' });
    }
    if (phone_number !== undefined && phone_number) {
      if (!/^\+?[\d\s\-().]{7,20}$/.test(phone_number)) return res.status(400).json({ message: 'Invalid phone number format.' });
    }
    if (avatar_url !== undefined && avatar_url) {
      if (!/^https?:\/\//i.test(avatar_url) && !avatar_url.startsWith('/')) {
        return res.status(400).json({ message: 'Avatar URL must be a valid http/https URL or server path.' });
      }
      if (avatar_url.length > 500) return res.status(400).json({ message: 'Avatar URL is too long.' });
    }

    const dietaryValue = dietary_prefs !== undefined ? JSON.stringify(dietary_prefs) : null;
    const result = await pool.query(
      `UPDATE users
          SET name=$1,
              phone_number=$2,
              avatar_url=COALESCE($3, avatar_url),
              date_of_birth=COALESCE($5::date, date_of_birth),
              dietary_prefs=COALESCE($6::jsonb, dietary_prefs),
              updated_at=NOW()
        WHERE id=$4
        RETURNING id, name, email, phone_number, role, loyalty_points, avatar_url, date_of_birth, dietary_prefs`,
      [name?.trim() || null, phone_number || null, avatar_url || null, req.user.id, date_of_birth || null, dietaryValue]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── PUT /api/users/me/notification-prefs ────────────────────────────────────
const updateNotificationPrefs = async (req, res) => {
  try {
    const { receive_sms_updates, receive_email_updates } = req.body;

    if (receive_sms_updates !== undefined) {
      await pool.query(
        `UPDATE users SET receive_sms_updates=$1, updated_at=NOW() WHERE id=$2`,
        [!!receive_sms_updates, req.user.id]
      );
    }

    if (receive_email_updates !== undefined) {
      const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [req.user.id]);
      const email = userRes.rows[0]?.email;
      if (email) {
        // Same table the broadcast sender's unsubscribe link writes to --
        // flipping it here keeps a single source of truth for email opt-out
        // rather than a second users-table column that could drift out of sync.
        await pool.query(
          `INSERT INTO newsletter_subscribers (email, is_subscribed, unsubscribe_token)
           VALUES ($1, $2, replace(gen_random_uuid()::text,'-',''))
           ON CONFLICT (email) DO UPDATE SET is_subscribed=$2`,
          [email, !!receive_email_updates]
        );
      }
    }

    res.json({
      receive_sms_updates: receive_sms_updates !== undefined ? !!receive_sms_updates : undefined,
      receive_email_updates: receive_email_updates !== undefined ? !!receive_email_updates : undefined,
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ─── POST /api/users/me/avatar ───────────────────────────────────────────────
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided.' });
    const avatarUrl = req.file.path?.startsWith('http') ? req.file.path : `/uploads/avatars/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE users SET avatar_url=$1, updated_at=NOW() WHERE id=$2 RETURNING avatar_url`,
      [avatarUrl, req.user.id]
    );
    res.json({ avatar_url: result.rows[0].avatar_url });
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
    // Revoke the current JWT and clear the session cookie
    revokeToken(req.user.jti, req.user.exp);
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    res.json({ message: "Password updated successfully. Please log in again." });
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
    // Revoke the current JWT and clear the session cookie
    revokeToken(req.user.jti, req.user.exp);
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', path: '/' });
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

    // Only match by user_id — orders placed while logged in.
    // Email/phone matching was removed to prevent showing another person's
    // guest orders when they happen to share the same contact details.
    const result = await pool.query(
      `SELECT order_number, customer_name, delivery_method,
              order_status, payment_status, total, sub_total, tax, service_fee,
              delivery_fee, tip, discount, coupon_code, payment_method,
              delivery_address, delivery_city, delivery_state, delivery_zip,
              placed_at, items
         FROM guest_orders
        WHERE user_id = $1
        ORDER BY placed_at DESC`,
      [req.user.id]
    );

    // Enrich items with menu names so the mobile reorder feature works
    const allMenuItemIds = new Set();
    const rawOrders = result.rows.map(o => {
      let items = [];
      try { items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []); } catch (_) {}
      items.forEach(it => { const id = parseInt(it.menu_item_id || it.id || it.menu_id); if (!isNaN(id)) allMenuItemIds.add(id); });
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
        name: nameMap[it.menu_item_id || it.id || it.menu_id]?.name || it.name || 'Item',
        image_url: nameMap[it.menu_item_id || it.id || it.menu_id]?.image_url || null,
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE addresses SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
    const result = await client.query(
      "UPDATE addresses SET is_default=TRUE WHERE id=$1 AND user_id=$2 RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Address not found." });
    }
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json(safeError(err));
  } finally {
    client.release();
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
      { name: 'Bronze',   min: 0,    max: 999,  next: 1000, color: '#CD7F32', multiplier: 1.0 },
      { name: 'Silver',   min: 1000, max: 2499, next: 2500, color: '#A8A9AD', multiplier: 1.25 },
      { name: 'Gold',     min: 2500, max: 4999, next: 5000, color: '#F2C94C', multiplier: 1.5 },
      { name: 'Platinum', min: 5000, max: Infinity, next: null, color: '#B9F2FF', multiplier: 2.0 },
    ];
    const tier = tiers.find(t => pts >= t.min && pts <= t.max) || tiers[0];
    const tierIdx = tiers.findIndex(t => t.name === tier.name);
    const nextTierName = tierIdx < tiers.length - 1 ? tiers[tierIdx + 1].name : null;

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
      tier_multiplier: tier.multiplier,
      next_tier: tier.next,
      next_tier_name: nextTierName,
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

// Cancel own pending order
const cancelMyOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user.id;

    // Only allow cancellation of orders owned by this user that are still pending
    const result = await pool.query(
      `UPDATE guest_orders
          SET order_status = 'cancelled', updated_at = NOW()
        WHERE order_number = $1
          AND order_status = 'pending'
          AND (user_id = $2 OR customer_email = (SELECT email FROM users WHERE id = $2))
        RETURNING order_number, order_status`,
      [orderNumber, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Order not found, already processed, or cannot be cancelled.' });
    }

    res.json({ ok: true, order_number: result.rows[0].order_number });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  getProfile, updateProfile, uploadAvatar, updateNotificationPrefs, changePassword, deleteAccount,
  getMyOrders, getLoyalty, cancelMyOrder,
  getAddresses, addAddress, setDefaultAddress, deleteAddress,
  createUser, getUsers,
  registerDeviceToken,
};
