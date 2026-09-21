const cron = require('node-cron');
const pool = require('../config/db');
const { getDistance } = require('../utils/googleMaps');
const { dispatchDeliveryOrder } = require('../controllers/orderController');

// Books couriers for SCHEDULED delivery orders, shortly before they're due.
//
// ASAP delivery orders are dispatched the moment they're placed
// (createGuestOrder); scheduled ones are skipped there and left to this job.
//
// Until 2026-09-21 this job never booked anything. It parsed expected_time -- a
// display label like "Today at 19:30" -- with a parser that only understood
// "7:30 PM", got null, marked the order dispatch_fired and moved on. It also
// routed through the old DoorDash/Roadie delivery_tiers table, which has no
// live credentials and which live dispatch stopped using once each order's
// price came from its own courier quote. So a scheduled delivery was never
// handed to any courier.
//
// Now it reads scheduled_date + scheduled_time as New York time and books
// through dispatchDeliveryOrder -- the routine ASAP orders use -- so a scheduled
// order reaches the same courier with the same failure handling.
//
// A scheduled order whose time can't be read (the mobile app sends only an
// expected_time label, no scheduled_date), or whose booking window has already
// passed, is never dropped: it goes on the dispatch board for a person to
// arrange, which is what the ASAP path does when a courier booking fails.

// ASAP orders book the courier at placement, with food ready in the 25-35 min
// checkout quotes. Booking 45 min before the customer's chosen time mirrors
// that: the courier arrives while the food is finishing and the delivery lands
// around the time they picked.
const LEAD = '45 minutes';
// Still worth booking if the job was briefly late; past this, flag instead.
const LATE = '15 minutes';

// Mirrors createGuestOrder's isScheduled: a non-empty expected_time other than
// ASAP. The time pattern only admits real clock times, because casting
// something like '25:99' would throw and fail the query for every order.
//
// One statement selects and claims (dispatch_fired = TRUE), so an order is
// handled at most once -- a courier is paid for, so double booking is the
// failure to rule out first. Windows keep old orders out entirely: anything
// placed more than 48 h ago, or already long past due, is not touched.
const CLAIM = `
  WITH candidates AS (
    SELECT id, placed_at,
           CASE WHEN scheduled_date IS NOT NULL
                 AND scheduled_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
                THEN (scheduled_date + scheduled_time::time) AT TIME ZONE 'America/New_York'
           END AS due_at
      FROM guest_orders
     WHERE LOWER(delivery_method) = 'delivery'
       AND dispatch_fired = FALSE
       AND order_status NOT IN ('cancelled', 'refunded', 'delivered')
       AND expected_time IS NOT NULL AND expected_time <> ''
       AND UPPER(TRIM(expected_time)) <> 'ASAP'
       AND placed_at >= NOW() - INTERVAL '48 hours'
  ), picked AS (
    SELECT id, due_at,
           CASE
             WHEN due_at BETWEEN NOW() - INTERVAL '${LATE}' AND NOW() + INTERVAL '${LEAD}' THEN 'book'
             WHEN due_at IS NULL AND placed_at >= NOW() - INTERVAL '2 hours'             THEN 'unreadable'
             WHEN due_at <  NOW() - INTERVAL '${LATE}' AND due_at >= NOW() - INTERVAL '6 hours' THEN 'missed'
           END AS action
      FROM candidates
  )
  UPDATE guest_orders g
     SET dispatch_fired = TRUE
    FROM picked
   WHERE g.id = picked.id AND picked.action IS NOT NULL AND g.dispatch_fired = FALSE
  RETURNING g.id, g.order_number, g.customer_name, g.customer_phone, g.delivery_method,
            g.delivery_address, g.delivery_city, g.delivery_state, g.delivery_zip,
            g.delivery_instructions, g.total, g.location_id, g.expected_time,
            picked.due_at, picked.action`;

// Puts the order on the dispatch board, the same way the ASAP path does when a
// courier booking fails, so someone arranges it by hand.
async function flagForManualArrangement(o, io, note) {
  const address = [o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_zip]
    .filter(Boolean).join(', ');
  // The board renders miles with toFixed(), so it needs a number; same default
  // as the ASAP path when Maps is unavailable.
  const dist  = await getDistance(process.env.RESTAURANT_ADDRESS || '2974 Jerome Ave, Bronx, NY 10468', address).catch(() => null);
  const miles = dist?.miles ?? 7;
  await pool.query(
    `INSERT INTO delivery_assignments
       (order_id, order_number, driver_id, driver_name, status,
        delivery_address, customer_name, customer_phone, delivery_note)
     VALUES ($1,$2,NULL,'Unassigned','pending',$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    [o.id, o.order_number, address, o.customer_name || 'Guest', o.customer_phone || '', note]
  ).catch(e => console.error('[ScheduledDispatch] manual-arrangement insert failed:', e.message));
  if (io) io.to('admins').emit('inhouse_dispatch_needed', { order_number: o.order_number, miles, db_id: o.id });
}

const nyTime = d => new Date(d).toLocaleString('en-US', {
  weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
});

async function runScheduledDispatch(io) {
  const { rows } = await pool.query(CLAIM);
  for (const o of rows) {
    if (o.action === 'book') {
      console.log(`[ScheduledDispatch] booking courier for #${o.order_number}, due ${nyTime(o.due_at)}`);
      await dispatchDeliveryOrder({
        db_id: o.id, order: o, quoteRef: null, locationId: o.location_id, io,
      });
    } else if (o.action === 'unreadable') {
      console.warn(`[ScheduledDispatch] #${o.order_number}: time "${o.expected_time}" can't be read -- flagged for manual arrangement`);
      await flagForManualArrangement(o, io,
        `Scheduled delivery for "${o.expected_time}", but that time could not be read -- book the courier manually.`);
    } else if (o.action === 'missed') {
      console.warn(`[ScheduledDispatch] #${o.order_number}: booking window passed (due ${nyTime(o.due_at)}) -- flagged for manual arrangement`);
      await flagForManualArrangement(o, io,
        `Scheduled delivery was due ${nyTime(o.due_at)} and no courier was booked in time -- arrange it now.`);
    }
  }
}

// Called only on the designated PM2 instance (see server.js).
function startScheduledDispatch(io) {
  cron.schedule('* * * * *', () => {
    runScheduledDispatch(io).catch(err => console.error('[ScheduledDispatch] run failed:', err.message));
  });
}

module.exports = { startScheduledDispatch, runScheduledDispatch, CLAIM };
