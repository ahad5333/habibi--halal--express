// Answers for the home-page assistant that need live data beyond the menu:
// opening hours, order status, a delivery check for an address, a meal built
// to a head-count and budget, how to reach a person, and catering prefill.
//
// Everything here reads what CPanel already controls (locations, Business
// Hours, site settings, the delivery pricing rule) -- nothing is hardcoded, so
// an edit in CPanel changes the assistant's answer with it.

const pool = require('../config/db');
const { isOpenNow } = require('../utils/businessHours');
const { geocodeAddress, getDistance } = require('../utils/googleMaps');
const { resolveDeliveryFee } = require('../utils/deliveryPricing');

const TZ = 'America/New_York';

const COUNT_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, couple: 2,
};
const COUNT = `(\\d{1,4}|${Object.keys(COUNT_WORDS).join('|')})`;
const toCount = (w) => (/^\d+$/.test(w) ? parseInt(w, 10) : COUNT_WORDS[w] ?? null);
const money = (n) => `$${Number(n).toFixed(2)}`;
const nyTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

// ── Opening hours ─────────────────────────────────────────────────────────────
// Same source and same open/closed test as the checkout's "we're closed" gate
// (locations.working_days_hours + accepting_orders), so the assistant can never
// say "open" while checkout refuses orders, or the reverse.
const is24h = (h) => /24\s*hour|24hours|always/i.test(h || '');

async function hoursReply() {
  const { rows } = await pool.query(
    `SELECT title, working_days_hours, accepting_orders FROM locations WHERE is_active = TRUE ORDER BY id`
  );
  if (rows.length === 0) return 'Our opening hours are on the Locations page.';

  const n = rows.length;
  if (rows.every(l => is24h(l.working_days_hours) && l.accepting_orders !== false)) {
    const where = n === 1 ? `our ${rows[0].title} location is` : `all ${n} of our locations are`;
    return `Yes, we're open right now — ${where} open 24 hours a day, every day. 🌙`;
  }

  const status = (l) => (l.accepting_orders === false ? 'paused' : isOpenNow(l.working_days_hours));
  const lines = rows.map(l => {
    const hrs = l.working_days_hours || 'hours not listed';
    const s = status(l);
    if (s === 'paused') return `• ${l.title}: not taking online orders right now (${hrs})`;
    if (s === true) return `• ${l.title}: open now · ${hrs}`;
    if (s === false) return `• ${l.title}: closed now · ${hrs}`;
    return `• ${l.title}: ${hrs}`;
  });
  const states = rows.map(status);
  const lead = states.includes(true) ? "We're open right now." : states.every(s => s === false || s === 'paused') ? "We're closed right now." : '';
  return `${lead ? `${lead} ` : ''}Here are our hours:\n${lines.join('\n')}`;
}

// ── Order status ──────────────────────────────────────────────────────────────
// Order numbers look like HBB-1757000000000-A1B2C3 (13-digit timestamp plus a
// random suffix, so they can't be guessed). Only the status and timing are
// shown here -- never the name, address or items the tracking page carries.
const ORDER_NO_RE = /\bHBB-\d{10,16}-[A-Z0-9]{4,8}\b/i;
const TRACK_PAGE = '/order-tracking';
const TRACK_ASK = "Send me your order number — it's in your confirmation text or email and starts with HBB-.";

const STATUS_TEXT = {
  pending:          () => "we've got it, and the kitchen will start on it shortly.",
  accepted:         () => 'accepted — the kitchen has it.',
  preparing:        () => 'being prepared right now 🍳',
  ready:            (pickup) => (pickup ? 'ready for pickup! 🎉' : 'ready, waiting for the driver to collect it.'),
  out_for_delivery: () => 'on its way to you 🚗',
  delivered:        () => 'delivered ✅',
  completed:        () => 'completed ✅',
  cancelled:        () => 'cancelled.',
  refunded:         () => 'refunded.',
};

