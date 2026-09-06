// Single source of truth for the kitchen/staff order pipeline.
//
// Both the shared kitchen screen (/kitchen) and the per-person staff queue
// (/staff) drive the same backend endpoint and the same state machine
// (habibi-backend/src/routes/dineInRoutes.js -> KITCHEN_STATUS_FLOW), so these
// live here rather than being copy-pasted into both pages -- when the backend
// flow changes, there is exactly one place on the frontend to match it.

// Status -> kanban column
export const COLUMN_MAP = {
  pending_verification: 'new',
  pending:   'new',
  confirmed: 'new',
  accepted:  'accepted',
  preparing: 'preparing',
  cooking:   'preparing',
  ready:     'ready',
};

// What the bump button advances to for each status. Must match the backend's
// KITCHEN_STATUS_FLOW exactly -- a mismatch here is rejected with a 400.
export const BUMP_NEXT = {
  pending_verification: 'accepted',
  pending:   'accepted',
  confirmed: 'accepted',
  accepted:  'preparing',
  preparing: 'ready',
  cooking:   'ready',
  ready:     'delivered',   // pickup/dine-in only -- see canStaffBump below
};

export const COLUMNS = [
  { key: 'new',       title: 'New Orders', accent: '#ca8a04', station: 'counter' },
  { key: 'accepted',  title: 'Accepted',   accent: '#0891b2', station: 'kitchen' },
  { key: 'preparing', title: 'Preparing',  accent: '#ea580c', station: 'kitchen' },
  { key: 'ready',     title: 'Ready',      accent: '#16a34a', station: 'counter' },
];

// Which station each role belongs to. Used ONLY to highlight whose turn it is
// and to target notifications -- never to disable a button. In a small
// operation one person covers several of these, so hard-gating the buttons
// would deadlock the queue whenever someone stepped away.
export const ROLE_STATION = {
  manager: 'counter',
  cashier: 'counter',
  server:  'counter',
  kitchen: 'kitchen',
};

// A delivery order's last staff-side stage is 'ready'. The driver app owns
// picked_up/delivered, along with GPS tracking and proof-of-delivery -- if
// staff could close it from here, the order would complete without a driver
// ever having touched it.
export function canStaffBump(order) {
  if (!BUMP_NEXT[order.order_status]) return false;
  if (order.order_status === 'ready' && order.delivery_method === 'delivery') return false;
  return true;
}

// Button text for advancing this order, or null when staff can't advance it.
export function bumpLabel(order) {
  if (!canStaffBump(order)) return null;
  switch (order.order_status) {
    case 'pending_verification': return 'Confirm Payment ✓';
    case 'pending':
    case 'confirmed':            return 'Accept';
    case 'accepted':             return 'Start Preparing';
    case 'preparing':
    case 'cooking':              return 'Mark Ready';
    case 'ready':                return 'Handed to Customer';
    default:                     return 'Advance';
  }
}

// Shown in place of the button when staff can't advance the order themselves.
export function blockedReason(order) {
  if (order.order_status === 'ready' && order.delivery_method === 'delivery') {
    return 'Waiting for driver pickup';
  }
  return null;
}
