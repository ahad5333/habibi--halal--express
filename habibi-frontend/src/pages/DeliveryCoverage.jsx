import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { MapPin, Clock, Phone, Truck, ChevronRight, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { locationsAPI } from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './DeliveryCoverage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const BRONX_CENTER = [40.8448, -73.8648];
const MILES_TO_METERS = 1609.34;

// Straight-line distance — matches the radius each location is actually configured with.
function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Neighborhoods within our real delivery radii — verified against each
// location's actual delivery_radius_miles, not just "somewhere in the Bronx".
// Kept deliberately conservative: a neighborhood's centroid can be in range while
// its far edge isn't, so use the address checker above for a definitive answer.
const COVERED_AREAS = [
  'Hunts Point', 'Longwood', 'Melrose',
  'Morrisania', 'Crotona Park East', 'Claremont Village', 'Tremont',
  'Fordham', 'Belmont', 'Morris Heights', 'University Heights',
  'Kingsbridge', 'Riverdale', 'Norwood', 'Woodlawn', 'Wakefield',
  'Co-op City', 'Pelham Bay', 'Soundview',
  'Eastchester', 'Williamsbridge', 'Baychester',
  'East Tremont', 'West Farms', 'Van Cortlandt Park',
];

export default function DeliveryCoverage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [checkAddr, setCheckAddr] = useState('');
  const [checking, setChecking]   = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    locationsAPI.getAll()
      .then(d => setLocations(Array.isArray(d) ? d.filter(l => l.is_active) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Init the coverage map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: BRONX_CENTER,
      zoom: 12,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Draw each location's marker + real delivery-radius circle once locations load
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const withCoords = locations.filter(l => l.latitude && l.longitude);
    if (withCoords.length === 0) return;

    withCoords.forEach((loc, i) => {
      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);
      const radiusMiles = parseFloat(loc.delivery_radius_miles) || 5;

      L.circle([lat, lng], {
        radius: radiusMiles * MILES_TO_METERS,
        color: '#E5B64E',
        weight: 1.5,
        fillColor: '#E5B64E',
        fillOpacity: 0.08,
      }).addTo(layer);

      const pinIcon = L.divIcon({
        className: '',
        html: `<div class="dc-map-pin">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([lat, lng], { icon: pinIcon }).addTo(layer).bindPopup(
        `<strong>${loc.title}</strong><br>${loc.brief_address || loc.exact_address || ''}<br>${radiusMiles} mi delivery radius`
      );
    });

    if (!fittedRef.current) {
      const bounds = L.latLngBounds(withCoords.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]));
      map.fitBounds(bounds.pad(0.4), { maxZoom: 13 });
      fittedRef.current = true;
    }
  }, [locations]);

  const handleCheckAddress = async () => {
    const addr = checkAddr.trim();
    if (!addr) return;
    if (locations.length === 0) {
      setCheckResult({ error: 'Still loading our locations — try again in a moment.' });
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/dispatch/geocode?addr=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok || typeof data.lat !== 'number') {
        setCheckResult({ error: "We couldn't find that address. Try adding the city and state." });
        return;
      }
      const ranked = locations
        .filter(l => l.latitude && l.longitude)
        .map(l => ({ ...l, distance: haversineMiles(data.lat, data.lng, parseFloat(l.latitude), parseFloat(l.longitude)) }))
        .sort((a, b) => a.distance - b.distance);
      const nearest = ranked[0];
      const radius = parseFloat(nearest?.delivery_radius_miles) || 5;
      setCheckResult({ nearest, inRange: !!nearest && nearest.distance <= radius, radius });
    } catch {
      setCheckResult({ error: 'Something went wrong checking that address. Please try again.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="dc-page">
      <SEO
        title="Delivery Coverage | Habibi Halal Express"
        description="Check if Habibi Halal Express delivers to your area in the Bronx. See our delivery zones and estimated times."
        keywords="halal food delivery bronx, habibi delivery zone, halal delivery near me"
      />
      {/* Hero */}
      <div className="dc-hero">
        <img
          className="dc-hero-img"
          src="/images/banners/delivery-coverage-hero.webp"
          alt=""
          loading="eager"
          fetchpriority="high"
        />
        <div className="dc-hero-overlay" />
        <div className="dc-hero-content">
          <p className="dc-eyebrow">DELIVERY COVERAGE</p>
          <h1 className="dc-title">Where Can We Deliver?</h1>
          <p className="dc-sub">Fresh, hot Halal food delivered across the Bronx and surrounding areas. Check if your neighborhood is in range.</p>
          <div className="dc-hero-badges">
            <span className="dc-badge"><Truck size={14} /> Fast Delivery</span>
            <span className="dc-badge"><CheckCircle size={14} /> All NYC Locations</span>
            <span className="dc-badge"><MapPin size={14} /> {COVERED_AREAS.length}+ Neighborhoods</span>
          </div>
        </div>
      </div>

      <div className="dc-container">
        {/* Address checker */}
        <section className="dc-checker-section">
          <div className="dc-checker-box">
            <h2 className="dc-checker-title"><Search size={18} /> Check Your Address</h2>
            <p className="dc-checker-sub">Enter your address for a definitive answer — more accurate than the neighborhood list below.</p>
            <div className="dc-checker-row">
              <input
                type="text"
                className="dc-checker-input"
                placeholder="e.g. 2 E Kingsbridge Rd, Bronx, NY"
                value={checkAddr}
                onChange={e => setCheckAddr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCheckAddress()}
              />
              <button className="dc-checker-btn" onClick={handleCheckAddress} disabled={checking || !checkAddr.trim()}>
                {checking ? 'Checking…' : 'Check'}
              </button>
            </div>

            {checkResult?.error && (
              <p className="dc-checker-error"><AlertCircle size={14} /> {checkResult.error}</p>
            )}

            {checkResult && !checkResult.error && checkResult.inRange && (
              <div className="dc-checker-result dc-checker-result--yes">
                <CheckCircle size={22} />
                <div className="dc-checker-result-text">
                  <p className="dc-checker-result-title">You're in range!</p>
                  <p className="dc-checker-result-sub">
                    {checkResult.nearest.distance.toFixed(1)} mi from our {checkResult.nearest.title} location.
                  </p>
                </div>
                <Link to={`/checkout?location=${checkResult.nearest.id}`} className="dc-checker-cta">
                  Order Now <ChevronRight size={14} />
                </Link>
              </div>
            )}

            {checkResult && !checkResult.error && !checkResult.inRange && (
              <div className="dc-checker-result dc-checker-result--no">
                <AlertCircle size={22} />
                <div className="dc-checker-result-text">
                  <p className="dc-checker-result-title">
                    {checkResult.nearest?.distance <= checkResult.radius * 1.5 ? 'Just outside our delivery zone' : 'Outside our delivery zone'}
                  </p>
                  <p className="dc-checker-result-sub">
                    Our nearest location ({checkResult.nearest?.title}) is {checkResult.nearest?.distance.toFixed(1)} mi away, past its {checkResult.radius} mi delivery radius. You're welcome to order for pickup, or call us to ask.
                  </p>
                </div>
                <Link to="/menu" className="dc-checker-cta dc-checker-cta--outline">
                  Order Pickup <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Map embed */}
        <section className="dc-map-section">
          <div className="dc-map-hdr">
            <h2 className="dc-section-title">Coverage Map</h2>
            <p className="dc-section-sub">Our 3 Bronx locations, each with its own delivery radius shown below.</p>
          </div>
          <div className="dc-map-wrap">
            <div ref={mapContainerRef} className="dc-map-container" role="img" aria-label="Map showing our delivery locations and their delivery radii" />
            <p className="dc-map-credit">
              Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, tiles by <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>
            </p>
          </div>
        </section>

        {/* Location cards */}
        <section className="dc-locations-section">
          <h2 className="dc-section-title">Our Delivery Locations</h2>
          <p className="dc-section-sub">Each location has its own delivery radius. Order from the nearest one for the fastest service.</p>

          {loading ? (
            <div className="dc-loading"><div className="dc-spinner" /></div>
          ) : (
            <div className="dc-loc-grid">
              {locations.map((loc, i) => (
                <div key={loc.id} className="dc-loc-card">
                  <div className="dc-loc-num">{i + 1}</div>
                  <div className="dc-loc-body">
                    <h3 className="dc-loc-title">{loc.title}</h3>
                    <p className="dc-loc-addr">{loc.brief_address || loc.exact_address}</p>
                    <div className="dc-loc-meta">
                      {loc.phone_number && (
                        <span className="dc-loc-meta-item"><Phone size={11} /> {loc.phone_number}</span>
                      )}
                      {loc.working_days_hours && (
                        <span className="dc-loc-meta-item"><Clock size={11} /> {loc.working_days_hours}</span>
                      )}
                      <span className="dc-loc-meta-item dc-radius">
                        <MapPin size={11} /> {loc.delivery_radius_miles || 5} mi radius · ${parseFloat(loc.delivery_cost || 0).toFixed(2)} fee
                      </span>
                    </div>
                    <div className={`dc-loc-status ${loc.accepting_orders !== false ? 'open' : 'closed'}`}>
                      <span className="dc-loc-dot" />
                      {loc.accepting_orders !== false ? 'Accepting Orders' : 'Currently Closed'}
                    </div>
                  </div>
                  <Link to={`/checkout?location=${loc.id}`} className="dc-order-btn">
                    Order <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Neighborhoods */}
        <section className="dc-neighborhoods-section">
          <h2 className="dc-section-title">Neighborhoods We Cover</h2>
          <p className="dc-section-sub">A general guide to our reach — some addresses near the edge of a neighborhood may fall outside our radius. Use the address checker above for a definitive answer.</p>
          <div className="dc-neighborhood-grid">
            {COVERED_AREAS.map(area => (
              <div key={area} className="dc-neighborhood-chip">
                <CheckCircle size={12} className="dc-chip-icon" /> {area}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="dc-cta">
          <div className="dc-cta-inner">
            <h2 className="dc-cta-title">Ready to Order?</h2>
            <p className="dc-cta-sub">Browse our full menu and place your order in minutes.</p>
            <div className="dc-cta-btns">
              <Link to="/menu" className="btn-dc-primary">View Full Menu</Link>
              <Link to="/checkout" className="btn-dc-secondary">Order Now</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
