import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Navigation, Star, ChevronDown, Wifi } from 'lucide-react';
import { locationsAPI } from '../services/api';
import SEO from '../components/SEO';
import './Locations.css';

/* ── Helpers ──────────────────────────────────────────────── */
const DAYS       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const getLocationImage = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))                                    return '/images/locations/bedford-park.jpg';
  if (t.includes('kingsbridge') || t.includes('king'))         return '/images/locations/kings-bridge.jpg';
  if (t.includes('white plains') || t.includes('white-plains')) return '/images/locations/white-plains.jpg';
  return '/images/locations/bedford-park.jpg';
};

const getShortTitle = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))                            return 'Bedford Park';
  if (t.includes('lehman'))                             return 'Lehman';
  if (t.includes('bronx') || t.includes('science'))    return 'Bronx Science';
  if (t.includes('kingsbridge'))                        return 'Kingsbridge';
  if (t.includes('white plains'))                       return 'White Plains';
  return (title || '').split(/\s+/).slice(0, 3).join(' ');
};

const getNeighborhood = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))   return 'Jerome Ave · Bronx';
  if (t.includes('lehman'))    return 'Bedford Park · Bronx';
  if (t.includes('bronx') || t.includes('science')) return 'W 205th St · Bronx';
  if (t.includes('kingsbridge')) return 'Kingsbridge · Bronx';
  if (t.includes('white plains')) return 'White Plains · NY';
  return 'Bronx, New York';
};

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
    return DAYS.map((day, i) => ({ day, hours: 'Hours Vary', isToday: i === today }));
  }

  const h = hoursStr.toLowerCase();
  if (h.includes('24 hour') || h.includes('always')) {
    return DAYS.map((day, i) => ({ day, hours: '24 Hours', isToday: i === today }));
  }

  const DAY_MAP  = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  const result   = DAYS.map((day, i) => ({ day, hours: 'Closed', isToday: i === today }));

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

const getAnchorId = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))                          return 'bedford';
  if (t.includes('lehman'))                           return 'lehman';
  if (t.includes('bronx') || t.includes('science'))  return 'bronx-science';
  if (t.includes('kingsbridge'))                      return 'kingsbridge';
  if (t.includes('white plains'))                     return 'white-plains';
  return t.replace(/\W+/g, '-');
};

