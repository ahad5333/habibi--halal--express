/**
 * api.js — Central API client for Habibi Halal Express
 * All backend calls go through here. Base URL is set via VITE_API_URL in .env
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem('habibi_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed: ${res.status}`);
  }

  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authAPI = {
  /** POST /api/auth/login */
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /** POST /api/auth/register */
  register: (name, email, password, extra = {}) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, ...extra }),
    }),

  /** Save token to localStorage */
  saveToken: (token) => localStorage.setItem('habibi_token', token),

  /** Remove token */
  logout: () => localStorage.removeItem('habibi_token'),

  /** POST /api/auth/forgot-password */
  forgotPassword: (email) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  /** POST /api/auth/reset-password */
  resetPassword: (token, password) =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  /** Check if user is logged in */
  isLoggedIn: () => !!localStorage.getItem('habibi_token'),

  /** GET /api/auth/verify-email?token=xxx */
  verifyEmail: (token) => request(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
};

// ─── Menu ────────────────────────────────────────────────────────────────────

export const menuAPI = {
  /** GET /api/menus — fetch all menu items */
  getAll: () => request('/api/menus'),

  /** GET /api/menus/:id */
  getById: (id) => request(`/api/menus/${id}`),

  /** GET /api/menus/:id/modifiers — choice_groups + addon_groups */
  getModifiers: (id) => request(`/api/menus/${id}/modifiers`),
};

// ─── Locations ───────────────────────────────────────────────────────────────

export const locationsAPI = {
  /** GET /api/locations */
  getAll: () => request('/api/locations'),

  /** GET /api/locations/:id */
  getById: (id) => request(`/api/locations/${id}`),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartAPI = {
  /** GET /api/cart */
  get: () => request('/api/cart'),

  /** POST /api/cart/add */
  add: (menuItemId, quantity, modifiers) =>
    request('/api/cart/add', {
      method: 'POST',
      body: JSON.stringify({ menuItemId, quantity, modifiers }),
    }),

  /** PUT /api/cart/update/:id */
  updateQuantity: (cartItemId, quantity) =>
    request(`/api/cart/update/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),

  /** DELETE /api/cart/remove/:id */
  remove: (cartItemId) =>
    request(`/api/cart/remove/${cartItemId}`, { method: 'DELETE' }),

  /** DELETE /api/cart/clear */
  clear: () => request('/api/cart/clear', { method: 'DELETE' }),
};

// ─── Orders ──────────────────────────────────────────────────────────────────

export const ordersAPI = {
  /** POST /api/orders — create authenticated order */
  create: (orderData) =>
    request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),

  /** POST /api/orders/guest — guest order (no auth required) */
  createGuest: (orderData) =>
    request('/api/orders/guest', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),

  /** GET /api/orders */
  getAll: () => request('/api/orders'),

  /** GET /api/orders/:id */
  getById: (id) => request(`/api/orders/${id}`),

  /** GET /api/orders/track/:orderNumber — public, no auth */
  track: (orderNumber) => request(`/api/orders/track/${orderNumber}`),
};

// ─── Contact ─────────────────────────────────────────────────────────────────

export const contactAPI = {
  /** POST /api/contact — sends full payload to backend */
  submitFeedback: (payload) =>
    request('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** POST /api/contact/subscribe */
  subscribe: (email) =>
    request('/api/contact/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** GET /api/contact/unsubscribe?token= */
  unsubscribe: (token) =>
    request(`/api/contact/unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    }),
};

// ─── Payments ────────────────────────────────────────────────────────────────

export const paymentsAPI = {
  /** POST /api/payments/create-intent */
  createIntent: (amount, orderNumber, paymentMethodTypes = ['card']) =>
    request('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, order_number: orderNumber, payment_method_types: paymentMethodTypes }),
    }),

  /** POST /api/payments/square/charge */
  squareCharge: (sourceId, amount, orderNumber) =>
    request('/api/payments/square/charge', {
      method: 'POST',
      body: JSON.stringify({ sourceId, amount, order_number: orderNumber }),
    }),

  /** GET /api/payments/offline-info */
  offlineInfo: () => request('/api/payments/offline-info'),
};

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const couponsAPI = {
  validate: (code, amount, cartItems = []) =>
    request('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({
        code: code.toUpperCase(),
        amount,
        cart: cartItems.map(i => ({ id: i.id, price: i.price, quantity: i.qty })),
      }),
    }),
};

