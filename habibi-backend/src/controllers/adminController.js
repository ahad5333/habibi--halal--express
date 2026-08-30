const safeError = require('../utils/safeError');
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendOrderUpdate } = require("../services/smsService");
const emailService = require("../services/emailService");
const fcmService = require("../services/fcmService");
const { logAudit } = require('./auditController');

// 1. Dashboard Analytics
const getDashboardStats = async (req, res) => {
  try {
    const [revenueRes, ordersRes, pendingRes, menuRes, todayRevRes, todayOrdRes] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total), 0) as total FROM guest_orders WHERE order_status IN ('delivered', 'completed')"),
      pool.query("SELECT COUNT(*) as total FROM guest_orders"),
      pool.query("SELECT COUNT(*) as total FROM guest_orders WHERE order_status NOT IN ('delivered', 'completed', 'cancelled')"),
      pool.query("SELECT COUNT(*) as total FROM menus WHERE is_active IS NOT FALSE"),
      pool.query("SELECT COALESCE(SUM(total), 0) as total FROM guest_orders WHERE order_status IN ('delivered', 'completed') AND placed_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) as total FROM guest_orders WHERE placed_at >= CURRENT_DATE"),
    ]);

    res.json({
      revenue:        parseFloat(revenueRes.rows[0].total  || 0).toFixed(2),
      orders:         parseInt(ordersRes.rows[0].total     || 0),
      pending:        parseInt(pendingRes.rows[0].total    || 0),
      menus:          parseInt(menuRes.rows[0].total       || 0),
      today_revenue:  parseFloat(todayRevRes.rows[0].total || 0).toFixed(2),
      today_orders:   parseInt(todayOrdRes.rows[0].total   || 0),
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
        items = raw.map(i => {
          // selectedAddons/selectedChoices come from the real checkout flow as
          // plain objects (e.g. {"123": 1}, keyed by option id), not arrays —
          // .map()-ing them directly threw and silently dropped every item on
          // the order (caught below), which is why real orders were showing
          // "0 items" in the admin table despite having a normal total. Names
          // for those option ids aren't in this payload, but `note` already
          // carries a human-readable summary (e.g. "Choose Your Bread: Burger
          // Bun") built at checkout, so prefer that over trying to relabel ids.
          const addonList = Array.isArray(i.selectedAddons)
            ? i.selectedAddons.map(a => (typeof a === 'string' ? a : (a.name || '')))
            : [];
          const choiceList = Array.isArray(i.choices)
            ? i.choices
            : (i.selectedOption ? [i.selectedOption] : []);
          return {
            name: i.name || 'Item',
            quantity: i.quantity || i.qty || 1,
            price: parseFloat(i.price ?? i.unit_price) || 0,
            note: i.note || '',
            choices: choiceList,
            addons: addonList,
          };
        });
      } catch (e) {
        console.error('[Admin] Failed to parse order items for', o.order_number, e.message);
        items = [];
      }

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
        payment_status: (o.payment_status || 'unpaid') === 'paid' ? 'Paid'
                       : (o.payment_status === 'refunded' ? 'Refunded' : 'Pending'),
        payment_reference: o.payment_reference || null,
        status: o.order_status || 'pending',
        driver_instructions: o.delivery_instructions || '',
        notes: '',
        cancellation_reason: o.cancellation_reason || '',
        is_gift: o.is_gift || false,
        gift_recipient_name:  o.gift_recipient_name  || null,
        gift_recipient_phone: o.gift_recipient_phone || null,
        gift_message:         o.gift_message         || null,
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
             image_url, category,
             COALESCE(categories, ARRAY[]::TEXT[]) AS categories,
             sort_order, notes,
             is_active, is_available, is_featured,
             is_spicy, is_vegetarian, is_gluten_free,
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
    const { status, cancellation_reason, estimated_minutes } = req.body;

    if (!status || !ALLOWED_ORDER_STATUSES.has(String(status).toLowerCase())) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    const io = req.app.get("io");
    const parsedMinutes = estimated_minutes != null ? parseInt(estimated_minutes, 10) : null;

    const updated = await pool.query(
      `WITH prev AS (
         SELECT order_status FROM guest_orders WHERE order_number = $2 OR CAST(id AS TEXT) = $2
       )
       UPDATE guest_orders
       SET order_status        = $1::varchar,
           updated_at          = NOW(),
           cancellation_reason = CASE WHEN $1::varchar = 'cancelled' THEN $3::text ELSE cancellation_reason END,
           estimated_minutes   = CASE WHEN $4::integer IS NOT NULL   THEN $4::integer ELSE estimated_minutes END
       WHERE order_number = $2 OR CAST(id AS TEXT) = $2
       RETURNING customer_phone, customer_email, order_number, user_id, total,
                 (SELECT order_status FROM prev) AS previous_status`,
      [status.toLowerCase(), id, cancellation_reason || null, parsedMinutes]
    );

    const orderNumber = updated.rows[0]?.order_number;
    if (io) {
      const payload = { order_id: id, order_number: orderNumber, status: status.toLowerCase() };
      // Emit to the order_number room (used by the customer tracking page)
      if (orderNumber) io.to(`order_${orderNumber}`).emit("order_status_updated", payload);
      // Also emit to the integer-id room for any legacy listeners
      if (String(id) !== orderNumber) io.to(`order_${id}`).emit("order_status_updated", payload);
      try {
        const activeOrders = await pool.query(
          `SELECT order_number FROM guest_orders WHERE order_status = ANY($1) ORDER BY placed_at ASC`,
          [['pending', 'accepted', 'preparing']]
        );
        activeOrders.rows.forEach((ord, i) => {
          io.to(`order_${ord.order_number}`).emit("queue_update", { position: i });
        });
      } catch (_) {}

      // When order is accepted, broadcast to on-duty drivers -- nearest first
      // if any have a fresh location on file, falling back to everyone at
      // once otherwise (see broadcastOrderToNearestDrivers for the staging).
      if (status.toLowerCase() === 'accepted' && orderNumber) {
        void (async () => {
          try {
            const ord = await pool.query(
              `SELECT order_number, customer_name, delivery_address, delivery_city, total, tip, items
                 FROM guest_orders WHERE order_number = $1 LIMIT 1`,
              [orderNumber]
            );
            const o = ord.rows[0];
            if (o) {
              const { broadcastOrderToNearestDrivers } = require('./dispatchController');
              await broadcastOrderToNearestDrivers(io, o);
              console.log(`[Admin] Broadcast order ${orderNumber} to drivers`);
            }
          } catch (err) { console.error('[Admin] Driver broadcast failed:', err.message); }
        })();
      }
    }

    // Respond immediately — notifications fire after
    logAudit(pool, req.user?.id, req.user?.name, 'update_order_status', 'order', String(id), { status }, req.ip);
    res.json({ message: "Status updated successfully" });

    // Fire-and-forget notifications — completely isolated from the response
    const row = updated.rows[0];
    if (!row) return;

    const { customer_phone, customer_email, order_number } = row;
    const orderNum = order_number || id;

    if (customer_phone) {
      void (async () => {
        try { await sendOrderUpdate(customer_phone, orderNum, status); }
        catch (err) { console.error('[Admin] SMS failed:', err.message); }
      })();
    }

    if (customer_email) {
      void (async () => {
        try { await emailService.sendOrderStatusUpdate(customer_email, orderNum, status); }
        catch (err) { console.error('[Admin] Email failed:', err.message); }
      })();
    }

    const STATUS_BODY = {
      received:         'Your order has been received and is being reviewed.',
      pending:          'Your order is awaiting confirmation.',
      accepted:         'Great news — the kitchen has accepted your order!',
      preparing:        'The kitchen is now preparing your food.',
      cooking:          'Your food is being cooked to perfection.',
      ready:            'Your order is ready! Pickup or on its way.',
      picked_up:        'A driver has picked up your order.',
      out_for_delivery: 'Your order is out for delivery. Hang tight!',
      delivered:        'Your order has been delivered. Enjoy your meal!',
      cancelled:        'Your order has been cancelled. Contact us if you need help.',
    };
    const notifBody  = STATUS_BODY[status.toLowerCase()] || `Your order status is now: ${status}.`;
    const notifTitle = `Order Update — #${orderNum}`;

    const sendFCM = async (userId) => {
      try { await fcmService.sendOrderPushNotification(userId, orderNum, status); }
      catch (err) { console.error('[Admin] FCM failed:', err.message); }
      try {
        await pool.query(
          `INSERT INTO user_notifications (user_id, title, body) VALUES ($1, $2, $3)`,
          [userId, notifTitle, notifBody]
        );
      } catch (err) { console.error('[Admin] Notification insert failed:', err.message); }
    };

    const resolvedUserId = row.user_id || null;
    if (resolvedUserId) {
      void sendFCM(resolvedUserId);
    } else if (customer_email) {
      void (async () => {
        try {
          const userRes = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [customer_email]);
          if (userRes.rows.length > 0) await sendFCM(userRes.rows[0].id);
        } catch (err) { console.error('[Admin] FCM lookup failed:', err.message); }
      })();
    }

    // Award loyalty points on delivery (per the admin-configured earn_rate)
    // and complete any pending referral on the referee's first delivered
    // order. This is the real order-status-update path used by both the
    // merchant app and the admin panel — orderController.js has an
    // equivalent block but on a route (PUT /api/orders/admin/:id/status)
    // nothing actually calls, so without this the loyalty-on-delivery bonus
    // and the entire referral program never fire for any real order.
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'delivered' && row.previous_status !== 'delivered' && customer_email && row.total) {
      // Previously hardcoded to 1 pt per $1 regardless of the Loyalty Program
      // admin page's "Configure Rates" setting (earn_rate) — that panel had
      // zero real effect on what customers actually earned.
      pool.query(`SELECT earn_rate FROM loyalty_config WHERE id = 1`).then(cfgRes => {
        const earnRate = parseFloat(cfgRes.rows[0]?.earn_rate) || 1;
        const pts = Math.floor((parseFloat(row.total) || 0) * earnRate);
        if (pts > 0) {
          pool.query(
            `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE LOWER(email) = LOWER($2)`,
            [pts, customer_email]
          ).catch(err => console.error('[Loyalty] Award on delivery failed:', err.message));
        }
      }).catch(err => console.error('[Loyalty] Config lookup failed:', err.message));

      pool.query(
        `SELECT id FROM guest_orders WHERE customer_email = $1 AND order_status = 'delivered'`,
        [customer_email]
      ).then(async (countRes) => {
        if (countRes.rows.length !== 1) return; // not their first delivered order
        const userRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [customer_email]);
        if (!userRes.rows[0]) return;
        const refereeId = userRes.rows[0].id;
        const refRow = await pool.query(
          `SELECT id, referrer_id FROM referrals WHERE referee_user_id = $1 AND status = 'pending' LIMIT 1`,
          [refereeId]
        );
        if (!refRow.rows[0]) return;
        const { id: refId, referrer_id } = refRow.rows[0];
        const REFERRAL_BONUS = 500;
        await pool.query(
          `UPDATE referrals SET status = 'completed', points_awarded = $1, completed_at = NOW() WHERE id = $2`,
          [REFERRAL_BONUS, refId]
        );
        await pool.query(
          `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2`,
          [REFERRAL_BONUS, referrer_id]
        );
        console.log(`[Referral] Awarded ${REFERRAL_BONUS} pts to user ${referrer_id} for referring user ${refereeId}`);
      }).catch(err => console.error('[Referral] Completion check failed:', err.message));
    }
  } catch (error) {
    console.error("[updateOrderStatus ERROR]", error.message, error.stack);
    res.status(500).json(safeError(error));
  }
};

