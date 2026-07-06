const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function handle401(res, path) {
  if (res.status === 401) {
    // Don't redirect on the initial session check — AuthContext handles that
    if (path === '/api/auth/me') return;
    localStorage.removeItem('habibi_admin_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) handle401(res, path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function upload(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (res.status === 401) handle401(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

async function uploadPatch(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    body: formData,
    credentials: 'include',
  });
  if (res.status === 401) handle401(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

export const authAPI = {
  login:          (email, password) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyAdminMfa: (email, otp)      => req('/api/auth/admin-mfa/verify', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  me:    () => req('/api/auth/me'),
  save:  () => {}, // token lives in httpOnly cookie — no localStorage storage needed
  clear: () => localStorage.removeItem('habibi_admin_user'),
};

export const adminAPI = {
  stats:       () => req('/api/admin/stats'),
  sidebar:     () => req('/api/admin/sidebar'),

  orders:      () => req('/api/admin/orders'),
  updateOrder: (id, status, cancellation_reason) => req(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(cancellation_reason ? { cancellation_reason } : {}) }) }),

  menus:       () => req('/api/admin/menus'),
  createMenu:  (fd) => upload('/api/admin/menus', fd),
  updateMenu:  (id, fd) => {
    return fetch(`${BASE}/api/admin/menus/${id}`, {
      method: 'PATCH', body: fd,
      credentials: 'include',
    }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || r.status); return d; });
  },
  deleteMenu:  (id) => req(`/api/admin/menus/${id}`, { method: 'DELETE' }),

  // Modifiers (shared choice/addon groups)
  getModifiers:    ()           => req('/api/admin/modifiers'),
  createModifier:  (body)       => req('/api/admin/modifiers',     { method: 'POST',  body: JSON.stringify(body) }),
  updateModifier:  (id, body)   => req(`/api/admin/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteModifier:  (id, type)   => req(`/api/admin/modifiers/${id}?type=${type}`, { method: 'DELETE' }),

  customers:   (search = '', page = 1, limit = 50) => req(`/api/admin/customers?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
  customer:    (id) => req(`/api/admin/customers/${id}`),
  integrationStatus: () => req('/api/admin/integration-status'),

  coupons:     () => req('/api/admin/coupons'),
  createCoupon:(body) => req('/api/admin/coupons', { method: 'POST', body: JSON.stringify(body) }),
  updateCoupon:(id, body) => req(`/api/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleCoupon:(id) => req(`/api/admin/coupons/${id}/toggle`, { method: 'PUT' }),
  deleteCoupon:(id) => req(`/api/admin/coupons/${id}`, { method: 'DELETE' }),

  partners:    () => req('/api/admin/partners/applications'),
  updatePartner:(id, status, note, price_tier, payment_methods, credit_balance) =>
    req(`/api/admin/partners/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status, notes: note, price_tier, payment_methods, credit_balance }) }),

  urgent:      () => req('/api/urgent-requests'),

  revenue:     () => req('/api/admin/analytics/revenue'),
  growth:      () => req('/api/admin/analytics/growth'),

  tiers:       () => req('/api/admin/delivery-tiers'),
  updateTier:  (id, body) => req(`/api/admin/delivery-tiers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  paymentSettings:       () => req('/api/admin/payment-settings'),
  updatePaymentSetting:  (id, is_active) => req(`/api/admin/payment-settings/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  payments:    () => req('/api/admin/payments'),
  refundOrder: (orderNumber) => req(`/api/admin/payments/${orderNumber}/refund`, { method: 'POST' }),

  // Coupon stats
  couponStats: () => req('/api/admin/coupon-stats'),

  // Locations
  getLocations:   () => req('/api/admin/locations'),
  updateLocation: (id, body) => req(`/api/admin/locations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleLocation: (id, field) => req(`/api/admin/locations/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ field }) }),

  // Menu availability
  toggleMenuAvailability: (body) => req('/api/admin/menus/availability', { method: 'PATCH', body: JSON.stringify(body) }),
  getLocationMenuAvailability: (location_id) => req(`/api/admin/menus/location-availability?location_id=${location_id}`),
  setLocationMenuAvailability: (body) => req('/api/admin/menus/location-availability', { method: 'POST', body: JSON.stringify(body) }),

  // Staff
  getStaff:    () => req('/api/admin/staff'),
  createStaff: (body) => req('/api/admin/staff', { method: 'POST', body: JSON.stringify(body) }),
  updateStaff: (id, body) => req(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStaff: (id) => req(`/api/admin/staff/${id}`, { method: 'DELETE' }),

  // Inventory
  getInventory:       () => req('/api/admin/inventory'),
  createInventoryItem:(body) => req('/api/admin/inventory', { method: 'POST', body: JSON.stringify(body) }),
  updateInventoryItem:(id, body) => req(`/api/admin/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInventoryItem:(id) => req(`/api/admin/inventory/${id}`, { method: 'DELETE' }),
  restockItem:        (id, body) => req(`/api/admin/inventory/${id}/restock`, { method: 'POST', body: JSON.stringify(body) }),
  getRestockLog:      () => req('/api/admin/inventory/restock-log'),

  // Delivery Zones
  getZones:    () => req('/api/admin/zones'),
  createZone:  (body) => req('/api/admin/zones', { method: 'POST', body: JSON.stringify(body) }),
  updateZone:  (id, body) => req(`/api/admin/zones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteZone:  (id) => req(`/api/admin/zones/${id}`, { method: 'DELETE' }),

  // Broadcasts
  getBroadcasts:   () => req('/api/admin/broadcasts'),
  sendBroadcast:   (body) => req('/api/admin/broadcasts', { method: 'POST', body: JSON.stringify(body) }),
  deleteBroadcast: (id) => req(`/api/admin/broadcasts/${id}`, { method: 'DELETE' }),

  // Audit log
  getAuditLog: (params = '') => req(`/api/admin/audit-log${params}`),

  // Authorize.net merchant accounts
  listAuthNetAccounts:    () => req('/api/admin/authnet/accounts'),
  createAuthNetAccount:   (body) => req('/api/admin/authnet/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAuthNetAccount:   (id, body) => req(`/api/admin/authnet/accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAuthNetAccount:   (id) => req(`/api/admin/authnet/accounts/${id}`, { method: 'DELETE' }),
  activateAuthNetAccount: (id) => req(`/api/admin/authnet/accounts/${id}/activate`, { method: 'POST' }),

  // Reports
  reportRevenue:      (qs = '') => req(`/api/admin/reports/revenue${qs}`),
  reportTransactions: (qs = '') => req(`/api/admin/reports/transactions${qs}`),
  reportByCategory:   (qs = '') => req(`/api/admin/reports/by-category${qs}`),
  reportByLocation:   (qs = '') => req(`/api/admin/reports/by-location${qs}`),
  reportTax:          (qs = '') => req(`/api/admin/reports/tax${qs}`),
  reportCouponUsage:  (qs = '') => req(`/api/admin/reports/coupon-usage${qs}`),

  // Platform Integrations (Milestone 2)
  getPlatformSettings:    () => req('/api/admin/integrations'),
  updatePlatformSettings: (platform, body) => req(`/api/admin/integrations/${platform}`, { method: 'PATCH', body: JSON.stringify(body) }),
  triggerCatalogSync:     (body = {}) => req('/api/admin/integrations/sync', { method: 'POST', body: JSON.stringify(body) }),

  // Platform Credentials & Location Mappings
  getCredentials:          () => req('/api/admin/credentials'),
  updateCredentials:       (platform, credentials) => req(`/api/admin/credentials/${platform}`, { method: 'PATCH', body: JSON.stringify({ credentials }) }),
  getLocationMappings:     () => req('/api/admin/location-mappings'),
  upsertLocationMapping:   (body) => req('/api/admin/location-mappings', { method: 'POST', body: JSON.stringify(body) }),
  triggerMenuSync:         (body) => req('/api/admin/menu-sync', { method: 'POST', body: JSON.stringify(body) }),
  getMenuPreview:          (platform) => req(`/api/admin/menu-preview/${platform}`),

  // DoorDash Drive
  getDoorDashDeliveries:   ()       => req('/api/doordash/'),
  createDoorDashDelivery:  (orderId) => req(`/api/doordash/orders/${orderId}`, { method: 'POST' }),
  cancelDoorDashDelivery:  (ddId)   => req(`/api/doordash/${ddId}/cancel`, { method: 'PUT' }),

  // Marketplace (UberEats / GrubHub / Caviar)
  getMarketplaceOrders:    (qs = '')     => req(`/api/marketplace/${qs}`),
  getMarketplaceStats:     ()            => req('/api/marketplace/stats'),
  updateMarketplaceOrder:  (id, body)    => req(`/api/marketplace/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getMarketplaceLocationMappings: ()     => req('/api/marketplace/location-mappings'),
  saveMarketplaceLocationMapping: (body) => req('/api/marketplace/location-mappings', { method: 'POST', body: JSON.stringify(body) }),

  // Roadie long-distance
  getRoadieShipments:     ()         => req('/api/roadie/'),
  getRoadieEstimate:      (addr)     => req('/api/roadie/estimate', { method: 'POST', body: JSON.stringify({ dropoff_address: addr }) }),
  cancelRoadieShipment:   (shipId)   => req(`/api/roadie/${shipId}/cancel`, { method: 'DELETE' }),

  // In-house dispatch
  getAssignments:         () => req('/api/dispatch/assignments'),
  getScheduledOrders:     () => req('/api/dispatch/scheduled'),
  getDeliveryDrivers:     () => req('/api/dispatch/drivers'),
  assignDriver:           (body) => req('/api/dispatch/assign', { method: 'POST', body: JSON.stringify(body) }),
  updateAssignmentStatus: (id, status) => req(`/api/dispatch/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Driver view (no admin auth — driver-facing)
  getDriverAssignment: (driverId) => req(`/api/dispatch/driver/${driverId}`),
  updateDriverGPS: (assignmentId, gpsData) => req(`/api/dispatch/assignments/${assignmentId}/gps`, { method: 'PATCH', body: JSON.stringify(gpsData) }),

  // Delivery fee calculator
  calculateDeliveryFee: (customer_address, location_id) =>
    req('/api/dispatch/calculate-fee', { method: 'POST', body: JSON.stringify({ customer_address, location_id }) }),

  // COD cash accountability
  getCashReport:    (date) => req(`/api/dispatch/cash-report${date ? `?date=${date}` : ''}`),
  recordCashHandin: (body) => req('/api/dispatch/cash-handins', { method: 'POST', body: JSON.stringify(body) }),

  // Offline payment handles (Zelle / Cash App)
  getOfflineHandles:    ()     => req('/api/admin/payment-settings/offline-handles'),
  updateOfflineHandles: (body) => req('/api/admin/payment-settings/offline-handles', { method: 'PATCH', body: JSON.stringify(body) }),

  // Wholesale / Business Menu catalog
  getBusinessMenus:    () => req('/api/admin/business-menus'),
  createBusinessMenu:  (fd) => upload('/api/admin/business-menus', fd),
  updateBusinessMenu:  (id, fd) => uploadPatch(`/api/admin/business-menus/${id}`, fd),
  deleteBusinessMenu:  (id) => req(`/api/admin/business-menus/${id}`, { method: 'DELETE' }),

  // Partner orders (B2B)
  getPartnerOrders:           () => req('/api/admin/partner-orders'),
  updatePartnerOrderStatus:   (id, status) => req(`/api/admin/partner-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Careers
  getCareersVacancies:        () => req('/api/admin/careers/vacancies'),
  createVacancy:              (body) => req('/api/admin/careers/vacancies', { method: 'POST', body: JSON.stringify(body) }),
  updateVacancy:              (id, body) => req(`/api/admin/careers/vacancies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVacancy:              (id) => req(`/api/admin/careers/vacancies/${id}`, { method: 'DELETE' }),
  getCareersApplications:     (status = '') => req(`/api/admin/careers/applications${status ? `?status=${status}` : ''}`),
  updateApplicationStatus:    (id, status, notes) => req(`/api/admin/careers/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),

  // Reviews
  getReviews:    (status = '') => req(`/api/admin/reviews${status ? `?status=${status}` : ''}`),
  updateReview:  (id, body)   => req(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteReview:  (id)         => req(`/api/admin/reviews/${id}`, { method: 'DELETE' }),

  // Global Add-ons
  getGlobalAddons:   ()          => req('/api/admin/global-addons'),
  updateGlobalAddon: (id, body)  => req(`/api/admin/global-addons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Business Hours
  getBusinessHours:  (locationId) => req(`/api/admin/business-hours?location_id=${locationId}`),
  saveBusinessHours: (body)        => req('/api/admin/business-hours', { method: 'PUT', body: JSON.stringify(body) }),
};

export const chatAPI = {
  getConversations: ()                    => req('/api/admin/chat'),
  getMessages:      (orderNumber)         => req(`/api/admin/chat/${orderNumber}`),
  sendMessage:      (orderNumber, text)   => req(`/api/admin/chat/${orderNumber}`, { method: 'POST', body: JSON.stringify({ text }) }),
};

export const loyaltyAPI = {
  getStats:      ()                              => req('/api/admin/loyalty/stats'),
  getCustomers:  (search = '', limit = 50)       => req(`/api/admin/loyalty/customers?search=${encodeURIComponent(search)}&limit=${limit}`),
  adjustPoints:  (userId, points, reason = '')   => req('/api/admin/loyalty/adjust', { method: 'POST', body: JSON.stringify({ user_id: userId, points, reason }) }),
  getConfig:     ()                              => req('/api/admin/loyalty/config'),
  updateConfig:  (earn_rate, redeem_rate)        => req('/api/admin/loyalty/config', { method: 'PUT', body: JSON.stringify({ earn_rate, redeem_rate }) }),
};