// ─── User Account ────────────────────────────────────────────────────────────

export const userAPI = {
  /** GET /api/users/me */
  getProfile: () => request('/api/users/me'),

  /** PUT /api/users/me */
  updateProfile: (data) =>
    request('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),

  /** PUT /api/users/me/password */
  changePassword: (current_password, new_password) =>
    request('/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }),

  /** DELETE /api/users/me */
  deleteAccount: (password) =>
    request('/api/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),

  /** GET /api/users/me/orders */
  getOrders: () => request('/api/users/me/orders'),

  /** GET /api/users/me/addresses */
  getAddresses: () => request('/api/users/me/addresses'),

  /** POST /api/users/me/addresses */
  addAddress: (data) =>
    request('/api/users/me/addresses', { method: 'POST', body: JSON.stringify(data) }),

  /** PUT /api/users/me/addresses/:id/default */
  setDefaultAddress: (id) =>
    request(`/api/users/me/addresses/${id}/default`, { method: 'PUT' }),

  /** DELETE /api/users/me/addresses/:id */
  deleteAddress: (id) =>
    request(`/api/users/me/addresses/${id}`, { method: 'DELETE' }),
};

// ─── Saved Payment Methods ────────────────────────────────────────────────────

export const savedPaymentsAPI = {
  /** GET /api/payment-methods */
  getAll: () => request('/api/payment-methods'),

  /** PUT /api/payment-methods/:id/default */
  setDefault: (id) =>
    request(`/api/payment-methods/${id}/default`, { method: 'PUT' }),

  /** DELETE /api/payment-methods/:id */
  remove: (id) =>
    request(`/api/payment-methods/${id}`, { method: 'DELETE' }),
};

// ─── Partner Portal ──────────────────────────────────────────────

export const partnerPortalAPI = {
  /** GET /api/partner/profile */
  getProfile: () => request('/api/partner/profile'),

  /** GET /api/partner/catalog */
  getCatalog: () => request('/api/partner/catalog'),

  /** POST /api/partner/orders */
  placeOrder: (body) => request('/api/partner/orders', { method: 'POST', body: JSON.stringify(body) }),

  /** GET /api/partner/orders */
  getOrders: () => request('/api/partner/orders'),

  /** GET /api/partner/orders/:id/invoice */
  getInvoice: (id) => request(`/api/partner/orders/${id}/invoice`),
};

// ─── Partners (Wholesale) ────────────────────────────────────────────────────

// ─── Favorites ───────────────────────────────────────────────────────────────

export const favoritesAPI = {
  getAll:  ()           => request('/api/favorites'),
  add:     (menuItemId) => request('/api/favorites', { method: 'POST', body: JSON.stringify({ menu_item_id: menuItemId }) }),
  remove:  (menuItemId) => request(`/api/favorites/${menuItemId}`, { method: 'DELETE' }),
};

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationsAPI = {
  getAll:       () => request('/api/users/me/notifications'),
  markRead:     (id) => request(`/api/users/me/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead:  () => request('/api/users/me/notifications/read-all', { method: 'PATCH' }),
};

export const reviewsAPI = {
  getApproved: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/reviews${q ? '?' + q : ''}`);
  },
  submit: (payload) => request('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }),
};

export const partnersAPI = {
  /**
   * POST /api/partners/apply
   * Submits a wholesale partner application with optional certificate file.
   */
  apply: (formData) =>
    fetch(`${BASE_URL}/api/partners/apply`, {
      method: 'POST',
      body: formData, // FormData (multipart) — do NOT set Content-Type manually
      headers: (() => {
        const token = localStorage.getItem('habibi_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
      })(),
      credentials: 'include',
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
      return data;
    }),
};
