import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Navigation, Star, ChevronDown, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { locationsAPI } from '../services/api';
import SEO from '../components/SEO';
import { locationAnchor, useBusinessSchema } from '../utils/businessSchema';
import { getGrantedDevicePoint } from '../utils/devicePoint';
import StoreMapImage from '../components/StoreMapImage';
import './Locations.css';

/* ── Helpers ──────────────────────────────────────────────── */
// Kept as English day-name keys for internal parsing/matching (DAY_MAP
// below) -- translated only at render time via `locations.days.<key>`.
const DAY_KEYS    = ['sun','mon','tue','wed','thu','fri','sat'];

// The store photo set in CPanel. Photos bundled with the site also ship as .webp.
const storeImage = (url) => {
  if (!url) return null;
  return url.startsWith('/images/') ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;
};

/* Strip " Area" suffix that should not appear in displayed titles */
const sanitizeTitle = (title) => (title || '').replace(/\s+area\b/gi, '').trim();

const isOpenNow = (hoursStr) => {
  if (!hoursStr) return null;
  const h = hoursStr.toLowerCase();
  if (h.includes('24 hour') || h.includes('24hours') || h.includes('always')) return true;

  const now  = new Date();
  const day  = now.getDay();
  const hhmm = now.getHours() * 60 + now.getMinutes();

  const DAY_MAP = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

  const parseTime = (s) => {
    s = s.trim().toLowerCase().replace(/\s/g, '');
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
    if (!m) return null;
    let hr = parseInt(m[1], 10);
    const min = parseInt(m[2] || '0', 10);
    if (m[3] === 'pm' && hr !== 12) hr += 12;
    if (m[3] === 'am' && hr === 12) hr = 0;
    return hr * 60 + min;
  };

  const parseDayRange = (s) => {
    s = s.trim().toLowerCase();
    const parts = s.split(/[–\-]/);
    const a = DAY_MAP[parts[0]?.trim().slice(0,3)];
    const b = parts[1] ? DAY_MAP[parts[1]?.trim().slice(0,3)] : a;
    if (a == null) return [];
    const days = [];
    if (b >= a) { for (let i = a; i <= b; i++) days.push(i); }
    else { for (let i = a; i <= 6; i++) days.push(i); for (let i = 0; i <= b; i++) days.push(i); }
    return days;
  };

  const segments = hoursStr.split(/[·,;]+/);
  for (const seg of segments) {
    const colon = seg.indexOf(':');
    if (colon === -1) continue;
    const dayPart  = seg.slice(0, colon).trim();
    const timePart = seg.slice(colon + 1).trim();
    const openDays = parseDayRange(dayPart);
    if (!openDays.includes(day)) continue;
    const times = timePart.split(/[–\-]/);
    if (times.length < 2) continue;
    const open  = parseTime(times[0]);
    const close = parseTime(times[1]);
    if (open == null || close == null) continue;
    if (close > open) return hhmm >= open && hhmm < close;
    if (close < open) return hhmm >= open || hhmm < close;
  }
  return null;
};

const parseHoursTable = (hoursStr) => {
  const today = new Date().getDay();

  if (!hoursStr) {
    return DAY_KEYS.map((dayKey, i) => ({ dayKey, hours: null, isToday: i === today }));
  }

  const h = hoursStr.toLowerCase();
  if (h.includes('24 hour') || h.includes('always')) {
    return DAY_KEYS.map((dayKey, i) => ({ dayKey, hours: '24', isToday: i === today }));
  }

  const DAY_MAP  = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  const result   = DAY_KEYS.map((dayKey, i) => ({ dayKey, hours: 'closed', isToday: i === today }));

  const segments = hoursStr.split(/[·,;]+/);
  for (const seg of segments) {
    const colon = seg.indexOf(':');
    if (colon === -1) continue;
    const dayPart  = seg.slice(0, colon).trim();
    const timePart = seg.slice(colon + 1).trim();
    const parts    = dayPart.split(/[–\-]/);
    const startDay = DAY_MAP[parts[0]?.trim().slice(0,3).toLowerCase()];
    const endDay   = parts[1] ? DAY_MAP[parts[1]?.trim().slice(0,3).toLowerCase()] : startDay;
    if (startDay == null) continue;
    const indices = [];
    if (endDay == null || endDay >= startDay) {
      for (let i = startDay; i <= (endDay ?? startDay); i++) indices.push(i);
    } else {
      for (let i = startDay; i <= 6; i++) indices.push(i);
      for (let i = 0; i <= endDay; i++) indices.push(i);
    }
    for (const di of indices) result[di].hours = timePart;
  }
  return result;
};

