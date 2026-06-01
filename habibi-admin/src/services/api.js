const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function token() { return localStorage.getItem('habibi_admin_token'); }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

async function upload(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

async function uploadPatch(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    body: formData,
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

export const authAPI = {
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  save: (t) => localStorage.setItem('habibi_admin_token', t),
  clear: () => localStorage.removeItem('habibi_admin_token'),
};

export const adminAPI = {
  stats:       () => req('/api/admin/stats'),
  sidebar:     () => req('/api/admin/sidebar'),

  orders:      () => req('/api/admin/orders'),
  updateOrder: (id, status) => req(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  menus:       () => req('/api/admin/menus'),
  createMenu:  (fd) => upload('/api/admin/menus', fd),
  updateMenu:  (id, fd) => {
    return fetch(`${BASE}/api/admin/menus/${id}`, {
      method: 'PATCH', body: fd,
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || r.status); return d; });
  },
  deleteMenu:  (id) => req(`/api/admin/menus/${id}`, { method: 'DELETE' }),

  customers:   () => req('/api/admin/customers'),
  customer:    (id) => req(`/api/admin/customers/${id}`),

  coupons:     () => req('/api/admin/coupons'),
  createCoupon:(body) => req('/api/admin/coupons', { method: 'POST', body: JSON.stringify(body) }),
  toggleCoupon:(id) => req(`/api/admin/coupons/${id}/toggle`, { method: 'PUT' }),
  deleteCoupon:(id) => req(`/api/admin/coupons/${id}`, { method: 'DELETE' }),

  partners:    () => req('/api/admin/partners/applications'),
  updatePartner:(id, status, note) => req(`/api/admin/partners/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),

  urgent:      () => req('/api/urgent-requests'),

  revenue:     () => req('/api/admin/analytics/revenue'),
  growth:      () => req('/api/admin/analytics/growth'),
  reportTx:    () => req('/api/admin/reports/transactions'),
  reportRev:   () => req('/api/admin/reports/revenue'),

  tiers:       () => req('/api/admin/delivery-tiers'),
  updateTier:  (id, body) => req(`/api/admin/delivery-tiers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

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
  getMarketplaceOrders:  (qs = '') => req(`/api/marketplace/${qs}`),
  getMarketplaceStats:   ()        => req('/api/marketplace/stats'),
  updateMarketplaceOrder:(id, body) => req(`/api/marketplace/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // In-house dispatch
  getAssignments:         () => req('/api/dispatch/assignments'),
  getDeliveryDrivers:     () => req('/api/dispatch/drivers'),
  assignDriver:           (body) => req('/api/dispatch/assign', { method: 'POST', body: JSON.stringify(body) }),
  updateAssignmentStatus: (id, status) => req(`/api/dispatch/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Driver view (no admin auth — driver-facing)
  getDriverAssignment: (driverId) => req(`/api/dispatch/driver/${driverId}`),
  updateDriverGPS: (assignmentId, gpsData) => req(`/api/dispatch/assignments/${assignmentId}/gps`, { method: 'PATCH', body: JSON.stringify(gpsData) }),

  // Delivery fee calculator
  calculateDeliveryFee: (customer_address, location_id) =>
    req('/api/dispatch/calculate-fee', { method: 'POST', body: JSON.stringify({ customer_address, location_id }) }),

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
};
