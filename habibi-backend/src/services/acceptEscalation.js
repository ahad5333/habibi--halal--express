const cron = require('node-cron');
const { getAlertPhone } = require('../utils/alertPhone');
const pool = require('../config/db');
const { sendSMS } = require('./smsService');

// Texts the owner when an order sits in "New" without anyone accepting it.
//
// This is the escalation step the big delivery platforms use: the order screen
// rings until someone taps Accept, and if nobody does, a person is contacted
// rather than the order quietly going cold. The staff screens handle the ring;
// this handles "nobody answered".
//
// Which orders count as waiting too long:
//   - ASAP orders unaccepted 3+ minutes after being placed
//   - scheduled orders still unaccepted 30 minutes before they're due
// Both are windowed so that old orders can never trigger a text -- the stale
// test orders that have sat in "pending" for weeks would otherwise all fire the
// moment this deploys.
//
// Only real, placed orders are in guest_orders; a checkout that was staged and
// then abandoned lives in pending_checkouts and never reaches here.
//
// The time pattern only admits real clock times: '::time' on something like
// '25:99' would throw and fail the whole query every minute, so one bad row
// would silence escalation for every order.
//
// Scheduled times come from scheduled_date + scheduled_time, read as New York
// time in SQL. Deliberately not expected_time: that is a display label such as
// "Today at 19:30" which is relative to when it was written and doesn't parse.

const ASAP_GRACE     = '3 minutes';
const SCHEDULED_LEAD = '30 minutes';
const TOO_OLD        = '2 hours';   // past this, it is a stuck order, not a new one

// One statement both selects the due orders and claims them, so an order is
// texted at most once -- even across a restart, or if two workers ever ran
// this. Claiming before sending means a failed SMS is not retried every minute;
// the ring on the staff screens is still going regardless.
const CLAIM_DUE = `
  WITH candidates AS (
    SELECT id, placed_at,
           CASE WHEN scheduled_date IS NOT NULL AND scheduled_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
                THEN (scheduled_date + scheduled_time::time) AT TIME ZONE 'America/New_York'
           END AS due_at
      FROM guest_orders
     WHERE order_status IN ('pending', 'pending_verification')
       AND accept_escalated_at IS NULL
       AND placed_at >= NOW() - INTERVAL '48 hours'
  ), due AS (
    SELECT id, due_at FROM candidates
     WHERE (due_at IS NULL
            AND placed_at <= NOW() - INTERVAL '${ASAP_GRACE}'
            AND placed_at >= NOW() - INTERVAL '${TOO_OLD}')
        OR (due_at IS NOT NULL
            AND due_at <= NOW() + INTERVAL '${SCHEDULED_LEAD}'
            AND due_at >= NOW() - INTERVAL '${TOO_OLD}')
  )
  UPDATE guest_orders g
     SET accept_escalated_at = NOW()
    FROM due
   WHERE g.id = due.id AND g.accept_escalated_at IS NULL
  RETURNING g.order_number, g.total, g.delivery_method, g.order_status, g.placed_at, due.due_at`;

// A scheduled order says when it is due; "placed 2 hours ago" would read as
// neglected when it is actually on time.
function describe(o) {
  const zelle = o.order_status === 'pending_verification' ? ', Zelle - check payment' : '';
  const when = o.due_at
    ? `due ${new Date(o.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`
    : `${Math.max(1, Math.round((Date.now() - new Date(o.placed_at)) / 60000))} min ago`;
  return `#${o.order_number} ($${Number(o.total || 0).toFixed(2)} ${o.delivery_method || 'order'}${zelle}, ${when})`;
}

function buildMessage(orders) {
  const shown = orders.slice(0, 3).map(describe).join('; ');
  const more  = orders.length > 3 ? ` +${orders.length - 3} more` : '';
  const head  = orders.length === 1
    ? 'Habibi: an order is waiting to be accepted'
    : `Habibi: ${orders.length} orders are waiting to be accepted`;
  return `${head}: ${shown}${more}. Accept in CPanel (admin.habibihe.com) or on the staff screen.`;
}

