// Who can sign in to the CPanel, and what each role is allowed to see.
//
// This mirrors habibi-backend/src/middleware/managerMiddleware.js. Hiding a page
// here is a convenience, never the protection: the server enforces the same
// split on every request, so a manager who types a URL or calls the API
// directly still gets a 403.
export const PANEL_ROLES = ['admin', 'superadmin', 'manager'];

export const isPanelRole = (role) => PANEL_ROLES.includes(role);
export const isFullAdmin = (role) => role === 'admin' || role === 'superadmin';
export const isManager   = (role) => role === 'manager';

export const ROLE_LABEL = {
  admin:      'Administrator',
  superadmin: 'Administrator',
  manager:    'Manager',
};

// The pages a manager may open, by route. Anything not listed is admin-only.
// Matches MANAGER_ALLOWED on the server.
export const MANAGER_ROUTES = new Set([
  '/',                // dashboard (the server strips the takings from its stats)
  '/orders',
  '/all-orders',
  '/liveboard',
  '/urgent',
  '/menu',
  '/byo-ingredients',
  '/global-addons',
  '/inventory',
  '/waste',
  '/business-hours',
  '/staff',
  '/schedule',
]);

export const canOpen = (role, path) => !isManager(role) || MANAGER_ROUTES.has(path);
