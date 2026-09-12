// Run with: node tests/manager-scope.test.js
// Checks the manager allow-list: everything the four permitted pages call must
// pass, and everything sensitive must not. Pure function, no DB, no network.
const { managerMayReach } = require('../src/middleware/managerMiddleware');

const MUST_ALLOW = [
  ['GET','/stats'],
  ['GET','/orders'], ['GET','/orders/unified'],
  ['GET','/menus'], ['POST','/menus'], ['PUT','/menus/12'], ['DELETE','/menus/12'],
  ['GET','/menus/location-availability'], ['POST','/menus/location-availability'],
  ['POST','/menus/location-availability/bulk'], ['PATCH','/menus/availability'],
  ['GET','/byo-ingredients'], ['POST','/byo-ingredients'], ['DELETE','/byo-ingredients/3'],
  ['GET','/global-addons'], ['PATCH','/global-addons/1'],
  ['GET','/inventory'], ['POST','/inventory'], ['PATCH','/inventory/5'],
  ['DELETE','/inventory/5'], ['POST','/inventory/5/restock'],
  ['GET','/inventory/order-log'], ['GET','/inventory/restock-log'],
  ['GET','/waitlist/counts'],
  ['GET','/waste'], ['POST','/waste'], ['GET','/waste/options'], ['DELETE','/waste/9'],
  ['GET','/business-hours'], ['POST','/business-hours'],
  ['GET','/locations'],
  ['GET','/staff'], ['POST','/staff'], ['PATCH','/staff/2'], ['DELETE','/staff/2'],
  ['POST','/staff/bulk-delete'], ['POST','/staff/bulk-import'], ['POST','/staff/bulk-status'],
  ['GET','/schedule'], ['POST','/schedule/shifts'], ['PATCH','/schedule/shifts/4'],
  ['DELETE','/schedule/shifts/4'], ['GET','/schedule/hours'], ['POST','/schedule/clock'],
  ['PATCH','/schedule/clock/7'], ['DELETE','/schedule/clock/7'], ['POST','/schedule/notify'],
  ['GET','/schedule/time-off'], ['PATCH','/schedule/time-off/3'], ['POST','/schedule/copy-week'],
];

const MUST_DENY = [
  ['PATCH','/orders/HH-1/payment-status'],
  ['GET','/payments'], ['POST','/payments/HH-1/refund'], ['GET','/refunds'],
  ['GET','/reports/revenue'], ['GET','/reports/tax'], ['GET','/analytics/revenue'],
  ['GET','/analytics/growth'], ['GET','/cash-log'],
  ['GET','/customers'], ['DELETE','/customers/4'], ['POST','/customers/bulk-delete'],
  ['GET','/coupons'], ['POST','/coupons'], ['GET','/gift-cards'], ['GET','/loyalty/stats'],
  ['GET','/referrals'], ['GET','/settings'], ['POST','/settings'],
  ['GET','/audit-log'], ['GET','/integrations'], ['GET','/platform-credentials'],
  ['POST','/locations'], ['PUT','/locations/1'], ['PATCH','/locations/1'], ['DELETE','/locations/1'],
  ['GET','/authnet/accounts'], ['POST','/authnet/accounts'],
  ['GET','/card-processors/accounts'], ['POST','/card-processors/accounts'],
  ['GET','/payment-settings/offline-handles'], ['PUT','/payment-settings/offline-handles'],
  ['GET','/sidebar'], ['GET','/broadcasts'], ['POST','/broadcasts'],
  ['GET','/partners'], ['GET','/partner-orders'], ['GET','/marketplace/orders'],
  ['GET','/subscriptions'], ['GET','/assistant/insights'], ['GET','/drivers'],
  // path-traversal-ish and near-miss shapes that must not sneak past the regexes
  ['GET','/staffX'], ['GET','/menusuffix'], ['GET','/orders/HH-1'],
  ['GET','/locations/1'], ['GET','/business-hours/extra'],
  ['DELETE','/business-hours'], ['PUT','/business-hours'],
];

let fails = 0;
for (const [m, p] of MUST_ALLOW) {
  if (!managerMayReach(m, p)) { console.log('  FAIL should ALLOW:', m, p); fails++; }
}
for (const [m, p] of MUST_DENY) {
  if (managerMayReach(m, p)) { console.log('  FAIL should DENY :', m, p); fails++; }
}
console.log(`allow cases: ${MUST_ALLOW.length}, deny cases: ${MUST_DENY.length}, failures: ${fails}`);
process.exit(fails ? 1 : 0);
