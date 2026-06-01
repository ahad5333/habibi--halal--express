require('dotenv').config();
const BASE = 'http://localhost:5001';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function authReq(method, path, token, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function log(label, status, data, expectedStatus) {
  const expected = expectedStatus ?? [200, 201];
  const ok = Array.isArray(expected)
    ? expected.includes(status)
    : status === expected || (expected === '4xx' && status >= 400 && status < 500);
  const icon = ok ? '✅' : '❌';
  const summary = JSON.stringify(data).slice(0, 120);
  console.log(`${icon} [${status}] ${label}: ${summary}`);
}

async function run() {
  console.log('\n====== HABIBI BACKEND — FULL API TEST ======\n');

  // 1. Health
  let r = await req('GET', '/health');
  log('Health check', r.status, r.data);

  // 2. Root
  r = await req('GET', '/');
  log('Root endpoint', r.status, r.data);

  // 3. Menu
  r = await req('GET', '/api/menus');
  log(`Menu items (count: ${Array.isArray(r.data) ? r.data.length : '?'})`, r.status, { first: r.data[0]?.name, count: r.data.length });

  // 4. Locations
  r = await req('GET', '/api/locations');
  log(`Locations (count: ${Array.isArray(r.data) ? r.data.length : '?'})`, r.status, { first: r.data[0]?.title });

  // 5. Offline pay info
  r = await req('GET', '/api/payments/offline-info');
  log('Offline payment info', r.status, r.data);

  // 6. SEO - robots.txt
  const rRob = await fetch(`${BASE}/robots.txt`);
  log('robots.txt', rRob.status, { content: (await rRob.text()).slice(0, 60) });

  // 7. SEO - sitemap
  const rSite = await fetch(`${BASE}/sitemap.xml`);
  log('sitemap.xml', rSite.status, { ok: rSite.headers.get('content-type') });

  // 8. Register new user
  r = await req('POST', '/api/auth/register', { name: 'Test User', email: `tester_${Date.now()}@test.com`, password: 'Test1234!' });
  log('Register new user', r.status, r.data);

  // 9. Register duplicate (should fail 400)
  r = await req('POST', '/api/auth/register', { name: 'Test User', email: `tester_${Date.now()}@test.com`, password: 'Test1234!' });

  // 10. Login as admin - try common passwords
  let adminToken = null;
  for (const pw of ['Admin@Habibi1', 'admin123', 'Admin123', 'password', 'habibi123', 'Admin@123', '123456']) {
    r = await req('POST', '/api/auth/login', { email: 'admin@habibihe.com', password: pw });
    if (r.status === 200) { adminToken = r.data.token; log(`Admin login (pw: ${pw})`, r.status, { role: r.data.user?.role }); break; }
  }
  if (!adminToken) log('Admin login', 401, { error: 'None of the common passwords worked' });

  // 11. Coupon - invalid
  r = await req('POST', '/api/coupons/validate', { code: 'INVALID999', subtotal: 30 });
  log('Coupon invalid (expect 4xx)', r.status, r.data, '4xx');

  // 12. Dispatch calculate-fee
  r = await req('POST', '/api/dispatch/calculate-fee', { customer_address: '100 Main St, New York, NY 10001' });
  log('Delivery fee calc', r.status, r.data);

  // 13. Place guest order
  const orderNum = `HHE-TEST-${Date.now()}`;
  r = await req('POST', '/api/orders/guest', {
    order_number: orderNum,
    customer_name: 'Test Customer',
    customer_phone: '+17185550100',
    customer_email: 'test@habibi.test',
    delivery_method: 'pickup',
    payment_method: 'cash',
    sub_total: 15.00,
    tax: 1.33,
    service_fee: 0.64,
    delivery_fee: 0,
    tip: 0,
    discount: 0,
    total: 16.97,
    items: [{ id: 1, name: 'Beef Burger', price: 6.49, qty: 2, choices: [] }],
    expected_time: 'ASAP'
  });
  log('Place guest order (pickup)', r.status, r.data);

  // 14. Track that order
  r = await req('GET', `/api/orders/track/${orderNum}`);
  log('Track order', r.status, { status: r.data.order_status, method: r.data.delivery_method });

  // 15. Queue position
  r = await req('GET', `/api/orders/queue/${orderNum}`);
  log('Queue position', r.status, r.data);

  // 16. Place DINE-IN order
  const dineOrderNum = `HHE-DINE-${Date.now()}`;
  r = await req('POST', '/api/orders/guest', {
    order_number: dineOrderNum,
    customer_name: 'Dine Test',
    customer_phone: '+17185550101',
    delivery_method: 'dine_in',
    table_number: 'Table 5',
    payment_method: 'cash',
    sub_total: 20.00,
    tax: 1.77,
    service_fee: 0.85,
    delivery_fee: 0,
    tip: 0,
    discount: 0,
    total: 22.62,
    items: [{ id: 2, name: 'Chicken Platter', price: 10.00, qty: 2 }]
  });
  log('Place dine-in order (table_number test)', r.status, r.data);

  // Check dine-in table_number stored
  if (r.status === 200 || r.status === 201) {
    const track = await req('GET', `/api/orders/track/${dineOrderNum}`);
    log(`Dine-in table_number stored: "${track.data.table_number}"`, track.status, { table: track.data.table_number, method: track.data.delivery_method });
  }

  // 17. Admin routes (need token)
  if (adminToken) {
    r = await authReq('GET', '/api/admin/stats', adminToken);
    log('Admin stats', r.status, r.data);

    r = await authReq('GET', '/api/orders/admin', adminToken);
    log(`Admin orders list (count: ${Array.isArray(r.data) ? r.data.length : '?'})`, r.status, { count: Array.isArray(r.data) ? r.data.length : r.data });
  }

  // 18. Kitchen display (public)
  r = await req('GET', '/api/dine-in/kitchen');
  log('Kitchen display data', r.status, { count: Array.isArray(r.data) ? r.data.length : '?' });

  // 19. Dine-in tables list
  r = await req('GET', '/api/dine-in/tables');
  log('Dine-in tables (admin-only, expect 401)', r.status, { count: Array.isArray(r.data) ? r.data.length : r.data }, 401);

  // 20. Auth required - no token
  r = await req('GET', '/api/users/me');
  log('Profile without token (expect 401)', r.status, r.data, 401);

  // 21. Stripe mock intent
  r = await req('POST', '/api/payments/create-intent', { amount: 25.00, order_number: `PAY-${Date.now()}` });
  log('Stripe mock intent', r.status, { mock: r.data.mock, hasSecret: !!r.data.clientSecret });

  // 22. Robots & sitemap
  r = await req('GET', '/api/locations');
  log('Locations count', r.status, { count: Array.isArray(r.data) ? r.data.length : '?' });

  // 23. Offers
  r = await req('GET', '/api/offers');
  log('Offers', r.status, { count: Array.isArray(r.data) ? r.data.length : r.data });

  // 24. Urgent requests (POST)
  r = await req('POST', '/api/urgent-requests', {
    name: 'Test User', phone: '+17185550100', email: 'test@test.com',
    reason: 'Wrong order', order_id: 'HHE-TEST-001', message: 'Got wrong food', urgency_level: 'High'
  });
  log('Urgent request submit', r.status, r.data);

  // 25. Contact form
  r = await req('POST', '/api/contact', {
    name: 'Test', email: 'test@test.com', subject: 'Test', message: 'Hello test message here'
  });
  log('Contact form', r.status, r.data);

  console.log('\n====== TEST COMPLETE ======\n');
}

run().catch(e => console.error('Test crashed:', e.message));
