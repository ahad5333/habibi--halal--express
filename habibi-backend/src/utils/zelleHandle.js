// Zelle can be sent to either a US mobile number or an email address.
//
// The Zelle destination used to be email-only everywhere: the admin form, the
// save endpoint and the checkout modal all rejected or mis-worded a phone
// number, so when the owner supplied one (347-459-7103) there was no way to
// enter it. With nothing configured, customers were instead shown a hardcoded
// fallback address on a domain Habibi does not own.
//
// One definition of "valid Zelle destination", used by both the save path and
// the read path, so what the admin can save and what the customer is shown
// can't disagree.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @returns {{type:'phone', value:string} | {type:'email', value:string} | null}
 *          null when the input is empty or not a usable destination.
 */
function normalizeZelleHandle(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (EMAIL_RE.test(s)) return { type: 'email', value: s.toLowerCase() };

  // US numbers turn up as both 10 and 11 digits (with or without the leading
  // country code 1) -- exact-length matching on one form is a bug this project
  // has already paid for once (STOP opt-out silently failing).
  const digits = s.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  // A US area code can never begin with 0 or 1.
  if (national.length === 10 && /^[2-9]/.test(national)) return { type: 'phone', value: national };

  return null;
}

/** What a customer should see: "(347) 459-7103" or the email as-is. */
function displayZelleHandle(handle) {
  if (!handle) return null;
  if (handle.type === 'phone') {
    const v = handle.value;
    return `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}`;
  }
  return handle.value;
}

/** Read a stored payment_settings.config for zelle, old or new shape. */
function zelleHandleFromConfig(config) {
  if (!config) return null;
  // New shape: { type, value }. Old shape: { email }.
  if (config.type && config.value) return normalizeZelleHandle(config.value);
  if (config.email) return normalizeZelleHandle(config.email);
  return null;
}

module.exports = { normalizeZelleHandle, displayZelleHandle, zelleHandleFromConfig };
