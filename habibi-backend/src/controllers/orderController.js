const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { ddRequest, isConfigured: ddConfigured } = require("../utils/doordash");
const { roadieRequest, isConfigured: roadieConfigured } = require("../utils/roadie");
const { getDistance } = require("../utils/googleMaps");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const fcmService = require("../services/fcmService");

const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || '204 E Mosholu Pkwy S, Bronx, NY 10458';
const RESTAURANT_NAME    = process.env.RESTAURANT_NAME    || 'Habibi Halal Express';
const RESTAURANT_PHONE   = process.env.RESTAURANT_PHONE   || '+13477033731';

async function autoDispatchDoorDash(order_id, order) {
  if (!ddConfigured()) return;
  if ((order.delivery_method || '').toLowerCase() !== 'delivery') return;
  try {
    const dropoffAddress = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip]
      .filter(Boolean).join(', ');
    const payload = {
      external_delivery_id:  `habibi-${order.order_number}`,
      pickup_address:        RESTAURANT_ADDRESS,
      pickup_business_name:  RESTAURANT_NAME,
      pickup_phone_number:   RESTAURANT_PHONE,
      pickup_instructions:   'Pick up at counter. Ask for the order number.',
      dropoff_address:       dropoffAddress,
      dropoff_business_name: order.customer_name || 'Customer',
      dropoff_phone_number:  order.customer_phone || '',
      dropoff_instructions:  order.delivery_instructions || '',
      order_value:           Math.round(parseFloat(order.total || 0) * 100),
    };
    const ddData = await ddRequest('/drive/v2/deliveries', 'POST', payload);
    await pool.query(
      `INSERT INTO doordash_deliveries
         (order_id, order_number, doordash_delivery_id, tracking_url, status, fee)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (doordash_delivery_id) DO NOTHING`,
      [
        order_id,
        order.order_number,
        ddData.delivery_id || ddData.external_delivery_id,
        ddData.tracking_url || null,
        ddData.delivery_status || 'created',
        ddData.fee ? ddData.fee / 100 : 0,
      ]
    );
  } catch (err) {
    // Non-fatal: log and continue
    console.error('DoorDash auto-dispatch failed:', err.message);
  }
}

async function autoDispatchRoadie(order_id, order) {
  if (!roadieConfigured()) return;
  if ((order.delivery_method || '').toLowerCase() !== 'delivery') return;
  try {
    const dropoffAddress = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip]
      .filter(Boolean).join(', ');

    // Parse address into Roadie's structured format
    const parts = dropoffAddress.split(',').map(s => s.trim());
    const dropoffAddr = {
      street1: parts[0] || dropoffAddress,
      city:    parts[1] || '',
      state:   (parts[2] || '').replace(/\s*\d+/, '').trim(),
      zip:     ((parts[2] || '').match(/\d+/) || [])[0] || (parts[3] || ''),
    };

    const payload = {
      description:      'Halal food delivery',
      size:             'small',
      value:            Math.round(parseFloat(order.total || 0) * 100),
      quantity:         1,
      reference_number: `habibi-${order.order_number}`,
      pickup: {
        name:    RESTAURANT_NAME,
        phone:   RESTAURANT_PHONE,
        address: {
          street1: process.env.RESTAURANT_STREET || '204 E Mosholu Pkwy S',
          city:    process.env.RESTAURANT_CITY   || 'Bronx',
          state:   process.env.RESTAURANT_STATE  || 'NY',
          zip:     process.env.RESTAURANT_ZIP    || '10458',
        },
        notes: `Pick up at counter. Order #${order.order_number}.`,
      },
      delivery: {
        name:    order.customer_name  || 'Customer',
        phone:   order.customer_phone || '',
        address: dropoffAddr,
        notes:   order.delivery_instructions || '',
      },
    };

    const data = await roadieRequest('/shipments', 'POST', payload);
    await pool.query(
      `INSERT INTO roadie_deliveries
         (order_id, order_number, roadie_id, tracking_number, state, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (roadie_id) DO NOTHING`,
      [order_id, order.order_number, data.id, data.tracking_number || data.id, data.state || 'pending', data.price || 0]
    );
  } catch (err) {
    console.error('Roadie auto-dispatch failed:', err.message);
  }
}

