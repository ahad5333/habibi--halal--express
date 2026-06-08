const cron = require('node-cron');
const pool = require('../config/db');
const { ddRequest, isConfigured: ddConfigured } = require('../utils/doordash');
const { roadieRequest, isConfigured: roadieConfigured } = require('../utils/roadie');
const { getDistance } = require('../utils/googleMaps');

const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || '204 E Mosholu Pkwy S, Bronx, NY 10458';
const RESTAURANT_NAME    = process.env.RESTAURANT_NAME    || 'Habibi Halal Express';
const RESTAURANT_PHONE   = process.env.RESTAURANT_PHONE   || '+13477033731';

// Dispatch window: fire this many minutes before expected_time
const DISPATCH_LEAD_MIN = 60;

/**
 * Parse "Today at 2:30 PM" / "Tomorrow at 3:00 PM" into a Date.
 * Returns null if the string can't be parsed.
 */
function parseExpectedTime(str) {
  if (!str) return null;
  const upper = str.trim().toUpperCase();
  if (upper === 'ASAP' || upper === '') return null;

  // Try native parse first (handles ISO strings)
  const direct = new Date(str);
  if (!isNaN(direct)) return direct;

  // Handle "Today at H:MM AM/PM" and "Tomorrow at H:MM AM/PM"
  const match = str.match(/^(Today|Tomorrow)\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, day, hourRaw, min, ampm] = match;
  let hour = parseInt(hourRaw, 10);
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

  const now = new Date();
  const base = new Date(now);
  base.setHours(hour, parseInt(min, 10), 0, 0);

  if (day.toLowerCase() === 'tomorrow') {
    base.setDate(base.getDate() + 1);
  }
  return base;
}

