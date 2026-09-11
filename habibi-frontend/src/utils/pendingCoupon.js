// A deal picked in the home-page assistant, waiting for checkout to apply it.
// Session-only on purpose: it applies during this visit or not at all, and it
// is validated at checkout exactly like a typed code.
const KEY = 'habibi_pending_coupon';

export function setPendingCoupon(code) {
  try { sessionStorage.setItem(KEY, code); } catch { /* storage blocked: nothing to carry */ }
}

// Returns the waiting code (or null) and clears it, so it's applied once.
export function takePendingCoupon() {
  try {
    const code = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
