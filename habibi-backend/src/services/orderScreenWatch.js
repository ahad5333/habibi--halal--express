const cron = require('node-cron');
const { getAlertPhone } = require('../utils/alertPhone');
const pool = require('../config/db');
const { sendSMS } = require('./smsService');
const { isOpenNow } = require('../utils/businessHours');

// Texts the owner when the restaurant is open but no order screen is watching.
//
// This is the delivery platforms' "store is offline" protection: if nobody has
// the order screen open, orders arrive to an empty room. The platforms pause the
// store; here the owner is told instead, since pausing is his call.
//
// "Watching" = a socket in the 'kitchen' room, which only /staff and /kitchen
// join (socket/index.js, join_kitchen). The Redis adapter makes
// io.in(...).fetchSockets() count both PM2 workers. The admin panel is not
// counted: its pages join 'admins', and most of them don't ring for orders.
//
// "Open" = at least one active location that is accepting orders and whose hours
// positively say open now. Checkout also treats unreadable hours as open, but
// that is too weak a reason to text someone.
//
// All times are New York time. The stores are listed as open 24 hours, so this
// warning is limited on its own terms (2026-09-22, after it texted the owner at
// 2:54 and 3:26 a.m.):
//  - never between QUIET_FROM and QUIET_UNTIL -- the owner is asleep, and an
//    order that actually arrives then and sits unaccepted still texts him
//    (acceptEscalation.js), which is the alert that matters at night;
//  - at most once per New York day, recorded in system_settings, so a restart or
//    a deploy can't re-send it (the first version kept this in memory, and every
//    restart re-armed it 15 minutes later).
//
// Only sends when ORDER_SCREEN_WATCH=on in the backend .env; otherwise it logs
// what it would have sent, once a day.

const GRACE_MIN   = 15;
const QUIET_FROM  = 22;   // 10 p.m. New York
const QUIET_UNTIL = 8;    //  8 a.m. New York

let unwatchedSince = null;   // first check that found no screen while open
let dryRunLoggedOn = null;   // New York date of the last dry-run log line

async function anyLocationOpenNow() {
  const { rows } = await pool.query(
    `SELECT accepting_orders, working_days_hours FROM locations WHERE is_active = true`
  );
  return rows.some(l => l.accepting_orders !== false && isOpenNow(l.working_days_hours) === true);
}

// Wall-clock date and hour in New York, via Intl -- never the Date object's own
// getters, which run in the server's timezone (UTC).
function newYorkNow(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

const MESSAGE =
  `Habibi: the restaurant is open but no order screen has been open for ${GRACE_MIN}+ minutes, ` +
  `so new orders will not ring. Open habibihe.com/staff (or /kitchen) on the counter tablet.`;

// `now` is injectable for tests. Returns what it did, for logging and tests.
async function checkWatchers(io, now = Date.now()) {
  const screens = (await io.in('kitchen').fetchSockets()).length;
  if (screens > 0) { unwatchedSince = null; return 'watched'; }

  if (!(await anyLocationOpenNow())) { unwatchedSince = null; return 'closed'; }
  if (unwatchedSince === null) { unwatchedSince = now; return 'grace-started'; }
  if (now - unwatchedSince < GRACE_MIN * 60000) return 'in-grace';

  const ny = newYorkNow(now);
  if (ny.hour >= QUIET_FROM || ny.hour < QUIET_UNTIL) return 'quiet-hours';

  if (process.env.ORDER_SCREEN_WATCH !== 'on') {
    if (dryRunLoggedOn !== ny.date) {
      dryRunLoggedOn = ny.date;
      console.log(`[SCREEN WATCH] dry run (ORDER_SCREEN_WATCH is not "on") -- would text: ${MESSAGE}`);
    }
    return 'dry-run';
  }

  // Claim today in the database before sending: one text per New York day, across
  // restarts, deploys and both workers.
  const claim = await pool.query(
    `UPDATE system_settings SET screen_watch_alerted_on = $1::date
      WHERE id = 1 AND screen_watch_alerted_on IS DISTINCT FROM $1::date RETURNING 1`,
    [ny.date]
  );
  if (!claim.rowCount) return 'already-alerted';

  const phone = await getAlertPhone();
  if (!phone) {
    console.error('[SCREEN WATCH] no owner alert phone is set -- owner NOT told that no order screen is open');
    return 'no-phone';
  }
  const result = await sendSMS(phone, MESSAGE);
  if (!result?.success) console.error(`[SCREEN WATCH] SMS failed: ${result?.error}`);
  else console.log('[SCREEN WATCH] owner texted: no order screen open while the restaurant is open');
  return result?.success ? 'texted' : 'sms-failed';
}

// Called only on the designated PM2 instance (see server.js).
function startOrderScreenWatch(io) {
  cron.schedule('* * * * *', () => {
    checkWatchers(io).catch(err => console.error('[SCREEN WATCH] check failed:', err.message));
  });
}

// For tests: forget the per-process state (the daily record lives in the database).
function _reset() { unwatchedSince = null; dryRunLoggedOn = null; }

module.exports = { startOrderScreenWatch, checkWatchers, GRACE_MIN, _reset, newYorkNow };