async function checkUnaccepted() {
  const { rows } = await pool.query(CLAIM_DUE);
  if (!rows.length) return;

  const phone = await getAlertPhone();
  if (!phone) {
    console.error(`[ACCEPT ESCALATION] ADMIN_CPANEL_PHONE is not configured -- ${rows.length} unaccepted order(s) NOT texted: ${rows.map(r => r.order_number).join(', ')}`);
    return;
  }
  const result = await sendSMS(phone, buildMessage(rows));
  if (!result?.success) {
    console.error(`[ACCEPT ESCALATION] SMS failed for ${rows.map(r => r.order_number).join(', ')}: ${result?.error}`);
  } else {
    console.log(`[ACCEPT ESCALATION] owner texted about ${rows.length} unaccepted order(s)`);
  }
}

// Optional second text (CPanel Settings, OFF by default): if an order is STILL
// not accepted N minutes after the first text, text once more. Claimed the same
// way as the first, so it goes out at most once per order. Orders past TOO_OLD
// are left alone like the first text does.
const CLAIM_REMINDER = `
  UPDATE guest_orders
     SET accept_reminded_at = NOW()
   WHERE order_status IN ('pending', 'pending_verification')
     AND accept_escalated_at IS NOT NULL
     AND accept_reminded_at IS NULL
     AND accept_escalated_at <= NOW() - make_interval(mins => $1::int)
     AND placed_at >= NOW() - INTERVAL '48 hours'
     AND accept_escalated_at >= NOW() - INTERVAL '${TOO_OLD}'
  RETURNING order_number, total, delivery_method, order_status, placed_at, NULL::timestamptz AS due_at`;

async function reminderMinutes() {
  const { rows } = await pool.query('SELECT accept_reminder_min FROM system_settings WHERE id = 1');
  const n = parseInt(rows[0]?.accept_reminder_min, 10);
  return n > 0 ? n : null;
}

function buildReminder(orders, minutes) {
  const head = orders.length === 1
    ? `Habibi REMINDER: an order is STILL not accepted (${minutes}+ min after the first text)`
    : `Habibi REMINDER: ${orders.length} orders are STILL not accepted (${minutes}+ min after the first text)`;
  const shown = orders.slice(0, 3).map(describe).join('; ');
  const more  = orders.length > 3 ? ` +${orders.length - 3} more` : '';
  return `${head}: ${shown}${more}. The customer is waiting -- accept it, or call them.`;
}

async function checkReminders() {
  const minutes = await reminderMinutes();
  if (!minutes) return;
  const { rows } = await pool.query(CLAIM_REMINDER, [minutes]);
  if (!rows.length) return;
  const phone = await getAlertPhone();
  if (!phone) {
    console.error(`[ACCEPT ESCALATION] no alert phone -- reminder NOT sent for ${rows.map(r => r.order_number).join(', ')}`);
    return;
  }
  const result = await sendSMS(phone, buildReminder(rows, minutes));
  if (!result?.success) console.error(`[ACCEPT ESCALATION] reminder SMS failed for ${rows.map(r => r.order_number).join(', ')}: ${result?.error}`);
  else console.log(`[ACCEPT ESCALATION] owner reminded about ${rows.length} still-unaccepted order(s)`);
}

// Called only on the designated PM2 instance (see server.js), same as the
// other per-minute jobs.
function startAcceptEscalation() {
  cron.schedule('* * * * *', () => {
    checkUnaccepted().catch(err => console.error('[ACCEPT ESCALATION] check failed:', err.message));
    checkReminders().catch(err => console.error('[ACCEPT ESCALATION] reminder check failed:', err.message));
  });
}

module.exports = { startAcceptEscalation, checkUnaccepted, checkReminders, buildMessage, buildReminder, CLAIM_DUE, CLAIM_REMINDER };