// Shared with the structured data so each store has one id across pages.
const getAnchorId = locationAnchor;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Purely informational "how far away are you" badge — NOT a delivery
// eligibility check. Real eligibility/fee is decided at checkout by address
// (see Checkout.jsx → /api/dispatch/calculate-fee), which is the only
// source of truth for whether an address can be delivered to. This never
// returns a "pickup only"-style verdict — a bad/missing distance reading
// should never be presented as a delivery restriction.
function getDistanceBadge(miles, t) {
  if (miles === undefined || miles === null || Number.isNaN(miles)) return null;
  if (miles > 350) return null; // too far from every store for the number to mean anything
  if (miles < 0.5) return { label: t('locations.nearby'), color: '#22c55e' };
  return { label: t('locations.milesAway', { miles: miles.toFixed(1) }), color: '#3b82f6' };
}

/* ── Location Card ─────────────────────────────────────────── */
function LocationCard({ loc, userCoords, index }) {
  const { t } = useTranslation();
  // The CPanel photo, else a light "View on map" link. (A live map embed per
  // store used to load 7 maps at once for the stores without photos.)
  const [imgFailed, setImgFailed] = useState(false);
  const displayImg = imgFailed ? null : storeImage(loc.image_url);
  const open        = isOpenNow(loc.working_days_hours);
  const anchorId   = getAnchorId(loc.title);
  const hoursTable = parseHoursTable(loc.working_days_hours);
  const [flipped, setFlipped] = useState(false);

  const distKm    = (userCoords && loc.latitude && loc.longitude)
    ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(loc.latitude), parseFloat(loc.longitude))
    : null;
  const distMiles = distKm !== null && !Number.isNaN(distKm) ? distKm * 0.621371 : null;
  const distBadge = getDistanceBadge(distMiles, t);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.title + ' ' + (loc.brief_address || 'Bronx, NY'))}`;
  const shortTitle = sanitizeTitle(loc.title);
  const neighborhood = loc.brief_address || 'Bronx, New York';

  return (
    <div
      id={anchorId}
      className="lcn-card"
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      {/* ── Photo Section ── */}
      <div className="lcn-photo-section">
        {displayImg ? (
          <img
            src={displayImg}
            alt={sanitizeTitle(loc.title)}
            className="lcn-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <a className="lcn-photo-none" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <StoreMapImage lat={loc.latitude} lng={loc.longitude} />
            <span className="lcn-photo-none-label">{t('locations.viewOnMap')}</span>
          </a>
        )}
        <div className="lcn-img-gradient" />

        {/* Floating status badge */}
        {open !== null && (
          <div className={`lcn-live-badge ${open ? 'lcn-live-open' : 'lcn-live-closed'}`}>
            <span className="lcn-live-dot" />
            {open ? t('locations.openNow') : t('locations.closed')}
          </div>
        )}

        {/* Distance badge — "how far from you", not a delivery-eligibility verdict */}
        {distBadge && (
          <div className="lcn-dist-badge" style={{ borderColor: distBadge.color + '66', background: 'rgba(0,0,0,0.75)' }}>
            <MapPin size={12} style={{ color: distBadge.color }} />
            <span style={{ color: distBadge.color }}>{distBadge.label}</span>
          </div>
        )}

        {/* Bottom overlay info */}
        <div className="lcn-photo-footer">
          <div className="lcn-photo-footer-inner">
            <MapPin size={16} className="lcn-pin-icon" />
            <div>
              <p className="lcn-location-name">{shortTitle}</p>
              <p className="lcn-location-sub">{neighborhood}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="lcn-body">

        {/* Info tabs */}
        <div className="lcn-tabs">
          <button
            className={`lcn-tab ${!flipped ? 'lcn-tab-active' : ''}`}
            onClick={() => setFlipped(false)}
          >
            <MapPin size={12} /> {t('locations.info')}
          </button>
          <button
            className={`lcn-tab ${flipped ? 'lcn-tab-active' : ''}`}
            onClick={() => setFlipped(true)}
          >
            <Clock size={12} /> {t('locations.hoursTab')}
          </button>
        </div>

        {/* Info Panel */}
        {!flipped ? (
          <div className="lcn-info-panel">
            <div className="lcn-info-row">
              <MapPin size={14} className="lcn-info-icon" />
              <div>
                <p className="lcn-info-label">{t('locations.address')}</p>
                <p className="lcn-info-value">{loc.brief_address}</p>
              </div>
            </div>

            {loc.phone_number && (
              <div className="lcn-info-row">
                <Phone size={14} className="lcn-info-icon" />
                <div>
                  <p className="lcn-info-label">{t('locations.phone')}</p>
                  <a href={`tel:${loc.phone_number}`} className="lcn-phone">{loc.phone_number}</a>
                </div>
              </div>
            )}

            <div className="lcn-info-row">
              <Wifi size={14} className="lcn-info-icon" />
              <div>
                <p className="lcn-info-label">{t('locations.deliveryAndPickup')}</p>
                <p className="lcn-info-value">
                  {loc.delivery_radius_miles
                    ? t('locations.deliveryWithinMi', { radius: loc.delivery_radius_miles })
                    : t('locations.deliveryPickupGeneric')
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="lcn-hours-panel">
            {hoursTable.map(({ dayKey, hours, isToday }) => (
              <div key={dayKey} className={`lcn-hr-row ${isToday ? 'lcn-hr-today' : ''}`}>
                <span className="lcn-hr-day">{t(`locations.days.${dayKey}`)}</span>
                <div className="lcn-hr-dots" />
                <span className="lcn-hr-time">
                  {hours === null ? t('locations.hoursVary') : hours === '24' ? t('locations.hours24') : hours === 'closed' ? t('locations.closed') : hours}
                </span>
                {isToday && (
                  <span className={`lcn-today-badge ${open ? 'lcn-today-open' : 'lcn-today-closed'}`}>
                    {open ? t('locations.openBadge') : t('locations.closedBadge')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="lcn-actions">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="lcn-btn-directions">
            <Navigation size={14} />
            {t('locations.getDirections')}
          </a>
          <a href={`tel:${loc.phone_number}`} className="lcn-btn-call">
            <Phone size={14} />
            {t('locations.call')}
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Animated Counter ── */
function AnimatedCounter({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const end = parseInt(target, 10);
        const duration = 1800;
        const step = end / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
          current += step;
          if (current >= end) { setCount(end); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, 16);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Page ──────────────────────────────────────────────────── */
const Locations = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const businessSchema = useBusinessSchema(locations);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100);
    // Spec: no location prompt when the page opens. Use the position only if the
    // browser already allows it; otherwise the visitor can tap "Sort by distance".
    getGrantedDevicePoint().then(p => { if (p) setUserCoords(p); });
  }, []);

  const [locating, setLocating] = useState(false);
  const locateMe = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    // Every store switched on in CPanel, however many there are.
    locationsAPI.getAll()
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  // Sort by distance only when the visitor is within reach of a store (350 mi,
  // ~563 km); from farther away the distances say nothing, so keep CPanel's order.
  const nearUser = !!userCoords && locations.some(l => l.latitude && l.longitude
    && haversineKm(userCoords.lat, userCoords.lng, parseFloat(l.latitude), parseFloat(l.longitude)) <= 563);
  const sortedLocations = nearUser
    ? [...locations].sort((a, b) => {
        const dA = (a.latitude && a.longitude) ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(a.latitude), parseFloat(a.longitude)) : 9999;
        const dB = (b.latitude && b.longitude) ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(b.latitude), parseFloat(b.longitude)) : 9999;
        return dA - dB;
      })
    : locations;



  return (
    <div className="locations-page page-watermark">
      <SEO
        title="Locations | Our Bronx Stores & Tri-State Delivery"
        description="Find a Habibi Halal Express store near you in the Bronx, with hours, directions and phone numbers for every location."
        keywords="halal food nyc, habibi halal express locations, bronx halal restaurant, halal food near me, bronx halal"
        schema={businessSchema}
      />

      {/* ── Hero ── */}
      <div className={`loc-hero ${heroVisible ? 'loc-hero-visible' : ''}`}>
        <div className="loc-hero-bg">
          <img src="/images/title/locations-hero-v2.jpg" alt="Habibi Halal Express Locations" className="loc-hero-img" />
          <div className="loc-hero-overlay" />
          {/* Animated bokeh particles */}
          <div className="loc-bokeh">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="loc-bokeh-dot" style={{
                '--bx': `${Math.random() * 100}%`,
                '--by': `${Math.random() * 100}%`,
                '--bs': `${4 + Math.random() * 8}px`,
                '--bd': `${Math.random() * 4}s`,
              }} />
            ))}
          </div>
        </div>

        <div className="loc-hero-content">
          <div className="loc-hero-badge">
            <MapPin size={14} />
            <span>{loading || !locations.length ? t('locations.locationsBadgeLoading') : t('locations.locationsCountBadge', { count: locations.length })}</span>
          </div>
          <h1 className="loc-hero-title">
            {t('locations.findUsNear')} <span className="loc-hero-accent">{t('locations.nearYou')}</span>
          </h1>
          <p className="loc-hero-sub">
            {t('locations.heroSub')}
          </p>
          <a href="#locations-grid" className="loc-hero-scroll">
            <span>{t('locations.exploreLocations')}</span>
            <ChevronDown size={18} className="loc-scroll-arrow" />
          </a>
          {!userCoords && typeof navigator !== 'undefined' && 'geolocation' in navigator && (
            <button type="button" className="loc-hero-locate" onClick={locateMe} disabled={locating}>
              <Navigation size={15} /> {locating ? t('locations.locating') : t('locations.useMyLocation')}
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="loc-hero-stats">
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">{loading ? '…' : locations.length}</span>
            <span className="loc-hero-stat-label">{t('locations.statLocations')}</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">365</span>
            <span className="loc-hero-stat-label">{t('locations.statDaysPerYear')}</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">300+</span>
            <span className="loc-hero-stat-label">{t('locations.statMileDelivery')}</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <span className="loc-hero-stat-num">4.9</span>
            <span className="loc-hero-stat-label">{t('locations.statRating')}</span>
          </div>
        </div>
      </div>

      <div className="container loc-body">

        {/* ── Section Header ── */}
        <div className="loc-section-header" id="locations-grid">
          <div className="loc-section-label">
            <span className="loc-eyebrow-dot" />
            <span className="loc-eyebrow">{t('locations.ourNetwork')}</span>
          </div>
          <h2 className="loc-section-title">{t('locations.allLocations')} <span className="text-primary">{t('locations.locationsWord')}</span></h2>
          <p className="loc-section-desc">
            {userCoords ? t('locations.sortedByProximity') : t('locations.tapCardForHours')}
          </p>
        </div>

        {/* ── Cards Grid ── */}
        {loading ? (
          <div className="loc-loading">
            <div className="loc-loading-ring">
              <div className="loading-spinner" />
            </div>
            <p>{t('locations.findingLocations')}</p>
          </div>
        ) : loadFailed || sortedLocations.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255,255,255,0.7)' }}>
            {loadFailed ? t('locations.loadFailed') : t('locations.noneYet')}
          </p>
        ) : (
          <div className="lcn-grid">
            {sortedLocations.map((loc, i) => (
              <LocationCard key={loc.id} loc={loc} userCoords={userCoords} index={i} />
            ))}
          </div>
        )}

        {/* ── Coverage Section ── */}
        <div className="coverage-section" id="coverage">

          {/* Left: visual */}
          <div className="coverage-visual">
            <div className="coverage-map-bg">
              {/* Fine dot-grid texture, like a tracking/radar display */}
              <div className="cov-grid" />

              {/* Concentric range rings */}
              <div className="cov-ring cov-r1" />
              <div className="cov-ring cov-r2" />
              <div className="cov-ring cov-r3" />
              <div className="cov-ring cov-r4" />

              {/* Cardinal tick marks */}
              <div className="cov-ticks">
                <span /><span /><span /><span />
              </div>

              {/* Rotating radar sweep beam */}
              <div className="cov-sweep" />

              {/* Live delivery "pings" flashing across the coverage field */}
              <div className="cov-ping cov-ping-1" />
              <div className="cov-ping cov-ping-2" />
              <div className="cov-ping cov-ping-3" />
              <div className="cov-ping cov-ping-4" />

              {/* Center hub */}
              <div className="cov-center">
                <div className="cov-pulse" />
                <div className="cov-dot" />
              </div>
            </div>
            <div className="coverage-stat-center">
              <p className="coverage-num"><AnimatedCounter target="300" suffix="+" /></p>
              <p className="coverage-unit">{t('locations.mileRadius')}</p>
            </div>
          </div>

          {/* Right: text */}
          <div className="coverage-text">
            <p className="loc-eyebrow">{t('locations.deliveryCoverage')}</p>
            <h2 className="coverage-title">
              {t('locations.broadening')}<br /><span className="text-primary">{t('locations.halalHorizon')}</span>
            </h2>
            <p className="coverage-desc">
              {t('locations.coverageDesc')}
            </p>

            {/* Delivery tiers */}
            <div className="coverage-tiers">
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#22c55e' }} />
                <div>
                  <p className="cov-tier-label">{t('locations.inHouseDelivery')}</p>
                  <p className="cov-tier-range">{t('locations.inHouseRange')}</p>
                </div>
              </div>
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#3b82f6' }} />
                <div>
                  <p className="cov-tier-label">{t('locations.expressDelivery')}</p>
                  <p className="cov-tier-range">{t('locations.expressRange')}</p>
                </div>
              </div>
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#f59e0b' }} />
                <div>
                  <p className="cov-tier-label">{t('locations.longDistance')}</p>
                  <p className="cov-tier-range">{t('locations.longDistanceRange')}</p>
                </div>
              </div>
            </div>

            <div className="coverage-metrics">
              <div className="coverage-metric">
                <span><AnimatedCounter target="25" suffix=" min" /></span>
                <p>{t('locations.avgDelivery')}</p>
              </div>
              <div className="coverage-metric">
                <span><AnimatedCounter target="10" suffix="K+" /></span>
                <p>{t('locations.ordersDelivered')}</p>
              </div>
              <div className="coverage-metric">
                <span>4.9 ★</span>
                <p>{t('locations.customerRating')}</p>
              </div>
            </div>

            <Link to="/menu" className="btn btn-primary loc-cta-btn">
              {t('locations.orderNowArrow')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Locations;
