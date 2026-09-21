const cron = require('node-cron');
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
// positively say open now. Checkout also treats unparseable hours as open, but
// that is too weak a reason to text someone -- it could fire at 3 a.m.
//
// At most one text per open period: after one, nothing more until a screen
// connects again or the restaurant closes (so a split lunch/dinner day can send
// at most two). State lives in this process only -- this runs on the designated
// PM2 instance -- so after a restart it has to observe the full grace period
// again before texting, which errs toward silence.
//
// Ships as a DRY RUN: it logs the text it would send until ORDER_SCREEN_WATCH=on
// is set in the backend .env. Until staff actually keep a screen open, turning
// it on means the owner is texted once each open period.

const GRACE_MIN = 15;

let unwatchedSince = null;   // first check that found no screen while open
let alerted = false;         // already texted for this gap

async function anyLocationOpenNow() {
  const { rows } = await pool.query(
    `SELECT accepting_orders, working_days_hours FROM locations WHERE is_active = true`
  );
  return rows.some(l => l.accepting_orders !== false && isOpenNow(l.working_days_hours) === true);
}

const MESSAGE =
  `Habibi: the restaurant is open but no order screen has been open for ${GRACE_MIN}+ minutes, ` +
  `so new orders will not ring. Open habibihe.com/staff (or /kitchen) on the counter tablet.`;

// `now` is injectable for tests. Returns what it did, for logging and tests.
async function checkWatchers(io, now = Date.now()) {
  const screens = (await io.in('kitchen').fetchSockets()).length;
  if (screens > 0) { unwatchedSince = null; alerted = false; return 'watched'; }

  if (!(await anyLocationOpenNow())) {
    // Closed: nothing to watch. Resetting here is what lets the next open
    // period send its own single text.
    unwatchedSince = null; alerted = false;
    return 'closed';
  }
  if (unwatchedSince === null) { unwatchedSince = now; return 'grace-started'; }
  if (alerted) return 'already-alerted';
  if (now - unwatchedSince < GRACE_MIN * 60000) return 'in-grace';

  alerted = true;
  if (process.env.ORDER_SCREEN_WATCH !== 'on') {
    console.log(`[SCREEN WATCH] dry run (ORDER_SCREEN_WATCH is not "on") -- would text: ${MESSAGE}`);
    return 'dry-run';
  }
  const phone = process.env.ADMIN_CPANEL_PHONE;
  if (!phone) {
    console.error('[SCREEN WATCH] ADMIN_CPANEL_PHONE is not configured -- owner NOT told that no order screen is open');
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

// For tests: forget the per-process state.
function _reset() { unwatchedSince = null; alerted = false; }

module.exports = { startOrderScreenWatch, checkWatchers, GRACE_MIN, _reset };
