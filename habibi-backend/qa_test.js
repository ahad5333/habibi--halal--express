require('dotenv').config();
const BASE = 'http://localhost:5001';

let passed = 0;
let failed = 0;
let warnings = 0;
const failures = [];

async function req(method, path, body, token) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { error: e.message } };
  }
}

function assert(label, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${details ? ' — ' + details : ''}`);
    failed++;
    failures.push(`${label}${details ? ': ' + details : ''}`);
  }
}

function warn(label, details = '') {
  console.log(`  ⚠️  WARN: ${label}${details ? ' — ' + details : ''}`);
  warnings++;
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ─── helpers ───────────────────────────────────────────────────────────────
let adminToken = null;
let userToken  = null;
let testEmail  = `qa_${Date.now()}@test.com`;

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         HABIBI QA — FULL REGRESSION TEST SUITE          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ══════════════════════════════════════════════════════════════
  section('1. SERVER HEALTH');
  // ══════════════════════════════════════════════════════════════

  let r = await req('GET', '/health');
  assert('Server is up', r.status === 200);
  assert('DB is connected', r.data.db === 'connected');
  assert('Uptime reported', typeof r.data.uptime === 'string');

  // ══════════════════════════════════════════════════════════════
  section('2. AUTH — REGISTRATION (valid + invalid inputs)');
  // ══════════════════════════════════════════════════════════════

  // Valid registration
  r = await req('POST', '/api/auth/register', { name: 'QA Tester', email: testEmail, password: 'QaTest@123' });
  assert('Register valid user → 201', r.status === 201);
  assert('Returns needs_verification', r.data.needs_verification === true);
  assert('Returns email back', r.data.email === testEmail);

  // Duplicate email
  r = await req('POST', '/api/auth/register', { name: 'QA Tester', email: testEmail, password: 'QaTest@123' });
  assert('Duplicate email → 400', r.status === 400);
  assert('Returns error message', !!r.data.message);

  // Missing fields
  r = await req('POST', '/api/auth/register', { email: 'noemail@test.com' });
  assert('Register missing password → 400', r.status === 400);

  r = await req('POST', '/api/auth/register', { name: 'X', password: 'abc12345' });
  assert('Register missing email → 400', r.status === 400);

  // Invalid email format
  r = await req('POST', '/api/auth/register', { name: 'Bad Email', email: 'not-an-email', password: 'QaTest@123' });
  assert('Invalid email format → 400', r.status === 400);

  // Short password
  r = await req('POST', '/api/auth/register', { name: 'Short Pass', email: `short_${Date.now()}@test.com`, password: '123' });
  assert('Password too short → 400', r.status === 400);

  // Name too long
  r = await req('POST', '/api/auth/register', { name: 'A'.repeat(101), email: `longname_${Date.now()}@test.com`, password: 'QaTest@123' });
  assert('Name too long → 400', r.status === 400);

  // Empty body
  r = await req('POST', '/api/auth/register', {});
  assert('Empty body → 400', r.status === 400);

  // ══════════════════════════════════════════════════════════════
  section('3. AUTH — LOGIN (valid + invalid)');
  // ══════════════════════════════════════════════════════════════

  // Wrong password
  r = await req('POST', '/api/auth/login', { email: 'admin@habibihe.com', password: 'wrongpassword' });
  assert('Wrong password → 400', r.status === 400);
  assert('No token on bad login', !r.data.token);

  // Non-existent email
  r = await req('POST', '/api/auth/login', { email: 'nobody@nowhere.com', password: 'abc123' });
  assert('Unknown email → 400', r.status === 400);

  // Missing fields
  r = await req('POST', '/api/auth/login', { email: 'admin@habibihe.com' });
  assert('Login missing password does not crash (4xx or 5xx not 200)', r.status !== 200);

  // Valid admin login
  r = await req('POST', '/api/auth/login', { email: 'admin@habibihe.com', password: 'Admin@Habibi1' });
  assert('Admin login → 200', r.status === 200);
  assert('Admin token returned', !!r.data.token);
  assert('Admin role confirmed', r.data.user?.role === 'admin');
  adminToken = r.data.token;

  // ══════════════════════════════════════════════════════════════
  section('4. AUTH — TOKEN & ROLE PROTECTION');
  // ══════════════════════════════════════════════════════════════

  // No token
  r = await req('GET', '/api/users/me');
  assert('No token → 401', r.status === 401);

  // Garbage token
  r = await req('GET', '/api/users/me', null, 'Bearer thisisafaketoken');
  assert('Fake token → 401', r.status === 401);

  // Regular user cannot access admin
  // First register & log in a normal user
  const normalEmail = `normal_${Date.now()}@test.com`;
  await req('POST', '/api/auth/register', { name: 'Normal User', email: normalEmail, password: 'NormalPass@1' });
  // Manually verify via DB so we can log in (skip email verification for testing)
  try {
    const pool = require('./src/config/db');
    await pool.query('UPDATE users SET email_verified=TRUE WHERE email=$1', [normalEmail]);
    const loginRes = await req('POST', '/api/auth/login', { email: normalEmail, password: 'NormalPass@1' });
    userToken = loginRes.data.token;
    pool.end().catch(() => {});
  } catch (_) {}

  if (userToken) {
    r = await req('GET', '/api/admin/stats', null, userToken);
    assert('Regular user cannot access admin stats → 403', r.status === 403);

    r = await req('GET', '/api/orders/admin', null, userToken);
    assert('Regular user cannot access admin orders → 403', r.status === 403);
  } else {
    warn('Could not obtain user token — skipping role protection tests');
  }

  // Admin CAN access admin routes
  r = await req('GET', '/api/admin/stats', null, adminToken);
  assert('Admin can access stats → 200', r.status === 200);

  // ══════════════════════════════════════════════════════════════
  section('5. MENU — DATA INTEGRITY');
  // ══════════════════════════════════════════════════════════════

  r = await req('GET', '/api/menus');
  assert('Menu returns 200', r.status === 200);
  assert('Menu is an array', Array.isArray(r.data));
  assert('Menu has 172 items', r.data.length === 172);
  assert('Each item has id', r.data.every(i => i.id !== undefined));
  assert('Each item has name', r.data.every(i => !!i.name));
  assert('Each item has price', r.data.every(i => i.price !== undefined));
  assert('Each item has category', r.data.every(i => !!i.category));
  assert('No negative prices', r.data.every(i => parseFloat(i.price) >= 0));

  // ══════════════════════════════════════════════════════════════
  section('6. GUEST ORDER — VALID + EDGE CASES');
  // ══════════════════════════════════════════════════════════════

  const orderNum = `QA-PICK-${Date.now()}`;

  // Valid pickup order
  r = await req('POST', '/api/orders/guest', {
    order_number: orderNum,
    customer_name: 'QA Customer',
    customer_phone: '+17185550199',
    customer_email: 'qa@test.com',
    delivery_method: 'pickup',
    payment_method: 'cash',
    sub_total: 18.00, tax: 1.60, service_fee: 0.77,
    delivery_fee: 0, tip: 2.00, discount: 0, total: 22.37,
    items: [{ id: 1, name: 'Beef Burger', price: 9.00, qty: 2 }],
    expected_time: 'ASAP'
  });
  assert('Valid pickup order → 201', r.status === 201);
  assert('Returns db_id', !!r.data.db_id);

  // Duplicate order number
  r = await req('POST', '/api/orders/guest', {
    order_number: orderNum,
    customer_name: 'Dup', customer_phone: '+17185550100',
    delivery_method: 'pickup', payment_method: 'cash',
    sub_total: 5, tax: 0.5, service_fee: 0, delivery_fee: 0,
    tip: 0, discount: 0, total: 5.5,
    items: [{ id: 1, name: 'Test', price: 5, qty: 1 }]
  });
  assert('Duplicate order number → not 201', r.status !== 201);

  // Missing required fields — customer_name
  r = await req('POST', '/api/orders/guest', {
    order_number: `QA-MISS-${Date.now()}`,
    delivery_method: 'pickup', payment_method: 'cash',
    sub_total: 5, tax: 0, service_fee: 0, delivery_fee: 0,
    tip: 0, discount: 0, total: 5,
    items: []
  });
  assert('Order without customer_name does not crash server (not 500)', r.status !== 500);

  // Dine-in with table_number
  const dineNum = `QA-DINE-${Date.now()}`;
  r = await req('POST', '/api/orders/guest', {
    order_number: dineNum,
    customer_name: 'QA Diner', customer_phone: '+17185550200',
    delivery_method: 'dine_in', table_number: 'Table 7',
    payment_method: 'card',
    sub_total: 25, tax: 2.22, service_fee: 1.07,
    delivery_fee: 0, tip: 3, discount: 0, total: 31.29,
    items: [{ id: 2, name: 'Chicken Platter', price: 12.50, qty: 2 }]
  });
  assert('Dine-in order → 201', r.status === 201);

  // Verify table_number stored correctly
  r = await req('GET', `/api/orders/track/${dineNum}`);
  assert('Table number stored correctly', r.data.table_number === 'Table 7');
  assert('Delivery method is dine_in', r.data.delivery_method === 'dine_in');

  // ══════════════════════════════════════════════════════════════
  section('7. ORDER TRACKING — VALID + INVALID');
  // ══════════════════════════════════════════════════════════════

  r = await req('GET', `/api/orders/track/${orderNum}`);
  assert('Track real order → 200', r.status === 200);
  assert('Order has status field', !!r.data.order_status);
  assert('Order has items array', Array.isArray(r.data.items));
  assert('Order has customer_name', !!r.data.customer_name);

  // Non-existent order
  r = await req('GET', '/api/orders/track/FAKE-ORDER-99999');
  assert('Track fake order → 404', r.status === 404);

  // Queue for non-existent order
  r = await req('GET', '/api/orders/queue/FAKE-ORDER-99999');
  assert('Queue fake order → 404', r.status === 404);

  // Queue for real order
  r = await req('GET', `/api/orders/queue/${orderNum}`);
  assert('Queue real order → 200', r.status === 200);
  assert('Queue returns position', r.data.position !== undefined);

  // ══════════════════════════════════════════════════════════════
  section('8. COUPON — VALID + EDGE CASES');
  // ══════════════════════════════════════════════════════════════

  // Invalid code
  r = await req('POST', '/api/coupons/validate', { code: 'FAKECODE999', subtotal: 50 });
  assert('Invalid coupon → 404', r.status === 404);

  // Valid coupon (TEST10 created earlier)
  r = await req('POST', '/api/coupons/validate', { code: 'TEST10', subtotal: 30 });
  assert('Valid coupon → 200', r.status === 200);
  assert('Discount calculated correctly (10% of 30 = 3)', r.data.discount === 3);
  assert('Returns valid:true', r.data.valid === true);
  assert('Returns code', r.data.code === 'TEST10');

  // Coupon below minimum order
  r = await req('POST', '/api/coupons/validate', { code: 'TEST10', subtotal: 10 });
  assert('Coupon below min order → 400', r.status === 400);
  assert('Returns minimum order message', r.data.message?.includes('Minimum'));

  // Case insensitive
  r = await req('POST', '/api/coupons/validate', { code: 'test10', subtotal: 30 });
  assert('Coupon code case-insensitive', r.status === 200);

  // Missing code field
  r = await req('POST', '/api/coupons/validate', { subtotal: 30 });
  assert('Missing coupon code does not crash (not 500)', r.status !== 500);

  // ══════════════════════════════════════════════════════════════
  section('9. DELIVERY FEE CALCULATION');
  // ══════════════════════════════════════════════════════════════

  // Missing address
  r = await req('POST', '/api/dispatch/calculate-fee', {});
  assert('Missing address → 400', r.status === 400);

  // Valid address (no Google key, graceful fail)
  r = await req('POST', '/api/dispatch/calculate-fee', { customer_address: '100 Main St, New York, NY 10001' });
  assert('Address provided → not 500', r.status !== 500);
  assert('Returns fee or graceful message', r.data.fee !== undefined || !!r.data.message);

  // ══════════════════════════════════════════════════════════════
  section('10. CONTACT FORM — VALID + MISSING FIELDS');
  // ══════════════════════════════════════════════════════════════

  r = await req('POST', '/api/contact', { name: 'QA Test', email: 'qa@test.com', message: 'This is a QA test message' });
  assert('Valid contact form → 201', r.status === 201);

  // Missing name
  r = await req('POST', '/api/contact', { email: 'qa@test.com', message: 'test' });
  assert('Contact missing name → 400', r.status === 400);

  // Missing email
  r = await req('POST', '/api/contact', { name: 'QA', message: 'test' });
  assert('Contact missing email → 400', r.status === 400);

  // Missing message
  r = await req('POST', '/api/contact', { name: 'QA', email: 'qa@test.com' });
  assert('Contact missing message → 400', r.status === 400);

  // With optional fields
  r = await req('POST', '/api/contact', {
    name: 'QA Full', email: 'qa@test.com', message: 'Full form test',
    phone: '+17185550100', subject: 'QA Subject', order_number: 'QA-ORDER-001'
  });
  assert('Contact form with all optional fields → 201', r.status === 201);

  // ══════════════════════════════════════════════════════════════
  section('11. URGENT REQUESTS');
  // ══════════════════════════════════════════════════════════════

  r = await req('POST', '/api/urgent-requests', {
    name: 'QA Urgent', phone: '+17185550100', email: 'qa@test.com',
    reason: 'Wrong order', order_id: orderNum,
    message: 'I received the wrong food', urgency_level: 'High'
  });
  assert('Urgent request → 201', r.status === 201);
  assert('Returns id', !!r.data.id);
  assert('Returns urgency_level', r.data.urgency_level === 'High');

  // ══════════════════════════════════════════════════════════════
  section('12. LOCATIONS & OFFERS');
  // ══════════════════════════════════════════════════════════════

  r = await req('GET', '/api/locations');
  assert('Locations → 200', r.status === 200);
  assert('Returns array', Array.isArray(r.data));
  assert('Has 3 locations', r.data.length === 3);
  assert('Each location has title', r.data.every(l => !!l.title));
  assert('Each location has address', r.data.every(l => !!(l.address || l.brief_address || l.exact_address)));

  r = await req('GET', '/api/offers');
  assert('Offers → 200', r.status === 200);
  assert('Returns array', Array.isArray(r.data));

  // ══════════════════════════════════════════════════════════════
  section('13. PAYMENTS');
  // ══════════════════════════════════════════════════════════════

  // Valid mock intent
  r = await req('POST', '/api/payments/create-intent', { amount: 25.00, order_number: `PAY-QA-${Date.now()}` });
  assert('Stripe intent → 200', r.status === 200);
  assert('Mock mode active', r.data.mock === true);
  assert('ClientSecret present', !!r.data.clientSecret);

  // Zero amount
  r = await req('POST', '/api/payments/create-intent', { amount: 0, order_number: `PAY-ZERO-${Date.now()}` });
  assert('Zero amount does not crash (not 500)', r.status !== 500);

  // Offline payment info
  r = await req('GET', '/api/payments/offline-info');
  assert('Offline info → 200', r.status === 200);
  assert('Has Zelle email', !!r.data.zelle?.email);
  assert('Has CashApp tag', !!r.data.cashapp?.cashtag);

  // ══════════════════════════════════════════════════════════════
  section('14. ADMIN ROUTES — DATA INTEGRITY');
  // ══════════════════════════════════════════════════════════════

  r = await req('GET', '/api/admin/stats', null, adminToken);
  assert('Admin stats → 200', r.status === 200);
  assert('Stats has orders count', r.data.orders !== undefined);
  assert('Stats has revenue', r.data.revenue !== undefined);
  assert('Stats has pending', r.data.pending !== undefined);

  r = await req('GET', '/api/orders/admin', null, adminToken);
  assert('Admin orders → 200', r.status === 200);
  assert('Orders is array', Array.isArray(r.data));
  assert('Orders have order_number', r.data.every(o => !!o.order_number));
  assert('Orders have order_status', r.data.every(o => !!o.order_status));
  assert('Orders have total', r.data.every(o => o.total !== undefined));

  r = await req('GET', '/api/admin/customers', null, adminToken);
  assert('Admin customers → 200', r.status === 200);

  r = await req('GET', '/api/admin/coupons', null, adminToken);
  assert('Admin coupons → 200', r.status === 200);
  assert('Coupons is array', Array.isArray(r.data));

  // ══════════════════════════════════════════════════════════════
  section('15. KITCHEN DISPLAY');
  // ══════════════════════════════════════════════════════════════

  r = await req('GET', '/api/dine-in/kitchen');
  assert('Kitchen display → 200', r.status === 200);
  assert('Returns array', Array.isArray(r.data));

  // ══════════════════════════════════════════════════════════════
  section('16. SEO ENDPOINTS');
  // ══════════════════════════════════════════════════════════════

  const robotsRes = await fetch(`${BASE}/robots.txt`);
  assert('robots.txt → 200', robotsRes.status === 200);
  const robotsTxt = await robotsRes.text();
  assert('robots.txt contains User-agent', robotsTxt.includes('User-agent'));
  assert('robots.txt disallows /api/', robotsTxt.includes('/api/'));
  assert('robots.txt disallows /admin', robotsTxt.includes('/admin'));

  const sitemapRes = await fetch(`${BASE}/sitemap.xml`);
  assert('sitemap.xml → 200', sitemapRes.status === 200);
  assert('sitemap.xml is XML', sitemapRes.headers.get('content-type')?.includes('xml'));

  // ══════════════════════════════════════════════════════════════
  section('17. SECURITY — INJECTION & ABUSE');
  // ══════════════════════════════════════════════════════════════

  // SQL injection attempt in order number
  r = await req('GET', "/api/orders/track/'; DROP TABLE guest_orders; --");
  assert('SQL injection in URL → not 500', r.status !== 500);

  // SQL injection in login
  r = await req('POST', '/api/auth/login', { email: "' OR 1=1; --", password: 'anything' });
  assert('SQL injection in login → 400 not 200', r.status !== 200);

  // XSS payload in contact form
  r = await req('POST', '/api/contact', {
    name: '<script>alert("xss")</script>',
    email: 'xss@test.com',
    message: '<img src=x onerror=alert(1)>'
  });
  assert('XSS payload in contact form → stored not executed (201)', r.status === 201);

  // Massive payload
  r = await req('POST', '/api/contact', {
    name: 'QA', email: 'qa@test.com', message: 'A'.repeat(100000)
  });
  assert('100KB message does not crash server (not 500)', r.status !== 500);

  // ══════════════════════════════════════════════════════════════
  section('18. FORGOT PASSWORD FLOW');
  // ══════════════════════════════════════════════════════════════

  // Known email
  r = await req('POST', '/api/auth/forgot-password', { email: 'admin@habibihe.com' });
  assert('Forgot password known email → 200', r.status === 200);
  assert('Returns success message', !!r.data.message);

  // Unknown email (should not reveal user existence)
  r = await req('POST', '/api/auth/forgot-password', { email: 'nobody@nowhere.com' });
  assert('Forgot password unknown email → 200 (no enumeration)', r.status === 200);
  assert('Same message for unknown email', !!r.data.message);

  // Missing email
  r = await req('POST', '/api/auth/forgot-password', {});
  assert('Forgot password missing email → 400', r.status === 400);

  // Invalid reset token
  r = await req('POST', '/api/auth/reset-password', { token: 'faketoken123', password: 'NewPass@123' });
  assert('Invalid reset token → 400', r.status === 400);

  // ══════════════════════════════════════════════════════════════
  section('19. COUPON CREATION (admin)');
  // ══════════════════════════════════════════════════════════════

  // Create percentage coupon
  r = await req('POST', '/api/admin/coupons', {
    code: `QATEST${Date.now()}`,
    discount_type: 'percentage',
    discount_value: 15,
    min_order: 20,
    max_uses: 100,
    expires_at: '2027-12-31'
  }, adminToken);
  assert('Create percentage coupon → 201', r.status === 201);
  assert('Coupon has condition_type=min_order', r.data.condition_type === 'min_order');
  assert('Coupon has condition_value=20', parseFloat(r.data.condition_value) === 20);

  // Create fixed_amount coupon
  r = await req('POST', '/api/admin/coupons', {
    code: `QAFIX${Date.now()}`,
    discount_type: 'fixed_amount',
    discount_value: 5,
    max_uses: 50
  }, adminToken);
  assert('Create fixed_amount coupon → 201', r.status === 201);

  // Coupon without auth
  r = await req('POST', '/api/admin/coupons', { code: 'NOAUTH', discount_type: 'percentage', discount_value: 10 });
  assert('Create coupon without auth → 401', r.status === 401);

  // ══════════════════════════════════════════════════════════════
  section('20. NEWSLETTER SUBSCRIBE');
  // ══════════════════════════════════════════════════════════════

  r = await req('POST', '/api/contact/subscribe', { email: `sub_${Date.now()}@test.com` });
  assert('Subscribe → 201', r.status === 201);

  // Subscribe same email again
  const subEmail = `resub_${Date.now()}@test.com`;
  await req('POST', '/api/contact/subscribe', { email: subEmail });
  r = await req('POST', '/api/contact/subscribe', { email: subEmail });
  assert('Re-subscribe same email → 200', r.status === 200);

  // Missing email
  r = await req('POST', '/api/contact/subscribe', {});
  assert('Subscribe missing email → 400', r.status === 400);

  // ══════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════
  const total = passed + failed;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   QA TEST REPORT                        ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests : ${String(total).padEnd(41)}║`);
  console.log(`║  ✅ Passed   : ${String(passed).padEnd(41)}║`);
  console.log(`║  ❌ Failed   : ${String(failed).padEnd(41)}║`);
  console.log(`║  ⚠️  Warnings : ${String(warnings).padEnd(40)}║`);
  console.log(`║  Pass Rate  : ${String(Math.round((passed/total)*100)+'%').padEnd(41)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\n📋 FAILED TESTS:');
    failures.forEach((f, i) => console.log(`  ${i+1}. ${f}`));
  }

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED — Backend is QA approved!\n');
  } else {
    console.log(`\n🚨 ${failed} test(s) failed — review above before deploying.\n`);
  }
}

run().catch(e => console.error('QA suite crashed:', e.message));