/* ── Guest order (no auth) ── */
const createGuestOrder = async (req, res) => {
  try {
    const {
      order_number, customer_name, customer_phone, customer_email,
      delivery_method, delivery_address, delivery_city, delivery_zip,
      delivery_state, delivery_instructions, payment_method,
      sub_total, tax, service_fee, delivery_fee, tip, discount, total,
      coupon_code, expected_time, items,
      table_id,
      table_number: table_number_raw,
      loyalty_points_redeemed: loyalty_points_raw,
    } = req.body;

    const loyalty_points_redeemed = Math.max(0, parseInt(loyalty_points_raw, 10) || 0);

    // Validate items — no negative quantities, no empty array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item.' });
    }
    for (const item of items) {
      const qty = parseInt(item.qty || item.quantity || 0, 10);
      if (qty < 1) return res.status(400).json({ message: 'Item quantities must be at least 1.' });
      const price = parseFloat(item.price || item.unit_price || 0);
      if (price < 0) return res.status(400).json({ message: 'Item prices cannot be negative.' });
    }

    // Server-side total validation
    const clientTotal    = parseFloat(total)        || 0;
    const clientSubtotal = parseFloat(sub_total)    || 0;
    const clientTax      = parseFloat(tax)          || 0;
    const clientSvcFee   = parseFloat(service_fee)  || 0;
    const clientDelFee   = parseFloat(delivery_fee) || 0;
    const clientTip      = parseFloat(tip)          || 0;
    const clientDiscount = parseFloat(discount)     || 0;

    if (clientTotal < 0) {
      return res.status(400).json({ message: 'Order total cannot be negative.' });
    }

    // 1. Total must equal sum of its components (catches $0.01 tricks)
    const expectedTotal = clientSubtotal + clientTax + clientSvcFee + clientDelFee + clientTip - clientDiscount;
    if (Math.abs(expectedTotal - clientTotal) > 0.10) {
      return res.status(400).json({ message: 'Order total does not add up. Please refresh and retry.' });
    }

    // 2. Verify item prices against the database so clients cannot lower individual prices
    if (Array.isArray(items) && items.length > 0) {
      const itemIds = items.map(i => parseInt(i.id || i.menu_id, 10)).filter(Boolean);
      if (itemIds.length > 0) {
        const priceRows = await pool.query(
          `SELECT id, price FROM menus WHERE id = ANY($1) AND is_available = TRUE`,
          [itemIds]
        );
        const priceMap = {};
        priceRows.rows.forEach(r => { priceMap[r.id] = parseFloat(r.price); });

        let recalcSubtotal = 0;
        for (const item of items) {
          const menuId = parseInt(item.id || item.menu_id, 10);
          if (!menuId) continue;
          const dbPrice = priceMap[menuId];
          if (dbPrice === undefined) continue; // item not in DB (addon, custom) — skip
          const qty = parseInt(item.qty || item.quantity || 1, 10);
          recalcSubtotal += dbPrice * qty;
        }

        // Allow $0.50 tolerance for addons/modifiers not individually tracked in menus table
        if (recalcSubtotal > 0 && clientSubtotal < recalcSubtotal - 0.50) {
          return res.status(400).json({ message: 'Item prices have changed. Please refresh your cart.' });
        }
      }
    }

    // Input length caps
    if (delivery_address && delivery_address.length > 300)
      return res.status(400).json({ message: 'Delivery address is too long.' });
    if (delivery_instructions && delivery_instructions.length > 500)
      return res.status(400).json({ message: 'Delivery instructions are too long.' });
    if (customer_name && customer_name.length > 100)
      return res.status(400).json({ message: 'Customer name is too long.' });

    // Accept table_number string directly (from frontend) OR resolve from table_id (from API callers)
    let table_number = table_number_raw || null;
    if (!table_number && table_id) {
      const tableRes = await pool.query(
        'SELECT table_name FROM dine_in_tables WHERE id = $1', [table_id]
      );
      table_number = tableRes.rows[0]?.table_name || null;
    }

    // Loyalty check + INSERT + deduct all in one transaction to prevent race conditions
    const client = await pool.connect();
    let db_id;
    try {
      await client.query('BEGIN');

      if (loyalty_points_redeemed > 0 && customer_email) {
        const userRes = await client.query(
          'SELECT loyalty_points FROM users WHERE email = $1 FOR UPDATE',
          [customer_email]
        );
        const availablePoints = userRes.rows[0]?.loyalty_points || 0;
        if (loyalty_points_redeemed > availablePoints) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Insufficient loyalty points.' });
        }
      }

    // Resolve user_id if the request carries a valid JWT
    let resolved_user_id = req.user?.id || null;
    if (!resolved_user_id && customer_email) {
      const uRes = await client.query(
        'SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [customer_email]
      );
      resolved_user_id = uRes.rows[0]?.id || null;
    }

    const result = await client.query(
      `INSERT INTO guest_orders
        (order_number, customer_name, customer_phone, customer_email,
         delivery_method, delivery_address, delivery_city, delivery_zip,
         delivery_state, delivery_instructions, payment_method,
         sub_total, tax, service_fee, delivery_fee, tip, discount, total,
         coupon_code, expected_time, items, table_number, loyalty_points_redeemed, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        order_number,
        customer_name   || 'Guest',
        customer_phone  || '',
        customer_email  || '',
        (delivery_method || 'delivery').toLowerCase(),
        delivery_address    || '',
        delivery_city       || '',
        delivery_zip        || '',
        delivery_state      || 'NY',
        delivery_instructions || '',
        payment_method || '',
        parseFloat(sub_total)   || 0,
        parseFloat(tax)         || 0,
        parseFloat(service_fee) || 0,
        parseFloat(delivery_fee)|| 0,
        parseFloat(tip)         || 0,
        parseFloat(discount)    || 0,
        parseFloat(total)       || 0,
        coupon_code    || null,
        expected_time  || '',
        JSON.stringify(items || []),
        table_number,
        loyalty_points_redeemed,
        resolved_user_id,
      ]
    );

      db_id = result.rows[0].id;

      // Deduct loyalty points inside the same transaction
      if (loyalty_points_redeemed > 0 && customer_email) {
        await client.query(
          `UPDATE users SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - $1) WHERE email = $2`,
          [loyalty_points_redeemed, customer_email]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Auto-dispatch: calculate distance → look up delivery_tiers table → route to correct provider
    if ((delivery_method || '').toLowerCase() === 'delivery') {
      const dispatchPayload = {
        order_number, customer_name, customer_phone, delivery_method,
        delivery_address, delivery_city, delivery_zip, delivery_state,
        delivery_instructions, total,
      };
      (async () => {
        try {
          const origin      = RESTAURANT_ADDRESS;
          const destination = [delivery_address, delivery_city, delivery_state, delivery_zip]
            .filter(Boolean).join(', ');
          const dist  = await getDistance(origin, destination);
          const miles = dist?.miles ?? 7; // default to DoorDash range if Maps unavailable

          // Load tiers from DB (ordered by min_distance ASC)
          const tiersRes = await pool.query(
            `SELECT provider_type, min_distance, max_distance
               FROM delivery_tiers
              WHERE is_active = TRUE
              ORDER BY min_distance ASC`
          );
          const tiers = tiersRes.rows;

          // Find the matching tier for this distance
          const tier = tiers.find(t =>
            miles >= parseFloat(t.min_distance) && miles < parseFloat(t.max_distance)
          );
          const provider = tier?.provider_type || 'doordash'; // safe fallback

          console.log(`[Dispatch] ${order_number}: ${miles} mi → ${provider}`);

          if (provider === 'in_house') {
            // Create an unassigned delivery_assignment so admin can pick a driver
            await pool.query(
              `INSERT INTO delivery_assignments
                 (order_id, order_number, driver_id, driver_name, status,
                  delivery_address, customer_name, customer_phone)
               VALUES ($1,$2,NULL,'Unassigned','pending',$3,$4,$5)
               ON CONFLICT DO NOTHING`,
              [db_id, order_number,
               [delivery_address, delivery_city, delivery_state, delivery_zip].filter(Boolean).join(', '),
               customer_name || 'Guest', customer_phone || '']
            ).catch(e => console.error('[Dispatch] delivery_assignment insert failed:', e.message));
            const io = req.app.get('io');
            if (io) io.emit('inhouse_dispatch_needed', { order_number, miles, db_id });
          } else if (provider === 'doordash') {
            autoDispatchDoorDash(db_id, dispatchPayload);
          } else if (provider === 'roadie') {
            autoDispatchRoadie(db_id, dispatchPayload);
          } else {
            // pickup_only or unknown — just log
            console.log(`[Dispatch] ${order_number}: ${miles} mi → pickup only (no dispatch)`);
          }
        } catch (err) {
          console.error('[Dispatch] Routing error:', err.message);
          autoDispatchDoorDash(db_id, dispatchPayload); // safe fallback
        }
      })();
    }

    // Trigger Notifications
    if (customer_email) {
      const fullOrderDetails = {
        order_number,
        customer_name: customer_name || 'Guest',
        delivery_method,
        delivery_address: delivery_address || '',
        delivery_city: delivery_city || '',
        delivery_state: delivery_state || 'NY',
        delivery_zip: delivery_zip || '',
        sub_total,
        tax,
        service_fee,
        delivery_fee,
        tip,
        discount,
        total,
        items
      };
      emailService.sendOrderConfirmation(customer_email, fullOrderDetails).catch(err => {
        console.error('Failed to send order confirmation email:', err.message);
      });
    }

    if (customer_phone) {
      const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-tracking/${order_number}`;
      smsService.sendSMS(customer_phone, `Thank you for your order! Order #${order_number} has been received. Total: $${parseFloat(total).toFixed(2)}. Track it here: ${trackingUrl}`).catch(err => {
        console.error('Failed to send order confirmation SMS:', err.message);
      });
    }

    if (customer_email) {
      pool.query("SELECT id, date_of_birth FROM users WHERE email = $1", [customer_email]).then(async userRes => {
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          fcmService.sendPushToUser(userId, 'Order Placed! 🛍️', `Thank you! Order #${order_number} has been placed.`).catch(err => {
            console.error('Failed to send order placement push notification:', err.message);
          });
          pool.query(
            `INSERT INTO user_notifications (user_id, title, body) VALUES ($1, $2, $3)`,
            [userId, 'Order Placed! 🛍️', `Your order #${order_number} has been received and is awaiting confirmation.`]
          ).catch(err => console.error('[Notification] Insert on placement failed:', err.message));

          // Birthday free order check — if today is the user's birthday, log & notify
          const dob = userRes.rows[0].date_of_birth;
          if (dob) {
            const today = new Date();
            const bday  = new Date(dob);
            if (today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()) {
              console.log(`[Birthday] Happy Birthday ${customer_email}! Order #${order_number}`);
              fcmService.sendPushToUser(userId, '🎂 Happy Birthday!',
                `A special birthday treat is being prepared for you — check your email!`
              ).catch(() => {});
              emailService.sendOrderStatusUpdate(customer_email, order_number, 'birthday_treat').catch(() => {});
            }
          }
        }
      }).catch(err => console.error('FCM lookup error during guest checkout:', err.message));
    }

    res.status(201).json({ success: true, db_id });
  } catch (err) {
    console.error("createGuestOrder error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: get all orders ── */
const getAdminOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
              order_status  AS status,
              placed_at     AS created_at
       FROM guest_orders
       ORDER BY placed_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getAdminOrders error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: update order status ── */
const updateGuestOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await pool.query(
      `UPDATE guest_orders SET order_status=$1, updated_at=NOW() WHERE id=$2
       RETURNING customer_phone, customer_email, order_number, total`,
      [status, id]
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`order_${id}`).emit("order_status_updated", { order_id: id, status });
    }

    const row = updated.rows[0];
    if (row) {
      const { customer_phone, customer_email, order_number } = row;

      // 1. Email notification
      if (customer_email) {
        emailService.sendOrderStatusUpdate(customer_email, order_number, status).catch(err => {
          console.error('Failed to send status update email:', err.message);
        });
      }

      // 2. SMS notification
      if (customer_phone) {
        smsService.sendOrderUpdate(customer_phone, order_number, status).catch(err => {
          console.error('Failed to send status update SMS:', err.message);
        });
      }

      // 3. FCM push + in-app notification
      if (customer_email) {
        const userRes = await pool.query("SELECT id FROM users WHERE email = $1", [customer_email]);
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          fcmService.sendOrderPushNotification(userId, order_number, status).catch(err => {
            console.error('Failed to send order status push notification:', err.message);
          });
          const STATUS_BODY = {
            pending:          'Your order is awaiting confirmation.',
            accepted:         'Great news — the kitchen has accepted your order!',
            preparing:        'The kitchen is now preparing your food.',
            cooking:          'Your food is being cooked to perfection.',
            ready:            'Your order is ready! Pickup or on its way.',
            out_for_delivery: 'Your order is out for delivery. Hang tight!',
            delivered:        'Your order has been delivered. Enjoy your meal! 🍽️',
            cancelled:        'Your order has been cancelled. Contact us if you need help.',
          };
          const body = STATUS_BODY[status] || `Your order status is now: ${status}.`;
          pool.query(
            `INSERT INTO user_notifications (user_id, title, body) VALUES ($1, $2, $3)`,
            [userId, `Order Update — #${order_number}`, body]
          ).catch(err => console.error('[Notification] Insert on status update failed:', err.message));
        }
      }

      // 4. Award loyalty points on delivery: 1 pt per $1 spent
      if (status === 'delivered' && customer_email && row.total) {
        const pts = Math.floor(parseFloat(row.total) || 0);
        if (pts > 0) {
          pool.query(
            `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE email = $2`,
            [pts, customer_email]
          ).catch(err => console.error('[Loyalty] Award on delivery failed:', err.message));
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("updateGuestOrderStatus error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: delete order ── */
const deleteGuestOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM guest_orders WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("deleteGuestOrder error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: clear all completed orders ── */
const clearCompletedOrders = async (req, res) => {
  try {
    await pool.query("DELETE FROM guest_orders WHERE order_status='completed'");
    res.json({ success: true });
  } catch (err) {
    console.error("clearCompletedOrders error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Auth-protected: legacy/future endpoints ── */
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await pool.query("SELECT * FROM carts WHERE user_id=$1", [userId]);
    if (cart.rows.length === 0) return res.status(400).json({ message: "Cart is empty" });

    const cartId = cart.rows[0].id;
    const items = await pool.query(
      `SELECT ci.menu_id, ci.quantity, m.price
       FROM cart_items ci JOIN menus m ON ci.menu_id = m.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );
    if (items.rows.length === 0) return res.status(400).json({ message: "No items in cart" });

    let total = 0;
    items.rows.forEach(item => { total += item.price * item.quantity; });

    const order = await pool.query(
      "INSERT INTO orders(user_id,total_amount) VALUES($1,$2) RETURNING *",
      [userId, total]
    );
    const orderId = order.rows[0].id;

    for (const item of items.rows) {
      await pool.query(
        "INSERT INTO order_items(order_id,menu_id,quantity,price) VALUES($1,$2,$3,$4)",
        [orderId, item.menu_id, item.quantity, item.price]
      );
    }

    await pool.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);
    res.status(201).json({ message: "Order created successfully", order_id: orderId, total });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, customer_phone,
              delivery_method, delivery_address, order_status, payment_method,
              sub_total, delivery_fee, tip, total, placed_at, items
       FROM guest_orders
       WHERE customer_email = $1
       ORDER BY placed_at DESC`,
      [req.user.email]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);
    if (!order.rows[0]) return res.status(404).json({ message: 'Order not found' });

    // Enforce ownership — non-admin users can only read their own orders
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin;
    if (!isAdmin && order.rows[0].user_id && order.rows[0].user_id !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const items = await pool.query(
      "SELECT oi.*, m.name FROM order_items oi JOIN menus m ON oi.menu_id = m.id WHERE oi.order_id=$1",
      [id]
    );
    res.json({ order: order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, id]);
    res.json({ message: "Order status updated" });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  createGuestOrder,
  getAdminOrders,
  updateGuestOrderStatus,
  deleteGuestOrder,
  clearCompletedOrders,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
};
