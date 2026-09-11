import { useEffect, useMemo, useState } from 'react';
import { locationsAPI, settingsAPI } from '../services/api';
import { useSettings } from '../context/SettingsContext';

// The business details Google reads from the site (schema.org JSON-LD),
// built from what CPanel controls: site settings (phone, email, address,
// social links), each location (address, phone, hours, map position), and
// which payment methods are switched on. Before this, Home, Locations and
// index.html each carried their own hand-typed copy -- wrong domain, three
// different sets of opening hours, cash listed after it was switched off.

export const SITE_URL = 'https://habibihe.com';
const NAME = 'Habibi Halal Express';
const CUISINE = ['Halal', 'Mediterranean', 'Middle Eastern', 'Platters', 'Gyros', 'Burgers'];
const LOGO = `${SITE_URL}/images/logos/logo-badge.webp`;
const IMAGE = `${SITE_URL}/favicon.png`;

// Same ids the Locations page uses for its #anchors, so both pages describe
// each store with one identity.
export const locationAnchor = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford')) return 'bedford';
  if (t.includes('kingsbridge')) return 'kingsbridge';
  if (t.includes('white plains')) return 'white-plains';
  return t.replace(/\W+/g, '-');
};

export const schemaPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten.length === 10 ? `+1-${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}` : undefined;
};

// "2974 Jerome Ave, Bronx, NY 10468"
function postalAddress(exact, fallbackStreet) {
  const m = String(exact || '').match(/^\s*(.+?),\s*([^,]+?),\s*([A-Z]{2})\s*(\d{5})?\s*$/);
  if (m) {
    return { '@type': 'PostalAddress', streetAddress: m[1], addressLocality: m[2], addressRegion: m[3], ...(m[4] ? { postalCode: m[4] } : {}), addressCountry: 'US' };
  }
  return { '@type': 'PostalAddress', streetAddress: fallbackStreet || exact || undefined, addressLocality: 'Bronx', addressRegion: 'NY', addressCountry: 'US' };
}

// ── Opening hours: CPanel's text -> OpeningHoursSpecification ──────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_IDX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function dayRange(s) {
  const [a, b] = s.toLowerCase().split(/[–-]/).map(x => DAY_IDX[x.trim().slice(0, 3)]);
  if (a === undefined) return [];
  if (b === undefined) return [a];
  const out = [];
  for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b || out.length === 7) break; }
  return out;
}
function to24(s) {
  const m = String(s).trim().toLowerCase().replace(/\s/g, '').match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === 'pm') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

// "Open 24 Hours · 365 Days a Year" or "Mon–Fri: 7:00 AM – 11:00 PM · Sat–Sun: Closed"
// (the format CPanel's Business Hours page writes). Unreadable text gives no
// hours at all rather than invented ones.
export function hoursSpec(text) {
  if (!text) return undefined;
  if (/24\s*hour|24hours|always/i.test(text)) {
    return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: '00:00', closes: '23:59' }];
  }
  const specs = [];
  for (const seg of text.split(/[·,;]+/)) {
    const i = seg.indexOf(':');
    if (i === -1) continue;
    const days = dayRange(seg.slice(0, i));
    const times = seg.slice(i + 1).trim();
    if (!days.length || /closed/i.test(times)) continue;
    const [open, close] = times.split(/[–-]/).map(to24);
    if (!open || !close) continue;
    specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days.map(d => DAYS[d]), opens: open, closes: close });
  }
  return specs.length ? specs : undefined;
}

// Active CPanel payment methods -> schema.org paymentAccepted.
const PAYMENT_LABELS = { card: 'Credit Card, Debit Card', paypal: 'PayPal, Google Pay', zelle: 'Zelle', cashapp: 'Cash App', cash: 'Cash' };
const paymentsText = (providers) => (providers || []).map(p => PAYMENT_LABELS[p]).filter(Boolean).join(', ') || undefined;

export function buildBusinessSchema({ settings = {}, locations = [], payments = [] }) {
  const paymentAccepted = paymentsText(payments);
  const sameAs = ['social_instagram', 'social_facebook', 'social_twitter', 'social_tiktok']
    .map(k => (settings[k] || '').trim()).filter(u => /^https?:\/\//.test(u));
  const active = locations.filter(l => l.is_active !== false);
  const sharedHours = active.length && active.every(l => l.working_days_hours === active[0].working_days_hours)
    ? hoursSpec(active[0].working_days_hours) : undefined;

  const brand = {
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurant`,
    name: NAME,
    url: SITE_URL,
    logo: LOGO,
    image: IMAGE,
    description: 'Fresh, authentic halal platters, gyros, shawarma and burgers made to order. Delivery and pickup in the Bronx, NY.',
    servesCuisine: CUISINE,
    priceRange: '$$',
    hasMenu: `${SITE_URL}/menu`,
    acceptsReservations: false,
    telephone: schemaPhone(settings.phone_main),
    email: settings.email_contact || undefined,
    address: postalAddress(
      [settings.address_street, settings.address_city, `${settings.address_state || ''} ${settings.address_zip || ''}`.trim()].filter(Boolean).join(', ')
    ),
    openingHoursSpecification: sharedHours,
    paymentAccepted,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const branches = active.map(l => ({
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/locations#${locationAnchor(l.title)}`,
    name: `${NAME} – ${(l.title || '').trim()}`,
    parentOrganization: { '@id': brand['@id'] },
    url: `${SITE_URL}/locations#${locationAnchor(l.title)}`,
    image: IMAGE,
    telephone: schemaPhone(l.phone_number || settings.phone_main),
    address: postalAddress(l.exact_address, l.brief_address),
    ...(l.latitude && l.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: parseFloat(l.latitude), longitude: parseFloat(l.longitude) } } : {}),
    openingHoursSpecification: hoursSpec(l.working_days_hours),
    servesCuisine: CUISINE,
    priceRange: '$$',
    hasMenu: `${SITE_URL}/menu`,
    paymentAccepted,
  }));

  // JSON.stringify drops undefined fields, so anything CPanel doesn't have
  // is simply left out.
  return { '@context': 'https://schema.org', '@graph': [brand, ...branches] };
}

// Locations and payment switches, fetched once per page load and shared.
let livePromise = null;
function loadLive() {
  if (!livePromise) {
    livePromise = Promise.all([
      locationsAPI.getAll().catch(() => []),
      settingsAPI.getPayments().catch(() => []),
    ]).then(([locs, pays]) => ({
      locations: Array.isArray(locs) ? locs : [],
      payments: Array.isArray(pays) ? pays.map(p => p.provider) : [],
    }));
  }
  return livePromise;
}

// Hook for pages: the schema once CPanel's data is in, null until then.
// `locations` can be passed by a page that already loaded them.
export function useBusinessSchema(locationsOverride) {
  const settings = useSettings();
  const [live, setLive] = useState(null);
  useEffect(() => { let on = true; loadLive().then(d => { if (on) setLive(d); }); return () => { on = false; }; }, []);
  return useMemo(() => {
    if (!live) return null;
    const locations = locationsOverride && locationsOverride.length ? locationsOverride : live.locations;
    return buildBusinessSchema({ settings, locations, payments: live.payments });
  }, [live, settings, locationsOverride]);
}
