const cron = require('node-cron');

// PM2 cluster mode runs this whole module tree once PER WORKER PROCESS.
// Without this guard, every cron.schedule(...) call -- and every startX(io)
// call that registers its own internally -- fires once per worker instead of
// once total: routine cleanup jobs run duplicated, the per-minute dispatch
// cron ticks twice as often, and worst of all, the hourly subscription-charge
// cron could attempt to charge the same due subscription twice. Found and
// fixed within minutes of switching to cluster mode, before any real
// duplicate charge occurred (checked subscription_charges directly).
//
// NODE_APP_INSTANCE is set by PM2 only in cluster mode ('0' for the first
// worker, '1' for the second, etc.) -- unset (fork mode, local dev, a single
// instance) is treated as the designated instance too, so nothing changes
// outside cluster mode.
const isDesignatedInstance =
  process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';

function scheduleOnce(pattern, fn, options) {
  if (!isDesignatedInstance) return { stop() {} }; // no-op on every other worker
  return cron.schedule(pattern, fn, options);
}

module.exports = { scheduleOnce, isDesignatedInstance };
