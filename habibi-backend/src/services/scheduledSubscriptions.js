const cron = require('node-cron');
const pool = require('../config/db');
const { processSubscriptionCharge } = require('../controllers/subscriptionController');

// Hourly, matching cleanupAbandonedPendingCheckouts' cadence -- a
// subscription is due to the day, not the minute, so per-minute polling
// (like scheduledDispatch's delivery-window firing) isn't needed here.
// Registered from server.js alongside the other money-related crons, not
// app.js -- see the comment on that placement convention in server.js.
function startScheduledSubscriptions(io) {
  cron.schedule('0 * * * *', async () => {
    try {
      const due = await pool.query(
        `SELECT * FROM subscriptions WHERE status = 'active' AND next_charge_date <= NOW() ORDER BY next_charge_date ASC`
      );
      for (const sub of due.rows) {
        // One subscription's failure (declined card, unavailable item, a
        // processor outage) must never block the rest of the batch --
        // matches scheduledDispatch's per-row isolation, not the scheduled-
        // broadcast job's weaker per-tick-only catch.
        try {
          await processSubscriptionCharge(sub, io);
        } catch (err) {
          console.error(`[ScheduledSubscriptions] Subscription ${sub.id} processing error:`, err.message);
        }
      }
    } catch (err) {
      console.error('[ScheduledSubscriptions] Cron tick error:', err.message);
    }
  });
  console.log('[ScheduledSubscriptions] Cron started — checking hourly');
}

module.exports = { startScheduledSubscriptions };