async function trackReply(rawNumber) {
  const num = rawNumber.toUpperCase();
  const { rows } = await pool.query(
    `SELECT o.order_status, o.delivery_method, o.expected_time,
            o.placed_at + make_interval(mins => o.estimated_minutes) AS ready_at,
            u.estimated_dropoff_time
       FROM guest_orders o
       LEFT JOIN LATERAL (
         SELECT estimated_dropoff_time FROM uber_deliveries
          WHERE order_number = o.order_number
          ORDER BY created_at DESC LIMIT 1
       ) u ON TRUE
      WHERE o.order_number = $1`,
    [num]
  );
  if (rows.length === 0) {
    return { found: false, text: `I couldn't find order ${num}. Check the number in your confirmation text or email — it starts with HBB-.` };
  }

  const o = rows[0];
  const pickup = o.delivery_method === 'pickup';
  const describe = STATUS_TEXT[o.order_status];
  let text = `Order ${num} is ${describe ? describe(pickup) : `${String(o.order_status).replace(/_/g, ' ')}.`}`;

  const inKitchen = ['pending', 'accepted', 'preparing'].includes(o.order_status);
  const now = Date.now();
  if (o.estimated_dropoff_time && (o.order_status === 'out_for_delivery' || (!pickup && (inKitchen || o.order_status === 'ready')))
      && new Date(o.estimated_dropoff_time).getTime() > now) {
    text += ` Arriving around ${nyTime(o.estimated_dropoff_time)}.`;
  } else if (inKitchen && o.ready_at && new Date(o.ready_at).getTime() > now) {
    text += ` Should be ready around ${nyTime(o.ready_at)}.`;
  }
  if (o.expected_time && o.expected_time !== 'ASAP' && inKitchen) {
    text += ` Scheduled for ${o.expected_time}.`;
  }
  return { found: true, text, cta: { label: 'Open live tracking', to: `${TRACK_PAGE}?order=${encodeURIComponent(num)}` } };
}

// ── Delivery check ────────────────────────────────────────────────────────────
// Prices an address exactly the way checkout does (nearest store, own driver
// inside its radius, otherwise the courier's live quote + markup) -- but the
// quote is NOT saved: this is a question, not the start of an order, and the
// real price is still quoted fresh at checkout.
const STREET_SUFFIX = 'st|street|ave|avenue|av|rd|road|blvd|boulevard|pl|place|ln|lane|dr|drive|pkwy|parkway|way|ct|court|ter|terrace|concourse|sq|square|hwy|highway|plaza|expy|expressway|walk|loop|oval';
const ADDRESS_RE = new RegExp(`\\b\\d{1,6}[a-z]?\\s+(?:[nsew]\\.?\\s+)?[a-z0-9.'-]+(?:\\s+[a-z0-9.'-]+){0,4}?\\s+(?:${STREET_SUFFIX})\\b`, 'i');
const DELIVERY_ASK_MARK = 'send me your street address';
const DELIVERY_ASK = `Send me your street address (like "2974 Jerome Ave, Bronx") and I'll check delivery and the price for you.`;

// The address as typed, from the house number to the end of the message.
function extractAddress(message) {
  const m = String(message || '').match(ADDRESS_RE);
  if (!m) return null;
  return message
    .slice(m.index)
    .replace(/\b(please|pls|thanks|thank you)\b.*$/i, '')
    .replace(/[?!.\s]+$/, '')
    .trim()
    .slice(0, 200) || null;
}