async function dispatchOrder(order, io) {
  const {
    id: db_id, order_number, customer_name, customer_phone,
    delivery_address, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, total,
  } = order;

  const dispatchPayload = {
    order_number, customer_name, customer_phone,
    delivery_method: 'delivery',
    delivery_address, delivery_city, delivery_zip, delivery_state,
    delivery_instructions, total,
  };

  const fullAddress = [delivery_address, delivery_city, delivery_state, delivery_zip]
    .filter(Boolean).join(', ');

  try {
    const dist  = await getDistance(RESTAURANT_ADDRESS, fullAddress);
    const miles = dist?.miles ?? 7;

    const tiersRes = await pool.query(
      `SELECT provider_type, min_distance, max_distance
         FROM delivery_tiers
        WHERE is_active = TRUE
        ORDER BY min_distance ASC`
    );
    const tier = tiersRes.rows.find(t =>
      miles >= parseFloat(t.min_distance) && miles < parseFloat(t.max_distance)
    );
    const provider = tier?.provider_type || 'doordash';

    console.log(`[ScheduledDispatch] ${order_number}: ${miles} mi → ${provider}`);

    if (provider === 'in_house') {
      await pool.query(
        `INSERT INTO delivery_assignments
           (order_id, order_number, driver_id, driver_name, status,
            delivery_address, customer_name, customer_phone)
         VALUES ($1,$2,NULL,'Unassigned','pending',$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [db_id, order_number, fullAddress, customer_name || 'Guest', customer_phone || '']
      );
      if (io) io.emit('inhouse_dispatch_needed', { order_number, miles, db_id });

    } else if (provider === 'doordash') {
      if (ddConfigured()) {
        const ddPayload = {
          external_delivery_id:  `habibi-${order_number}`,
          pickup_address:        RESTAURANT_ADDRESS,
          pickup_business_name:  RESTAURANT_NAME,
          pickup_phone_number:   RESTAURANT_PHONE,
          pickup_instructions:   'Pick up at counter. Ask for the order number.',
          dropoff_address:       fullAddress,
          dropoff_business_name: customer_name || 'Customer',
          dropoff_phone_number:  customer_phone || '',
          dropoff_instructions:  delivery_instructions || '',
          order_value:           Math.round(parseFloat(total || 0) * 100),
        };
        const ddData = await ddRequest('/drive/v2/deliveries', 'POST', ddPayload);
        await pool.query(
          `INSERT INTO doordash_deliveries
             (order_id, order_number, doordash_delivery_id, tracking_url, status, fee)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (doordash_delivery_id) DO NOTHING`,
          [db_id, order_number,
           ddData.delivery_id || ddData.external_delivery_id,
           ddData.tracking_url || null,
           ddData.delivery_status || 'created',
           ddData.fee ? ddData.fee / 100 : 0]
        );
      }

    } else if (provider === 'roadie') {
      if (roadieConfigured()) {
        const parts = fullAddress.split(',').map(s => s.trim());
        const dropoffAddr = {
          street1: parts[0] || fullAddress,
          city:    parts[1] || '',
          state:   (parts[2] || '').replace(/\s*\d+/, '').trim(),
          zip:     ((parts[2] || '').match(/\d+/) || [])[0] || (parts[3] || ''),
        };
        const roadiePayload = {
          description:      'Halal food delivery',
          size:             'small',
          value:            Math.round(parseFloat(total || 0) * 100),
          quantity:         1,
          reference_number: `habibi-${order_number}`,
          pickup: {
            name:    RESTAURANT_NAME,
            phone:   RESTAURANT_PHONE,
            address: {
              street1: process.env.RESTAURANT_STREET || '204 E Mosholu Pkwy S',
              city:    process.env.RESTAURANT_CITY   || 'Bronx',
              state:   process.env.RESTAURANT_STATE  || 'NY',
              zip:     process.env.RESTAURANT_ZIP    || '10458',
            },
            notes: `Pick up at counter. Order #${order_number}.`,
          },
          delivery: {
            name:    customer_name  || 'Customer',
            phone:   customer_phone || '',
            address: dropoffAddr,
            notes:   delivery_instructions || '',
          },
        };
        const data = await roadieRequest('/shipments', 'POST', roadiePayload);
        await pool.query(
          `INSERT INTO roadie_deliveries
             (order_id, order_number, roadie_id, tracking_number, state, price_cents)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (roadie_id) DO NOTHING`,
          [db_id, order_number, data.id, data.tracking_number || data.id, data.state || 'pending', data.price || 0]
        );
      }
    }
    // else: pickup_only — no action

  } catch (err) {
    console.error(`[ScheduledDispatch] ${order_number} dispatch error:`, err.message);
  }

  // Always mark fired to prevent re-queuing
  await pool.query(
    `UPDATE guest_orders SET dispatch_fired = TRUE WHERE id = $1`, [db_id]
  ).catch(() => {});
}

function startScheduledDispatch(io) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const res = await pool.query(
        `SELECT id, order_number, customer_name, customer_phone,
                delivery_address, delivery_city, delivery_state, delivery_zip,
                delivery_instructions, total, expected_time
           FROM guest_orders
          WHERE delivery_method = 'delivery'
            AND dispatch_fired  = FALSE
            AND expected_time IS NOT NULL
            AND expected_time   != ''
            AND expected_time   != 'ASAP'
          ORDER BY placed_at ASC`
      );

      for (const order of res.rows) {
        const scheduledAt = parseExpectedTime(order.expected_time);
        if (!scheduledAt) {
          // Unparseable — mark fired so we stop retrying
          await pool.query(
            `UPDATE guest_orders SET dispatch_fired = TRUE WHERE id = $1`, [order.id]
          ).catch(() => {});
          continue;
        }

        const minsUntil = (scheduledAt - Date.now()) / 60000;

        if (minsUntil <= DISPATCH_LEAD_MIN) {
          console.log(`[ScheduledDispatch] Firing #${order.order_number} (${minsUntil.toFixed(1)} min until ${order.expected_time})`);
          await dispatchOrder(order, io);
          if (io) io.emit('scheduled_dispatch_fired', {
            order_number: order.order_number,
            expected_time: order.expected_time,
            mins_until: Math.round(minsUntil),
          });
        }
      }
    } catch (err) {
      console.error('[ScheduledDispatch] Cron tick error:', err.message);
    }
  });

  console.log('[ScheduledDispatch] Cron started — checking every minute');
}

module.exports = { startScheduledDispatch };