const FALLBACK_LOCATIONS = [
  {
    id: 1, title: 'Bedford Park & Jerome Ave',
    brief_address: '204 E Mosholu Pkwy S, Bronx, NY 10458',
    phone_number: '(718) 367-7878',
    working_days_hours: 'Open 24 Hours · 365 Days a Year',
    delivery_radius_miles: 5, is_active: true, preference_level: 5,
    latitude: 40.8726, longitude: -73.8901,
  },
  {
    id: 2, title: 'Lehman College Area',
    brief_address: '250 Bedford Park Blvd W, Bronx, NY 10468',
    phone_number: '(718) 367-7879',
    working_days_hours: 'Mon – Sun: 7AM – 11PM',
    delivery_radius_miles: 4, is_active: true, preference_level: 4,
    latitude: 40.8731, longitude: -73.8967,
  },
  {
    id: 3, title: 'Bronx High School of Science',
    brief_address: '75 W 205th St, Bronx, NY 10468',
    phone_number: '(718) 367-7880',
    working_days_hours: 'Mon – Fri: 6AM – 10PM',
    delivery_radius_miles: 4, is_active: true, preference_level: 3,
    latitude: 40.8744, longitude: -73.8989,
  },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function getDeliveryTier(miles) {
  if (miles === undefined || miles === null) return null;
  if (miles <= 3)   return { label: 'In-House Delivery', color: '#22c55e', icon: '🏠' };
  if (miles <= 10)  return { label: 'Express Delivery',   color: '#3b82f6', icon: '⚡' };
  if (miles <= 350) return { label: 'Long Distance',       color: '#f59e0b', icon: '🚀' };
  return                   { label: 'Pickup Only',          color: '#6b7280', icon: '📦' };
}

/* ── Location Card ─────────────────────────────────────────── */
function LocationCard({ loc, userCoords, index }) {
  const mapEmbedSrc = loc.latitude && loc.longitude
    ? `https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=17&output=embed`
    : loc.brief_address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(loc.brief_address)}&z=17&output=embed`
      : null;
  const fallbackImg = getLocationImage(loc.title);
  const open        = isOpenNow(loc.working_days_hours);
  const anchorId   = getAnchorId(loc.title);
  const hoursTable = parseHoursTable(loc.working_days_hours);
  const [flipped, setFlipped] = useState(false);

  const distKm    = (userCoords && loc.latitude && loc.longitude)
    ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(loc.latitude), parseFloat(loc.longitude))
    : null;
  const distMiles = distKm !== null ? distKm * 0.621371 : null;
  const tier      = getDeliveryTier(distMiles);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.title + ' ' + (loc.brief_address || 'Bronx, NY'))}`;
  const shortTitle = getShortTitle(loc.title);
  const neighborhood = getNeighborhood(loc.title);

  return (
    <div
      id={anchorId}
      className="lcn-card"
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      {/* ── Photo Section ── */}
      <div className="lcn-photo-section">
        {mapEmbedSrc ? (
          <iframe
            title={`Map – ${loc.title}`}
            src={mapEmbedSrc}
            className="lcn-map-iframe"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <img
            src={fallbackImg}
            alt={loc.title}
            className="lcn-img"
            onError={e => { e.target.src = '/images/locations/bedford-park.jpg'; }}
          />
        )}
        <div className="lcn-img-gradient" />

        {/* Floating status badge */}
        {open !== null && (
          <div className={`lcn-live-badge ${open ? 'lcn-live-open' : 'lcn-live-closed'}`}>
            <span className="lcn-live-dot" />
            {open ? 'Open Now' : 'Closed'}
          </div>
        )}

        {/* Distance badge */}
        {tier && distMiles !== null && (
          <div className="lcn-dist-badge" style={{ borderColor: tier.color + '66', background: 'rgba(0,0,0,0.75)' }}>
            <span style={{ color: tier.color }}>{tier.icon}</span>
            <span style={{ color: tier.color }}>
              {distMiles < 0.5 ? 'Nearby' : `${distMiles.toFixed(1)} mi`}
            </span>
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
            <MapPin size={12} /> Info
          </button>
          <button
            className={`lcn-tab ${flipped ? 'lcn-tab-active' : ''}`}
            onClick={() => setFlipped(true)}
          >
            <Clock size={12} /> Hours
          </button>
        </div>

        {/* Info Panel */}
        {!flipped ? (
          <div className="lcn-info-panel">
            <div className="lcn-info-row">
              <MapPin size={14} className="lcn-info-icon" />
              <div>
                <p className="lcn-info-label">Address</p>
                <p className="lcn-info-value">{loc.brief_address}</p>
              </div>
            </div>

            {loc.phone_number && (
              <div className="lcn-info-row">
                <Phone size={14} className="lcn-info-icon" />
                <div>
                  <p className="lcn-info-label">Phone</p>
                  <a href={`tel:${loc.phone_number}`} className="lcn-phone">{loc.phone_number}</a>
                </div>
              </div>
            )}

            <div className="lcn-info-row">
              <Wifi size={14} className="lcn-info-icon" />
              <div>
                <p className="lcn-info-label">Delivery Zone</p>
                <p className="lcn-info-value">
                  {tier && distMiles !== null
                    ? `${tier.icon} ${tier.label}`
                    : loc.delivery_radius_miles
                      ? `${loc.delivery_radius_miles} mile radius`
                      : 'Contact for details'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="lcn-hours-panel">
            {hoursTable.map(({ day, hours, isToday }) => (
              <div key={day} className={`lcn-hr-row ${isToday ? 'lcn-hr-today' : ''}`}>
                <span className="lcn-hr-day">{day.slice(0, 3)}</span>
                <div className="lcn-hr-dots" />
                <span className="lcn-hr-time">{hours}</span>
                {isToday && (
                  <span className={`lcn-today-badge ${open ? 'lcn-today-open' : 'lcn-today-closed'}`}>
                    {open ? '● OPEN' : '● CLOSED'}
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
            Get Directions
          </a>
          <a href={`tel:${loc.phone_number}`} className="lcn-btn-call">
            <Phone size={14} />
            Call
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
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [userCoords, setUserCoords] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    locationsAPI.getAll()
      .then(data => {
        const arr = Array.isArray(data) ? data.slice(0, 3) : [];
        setLocations(arr.length > 0 ? arr : FALLBACK_LOCATIONS);
      })
      .catch(() => setLocations(FALLBACK_LOCATIONS))
      .finally(() => setLoading(false));
  }, []);

  const sortedLocations = userCoords
    ? [...locations].sort((a, b) => {
        const dA = (a.latitude && a.longitude) ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(a.latitude), parseFloat(a.longitude)) : 9999;
        const dB = (b.latitude && b.longitude) ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(b.latitude), parseFloat(b.longitude)) : 9999;
        return dA - dB;
      })
    : locations;

  const locationsSchema = {
    "@context": "https://schema.org",
    "@graph": locations.map(loc => ({
      "@type": "Restaurant",
      "@id": `https://habibihalalexpress.com/locations#${getAnchorId(loc.title)}`,
      "name": `Habibi Halal Express - ${loc.title}`,
      "image": "https://habibihalalexpress.com/images/logos/logo.png",
      "telephone": loc.phone_number || "+1-718-561-0001",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": loc.brief_address || loc.exact_address,
        "addressLocality": "Bronx",
        "addressRegion": "NY",
        "addressCountry": "US"
      },
      "openingHours": loc.working_days_hours || "Mo-Su 11:00-23:00",
      "servesCuisine": ["Halal", "Mediterranean", "Middle Eastern"],
      "priceRange": "$$"
    }))
  };

  return (
    <div className="locations-page page-watermark">
      <SEO
        title="Locations | 3 Bronx Outlets & Tri-State Delivery"
        description="Find a Habibi Halal Express outlet near you in the Bronx. Locations include Bedford Park & Jerome Ave, Lehman College Area, and Bronx Science Area."
        keywords="halal food nyc, locations habibi halal, bedford park restaurant, lehman college food, bronx halal"
        schema={locations.length > 0 ? locationsSchema : null}
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
            <span>3 Locations · Bronx, NY</span>
          </div>
          <h1 className="loc-hero-title">
            Find Us <span className="loc-hero-accent">Near You</span>
          </h1>
          <p className="loc-hero-sub">
            Serving authentic Halal cuisine across the Bronx, open early, close late, always fresh.
          </p>
          <a href="#locations-grid" className="loc-hero-scroll">
            <span>Explore Locations</span>
            <ChevronDown size={18} className="loc-scroll-arrow" />
          </a>
        </div>

        {/* Stats bar */}
        <div className="loc-hero-stats">
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">3</span>
            <span className="loc-hero-stat-label">Locations</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">365</span>
            <span className="loc-hero-stat-label">Days / Year</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <span className="loc-hero-stat-num">300+</span>
            <span className="loc-hero-stat-label">Mile Delivery</span>
          </div>
          <div className="loc-hero-stat-divider" />
          <div className="loc-hero-stat">
            <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <span className="loc-hero-stat-num">4.9</span>
            <span className="loc-hero-stat-label">Rating</span>
          </div>
        </div>
      </div>

      <div className="container loc-body">

        {/* ── Section Header ── */}
        <div className="loc-section-header" id="locations-grid">
          <div className="loc-section-label">
            <span className="loc-eyebrow-dot" />
            <span className="loc-eyebrow">OUR NETWORK</span>
          </div>
          <h2 className="loc-section-title">All <span className="text-primary">Locations</span></h2>
          <p className="loc-section-desc">
            {userCoords ? 'Sorted by proximity to your location' : 'Tap a card to view hours or get directions'}
          </p>
        </div>

        {/* ── Cards Grid ── */}
        {loading ? (
          <div className="loc-loading">
            <div className="loc-loading-ring">
              <div className="loading-spinner" />
            </div>
            <p>Finding locations near you...</p>
          </div>
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
              <div className="cov-ring cov-r1" />
              <div className="cov-ring cov-r2" />
              <div className="cov-ring cov-r3" />
              <div className="cov-ring cov-r4" />
              {/* Center pulse */}
              <div className="cov-center">
                <div className="cov-pulse" />
                <div className="cov-dot" />
              </div>
              {/* Orbiting dots */}
              <div className="cov-orbit cov-orbit-1"><div className="cov-orbit-dot" /></div>
              <div className="cov-orbit cov-orbit-2"><div className="cov-orbit-dot" /></div>
              <div className="cov-orbit cov-orbit-3"><div className="cov-orbit-dot" /></div>
            </div>
            <div className="coverage-stat-center">
              <p className="coverage-num"><AnimatedCounter target="300" suffix="+" /></p>
              <p className="coverage-unit">MILE RADIUS</p>
            </div>
          </div>

          {/* Right: text */}
          <div className="coverage-text">
            <p className="loc-eyebrow">📦 DELIVERY COVERAGE</p>
            <h2 className="coverage-title">
              Broadening the<br /><span className="text-primary">Halal Horizon</span>
            </h2>
            <p className="coverage-desc">
              We don't just deliver to your doorstep, we bridge the gap between premium Halal artistry
              and the tri-state area. Our long-distance logistics network ensures your feast arrives
              with the same precision it was crafted with.
            </p>

            {/* Delivery tiers */}
            <div className="coverage-tiers">
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#22c55e' }} />
                <div>
                  <p className="cov-tier-label">🏠 In-House Delivery</p>
                  <p className="cov-tier-range">Up to 3 miles · ~25 min</p>
                </div>
              </div>
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#3b82f6' }} />
                <div>
                  <p className="cov-tier-label">⚡ Express Delivery</p>
                  <p className="cov-tier-range">3–10 miles · ~45 min</p>
                </div>
              </div>
              <div className="cov-tier">
                <div className="cov-tier-dot" style={{ background: '#f59e0b' }} />
                <div>
                  <p className="cov-tier-label">🚀 Long Distance</p>
                  <p className="cov-tier-range">10–350 miles · Scheduled</p>
                </div>
              </div>
            </div>

            <div className="coverage-metrics">
              <div className="coverage-metric">
                <span><AnimatedCounter target="25" suffix=" min" /></span>
                <p>Avg. Delivery</p>
              </div>
              <div className="coverage-metric">
                <span><AnimatedCounter target="10" suffix="K+" /></span>
                <p>Orders Delivered</p>
              </div>
              <div className="coverage-metric">
                <span>4.9 ★</span>
                <p>Customer Rating</p>
              </div>
            </div>

            <Link to="/menu" className="btn btn-primary loc-cta-btn">
              Order Now ➔
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Locations;
