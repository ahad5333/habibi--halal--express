const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { sendOrderUpdate } = require("../services/smsService");
const emailService = require("../services/emailService");
const fcmService = require("../services/fcmService");
const { logAudit } = require('./auditController');

// 1. Dashboard Analytics
const getDashboardStats = async (req, res) => {
  try {
    const revenueRes = await pool.query(
      "SELECT COALESCE(SUM(total), 0) as total FROM guest_orders WHERE order_status IN ('delivered', 'completed')"
    );
    const ordersRes = await pool.query("SELECT COUNT(*) as total FROM guest_orders");
    const pendingRes = await pool.query(
      "SELECT COUNT(*) as total FROM guest_orders WHERE order_status NOT IN ('delivered', 'completed', 'cancelled')"
    );
    const menuRes = await pool.query("SELECT COUNT(*) as total FROM menus WHERE is_active IS NOT FALSE");

    res.json({
      revenue: parseFloat(revenueRes.rows[0].total || 0).toFixed(2),
      orders: parseInt(ordersRes.rows[0].total || 0),
      pending: parseInt(pendingRes.rows[0].total || 0),
      menus: parseInt(menuRes.rows[0].total || 0)
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 2. Global Order Feed
const getAllOrders = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const result = await pool.query(
      "SELECT * FROM guest_orders ORDER BY placed_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const mapped = result.rows.map(o => {
      let items = [];
      try {
        const raw = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        items = raw.map(i => ({
          name: i.name || 'Item',
          quantity: i.quantity || 1,
          price: parseFloat(i.price) || 0,
          choices: i.selectedOption ? [i.selectedOption] : [],
          addons: (i.selectedAddons || []).map(a => (typeof a === 'string' ? a : (a.name || '')))
        }));
      } catch (e) { items = []; }

      return {
        id: o.order_number || String(o.id),
        created_at: o.placed_at,
        user_name: o.customer_name || 'Guest',
        user_phone: o.customer_phone || '',
        user_email: o.customer_email || '',
        user_address: [o.delivery_address, o.delivery_city, o.delivery_state].filter(Boolean).join(', '),
        location_name: [o.delivery_city, o.delivery_state].filter(Boolean).join(', ') || 'Habibi HQ',
        delivery_method: (o.delivery_method || 'delivery').toLowerCase() === 'pickup' ? 'Pickup' : 'Delivery',
        partner: 'Website',
        items,
        subtotal: parseFloat(o.sub_total) || 0,
        total_amount: parseFloat(o.total) || 0,
        payment_method: o.payment_method || 'Card',
        payment_status: o.payment_method ? 'Paid' : 'Pending',
        status: o.order_status || 'pending',
        driver_instructions: o.delivery_instructions || '',
        notes: '',
        cancellation_reason: '',
        timeline: { received: o.placed_at, accepted: null, prepared: null, picked_up: null, delivered: null }
      };
    });

    res.json(mapped);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 3. Admin Menu Management
const getAllMenus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, price, partner_price,
             image_url, category, sort_order, notes,
             is_active, is_available,
             choices, addons, dietary_info
      FROM menus
      ORDER BY category, sort_order, id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};


const ALLOWED_ORDER_STATUSES = new Set([
  'pending', 'accepted', 'preparing', 'cooking',
  'ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed',
]);

// 4. Update Order Status (Admin Override)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellation_reason } = req.body;

    if (!status || !ALLOWED_ORDER_STATUSES.has(String(status).toLowerCase())) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    const io = req.app.get("io");

    const updated = await pool.query(
      `UPDATE guest_orders
       SET order_status=$1, updated_at=NOW(),
           cancellation_reason = CASE WHEN $1='cancelled' THEN $3 ELSE cancellation_reason END
       WHERE order_number=$2 OR CAST(id AS TEXT)=$2
       RETURNING customer_phone, customer_email, order_number`,
      [status.toLowerCase(), id, cancellation_reason || null]
    );

    if (io) {
      io.to(`order_${id}`).emit("order_status_updated", { order_id: id, status: status.toLowerCase() });

      // Re-rank all still-active orders and push each their new queue position
      try {
        const activeStatuses = ['pending', 'accepted', 'preparing'];
        const activeOrders = await pool.query(
          `SELECT order_number FROM guest_orders
           WHERE order_status = ANY($1)
           ORDER BY placed_at ASC`,
          [activeStatuses]
        );
        activeOrders.rows.forEach((ord, idx) => {
          io.to(`order_${ord.order_number}`).emit("queue_update", { position: idx });
        });
      } catch (_) {}
    }

    const row = updated.rows[0];
    if (row) {
      const { customer_phone, customer_email, order_number } = row;
      const orderNum = order_number || id;

      // Fire SMS notification if customer has a phone number
      if (customer_phone) {
        sendOrderUpdate(customer_phone, orderNum, status).catch(err => {
          console.error('[Admin Override] Failed to send SMS update:', err.message);
        });
      }

      // Fire Email notification if customer has an email
      if (customer_email) {
        emailService.sendOrderStatusUpdate(customer_email, orderNum, status).catch(err => {
          console.error('[Admin Override] Failed to send Email update:', err.message);
        });
      }

      // Fire FCM push + in-app notification if user exists
      if (customer_email) {
        pool.query("SELECT id FROM users WHERE email = $1", [customer_email]).then(userRes => {
          if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;

            fcmService.sendOrderPushNotification(userId, orderNum, status).catch(err => {
              console.error('[Admin Override] Failed to send push notification:', err.message);
            });

            const STATUS_BODY = {
              received:         'Your order has been received and is being reviewed.',
              pending:          'Your order is awaiting confirmation.',
              accepted:         'Great news — the kitchen has accepted your order!',
              preparing:        'The kitchen is now preparing your food.',
              cooking:          'Your food is being cooked to perfection.',
              ready:            'Your order is ready! Pickup or on its way.',
              picked_up:        'A driver has picked up your order.',
              out_for_delivery: 'Your order is out for delivery. Hang tight!',
              delivered:        'Your order has been delivered. Enjoy your meal! 🍽️',
              cancelled:        'Your order has been cancelled. Contact us if you need help.',
            };
            const body = STATUS_BODY[status.toLowerCase()] || `Your order status is now: ${status}.`;
            pool.query(
              `INSERT INTO user_notifications (user_id, title, body) VALUES ($1, $2, $3)`,
              [userId, `Order Update — #${orderNum}`, body]
            ).catch(err => console.error('[Admin Override] Notification insert failed:', err.message));
          }
        }).catch(err => console.error('[Admin Override] FCM lookup error:', err.message));
      }
    }

    logAudit(pool, req.user?.id, req.user?.name, 'update_order_status', 'order', String(id), { status }, req.ip);
    res.json({ message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 5. Dynamic Sidebar Items
const getSidebarItems = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM admin_sidebar WHERE is_active = TRUE ORDER BY sort_order ASC"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 6. User Management
const getAllCustomers = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number  AS phone,
        u.role,
        u.loyalty_points,
        u.created_at,
        COUNT(o.id)::int                         AS total_orders,
        COALESCE(SUM(o.total), 0)::numeric       AS total_spent
      FROM users u
      LEFT JOIN guest_orders o ON o.customer_email = u.email
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await pool.query(`
      SELECT id, name, email, phone_number AS phone, role, loyalty_points, created_at
      FROM users
      WHERE id = $1
    `, [id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = userRes.rows[0];

    // Order history from guest_orders matched by email
    const ordersRes = await pool.query(`
      SELECT order_number, delivery_method, payment_method, total, order_status, placed_at
      FROM guest_orders
      WHERE customer_email = $1
      ORDER BY placed_at DESC
      LIMIT 50
    `, [customer.email]);

    res.json({
      ...customer,
      orders: ordersRes.rows,
      payment_methods: [],
      addresses: [],
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 7. Logistics & Delivery Tiers
const getDeliveryTiers = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM delivery_tiers ORDER BY min_distance ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateDeliveryTier = async (req, res) => {
  try {
    const { id } = req.params;
    const { min_distance, max_distance, provider_type, is_active } = req.body;
    const result = await pool.query(
      "UPDATE delivery_tiers SET min_distance = $1, max_distance = $2, provider_type = $3, is_active = $4 WHERE id = $5 RETURNING *",
      [min_distance, max_distance, provider_type, is_active, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateOrderProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { provider_type } = req.body;
    await pool.query("UPDATE orders SET delivery_partner = $1 WHERE id = $2", [provider_type, id]);
    res.json({ message: "Delivery provider updated successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// ── Location Management ──────────────────────────────────────────
const getAdminLocations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, brief_address, exact_address, phone_number,
              working_days_hours, holidays, is_active, accepting_orders,
              delivery_radius_miles, delivery_cost, latitude, longitude,
              preference_level, image_url, tablet_username, delivery_addresses
       FROM locations ORDER BY preference_level DESC, id`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateAdminLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, phone_number, working_days_hours, is_active, accepting_orders,
      delivery_radius_miles, delivery_cost,
      holidays, preference_level, image_url,
      tablet_username, tablet_password, delivery_addresses,
    } = req.body;

    // Only hash tablet password if a new one was provided
    let tabletPasswordHash;
    if (tablet_password) {
      const bcrypt = require('bcrypt');
      tabletPasswordHash = await bcrypt.hash(tablet_password, 10);
    }

    const addrJson = Array.isArray(delivery_addresses)
      ? JSON.stringify(delivery_addresses.slice(0, 30))
      : null;

    const result = await pool.query(
      `UPDATE locations
       SET title=$1, phone_number=$2, working_days_hours=$3,
           is_active=$4, accepting_orders=$5,
           delivery_radius_miles=$6, delivery_cost=$7,
           holidays=$8, preference_level=$9, image_url=$10,
           tablet_username=$11,
           tablet_password_hash = COALESCE($12, tablet_password_hash),
           delivery_addresses = COALESCE($14::jsonb, delivery_addresses),
           updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        title, phone_number, working_days_hours,
        is_active !== false, accepting_orders !== false,
        delivery_radius_miles || 5, delivery_cost || 0,
        holidays || null,
        preference_level ? parseInt(preference_level) : 1,
        image_url || null,
        tablet_username || null,
        tabletPasswordHash || null,
        id,
        addrJson,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Location not found' });
    const row = { ...result.rows[0] };
    delete row.tablet_password_hash; // never expose hash to frontend
    res.json(row);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const toggleLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // 'is_active' or 'accepting_orders'
    const sqlMap = {
      is_active:        'UPDATE locations SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 RETURNING id, title, is_active, accepting_orders',
      accepting_orders: 'UPDATE locations SET accepting_orders = NOT accepting_orders, updated_at=NOW() WHERE id=$1 RETURNING id, title, is_active, accepting_orders',
    };
    if (!sqlMap[field]) return res.status(400).json({ error: 'Invalid field' });
    const result = await pool.query(sqlMap[field], [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Per-Location Menu Availability ───────────────────────────────
const getLocationMenuAvailability = async (req, res) => {
  try {
    const { location_id } = req.query;
    if (!location_id) return res.status(400).json({ error: 'location_id required' });
    const result = await pool.query(
      `SELECT menu_id, status FROM menu_location_availability WHERE location_id=$1`,
      [location_id]
    );
    const map = {};
    result.rows.forEach(r => { map[r.menu_id] = r.status; });
    res.json(map);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const setLocationMenuAvailability = async (req, res) => {
  try {
    const { menu_id, location_id, status } = req.body;
    if (!menu_id || !location_id || !status) return res.status(400).json({ error: 'menu_id, location_id, status required' });
    const allowed = ['available', 'sold_out', 'inactive'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await pool.query(
      `INSERT INTO menu_location_availability (menu_id, location_id, status, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (menu_id, location_id) DO UPDATE SET status=$3, updated_at=NOW()`,
      [menu_id, location_id, status]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'set_location_menu_availability', 'menu', String(menu_id), { location_id, status }, req.ip);
    res.json({ menu_id, location_id, status });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Menu Availability Toggle ─────────────────────────────────────
const toggleMenuAvailability = async (req, res) => {
  try {
    const { ids, is_available, category } = req.body;
    let result;
    if (category) {
      result = await pool.query(
        `UPDATE menus SET is_available=$1 WHERE LOWER(category)=LOWER($2) RETURNING id`,
        [is_available !== false, category]
      );
    } else if (ids && ids.length) {
      result = await pool.query(
        `UPDATE menus SET is_available=$1 WHERE id = ANY($2::int[]) RETURNING id`,
        [is_available !== false, ids]
      );
    } else {
      return res.status(400).json({ error: 'Provide ids or category' });
    }
    res.json({ updated: result.rowCount });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Coupon Usage Stats ───────────────────────────────────────────
const getCouponStats = async (req, res) => {
  try {
    const [coupons, usage] = await Promise.all([
      pool.query(`SELECT * FROM coupons ORDER BY created_at DESC`),
      pool.query(
        `SELECT coupon_code, COUNT(*)::int AS uses,
                COALESCE(SUM(discount),0)::numeric AS total_saved
         FROM guest_orders
         WHERE coupon_code IS NOT NULL AND coupon_code != ''
         GROUP BY coupon_code`
      ),
    ]);
    const usageMap = {};
    for (const row of usage.rows) usageMap[row.coupon_code] = row;
    const enriched = coupons.rows.map(c => ({
      ...c,
      actual_uses: usageMap[c.code]?.uses || 0,
      total_saved: usageMap[c.code]?.total_saved || 0,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Chat Inbox ────────────────────────────────────────────────────────────────
const getChatConversations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        cm.order_number,
        go.customer_name,
        go.customer_email,
        go.customer_phone,
        go.order_status,
        go.placed_at,
        MAX(cm.created_at)                                              AS last_message_at,
        COUNT(*)::int                                                   AS message_count,
        COUNT(*) FILTER (WHERE cm.is_read_by_admin = FALSE AND cm.sender = 'customer')::int AS unread_count,
        (SELECT text    FROM chat_messages WHERE order_number = cm.order_number ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT sender  FROM chat_messages WHERE order_number = cm.order_number ORDER BY created_at DESC LIMIT 1) AS last_sender
      FROM chat_messages cm
      LEFT JOIN guest_orders go ON go.order_number = cm.order_number
      GROUP BY cm.order_number, go.customer_name, go.customer_email, go.customer_phone, go.order_status, go.placed_at
      ORDER BY last_message_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const getChatMessages = async (req, res) => {
  const { order_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE order_number = $1 ORDER BY created_at ASC`,
      [order_number]
    );
    // Mark customer messages as read
    await pool.query(
      `UPDATE chat_messages SET is_read_by_admin = TRUE WHERE order_number = $1 AND sender = 'customer'`,
      [order_number]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const sendAdminChatMessage = async (req, res) => {
  const { order_number } = req.params;
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.length > 2000) {
    return res.status(400).json({ message: 'text is required (max 2000 chars)' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (order_number, sender, text, is_read_by_admin) VALUES ($1, 'admin', $2, TRUE) RETURNING *`,
      [order_number, text.trim()]
    );
    const message = result.rows[0];
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order_number}`).emit('receive_message', {
        order_id: order_number,
        sender: 'admin',
        text: message.text,
        timestamp: message.created_at,
      });
    }
    res.status(201).json(message);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// ── Loyalty Management ────────────────────────────────────────────────────────
const getLoyaltyStats = async (req, res) => {
  try {
    const [members, redeemed, config] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE loyalty_points > 0)::int        AS active_members,
          COALESCE(SUM(loyalty_points), 0)::int                  AS total_outstanding_pts,
          COUNT(*)::int                                          AS total_users
        FROM users WHERE is_active = TRUE
      `),
      pool.query(`
        SELECT COALESCE(SUM(loyalty_points_redeemed), 0)::int AS total_redeemed_pts
        FROM guest_orders
      `),
      pool.query(`SELECT earn_rate, redeem_rate FROM loyalty_config WHERE id = 1`),
    ]);
    const cfg = config.rows[0] || { earn_rate: 10, redeem_rate: 100 };
    const outstanding = members.rows[0].total_outstanding_pts || 0;
    res.json({
      ...members.rows[0],
      total_redeemed_pts: redeemed.rows[0].total_redeemed_pts,
      outstanding_value: (outstanding / parseFloat(cfg.redeem_rate)).toFixed(2),
      earn_rate:  cfg.earn_rate,
      redeem_rate: cfg.redeem_rate,
    });
  } catch (err) { res.status(500).json(safeError(err)); }
};

const getLoyaltyCustomers = async (req, res) => {
  const search = req.query.search || '';
  const limit  = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone_number, loyalty_points,
             (SELECT COUNT(*)::int FROM guest_orders WHERE user_id = users.id) AS order_count,
             (SELECT COALESCE(SUM(total), 0)::numeric FROM guest_orders WHERE user_id = users.id) AS total_spent
      FROM users
      WHERE is_active = TRUE
        AND ($1 = '' OR name ILIKE $2 OR email ILIKE $2)
      ORDER BY loyalty_points DESC
      LIMIT $3 OFFSET $4
    `, [search, `%${search}%`, limit, offset]);
    res.json(result.rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const adjustLoyaltyPoints = async (req, res) => {
  const { user_id, points, reason } = req.body;
  if (!user_id || points === undefined) return res.status(400).json({ message: 'user_id and points required' });
  const delta = parseInt(points);
  if (isNaN(delta)) return res.status(400).json({ message: 'points must be a number' });
  try {
    const result = await pool.query(
      `UPDATE users SET loyalty_points = GREATEST(0, loyalty_points + $1) WHERE id = $2 RETURNING id, name, email, loyalty_points`,
      [delta, user_id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'User not found' });
    await logAudit(req.user?.id, 'adjust_loyalty', 'user', user_id, { delta, reason });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const getLoyaltyConfig = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM loyalty_config WHERE id = 1`);
    res.json(result.rows[0] || { earn_rate: 10, redeem_rate: 100 });
  } catch (err) { res.status(500).json(safeError(err)); }
};

const updateLoyaltyConfig = async (req, res) => {
  const { earn_rate, redeem_rate } = req.body;
  if (!earn_rate || !redeem_rate) return res.status(400).json({ message: 'earn_rate and redeem_rate required' });
  try {
    const result = await pool.query(
      `UPDATE loyalty_config SET earn_rate = $1, redeem_rate = $2, updated_at = NOW() WHERE id = 1 RETURNING *`,
      [parseFloat(earn_rate), parseFloat(redeem_rate)]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(safeError(err)); }
};

module.exports = {
  getDashboardStats,
  getAllOrders,
  getAllMenus,
  updateOrderStatus,
  getSidebarItems,
  getAllCustomers,
  getCustomerDetails,
  getDeliveryTiers,
  updateDeliveryTier,
  updateOrderProvider,
  getAdminLocations,
  updateAdminLocation,
  toggleLocation,
  toggleMenuAvailability,
  getLocationMenuAvailability,
  setLocationMenuAvailability,
  getCouponStats,
  getChatConversations,
  getChatMessages,
  sendAdminChatMessage,
  getLoyaltyStats,
  getLoyaltyCustomers,
  adjustLoyaltyPoints,
  getLoyaltyConfig,
  updateLoyaltyConfig,
};
