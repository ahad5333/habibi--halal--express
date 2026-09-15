// Run with: node tests/serving-location.test.js
// The owner's store-routing rules: carries every item -> nearest -> lowest
// preference number. Pure functions, no DB, no network.
const { rankLocations, cartMenuIds } = require('../src/utils/servingLocation');

const OPEN = () => true;
const store = (id, lat, lng, pref, extra = {}) => ({
  id, title: `Store ${id}`, latitude: lat, longitude: lng, preference_level: pref, accepting_orders: true, ...extra,
});
// Customer near Kingsbridge in the Bronx. Store 1 ~0.4 mi, store 2 ~1.4 mi, store 3 ~3.4 mi.
const CUSTOMER = { lat: 40.8680, lng: -73.8970 };
const S1 = store(1, 40.8730, -73.8930, 3);
const S2 = store(2, 40.8880, -73.8980, 1);
const S3 = store(3, 40.8450, -73.9300, 2);
const order = (r) => r.locations.map((l) => l.id).join(',');

let fails = 0;
const check = (label, pass, detail = '') => {
  if (!pass) { fails++; console.log(`  FAIL ${label}${detail ? '  -- ' + detail : ''}`); }
};

{
  const r = rankLocations([S2, S3, S1], [], { ...CUSTOMER, isOpen: OPEN });
  check('nearest store is recommended when all carry the items', r.recommended_id === 1, JSON.stringify(r.locations.map((l) => [l.id, l.distance_miles])));
  check('stores listed nearest first', order(r) === '1,2,3', order(r));
  check('distance reported in miles', r.locations[0].distance_miles > 0 && r.locations[0].distance_miles < 1, String(r.locations[0].distance_miles));
}
{
  const blocked = [{ location_id: 1, menu_id: 7, name: 'Lamb Over Rice', status: 'sold_out' }];
  const r = rankLocations([S1, S2, S3], blocked, { ...CUSTOMER, isOpen: OPEN });
  check('a store missing an item is never recommended, even if nearest', r.recommended_id === 2, String(r.recommended_id));
  const s1 = r.locations.find((l) => l.id === 1);
  check('the missing item is named', s1.can_serve === false && s1.missing_items[0].name === 'Lamb Over Rice');
  check('stores that can serve come before ones that cannot', order(r) === '2,3,1', order(r));
}
{
  const blocked = [{ location_id: 2, menu_id: 7, name: 'X', status: 'inactive' }];
  const r = rankLocations([S1, S2], [{ location_id: 1, menu_id: 7, name: 'X', status: 'sold_out' }, ...blocked], { ...CUSTOMER, isOpen: OPEN });
  check('inactive counts as missing too; nobody can serve -> no recommendation', r.recommended_id === null, String(r.recommended_id));
}
{
  const twinA = store(10, 40.873092, -73.8892829, 5);
  const twinB = store(11, 40.873092, -73.8892829, 2);
  const r = rankLocations([twinA, twinB], [], { ...CUSTOMER, isOpen: OPEN });
  check('same distance -> lower preference number wins', r.recommended_id === 11, String(r.recommended_id));
}
{
  const r = rankLocations([S1, S2, S3], [], { isOpen: OPEN });
  check('no customer location -> preference order', order(r) === '2,3,1' && r.recommended_id === 2, order(r));
  check('no customer location -> no distance shown', r.locations.every((l) => l.distance_miles === null));
}
{
  const paused = store(1, 40.8730, -73.8930, 3, { accepting_orders: false });
  const r = rankLocations([paused, S2], [], { ...CUSTOMER, isOpen: OPEN });
  check('a store not taking online orders is not recommended', r.recommended_id === 2, String(r.recommended_id));
}
{
  const closedNearest = { ...S1, working_days_hours: 'closed' };
  const isOpen = (hours) => (hours === 'closed' ? false : true);
  const r = rankLocations([closedNearest, S2], [], { ...CUSTOMER, isOpen });
  check('an open store beats a nearer closed one', r.recommended_id === 2, String(r.recommended_id));
  const onlyClosed = rankLocations([closedNearest], [], { ...CUSTOMER, isOpen });
  check('a closed store is still recommended when it is the only one that can serve', onlyClosed.recommended_id === 1);
}
{
  const unknownHours = (h) => (h === undefined ? null : true);
  const r = rankLocations([S1, S2], [], { ...CUSTOMER, isOpen: unknownHours });
  check('unreadable hours do not count as closed', r.recommended_id === 1, String(r.recommended_id));
}
{
  // A browser in India: thousands of miles from every store.
  const r = rankLocations([S1, S2, S3], [], { lat: 17.385, lng: 78.4867, isOpen: OPEN });
  check('customer beyond 350 miles -> preference order, as if unknown', order(r) === '2,3,1' && r.recommended_id === 2, order(r));
  check('customer beyond 350 miles -> no distances shown', r.locations.every((l) => l.distance_miles === null));
  const philly = rankLocations([S1, S2, S3], [], { lat: 39.9526, lng: -75.1652, isOpen: OPEN });
  check('customer within 350 miles still ranks by distance', philly.locations.every((l) => l.distance_miles > 50 && l.distance_miles < 350));
}
{
  const noCoords = store(4, null, null, 0);
  const r = rankLocations([noCoords, S3], [], { ...CUSTOMER, isOpen: OPEN });
  check('a store without coordinates sorts after stores with a distance', order(r) === '3,4', order(r));
}
{
  const ids = cartMenuIds([
    { id: 12, qty: 1 },
    { menu_id: 15, qty: 2 },
    { id: 12, qty: 3 },
    { id: 'custom-abc', customCfg: { extras: { 40: 1 }, drinks: { 41: 2 } } },
    { id: 'custom-def' },
    null, 'junk', 0, -3, 99,
  ]).sort((a, b) => a - b);
  check('cart ids: regular items, bundled sides/drinks, deduped, junk ignored', ids.join(',') === '12,15,40,41,99', ids.join(','));
}

console.log(`serving-location checks done, failures: ${fails}`);
process.exit(fails ? 1 : 0);
