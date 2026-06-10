// Full system test — run with: node test_full.js
const BASE = 'http://localhost:5001';

let passed = 0, failed = 0;
const pass = (label) => { passed++; console.log(`  ✅ PASS  ${label}`); };
const fail = (label, msg) => { failed++; console.log(`  ❌ FAIL  ${label} — ${msg}`); };

async function req(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

async function run() {
  let userToken, adminToken, cartItemId;
  const testEmail = `test_${Date.now()}@test.com`;
  let menuItem;

  console.log('\n══════════════════════════════════════════════');
  console.log('  HABIBI HALAL EXPRESS — FULL SYSTEM TEST');
  console.log('══════════════════════════════════════════════\n');

  // ── HEALTH ─────────────────────────────────────────────
  console.log('[ HEALTH ]');
  {
    const r = await req('GET', '/health');
    r.status === 200 && r.data.status === 'ok' ? pass(`Health — DB: ${r.data.db}`) : fail('Health', JSON.stringify(r.data));
  }

  // ── PUBLIC MENU & LOCATIONS ─────────────────────────────
  console.log('\n[ PUBLIC ENDPOINTS ]');
  {
    const r = await req('GET', '/api/menus');
    if (r.status === 200 && Array.isArray(r.data) && r.data.length > 0) {
      menuItem = r.data[0];
      pass(`GET /api/menus → ${r.data.length} items`);
    } else fail('GET /api/menus', `${r.status}`);
  }
  {
    const r = await req('GET', '/api/locations');
    r.status === 200 ? pass('GET /api/locations') : fail('GET /api/locations', `${r.status}`);
  }
  {
    const r = await req('GET', '/api/coupons/validate?code=WELCOME10');
    r.status === 200 || r.status === 404 ? pass(`GET /api/coupons/validate → ${r.status}`) : fail('Coupon validate', `${r.status}`);
  }

  // ── AUTH ────────────────────────────────────────────────
  console.log('\n[ AUTH ]');
  {
    const r = await req('POST', '/api/auth/register', { name: 'Test User', email: testEmail, password: 'Test1234!' });
    r.status === 201 ? pass('POST /api/auth/register') : fail('Register', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('POST', '/api/auth/login', { email: testEmail, password: 'Test1234!' });
    if (r.status === 200 && r.data.token) { userToken = r.data.token; pass('POST /api/auth/login → token'); }
    else fail('Login', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/users/me', null, userToken);
    r.status === 200 ? pass('GET /api/users/me (profile)') : fail('GET /api/users/me', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── ADMIN AUTH ──────────────────────────────────────────
  console.log('\n[ ADMIN AUTH ]');
  {
    const r = await req('POST', '/api/auth/login', { email: 'admin@habibihe.com', password: 'Admin@Habibi1' });
    if (r.status === 200 && r.data.token) { adminToken = r.data.token; pass('Admin login (admin@habibihe.com)'); }
    else fail('Admin login', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── CART ────────────────────────────────────────────────
  console.log('\n[ CART ]');
  {
    const r = await req('POST', '/api/cart/add', { menu_id: menuItem.id, quantity: 2 }, userToken);
    r.status === 200 ? pass('POST /api/cart/add') : fail('Add to cart', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/cart', null, userToken);
    if (r.status === 200 && Array.isArray(r.data.items) && r.data.items.length > 0) {
      cartItemId = r.data.items[0].cart_item_id;
      pass(`GET /api/cart → ${r.data.items.length} item(s)`);
    } else fail('GET /api/cart', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('PUT', `/api/cart/update/${cartItemId}`, { quantity: 3 }, userToken);
    r.status === 200 ? pass(`PUT /api/cart/update/${cartItemId}`) : fail('Update cart qty', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('POST', '/api/cart/sync', { items: [{ menu_id: menuItem.id, quantity: 1 }] }, userToken);
    r.status === 200 ? pass('POST /api/cart/sync') : fail('Sync cart', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('DELETE', `/api/cart/remove/${cartItemId}`, null, userToken);
    r.status === 200 || r.status === 404 ? pass(`DELETE /api/cart/remove/${cartItemId}`) : fail('Remove cart item', `${r.status}`);
  }

  // ── ORDERS (Guest checkout — real frontend flow) ─────────
  console.log('\n[ ORDERS ]');
  const itemPrice = parseFloat(menuItem.price);
  const subTotal = itemPrice * 1;
  const tax = parseFloat((subTotal * 0.08875).toFixed(2));
  const svcFee = 0.50;
  const delFee = 3.99;
  const total = parseFloat((subTotal + tax + svcFee + delFee).toFixed(2));
  {
    const r = await req('POST', '/api/orders/guest', {
      order_number:    `TEST-${Date.now()}`,
      customer_name:   'Test User',
      customer_email:  testEmail,
      customer_phone:  '07700900000',
      delivery_method: 'delivery',
      delivery_address:'123 Test Street',
      delivery_city:   'Manchester',
      delivery_state:  'Greater Manchester',
      delivery_zip:    'M1 1AA',
      payment_method:  'card',
      sub_total:       subTotal,
      tax:             tax,
      service_fee:     svcFee,
      delivery_fee:    delFee,
      tip:             0,
      discount:        0,
      total:           total,
      items: [{
        id:         menuItem.id,
        name:       menuItem.name,
        price:      itemPrice,
        unit_price: itemPrice,
        qty:        1,
        quantity:   1,
      }],
    });
    if (r.status === 201) {
      pass(`POST /api/orders/guest → order #${r.data.order_number || r.data.id}`);
    } else fail('Place guest order', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/orders/', null, userToken);
    r.status === 200 && Array.isArray(r.data) ? pass(`GET /api/orders → ${r.data.length} guest order(s) for this email`) : fail('GET /api/orders', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── RESERVATIONS ────────────────────────────────────────
  console.log('\n[ RESERVATIONS ]');
  {
    const r = await req('POST', '/api/reservations/table', {
      name:     'Ahmed Khan',
      contact:  '07700900000',
      location: 'Manchester',
      date:     '2026-07-15',
      time:     '19:00',
      party:    4,
      notes:    'Birthday dinner',
    });
    r.status === 201 ? pass(`POST /api/reservations/table → id=${r.data.id}`) : fail('Book table', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('POST', '/api/reservations/public', {
      full_name:   'Fatima Ali',
      email:       'fatima@test.com',
      phone:       '07700900001',
      event_type:  'Wedding',
      event_date:  '2026-08-20',
      guest_count: 100,
      service_type:'full_service',
      notes:       'Halal only',
    });
    r.status === 201 ? pass(`POST /api/reservations/public → catering inquiry`) : fail('Catering inquiry', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── ADMIN ENDPOINTS ─────────────────────────────────────
  console.log('\n[ ADMIN ]');
  {
    const r = await req('GET', '/api/admin/orders', null, adminToken);
    r.status === 200 ? pass(`GET /api/admin/orders → ${Array.isArray(r.data) ? r.data.length : '?'} orders`) : fail('Admin orders', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/admin/stats', null, adminToken);
    r.status === 200 ? pass('GET /api/admin/stats') : fail('Admin stats', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/coupons', null, adminToken);
    r.status === 200 ? pass(`GET /api/coupons → ${Array.isArray(r.data) ? r.data.length : '?'} coupons`) : fail('Admin coupons', `${r.status}`);
  }
  {
    const r = await req('GET', '/api/locations', null, adminToken);
    r.status === 200 ? pass('GET /api/locations (admin)') : fail('Admin locations', `${r.status}`);
  }
  {
    const r = await req('GET', '/api/reservations/admin', null, adminToken);
    r.status === 200 && Array.isArray(r.data) ? pass(`GET /api/reservations/admin → ${r.data.length} record(s)`) : fail('Admin all reservations', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/reservations/admin?type=table', null, adminToken);
    r.status === 200 && Array.isArray(r.data) ? pass(`GET /api/reservations/admin?type=table → ${r.data.length} table booking(s)`) : fail('Admin table reservations', `${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await req('GET', '/api/admin/customers', null, adminToken);
    r.status === 200 ? pass(`GET /api/admin/customers`) : fail('Admin customers', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── CART CLEANUP ────────────────────────────────────────
  console.log('\n[ CLEANUP ]');
  {
    const r = await req('DELETE', '/api/cart/clear', null, userToken);
    r.status === 200 ? pass('DELETE /api/cart/clear') : fail('Clear cart', `${r.status} ${JSON.stringify(r.data)}`);
  }

  // ── SUMMARY ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('  🎉 ALL TESTS PASSED');
  else console.log('  ⚠  SOME TESTS FAILED — see ❌ above');
  console.log('══════════════════════════════════════════════\n');
}

run().catch(e => console.error('Fatal:', e.message));
