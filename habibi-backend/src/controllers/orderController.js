const crypto = require('crypto');
const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { isOpenNow } = require('../utils/businessHours');
const { logAudit } = require('./auditController');
const { ddRequest, isConfigured: ddConfigured } = require("../utils/doordash");
const { roadieRequest, isConfigured: roadieConfigured } = require("../utils/roadie");
const { getDistance, feeFromMiles } = require("../utils/googleMaps");
const { getFeeForDistance } = require("../utils/deliveryFee");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const fcmService = require("../services/fcmService");

const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || '2974 Jerome Ave, Bronx, NY 10468';
const RESTAURANT_NAME    = process.env.RESTAURANT_NAME    || 'Habibi Halal Express';
const RESTAURANT_PHONE   = process.env.RESTAURANT_PHONE   || '+13477033731';

// Delivery fee is always measured from this one fixed address (multi-location fulfillment
// isn't wired into checkout at all yet), but delivery_zones can still be scoped to a
// specific location -- getFeeForDistance() prefers that over a global zone. Without
// resolving which location this address actually is, that scoping is silently dead:
// every call defaults to "global zones only." Resolved once and cached for the process
// lifetime since RESTAURANT_ADDRESS is a fixed env var, not something that changes mid-run.
let _originLocationId;
async function getOriginLocationId() {
  if (_originLocationId !== undefined) return _originLocationId;
  try {
    const r = await pool.query('SELECT id FROM locations WHERE exact_address = $1 LIMIT 1', [RESTAURANT_ADDRESS]);
    _originLocationId = r.rows[0]?.id || null;
  } catch {
    _originLocationId = null;
  }
  return _originLocationId;
}

