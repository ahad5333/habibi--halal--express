import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { locationsAPI } from '../services/api';
import SEO from '../components/SEO';
import './Locations.css';

/* ── Helpers ──────────────────────────────────────────────── */
const DAYS       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const getLocationImage = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))                              return '/images/locations/bedford-park.jpg';
  if (t.includes('kingsbridge') || t.includes('king'))   return '/images/locations/kings-bridge.jpg';
  if (t.includes('white plains') || t.includes('white-plains')) return '/images/locations/white-plains.jpg';
  if (t.includes('lehman'))                              return '/images/hero_dining_ambiance.jpg';
  if (t.includes('bronx') || t.includes('science'))     return '/images/chef-plating.jpg';
  return '/images/mixed-platter.jpg';
};

const getShortTitle = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('bedford'))                            return 'BEDFORD PARK';
  if (t.includes('lehman'))                             return 'LEHMAN';
  if (t.includes('bronx') || t.includes('science'))    return 'BRONX SCIENCE';
  if (t.includes('kingsbridge'))                        return 'KINGSBRIDGE';
  if (t.includes('white plains'))                       return 'WHITE PLAINS';
  return (title || '').toUpperCase().split(/\s+/).slice(0, 3).join(' ');
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
    image_url: '/images/locations/bedford-park.jpg',
  },
  {
    id: 2, title: 'Lehman College Area',
    brief_address: '250 Bedford Park Blvd W, Bronx, NY 10468',
    phone_number: '(718) 367-7879',
    working_days_hours: 'Mon – Sun: 7AM – 11PM',
    delivery_radius_miles: 4, is_active: true, preference_level: 4,
    image_url: '/images/hero_dining_ambiance.jpg',
  },
  {
    id: 3, title: 'Bronx High School of Science',
    brief_address: '75 W 205th St, Bronx, NY 10468',
    phone_number: '(718) 367-7880',
    working_days_hours: 'Mon – Fri: 6AM – 10PM',
    delivery_radius_miles: 4, is_active: true, preference_level: 3,
    image_url: '/images/chef-plating.jpg',
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
  if (miles <= 3)   return { label: 'In-House Delivery', color: '#22c55e' };
  if (miles <= 10)  return { label: 'Express Delivery',   color: '#3b82f6' };
  if (miles <= 350) return { label: 'Long Distance',       color: '#f59e0b' };
  return                   { label: 'Pickup Only',          color: '#6b7280' };
}