/* ── Admin: mark an order's payment as verified/unverified ──────────────────
   Separate from updateOrderStatus on purpose -- that endpoint fires customer-
   facing SMS/email "your order is now X" notifications on every call, which
   doesn't make sense for a payment-verification toggle staff might flip back
   and forth while double-checking their Zelle/Cash App activity against the
   customer-supplied payment_reference. Only meaningful for Zelle/Cash App --
   card/PayPal are marked 'paid' automatically at order creation, and cash is
   verified in person at handoff, not through this. */
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!['paid', 'unpaid'].includes(payment_status)) {
      return res.status(400).json({ message: 'Invalid payment status.' });
    }

    const updated = await pool.query(
      `UPDATE guest_orders SET payment_status = $1, updated_at = NOW()
       WHERE order_number = $2 OR CAST(id AS TEXT) = $2
       RETURNING id, order_number, payment_status`,
      [payment_status, id]
    );
    if (!updated.rows[0]) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    logAudit(pool, req.user?.id, req.user?.name, 'update_payment_status', 'order', String(id), { payment_status }, req.ip);
    res.json({ success: true, payment_status: updated.rows[0].payment_status });
  } catch (error) {
    console.error("[updatePaymentStatus ERROR]", error.message);
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
const CUSTOMER_ROLES = ['customer', 'business', 'merchant'];
const CUSTOMER_SORT_COLUMNS = { name: 'name', created_at: 'created_at', total_orders: 'total_orders', total_spent: 'total_spent' };

// Unions real accounts (users) with repeat guest-checkout customers who never signed up
// (matched by email, since guest_orders has no user_id for most historical rows) so the
// admin list reflects everyone who has actually ordered, not just people who registered.
function customersBaseCTE() {
  return `
    WITH registered AS (
      SELECT
        u.id::text                          AS id,
        u.name                              AS name,
        u.email                             AS email,
        u.phone_number                      AS phone,
        u.role                              AS role,
        COALESCE(u.loyalty_points, 0)       AS loyalty_points,
        u.created_at                        AS created_at,
        COUNT(o.id)::int                    AS total_orders,
        COALESCE(SUM(o.total) FILTER (WHERE o.order_status IN ('delivered', 'completed')), 0)::numeric AS total_spent,
        MAX(o.placed_at)                    AS last_order_at,
        FALSE                                AS is_guest
      FROM users u
      LEFT JOIN guest_orders o ON o.customer_email = u.email
      GROUP BY u.id
    ),
    guest_only AS (
      SELECT
        'guest:' || o.customer_email        AS id,
        MAX(NULLIF(o.customer_name, ''))    AS name,
        o.customer_email                    AS email,
        MAX(NULLIF(o.customer_phone, ''))   AS phone,
        'guest'                             AS role,
        0                                    AS loyalty_points,
        MIN(o.placed_at)                    AS created_at,
        COUNT(o.id)::int                    AS total_orders,
        COALESCE(SUM(o.total) FILTER (WHERE o.order_status IN ('delivered', 'completed')), 0)::numeric AS total_spent,
        MAX(o.placed_at)                    AS last_order_at,
        TRUE                                 AS is_guest
      FROM guest_orders o
      WHERE o.customer_email IS NOT NULL AND o.customer_email <> ''
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = o.customer_email)
      GROUP BY o.customer_email
    ),
    combined AS (
      SELECT * FROM registered
      UNION ALL
      SELECT * FROM guest_only
    )
  `;
}

function buildCustomersFilter(query) {
  const { search = '', role = '', dateFrom = '', dateTo = '', minSpent = '' } = query;
  const where = [];
  const params = [];

  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where.push(`(LOWER(COALESCE(name,'')) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR COALESCE(phone,'') LIKE $${params.length})`);
  }
  if (role && role !== 'all') {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`created_at >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (minSpent) {
    params.push(parseFloat(minSpent) || 0);
    where.push(`total_spent >= $${params.length}`);
  }

  const sortCol = CUSTOMER_SORT_COLUMNS[query.sort] || 'created_at';
  const dir = query.dir === 'asc' ? 'ASC' : 'DESC';

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    orderSql: `ORDER BY ${sortCol} ${dir} NULLS LAST`,
    params,
  };
}

const getAllCustomers = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { whereSql, orderSql, params } = buildCustomersFilter(req.query);
    const cte = customersBaseCTE();
    const limitParam  = params.length + 1;
    const offsetParam = params.length + 2;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `${cte} SELECT * FROM combined ${whereSql} ${orderSql} LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, limit, offset]
      ),
      pool.query(`${cte} SELECT COUNT(*)::int AS count FROM combined ${whereSql}`, params),
    ]);

    res.json({ customers: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Same filters as getAllCustomers but uncapped (up to a safety ceiling) for CSV export.
const exportCustomers = async (req, res) => {
  try {
    const { whereSql, orderSql, params } = buildCustomersFilter(req.query);
    const cte = customersBaseCTE();
    const result = await pool.query(`${cte} SELECT * FROM combined ${whereSql} ${orderSql} LIMIT 5000`, params);
    res.json({ customers: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Ranks everyone who ordered within a date range (guest or registered) by spend or order
// count — answers "who ordered the most between X and Y", independent of signup date.
const getTopCustomers = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: 'dateFrom and dateTo are required.' });
    }
    const sortCol = req.query.sort === 'orders' ? 'orders_in_range' : 'spent_in_range';
    const limit   = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));

    const result = await pool.query(`
      SELECT
        COALESCE(u.id::text, 'guest:' || o.customer_email)  AS id,
        COALESCE(NULLIF(u.name, ''), MAX(o.customer_name))  AS name,
        o.customer_email                                     AS email,
        COALESCE(u.phone_number, MAX(o.customer_phone))      AS phone,
        COALESCE(u.role, 'guest')                            AS role,
        COUNT(o.id)::int                                     AS orders_in_range,
        COALESCE(SUM(o.total) FILTER (WHERE o.order_status IN ('delivered', 'completed')), 0)::numeric AS spent_in_range
      FROM guest_orders o
      LEFT JOIN users u ON u.email = o.customer_email
      WHERE o.placed_at >= $1::date AND o.placed_at < ($2::date + INTERVAL '1 day')
        AND o.customer_email IS NOT NULL AND o.customer_email <> ''
      GROUP BY u.id, u.name, o.customer_email, u.phone_number, u.role
      ORDER BY ${sortCol} DESC
      LIMIT $3
    `, [dateFrom, dateTo, limit]);

    res.json({ customers: result.rows, dateFrom, dateTo });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('guest:')) {
      const email = id.slice('guest:'.length);
      const ordersRes = await pool.query(`
        SELECT order_number, delivery_method, payment_method, total, order_status, placed_at
        FROM guest_orders WHERE customer_email = $1 ORDER BY placed_at DESC LIMIT 50
      `, [email]);
      if (ordersRes.rows.length === 0) return res.status(404).json({ message: "Customer not found" });
      const infoRes = await pool.query(
        `SELECT customer_name, customer_phone FROM guest_orders WHERE customer_email = $1 AND customer_name <> '' ORDER BY placed_at DESC LIMIT 1`,
        [email]
      );
      return res.json({
        id, email,
        name: infoRes.rows[0]?.customer_name || null,
        phone: infoRes.rows[0]?.customer_phone || null,
        role: 'guest',
        loyalty_points: 0,
        created_at: null,
        orders: ordersRes.rows,
        addresses: [],
        payment_methods: [],
        is_guest: true,
      });
    }

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

    const addressesRes = await pool.query(
      `SELECT id, receiver_name, street_address, second_line, city, state, zip_code, is_default
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
      [customer.id]
    );

    res.json({
      ...customer,
      orders: ordersRes.rows,
      addresses: addressesRes.rows,
      payment_methods: [],
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Generates a 24h set-password link (same reset_token mechanism as "Forgot Password")
// so admin-created/imported accounts can be claimed without anyone knowing a password.
async function sendAccountSetupEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 24 * 3600000);
  await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [tokenHash, expires, user.id]);
  const frontendUrl = process.env.FRONTEND_URL || 'https://habibihe.com';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  return emailService.sendPasswordReset(user.email, resetUrl);
}

const createCustomer = async (req, res) => {
  try {
    const name  = String(req.body.name  || '').trim().slice(0, 255);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 255);
    const phone = String(req.body.phone || '').trim().slice(0, 20);
    let role    = String(req.body.role  || 'customer').trim().toLowerCase();
    if (!CUSTOMER_ROLES.includes(role)) role = 'customer';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'A customer with this email already exists.' });
    }

    const hashed = await bcrypt.hash(crypto.randomUUID(), 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone_number, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, name, email, phone_number AS phone, role, loyalty_points, created_at`,
      [name || null, email, phone || null, hashed, role]
    );
    const user = result.rows[0];
    sendAccountSetupEmail(user).catch(err => console.error('[createCustomer] setup email failed:', err.message));
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const name  = String(req.body.name  || '').trim().slice(0, 255);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 255);
    const phone = String(req.body.phone || '').trim().slice(0, 20);
    let role    = String(req.body.role  || 'customer').trim().toLowerCase();
    if (!CUSTOMER_ROLES.includes(role)) role = 'customer';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const clash = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
    if (clash.rows.length > 0) {
      return res.status(409).json({ message: 'Another customer already uses this email.' });
    }

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, phone_number = $3, role = $4, updated_at = NOW()
       WHERE id = $5 AND role = ANY($6)
       RETURNING id, name, email, phone_number AS phone, role, loyalty_points, created_at`,
      [name || null, email, phone || null, role, id, CUSTOMER_ROLES]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const bulkDeleteCustomers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No customer IDs provided.' });
    }
    const numericIds = ids.map(i => parseInt(i, 10)).filter(Number.isInteger);
    if (numericIds.length === 0) {
      return res.status(400).json({ message: 'No valid customer IDs provided.' });
    }
    // Was a hard DELETE — guest_orders.user_id and reviews.user_id are FK
    // NO ACTION (not CASCADE), so deleting any customer who ever placed an
    // order or left a review while logged in failed outright with a
    // constraint-violation 500, deleting nobody in the batch at all. Worse,
    // customers WITHOUT orders/reviews *would* hard-delete, silently
    // cascading away their saved addresses, payment methods, and even their
    // OWN referral history for people THEY referred (referrals.referrer_id
    // is CASCADE) — unrecoverable, no confirmation. Anonymize instead, same
    // GDPR-style pattern already used by the customer's own self-service
    // "Delete Account" flow (userController.js) — preserves order/review
    // history for accounting, works for every customer regardless of
    // activity, and the account becomes unusable (email replaced with an
    // unguessable placeholder, password replaced with a random hash) even
    // though nothing here actually checks is_active at login time.
    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const result = await pool.query(
      `UPDATE users
          SET is_active = FALSE,
              email = CONCAT('deleted_', id, '@habibi.removed'),
              name = 'Deleted User',
              phone_number = NULL,
              password_hash = $1,
              reset_token = NULL,
              reset_token_expires = NULL,
              updated_at = NOW()
        WHERE id = ANY($2) AND role = ANY($3)
        RETURNING id`,
      [randomHash, numericIds, CUSTOMER_ROLES]
    );
    res.json({ deleted_count: result.rowCount });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Bulk-create customer accounts from an uploaded CSV. Each created row gets a random
// password and a "set your password" email — mirrors the Staff/Driver bulk-import pattern.
const bulkImportCustomers = async (req, res) => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ message: 'No customers provided.' });
  }
  if (customers.length > 500) {
    return res.status(400).json({ message: 'Max 500 customers per import.' });
  }

  const created = [];
  const skipped = [];

  for (const row of customers) {
    const name  = String(row.name  || '').trim().slice(0, 255);
    const email = String(row.email || '').trim().toLowerCase().slice(0, 255);
    const phone = String(row.phone || '').trim().slice(0, 20);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ name, email, phone, reason: 'Missing or invalid email' });
      continue;
    }

    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        skipped.push({ name, email, phone, reason: 'Email already registered' });
        continue;
      }

      const hashed = await bcrypt.hash(crypto.randomUUID(), 12);
      const result = await pool.query(
        `INSERT INTO users (name, email, phone_number, password_hash, role, email_verified)
         VALUES ($1, $2, $3, $4, 'customer', TRUE)
         RETURNING id, name, email, phone_number AS phone, role, created_at`,
        [name || null, email, phone || null, hashed]
      );
      const user = result.rows[0];
      created.push(user);
      sendAccountSetupEmail(user).catch(err => console.error('[bulkImportCustomers] setup email failed for', email, err.message));
    } catch (err) {
      skipped.push({ name, email, phone, reason: err.message });
    }
  }

  res.json({ created_count: created.length, skipped_count: skipped.length, created, skipped });
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
              working_days_hours, holidays, location_note, roadie_pickup_message, is_active, accepting_orders,
              delivery_radius_miles, delivery_cost, latitude, longitude,
              preference_level, image_url, tablet_username, delivery_addresses,
              partner_ubereats, partner_doordash, partner_grubhub, partner_roadie,
              partner_instacart, partner_hhe,
              self_delivery_enabled AS partner_self
       FROM locations ORDER BY preference_level ASC, id`
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
      holidays, location_note, roadie_pickup_message, preference_level, image_url,
      tablet_username, tablet_password, delivery_addresses,
      exact_address, brief_address, latitude, longitude,
      partner_ubereats, partner_doordash, partner_grubhub, partner_roadie,
      partner_instacart, partner_hhe, self_delivery_enabled,
    } = req.body;

    if (brief_address !== undefined && !brief_address?.trim()) {
      return res.status(400).json({ error: 'Brief Address is required.' });
    }

    if (preference_level !== undefined && preference_level !== null && preference_level !== '') {
      const dupe = await pool.query(
        'SELECT id FROM locations WHERE preference_level = $1 AND id != $2',
        [parseInt(preference_level, 10), id]
      );
      if (dupe.rows.length > 0) {
        return res.status(400).json({ error: `Preference Level ${preference_level} is already used by another location.` });
      }
    }

    // Only hash tablet password if a new one was provided
    let tabletPasswordHash;
    if (tablet_password) {
      const bcrypt = require('bcryptjs');
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
           exact_address = COALESCE($15, exact_address),
           brief_address = COALESCE($16, brief_address),
           latitude = COALESCE($17, latitude),
           longitude = COALESCE($18, longitude),
           partner_ubereats = $19, partner_doordash = $20,
           partner_grubhub  = $21, partner_roadie   = $22,
           self_delivery_enabled = $23,
           location_note = $24,
           partner_instacart = $25, partner_hhe = $26,
           roadie_pickup_message = $27,
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
        exact_address || null,
        brief_address || null,
        latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
        longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
        !!partner_ubereats, !!partner_doordash, !!partner_grubhub, !!partner_roadie, !!self_delivery_enabled,
        location_note || null,
        !!partner_instacart, !!partner_hhe,
        roadie_pickup_message || '',
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Location not found' });
    const row = { ...result.rows[0] };
    delete row.tablet_password_hash; // never expose hash to frontend
    row.partner_self = row.self_delivery_enabled;
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

const setBulkLocationMenuAvailability = async (req, res) => {
  try {
    const { location_id, status, menu_ids } = req.body;
    if (!location_id || !status || !Array.isArray(menu_ids) || !menu_ids.length) {
      return res.status(400).json({ error: 'location_id, status, and menu_ids required' });
    }
    const allowed = ['available', 'sold_out', 'inactive'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await pool.query(
      `INSERT INTO menu_location_availability (menu_id, location_id, status, updated_at)
       SELECT unnest($1::int[]), $2, $3, NOW()
       ON CONFLICT (menu_id, location_id) DO UPDATE SET status=$3, updated_at=NOW()`,
      [menu_ids, location_id, status]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'bulk_set_location_menu_availability', 'menu', menu_ids.join(','), { location_id, status, count: menu_ids.length }, req.ip);
    res.json({ updated: menu_ids.length });
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
        `UPDATE menus SET is_available=$1
         WHERE LOWER(category)=LOWER($2)
            OR EXISTS (SELECT 1 FROM unnest(categories) c WHERE LOWER(c)=LOWER($2))
         RETURNING id`,
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
    await logAudit(pool, req.user?.id, req.user?.name || 'admin', 'adjust_loyalty', 'user', String(user_id), { delta, reason }, req.ip);
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
  const earnNum   = parseFloat(earn_rate);
  const redeemNum = parseFloat(redeem_rate);
  // A negative or zero redeem_rate would break the checkout discount check
  // (which divides by it) and a negative earn_rate would deduct points on
  // delivery instead of awarding them.
  if (!earn_rate || !redeem_rate || !(earnNum > 0) || !(redeemNum > 0)) {
    return res.status(400).json({ message: 'earn_rate and redeem_rate are required and must be positive numbers' });
  }
  try {
    const result = await pool.query(
      `UPDATE loyalty_config SET earn_rate = $1, redeem_rate = $2, updated_at = NOW() WHERE id = 1 RETURNING *`,
      [earnNum, redeemNum]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const addItemToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, qty, special_instructions } = req.body;
    if (!name || price == null || !qty) {
      return res.status(400).json({ error: 'name, price, and qty are required' });
    }
    const itemQty   = Math.max(1, parseInt(qty, 10));
    const itemPrice = parseFloat(price);
    const itemTotal = itemQty * itemPrice;
    const newItem   = { name, quantity: itemQty, price: itemPrice, special_instructions: special_instructions || null };
    const result = await pool.query(
      `UPDATE guest_orders
       SET items      = items || jsonb_build_array($1::jsonb),
           sub_total  = COALESCE(sub_total, 0) + $2,
           total      = COALESCE(total, 0) + $2,
           updated_at = NOW()
       WHERE order_number = $3 OR CAST(id AS TEXT) = $3
       RETURNING *`,
      [JSON.stringify(newItem), itemTotal, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// Returns raw DB fields in the format the merchant tablet app expects.
// Separate from getAllOrders which returns admin-panel-shaped data.
const getMerchantOrders = async (req, res) => {
  try {
    const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
    const status = req.query.status || null;
    const date   = req.query.date   || null; // YYYY-MM-DD

    const conditions = [];
    const values     = [limit];
    if (status) { conditions.push(`order_status = $${values.push(status)}`); }
    if (date)   { conditions.push(`placed_at::date = $${values.push(date)}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone, customer_email,
              delivery_method, delivery_address, table_number, payment_method,
              sub_total, tax, service_fee, delivery_fee, tip, discount, total,
              order_status, items, placed_at, updated_at, notes, coupon_code,
              estimated_minutes, cancellation_reason
       FROM guest_orders
       ${where}
       ORDER BY placed_at DESC
       LIMIT $1`,
      values
    );

    const rows = result.rows.map(o => {
      let items = [];
      try {
        const raw = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        items = raw.map(i => ({
          id:                   i.id || undefined,
          name:                 i.name || 'Item',
          quantity:             i.quantity || 1,
          price:                parseFloat(i.price) || 0,
          choices:              i.selectedOption || (Array.isArray(i.choices) ? i.choices.join(', ') : i.choices) || undefined,
          addons:               Array.isArray(i.selectedAddons)
                                  ? i.selectedAddons.map(a => typeof a === 'string' ? a : (a.name || '')).join(', ')
                                  : (i.addons || undefined),
          special_instructions: i.special_instructions || undefined,
        }));
      } catch (_) { items = []; }

      return {
        id:                   o.id,
        order_number:         o.order_number || String(o.id),
        customer_name:        o.customer_name || 'Guest',
        customer_phone:       o.customer_phone || undefined,
        customer_email:       o.customer_email || undefined,
        delivery_method:      (o.delivery_method || 'pickup').toLowerCase(),
        delivery_address:     o.delivery_address || undefined,
        table_number:         o.table_number || undefined,
        payment_method:       o.payment_method || 'unknown',
        sub_total:            parseFloat(o.sub_total) || 0,
        tax:                  parseFloat(o.tax) || 0,
        service_fee:          parseFloat(o.service_fee) || 0,
        delivery_fee:         parseFloat(o.delivery_fee) || 0,
        tip:                  parseFloat(o.tip) || 0,
        discount:             parseFloat(o.discount) || 0,
        total:                parseFloat(o.total) || 0,
        order_status:         o.order_status || 'pending',
        items,
        placed_at:            o.placed_at,
        updated_at:           o.updated_at || undefined,
        notes:                o.notes || undefined,
        coupon_code:          o.coupon_code || undefined,
        estimated_minutes:    o.estimated_minutes || undefined,
        cancellation_reason:  o.cancellation_reason || undefined,
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  getDashboardStats,
  getMerchantOrders,
  getAllOrders,
  getAllMenus,
  updateOrderStatus,
  updatePaymentStatus,
  addItemToOrder,
  getSidebarItems,
  getAllCustomers,
  exportCustomers,
  getTopCustomers,
  getCustomerDetails,
  createCustomer,
  updateCustomer,
  bulkDeleteCustomers,
  bulkImportCustomers,
  getDeliveryTiers,
  updateDeliveryTier,
  updateOrderProvider,
  getAdminLocations,
  updateAdminLocation,
  toggleLocation,
  toggleMenuAvailability,
  getLocationMenuAvailability,
  setLocationMenuAvailability,
  setBulkLocationMenuAvailability,
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