function milesBetween(a, b) {
  const R = 3958.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function deliveryReply(address) {
  const dest = await geocodeAddress(address);
  if (!dest) {
    return { ok: false, text: `I couldn't find that address. ${DELIVERY_ASK}` };
  }
  if (!/^\d/.test(dest.street || '')) {
    return { ok: false, text: `I need a full street address to check the price. ${DELIVERY_ASK}` };
  }

  const { rows: locs } = await pool.query(
    `SELECT id, title, exact_address, latitude, longitude FROM locations
      WHERE is_active = TRUE AND accepting_orders IS NOT FALSE AND exact_address IS NOT NULL`
  );
  const placed = locs.filter(l => l.latitude && l.longitude);
  const nearest = (placed.length ? placed : locs)
    .map(l => ({ ...l, straight: l.latitude ? milesBetween({ lat: +l.latitude, lng: +l.longitude }, dest) : 0 }))
    .sort((a, b) => a.straight - b.straight)[0];
  if (!nearest) return { ok: false, text: "I can't check delivery right now. You'll see the price at checkout, and pickup is always available." };

  const pickupLine = `Pickup is always available at our ${nearest.title} store (${nearest.exact_address}).`;
  const dist = await getDistance(nearest.exact_address, dest.formatted);
  if (!dist || dist.unavailable) {
    return { ok: false, text: `I can't check delivery prices right now — you'll see the price at checkout. ${pickupLine}` };
  }

  const resolved = await resolveDeliveryFee({
    locationId: nearest.id,
    destinationAddress: dest.formatted,
    originAddress: nearest.exact_address,
    miles: dist.miles,
    subtotal: 0,
  });
  if (resolved.fee === null) {
    return resolved.reason === 'not_serviceable'
      ? { ok: true, text: `Sorry, ${dest.formatted} is outside our delivery area. ${pickupLine}` }
      : { ok: false, text: `I can't get a delivery price right now — you'll see it at checkout. ${pickupLine}` };
  }
  const price = resolved.fee === 0 ? 'free' : `about ${money(resolved.fee)}`;
  return {
    ok: true,
    text: `Yes, we deliver to ${dest.formatted}! It's ${dist.text} from our ${nearest.title} store, and delivery is ${price}. You'll see the exact price at checkout.`,
  };
}

// ── Meal builder ──────────────────────────────────────────────────────────────
// "Feed 4 under $50": one main each, a drink each if the budget allows, then
// fries with what's left. Every main chosen costs no more than the per-person
// share, so the total can't exceed the budget. Dishes are picked by the menu's
// own featured flag and sort order -- order history is too thin to rank by.
const MAIN_CATEGORIES = ['Platter', 'Bergers', 'Habibi Specials', 'Sandwich', 'Tacos'];
const MEAL_MIN_MAIN = 5; // a $2.50 cream-cheese sandwich isn't someone's dinner
const MEAL_MAX_PEOPLE = 12; // bigger groups get the catering form instead
const CATEGORY_WORDS = [
  [/\bburgers?\b/, 'Bergers'],
  [/\bplatters?\b|\bover rice\b/, 'Platter'],
  [/\bsandwich(?:es)?\b|\bgyros?\b|\bwraps?\b/, 'Sandwich'],
  [/\btacos?\b/, 'Tacos'],
];

const MEAL_CUE_RE = new RegExp(
  `\\bfeed(?:s|ing)?\\b|\\b(?:meal|food|dinner|lunch) for\\b|\\b(?:family|group|party|table) of\\b|\\bfor\\s+${COUNT}\\s+(?:people|persons|ppl|of us|adults|kids)\\b`
);

function parsePeople(lower) {
  const m = lower.match(new RegExp(`\\b${COUNT}\\s+(?:of us|people|persons|person|ppl|guests|adults|kids|heads|pax)\\b`))
         || lower.match(new RegExp(`\\b(?:feed(?:s|ing)?|for|family of|group of|party of|table of)\\s+${COUNT}\\b(?!\\s*(?:dollars|bucks|usd))`));
  const n = m ? toCount(m[1]) : null;
  return n && n > 0 ? n : null;
}

function parseBudget(lower) {
  const m = lower.match(/\$\s*(\d{1,4}(?:\.\d{1,2})?)/)
         || lower.match(/\b(\d{1,4})\s*(?:dollars|bucks|usd)\b/)
         || lower.match(/\b(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|within|up to|no more than)\s+(\d{1,4})\b/);
  const n = m ? parseFloat(m[1]) : null;
  return n && n > 0 ? n : null;
}

const categoryFilter = (lower) => (CATEGORY_WORDS.find(([re]) => re.test(lower)) || [])[1] || null;

// Menu-defined order: featured first, then category priority, then the
// admin's sort order. Duplicate names (the menu has intentional twins) are
// offered once.
function rankedMains(menu, onlyCategory) {
  const seen = new Set();
  return menu
    .filter(m => (onlyCategory ? m.category === onlyCategory : MAIN_CATEGORIES.includes(m.category))
      && parseFloat(m.price) >= MEAL_MIN_MAIN)
    .sort((a, b) => (b.is_featured === true) - (a.is_featured === true)
      || MAIN_CATEGORIES.indexOf(a.category) - MAIN_CATEGORIES.indexOf(b.category)
      || (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
      || a.id - b.id)
    .filter(m => { const k = m.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const cheapest = (menu, category, nameRe) => menu
  .filter(m => m.category === category && (!nameRe || nameRe.test(m.name)))
  .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0] || null;

function buildMeal(menu, people, budget, onlyCategory) {
  const mains = rankedMains(menu, onlyCategory);
  if (mains.length === 0) return null;
  const drink = cheapest(menu, 'Drinks', /soda/i) || cheapest(menu, 'Drinks');
  const fries = cheapest(menu, 'Extras', /^french fries$/i) || cheapest(menu, 'Extras', /fries/i);
  const price = (m) => parseFloat(m.price);
  const lowestMain = Math.min(...mains.map(price));

  let withDrinks = !!drink;
  let choices = mains;
  let tight = false;
  if (budget) {
    if (withDrinks && budget - people * price(drink) < people * lowestMain) withDrinks = false;
    const cap = (budget - (withDrinks ? people * price(drink) : 0)) / people;
    choices = mains.filter(m => price(m) <= cap);
    if (choices.length === 0) { tight = true; choices = [mains.slice().sort((a, b) => price(a) - price(b))[0]]; }
  }

  // Up to 3 different dishes, shared out round-robin.
  const picks = choices.slice(0, Math.min(3, people));
  const counts = new Map();
  for (let i = 0; i < people; i++) {
    const m = picks[i % picks.length];
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  const lines = [...counts].map(([m, qty]) => ({ item: m, qty }));
  if (withDrinks) lines.push({ item: drink, qty: people });

  let total = lines.reduce((s, l) => s + price(l.item) * l.qty, 0);
  if (fries) {
    const maxFries = Math.ceil(people / 2);
    let n = 0;
    while (n < maxFries && (!budget || total + price(fries) <= budget)) { n++; total += price(fries); }
    if (n) lines.push({ item: fries, qty: n });
  }
  return { lines, total: Math.round(total * 100) / 100, tight };
}

// ── Talk to a person ──────────────────────────────────────────────────────────
async function contactReply() {
  const [s, l] = await Promise.all([
    pool.query(`SELECT phone_main, email_contact FROM site_settings ORDER BY id LIMIT 1`),
    pool.query(`SELECT title, phone_number, exact_address, working_days_hours FROM locations WHERE is_active = TRUE ORDER BY id`),
  ]);
  const settings = s.rows[0] || {};
  const locations = l.rows;
  const phone = settings.phone_main || locations.find(x => x.phone_number)?.phone_number || null;
  const open24 = locations.length > 0 && locations.every(x => is24h(x.working_days_hours));
  const text = phone
    ? (open24 ? `Our team is there around the clock — call ${phone} and a real person will help you.`
              : `Call ${phone} and a real person will help you.`)
    : 'You can reach our team through the Contact page.';
  return {
    text,
    contact: {
      phone,
      email: settings.email_contact || null,
      locations: locations.map(x => ({
        title: x.title,
        address: x.exact_address,
        // Only when a store has its own line; today all three share the main number.
        phone: x.phone_number && x.phone_number !== phone ? x.phone_number : null,
      })),
    },
  };
}

// ── Catering prefill ──────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const WEEKDAY_RE = /\b(sun|mon|tue|tues|wed|wednes|thu|thur|thurs|fri|sat|satur)(?:day)?\b/;
const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, wednes: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, satur: 6 };

const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ymdIfValid(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
}

// "saturday", "tomorrow", "sept 20", "20th of september", "9/20" -> YYYY-MM-DD
// in New York time, always today or later.
function parseEventDate(lower) {
  const today = todayNY();
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  if (/\btoday\b|\btonight\b/.test(lower)) return today;

  const wd = lower.match(WEEKDAY_RE);
  if (wd) {
    const target = WEEKDAY_INDEX[wd[1]];
    const now = new Date(`${today}T12:00:00Z`).getUTCDay();
    const ahead = ((target - now + 7) % 7) || 7;
    return addDays(today, ahead);
  }

  const [ty] = today.split('-').map(Number);
  let mo = null; let d = null; let y = null;
  const md = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/)
          || lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*\b/);
  if (md) {
    const monthFirst = isNaN(md[1]);
    mo = MONTHS[monthFirst ? md[1] : md[2]];
    d = parseInt(monthFirst ? md[2] : md[1], 10);
  } else {
    const sl = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (sl) {
      mo = parseInt(sl[1], 10); d = parseInt(sl[2], 10);
      if (sl[3]) y = parseInt(sl[3], 10) < 100 ? 2000 + parseInt(sl[3], 10) : parseInt(sl[3], 10);
    }
  }
  if (!mo || !d) return null;
  let date = ymdIfValid(y || ty, mo, d);
  if (date && !y && date < today) date = ymdIfValid(ty + 1, mo, d);
  return date && date >= today ? date : null;
}

function parseGuests(lower) {
  const n = parsePeople(lower);
  return n && n >= 10 && n <= 2000 ? n : null;
}

module.exports = {
  ORDER_NO_RE, TRACK_ASK,
  ADDRESS_RE, DELIVERY_ASK, DELIVERY_ASK_MARK, extractAddress,
  MEAL_CUE_RE, MEAL_MAX_PEOPLE, parsePeople, parseBudget, categoryFilter, buildMeal, rankedMains,
  parseEventDate, parseGuests,
  hoursReply, trackReply, deliveryReply, contactReply,
};