/* ── Location Card ─────────────────────────────────────────── */
function LocationCard({ loc, userCoords }) {
  const img        = loc.image_url || getLocationImage(loc.title);
  const open       = isOpenNow(loc.working_days_hours);
  const anchorId   = getAnchorId(loc.title);
  const hoursTable = parseHoursTable(loc.working_days_hours);

  const distKm    = (userCoords && loc.latitude && loc.longitude)
    ? haversineKm(userCoords.lat, userCoords.lng, parseFloat(loc.latitude), parseFloat(loc.longitude))
    : null;
  const distMiles = distKm !== null ? distKm * 0.621371 : null;
  const tier      = getDeliveryTier(distMiles);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.title + ' ' + (loc.brief_address || 'Bronx, NY'))}`;

  return (
    <div id={anchorId} className="lcn-card">
      {/* ── Photo ── */}
      <div className="lcn-img-wrap">
        <img
          src={img}
          alt={loc.title}
          className="lcn-img"
          onError={e => { e.target.src = '/images/food/background.png'; }}
        />
        <div className="lcn-img-overlay" />
        <div className="lcn-location-label">
          <MapPin size={20} className="lcn-pin-icon" />
          <div>
            <p className="lcn-city">{getShortTitle(loc.title)}</p>
            <p className="lcn-state">Bronx, New York</p>
          </div>
        </div>
        {open !== null && (
          <span className={`lcn-status-pill ${open ? 'lcn-pill-open' : 'lcn-pill-closed'}`}>
            {open ? 'Open Now' : 'Closed'}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="lcn-body">
        <div className="lcn-two-col">
          {/* Left: Address + Phone */}
          <div className="lcn-col-left">
            <p className="lcn-col-label">Address</p>
            <p className="lcn-address">{loc.brief_address}</p>

            {loc.phone_number && (
              <>
                <p className="lcn-col-label lcn-label-mt">Phone</p>
                <a href={`tel:${loc.phone_number}`} className="lcn-phone">{loc.phone_number}</a>
              </>
            )}

            {tier && distMiles !== null && (
              <span
                className="lcn-tier-badge"
                style={{ color: tier.color, borderColor: tier.color + '55', background: tier.color + '18' }}
              >
                {distMiles < 0.5 ? 'Nearby' : `${distMiles.toFixed(1)} mi`} · {tier.label}
              </span>
            )}
            {!distMiles && loc.delivery_radius_miles && (
              <span className="lcn-radius-info">{loc.delivery_radius_miles} mi delivery zone</span>
            )}
          </div>

          {/* Right: Store Hours */}
          <div className="lcn-col-right">
            <p className="lcn-col-label">Store Hours</p>
            <div className="lcn-hours">
              {hoursTable.map(({ day, hours, isToday }) => (
                <div key={day} className={`lcn-hr${isToday ? ' lcn-hr-today' : ''}`}>
                  <span className="lcn-hr-day">{day.slice(0, 3)}</span>
                  <span className="lcn-hr-time">{hours}</span>
                  {isToday && (
                    <span className={`lcn-hr-badge ${open ? 'lcn-badge-open' : 'lcn-badge-closed'}`}>
                      {open ? 'OPEN' : 'CLOSED'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Directions button */}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="lcn-directions-btn">
          Get Directions
        </a>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
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
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": parseFloat(loc.latitude) || 40.873426,
        "longitude": parseFloat(loc.longitude) || -73.890060
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

      {/* ── Header ── */}
      <div className="loc-header">
        <div className="loc-header-overlay" />
        <div className="loc-header-content">
          <div className="loc-header-icon-ring">
            <MapPin size={22} className="loc-header-icon" />
          </div>
          <h1 className="loc-header-title" style={{ color: '#ffffff' }}>Our Locations</h1>
          <p className="loc-header-sub">Serving the Bronx with authentic Halal cuisine at 3 locations</p>
        </div>
      </div>

      <div className="container loc-body">
        {/* Section header */}
        <div className="loc-section-header">
          <div>
            <p className="loc-eyebrow">OUR NETWORK</p>
            <h2 className="loc-section-title">All Locations</h2>
          </div>
          <div className="loc-stats">
            <div className="loc-stat">
              <span className="loc-stat-num">3</span>
              <span className="loc-stat-label">Locations</span>
            </div>
            <div className="loc-stat">
              <span className="loc-stat-num">365</span>
              <span className="loc-stat-label">Days a Year</span>
            </div>
            <div className="loc-stat">
              <span className="loc-stat-num">300+</span>
              <span className="loc-stat-label">Mile Radius</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loc-loading">
            <div className="loading-spinner" />
            <p>Loading locations...</p>
          </div>
        ) : (
          <div className="lcn-grid">
            {sortedLocations.map(loc => (
              <LocationCard key={loc.id} loc={loc} userCoords={userCoords} />
            ))}
          </div>
        )}

        {/* Coverage section */}
        <div className="coverage-section" id="coverage">
          <div className="coverage-rings-wrap">
            <div className="rings">
              <div className="ring r1" />
              <div className="ring r2" />
              <div className="ring r3" />
            </div>
            <div className="coverage-rings-content">
              <h2 className="coverage-num">300+</h2>
              <p className="coverage-unit">MILE RADIUS</p>
              <p className="coverage-quote">"Redefining distance in culinary excellence."</p>
            </div>
          </div>

          <div className="coverage-text">
            <p className="loc-eyebrow">DELIVERY COVERAGE</p>
            <h2 className="coverage-title">
              Broadening the <br /><span className="text-primary">Halal Horizon</span>
            </h2>
            <p className="coverage-desc">
              We don't just deliver to your doorstep — we bridge the gap between premium Halal artistry
              and the tri-state area. Our long-distance logistics network ensures your feast arrives
              with the same precision it was crafted with.
            </p>
            <div className="coverage-metrics">
              <div className="coverage-metric">
                <span>25 min</span>
                <p>Avg. Delivery</p>
              </div>
              <div className="coverage-metric">
                <span>10K+</span>
                <p>Orders Delivered</p>
              </div>
              <div className="coverage-metric">
                <span>4.9 ★</span>
                <p>Customer Rating</p>
              </div>
            </div>
            <Link to="/menu" className="btn btn-primary loc-cta-btn">Order Now ➔</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Locations;