// Real in-house delivery range for the resolved origin location — the fee-tier table
// alone allows fees up to 350mi (built for DoorDash Drive/Roadie), but neither is
// actually configured, so that range is not a real delivery-range cap on its own.
let _originRadiusMiles;
async function getOriginRadiusMiles(locationId) {
  if (_originRadiusMiles !== undefined) return _originRadiusMiles;
  try {
    if (locationId) {
      const r = await pool.query('SELECT delivery_radius_miles FROM locations WHERE id = $1', [locationId]);
      _originRadiusMiles = r.rows[0]?.delivery_radius_miles != null ? parseFloat(r.rows[0].delivery_radius_miles) : 5;
    } else {
      _originRadiusMiles = 5;
    }
  } catch {
    _originRadiusMiles = 5;
  }
  return _originRadiusMiles;
}

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
          street1: process.env.RESTAURANT_STREET || '2974 Jerome Ave',
          city:    process.env.RESTAURANT_CITY   || 'Bronx',
          state:   process.env.RESTAURANT_STATE  || 'NY',
          zip:     process.env.RESTAURANT_ZIP    || '10468',
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
    // ── Business hours gate ────────────────────────────────────────────────
    const locsRes = await pool.query(
      `SELECT accepting_orders, working_days_hours FROM locations WHERE is_active = true`
    );
    const anyOpen = locsRes.rows.length === 0 || locsRes.rows.some(l => {
      if (l.accepting_orders === false) return false;
      const auto = isOpenNow(l.working_days_hours);
      return auto === true || auto === null;
    });
    if (!anyOpen) {
      return res.status(503).json({ message: "We're currently closed. Please check our hours and try again." });
    }

    const {
      customer_name, customer_phone, customer_email,
      delivery_method, delivery_address, delivery_city, delivery_zip,
      delivery_state, delivery_instructions, payment_method,
      sub_total, tax, service_fee, delivery_fee, tip, discount, total,
      coupon_code, expected_time, items,
      table_id,
      table_number: table_number_raw,
      loyalty_points_redeemed: loyalty_points_raw,
      utm_source, utm_medium, utm_campaign, utm_content,
      is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
    } = req.body;

    // Generate order number server-side — never trust client-supplied values
    const order_number = `HBB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

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

    // Reject a payment method the admin has disabled via Settings — Payment
    // Methods there previously had zero real enforcement anywhere; disabling
    // one was purely cosmetic and a direct API call could still use it. Only
    // blocks methods that exist AND are explicitly inactive — an unrecognized
    // method (not yet represented in payment_settings) is left alone.
    if (payment_method) {
      const providerKey = payment_method === 'card' ? 'authorize.net' : payment_method;
      const pmRes = await pool.query(`SELECT is_active FROM payment_settings WHERE provider = $1`, [providerKey]);
      if (pmRes.rows.length > 0 && !pmRes.rows[0].is_active) {
        return res.status(400).json({ message: 'This payment method is currently unavailable.' });
      }
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

    // 2. Collect item IDs for price validation — every regular menu item must carry a
    //    valid menu ID. Custom Build-Your-Own items (id prefixed "custom-") have no
    //    row in `menus` — their price is computed client-side from selected ingredients
    //    and is intentionally not re-validated here, same as before this check existed.
    //    This only closes the gap for genuine menu items missing/spoofing an ID.
    const isCustomItem = item => typeof item.id === 'string' && item.id.startsWith('custom-');
    for (const item of items) {
      if (isCustomItem(item)) continue;
      const menuId = parseInt(item.id || item.menu_id, 10);
      if (!menuId || menuId <= 0) {
        return res.status(400).json({ message: 'All items must include a valid menu ID.' });
      }
    }
    const itemIds = items
      .filter(i => !isCustomItem(i))
      .map(i => parseInt(i.id || i.menu_id, 10));

    // 3. Server-side delivery fee enforcement
    const isDeliveryOrder = (delivery_method || '').toLowerCase() === 'delivery';
    if (!isDeliveryOrder) {
      // Pickup / dine-in must never carry a delivery fee
      if (clientDelFee > 0.01) {
        return res.status(400).json({ message: 'Delivery fee not applicable for this order type.' });
      }
    } else if (delivery_address) {
      // Re-compute the distance-based fee so the client cannot under-report it
      try {
        const addrStr = [delivery_address, delivery_city, delivery_state, delivery_zip]
          .filter(Boolean).join(', ');
        const dist = await getDistance(RESTAURANT_ADDRESS, addrStr);
        if (dist) {
          const originLocationId = await getOriginLocationId();
          const radiusMiles = await getOriginRadiusMiles(originLocationId);
          if (dist.miles > radiusMiles) {
            return res.status(400).json({ message: 'Delivery address is outside our delivery range.' });
          }
          const serverDelFee = await getFeeForDistance(dist.miles, originLocationId);
          if (serverDelFee === null) {
            return res.status(400).json({ message: 'Delivery address is outside our delivery range.' });
          }
          if (clientDelFee < serverDelFee - 0.10) {
            return res.status(400).json({ message: 'Delivery fee is incorrect. Please refresh and retry.' });
          }
        } else {
          // Maps unavailable or address unresolvable — enforce minimum fee floor so
          // a deliberately non-geocodable address cannot be used to submit $0 delivery fee.
          const minFee = feeFromMiles(0) ?? 2.99;
          if (clientDelFee < minFee - 0.10) {
            return res.status(400).json({ message: 'Delivery fee is incorrect. Please refresh and retry.' });
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    // 4. Server-side tax and service fee validation — reads the same
    //    DB-first, env-fallback source as GET /api/settings/checkout (which
    //    the client uses to build clientTax/clientSvcFee), so an admin
    //    changing the rate via Settings doesn't start rejecting every real
    //    order until this also picks it up.
    let serverTaxRate    = parseFloat(process.env.TAX_RATE)          || 0.08875;
    let serverSvcFeeRate = parseFloat(process.env.SERVICE_FEE_RATE)  || 0.04273;
    try {
      const sys = await pool.query(`SELECT tax_rate, service_fee_rate FROM system_settings WHERE id = 1`);
      if (sys.rows[0]?.tax_rate != null)         serverTaxRate    = parseFloat(sys.rows[0].tax_rate);
      if (sys.rows[0]?.service_fee_rate != null) serverSvcFeeRate = parseFloat(sys.rows[0].service_fee_rate);
    } catch (_) { /* fall back to env above */ }
    const serverTax    = Math.round(clientSubtotal * serverTaxRate    * 100) / 100;
    const serverSvcFee = Math.round(clientSubtotal * serverSvcFeeRate * 100) / 100;
    if (clientTax < serverTax - 0.10) {
      return res.status(400).json({ message: 'Tax amount is incorrect. Please refresh and retry.' });
    }
    if (clientSvcFee < serverSvcFee - 0.10) {
      return res.status(400).json({ message: 'Service fee is incorrect. Please refresh and retry.' });
    }

    // 5. Birthday coupon validation — codes are issued as BDAY-{userId}-{year}
    const BIRTHDAY_COUPON_RE = /^BDAY-(\d+)-(\d{4})$/i;
    const bdayMatch = coupon_code && BIRTHDAY_COUPON_RE.exec(coupon_code.trim());
    if (bdayMatch && clientDiscount > 0) {
      const bdayUserId = parseInt(bdayMatch[1]);
      const bdayYear   = parseInt(bdayMatch[2]);
      const now = new Date();
      let birthdayValid = false;
      if (customer_email && bdayYear === now.getFullYear()) {
        try {
          const uRes = await pool.query(
            `SELECT date_of_birth FROM users
              WHERE LOWER(email) = LOWER($1) AND id = $2 AND date_of_birth IS NOT NULL`,
            [customer_email, bdayUserId]
          );
          if (uRes.rows.length) {
            const dob = new Date(uRes.rows[0].date_of_birth);
            birthdayValid = dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
          }
        } catch (_) { /* non-fatal */ }
      }
      if (!birthdayValid) {
        return res.status(400).json({ message: 'Birthday discount is not valid for today.' });
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

      // Price validation inside transaction with FOR UPDATE — prevents TOCTOU race
      {
        const priceRows = await client.query(
          `SELECT id, price, choices, addons FROM menus WHERE id = ANY($1) AND is_available = TRUE FOR UPDATE`,
          [itemIds]
        );
        const dbMap = {};
        priceRows.rows.forEach(r => { dbMap[r.id] = r; });

        let recalcSubtotal = 0;
        for (const item of items) {
          if (isCustomItem(item)) continue;
          const menuId = parseInt(item.id || item.menu_id, 10);
          const row = dbMap[menuId];
          if (!row) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'One or more items are no longer available. Please refresh your cart.' });
          }

          const dbPrice = parseFloat(row.price);
          const choices = row.choices || [];
          const addons  = row.addons  || [];
          const selChoices = item.selectedChoices || {};
          const selAddons  = item.selectedAddons  || {};
          let modifierExtra = 0;
          for (const [cgId, optId] of Object.entries(selChoices)) {
            const cg  = choices.find(c => c.id === parseInt(cgId));
            const opt = (cg?.options || []).find(o => o.id === parseInt(optId));
            modifierExtra += parseFloat(opt?.extra_price || 0);
          }
          for (const [optId, addonQty] of Object.entries(selAddons)) {
            for (const ag of addons) {
              const opt = (ag?.options || []).find(o => o.id === parseInt(optId));
              if (opt) modifierExtra += parseFloat(opt.price || 0) * parseInt(addonQty, 10);
            }
          }

          const expectedUnit = dbPrice + modifierExtra;
          const clientUnit   = parseFloat(item.price || item.unit_price || 0);
          if (clientUnit < expectedUnit - 0.02) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Item price mismatch. Please refresh and try again.' });
          }
          recalcSubtotal += clientUnit * parseInt(item.qty || item.quantity || 1, 10);
        }

        if (recalcSubtotal > 0 && clientSubtotal < recalcSubtotal - 0.02) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Item prices have changed. Please refresh your cart.' });
        }
      }

      if (loyalty_points_redeemed > 0 && customer_email) {
        const userRes = await client.query(
          'SELECT loyalty_points FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE',
          [customer_email]
        );
        const availablePoints = userRes.rows[0]?.loyalty_points || 0;
        if (loyalty_points_redeemed > availablePoints) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Insufficient loyalty points.' });
        }
      }

      // The claimed discount was never checked against what
      // loyalty_points_redeemed actually justifies — only "total = sum of
      // parts" was verified above, so a tampered request could claim
      // loyalty_points_redeemed: 1 alongside an arbitrary discount and pass
      // every other check. Cap it at what the redeemed points are really
      // worth, using the real admin-configured redeem_rate (not whatever
      // rate the client assumed), plus a coupon allowance bounded by the
      // subtotal itself — a coupon can never discount more than the order.
      {
        const cfgRes = await client.query(`SELECT redeem_rate FROM loyalty_config WHERE id = 1`);
        const redeemRate = parseFloat(cfgRes.rows[0]?.redeem_rate) || 100;
        const maxLoyaltyDiscount = loyalty_points_redeemed / redeemRate;
        const couponAllowance = coupon_code ? clientSubtotal : 0;
        if (clientDiscount > maxLoyaltyDiscount + couponAllowance + 0.02) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Discount amount is incorrect. Please refresh and retry.' });
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
         coupon_code, expected_time, items, table_number, loyalty_points_redeemed, user_id, order_status,
         is_gift, gift_recipient_name, gift_recipient_phone, gift_message, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'pending',$25,$26,$27,$28,$29)
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
        is_gift === true || is_gift === 'true' ? true : false,
        gift_recipient_name  || null,
        gift_recipient_phone || null,
        gift_message         || null,
        ['card', 'paypal'].includes(payment_method) ? 'paid' : 'unpaid',
      ]
    );

      db_id = result.rows[0].id;

      // Deduct loyalty points inside the same transaction
      if (loyalty_points_redeemed > 0 && customer_email) {
        await client.query(
          `UPDATE users SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - $1) WHERE LOWER(email) = LOWER($2)`,
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

    // Store UTM attribution if present (columns added by migrate-utm.js)
    if (utm_source || utm_medium || utm_campaign || utm_content) {
      pool.query(
        `UPDATE guest_orders SET utm_source=$1, utm_medium=$2, utm_campaign=$3, utm_content=$4 WHERE id=$5`,
        [utm_source||null, utm_medium||null, utm_campaign||null, utm_content||null, db_id]
      ).catch(err => console.warn('[UTM] Store skipped (run migrate-utm.js):', err.message));
    }

    // Auto-dispatch: skip for scheduled orders — the cron job handles those
    const isScheduled = expected_time && expected_time.trim().toUpperCase() !== 'ASAP';
    if ((delivery_method || '').toLowerCase() === 'delivery' && !isScheduled) {
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
          } else if (provider === 'roadie' && roadieConfigured()) {
            autoDispatchRoadie(db_id, dispatchPayload);
          } else if (provider === 'roadie') {
            // Roadie is the right tier for this distance but credentials aren't
            // configured yet — without this, the order would get no delivery
            // dispatch of any kind and no one would know. Surface it the same
            // way an in-house order does, so it lands on the admin dispatch board.
            console.warn(`[Dispatch] ${order_number}: ${miles} mi wants Roadie but it's not configured — flagging for manual dispatch`);
            await pool.query(
              `INSERT INTO delivery_assignments
                 (order_id, order_number, driver_id, driver_name, status,
                  delivery_address, customer_name, customer_phone, delivery_note)
               VALUES ($1,$2,NULL,'Unassigned','pending',$3,$4,$5,$6)
               ON CONFLICT DO NOTHING`,
              [db_id, order_number,
               [delivery_address, delivery_city, delivery_state, delivery_zip].filter(Boolean).join(', '),
               customer_name || 'Guest', customer_phone || '',
               `Long-distance order (${miles.toFixed(1)} mi) — Roadie not yet configured, needs manual delivery arrangement.`]
            ).catch(e => console.error('[Dispatch] roadie-fallback assignment insert failed:', e.message));
            const io = req.app.get('io');
            if (io) io.emit('inhouse_dispatch_needed', { order_number, miles, db_id });
          } else {
            // pickup_only or unknown — just log
            console.log(`[Dispatch] ${order_number}: ${miles} mi → pickup only (no dispatch)`);
          }

          // Mark as fired so the scheduler skips this order
          await pool.query(
            `UPDATE guest_orders SET dispatch_fired = TRUE WHERE id = $1`, [db_id]
          ).catch(() => {});
        } catch (err) {
          console.error('[Dispatch] Routing error:', err.message);
          autoDispatchDoorDash(db_id, dispatchPayload); // safe fallback
          await pool.query(
            `UPDATE guest_orders SET dispatch_fired = TRUE WHERE id = $1`, [db_id]
          ).catch(() => {});
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
      const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-tracking?order=${order_number}`;
      smsService.sendSMS(customer_phone, `Thank you for your order! Order #${order_number} has been received. Total: $${parseFloat(total).toFixed(2)}. Track it here: ${trackingUrl}`).catch(err => {
        console.error('Failed to send order confirmation SMS:', err.message);
      });
    }

    if (customer_email) {
      pool.query("SELECT id, date_of_birth FROM users WHERE LOWER(email) = LOWER($1)", [customer_email]).then(async userRes => {
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

    // Broadcast new order to authenticated merchant/admin sockets only
    const io = req.app.get('io');
    if (io) io.to('admins').emit('new_order', { order_number, order_status: 'pending' });

    // Push to merchant tablets (wakes app if backgrounded/screen off)
    fcmService.sendPushToAdmins(
      '🔔 New Order!',
      `Order #${order_number} just came in — tap to review.`,
      { orderNumber: order_number, type: 'new_order', channelId: 'new-orders' }
    ).catch(err => console.error('[Push] Merchant alert failed:', err.message));

    res.status(201).json({ success: true, db_id, order_number });
  } catch (err) {
    console.error("createGuestOrder error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: get all orders ── */
const getAdminOrders = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '200', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
    const result = await pool.query(
      `SELECT *,
              order_status  AS status,
              placed_at     AS created_at
       FROM guest_orders
       WHERE deleted_at IS NULL
       ORDER BY placed_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getAdminOrders error:", err.message);
    res.status(500).json(safeError(err));
  }
};

const ALLOWED_ORDER_STATUSES = new Set([
  'pending', 'accepted', 'preparing', 'cooking',
  'ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed',
]);

/* ── Admin: update order status ── */
const updateGuestOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !ALLOWED_ORDER_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    // Capture previous status in the same UPDATE so we can guard loyalty award below
    const updated = await pool.query(
      `WITH prev AS (SELECT order_status FROM guest_orders WHERE id = $2)
       UPDATE guest_orders SET order_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING customer_phone, customer_email, order_number, total,
                 (SELECT order_status FROM prev) AS previous_status`,
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
        const userRes = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [customer_email]);
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
      // Guard: only award if we're transitioning INTO delivered, not re-setting it
      if (status === 'delivered' && row.previous_status !== 'delivered' && customer_email && row.total) {
        const pts = Math.floor(parseFloat(row.total) || 0);
        if (pts > 0) {
          pool.query(
            `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE LOWER(email) = LOWER($2)`,
            [pts, customer_email]
          ).catch(err => console.error('[Loyalty] Award on delivery failed:', err.message));
        }

        // 5. Complete pending referral on the referee's first delivered order
        pool.query(
          `SELECT id FROM guest_orders
           WHERE customer_email = $1 AND order_status = 'delivered'`,
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
    }

    res.json({ success: true });
  } catch (err) {
    console.error("updateGuestOrderStatus error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Customer self-service cancellation ────────────────────────────────────
   Public, ownership-verified (same pattern as the chat endpoint below):
   logged-in users must own the order, guests must supply the order's email.
   Only allowed while the order is still 'pending' and within a short grace
   window after placement, so the kitchen never loses work already started. ── */
const CANCEL_WINDOW_MINUTES = 3;

const cancelOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { customer_email } = req.body;

    // minutes_elapsed computed DB-side (NOW() - placed_at, both evaluated in the
    // same session) -- placed_at is stored as timestamp-without-timezone, so
    // comparing it against a JS Date.now() here would be skewed by whatever the
    // DB session's timezone happens to be. Let Postgres do the subtraction.
    const result = await pool.query(
      `SELECT id, user_id, customer_email, order_status, payment_method,
              EXTRACT(EPOCH FROM (NOW() - placed_at)) / 60 AS minutes_elapsed
         FROM guest_orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Order not found.' });
    const order = result.rows[0];

    if (req.user) {
      const ownsById    = order.user_id && order.user_id === req.user.id;
      const ownsByEmail = order.customer_email && order.customer_email.toLowerCase() === req.user.email?.toLowerCase();
      if (!ownsById && !ownsByEmail) return res.status(403).json({ message: 'Access denied.' });
    } else {
      const provided = (customer_email || '').trim().toLowerCase();
      if (!provided || !order.customer_email || order.customer_email.toLowerCase() !== provided) {
        return res.status(401).json({ message: 'Enter the email used for this order to cancel it.' });
      }
    }

    if ((order.order_status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ message: 'This order can no longer be cancelled automatically — the kitchen has already started. Please call us for help.' });
    }

    if (parseFloat(order.minutes_elapsed) > CANCEL_WINDOW_MINUTES) {
      return res.status(400).json({ message: `The ${CANCEL_WINDOW_MINUTES}-minute cancellation window has passed. Please call us and we'll help you right away.` });
    }

    await pool.query(
      `UPDATE guest_orders
          SET order_status = 'cancelled', cancellation_reason = 'Cancelled by customer', updated_at = NOW()
        WHERE id = $1`,
      [order.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`order_${orderNumber}`).emit('order_status_updated', { order_id: orderNumber, order_number: orderNumber, status: 'cancelled' });
    }

    const paidOnline = order.payment_method && !['cash', 'zelle', 'cashapp'].includes(order.payment_method.toLowerCase());
    res.json({
      success: true,
      message: paidOnline
        ? 'Your order has been cancelled. Our team will process your refund shortly.'
        : 'Your order has been cancelled.',
    });
  } catch (err) {
    console.error('cancelOrder error:', err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: soft-delete order (preserves financial record) ── */
const deleteGuestOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE guest_orders SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL", [id]);
    logAudit(pool, req.user?.id, req.user?.name, 'delete_order', 'order', String(id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error("deleteGuestOrder error:", err.message);
    res.status(500).json(safeError(err));
  }
};

/* ── Admin: archive completed orders (soft-delete, not hard-delete) ── */
const clearCompletedOrders = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE guest_orders SET deleted_at=NOW()
        WHERE order_status='completed' AND deleted_at IS NULL`
    );
    logAudit(pool, req.user?.id, req.user?.name, 'archive_completed_orders', 'order', 'bulk', { count: rowCount }, req.ip);
    res.json({ success: true, archived: rowCount });
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
      `SELECT ci.menu_item_id AS menu_id, ci.quantity, m.price
       FROM cart_items ci JOIN menus m ON ci.menu_item_id = m.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );
    if (items.rows.length === 0) return res.status(400).json({ message: "No items in cart" });

    let total = 0;
    items.rows.forEach(item => { total += item.price * item.quantity; });

    const order = await pool.query(
      "INSERT INTO orders(customer_id,total,order_status,payment_status) VALUES($1,$2,'pending','unpaid') RETURNING *",
      [userId, total]
    );
    const orderId = order.rows[0].id;

    for (const item of items.rows) {
      await pool.query(
        "INSERT INTO order_items(order_id,menu_item_id,quantity,unit_price) VALUES($1,$2,$3,$4)",
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
    const order = await pool.query("SELECT * FROM guest_orders WHERE id=$1", [id]);
    if (!order.rows[0]) return res.status(404).json({ message: 'Order not found' });

    // Enforce ownership — non-admin users can only read their own orders
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin;
    if (!isAdmin) {
      const ownerEmail = order.rows[0].customer_email;
      if (!ownerEmail || ownerEmail !== req.user?.email) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Items are stored as JSONB in guest_orders
    const storedItems = order.rows[0].items || [];
    res.json({ order: order.rows[0], items: storedItems });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin;
    if (!isAdmin) return res.status(403).json({ message: 'Admin access required.' });

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !ALLOWED_ORDER_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    await pool.query("UPDATE guest_orders SET order_status=$1, updated_at=NOW() WHERE id=$2", [status, id]);
    res.json({ message: "Order status updated" });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = {
  createGuestOrder,
  getAdminOrders,
  updateGuestOrderStatus,
  cancelOrder,
  deleteGuestOrder,
  clearCompletedOrders,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
};
