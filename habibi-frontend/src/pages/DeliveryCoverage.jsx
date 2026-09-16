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

// Straight-line distance, used only to pick which store to quote from.
// Whether we deliver to an address is never decided here — see handleCheckAddress.
function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Neighborhoods we deliver to regularly. This is a familiarity guide, not a
// limit: there is no radius cutoff anywhere in the system, so an address that
// isn't listed here is still quoted and delivered whenever a courier will take
// it. The address checker above is the definitive answer.
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
      attributionControl: false,
    });
    // CARTO's dark_all tiles now need a paid API key and draw "API KEY REQUIRED"
    // over the map without one. Same key-free Esri dark basemap as OrderTracking
    // and DriverMap: the base, plus a separate layer of place labels.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(map);
    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('© <a href="https://openstreetmap.org/copyright">OSM</a> © <a href="https://www.esri.com">Esri</a>')
      .addTo(map);
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

      // No radius circles: nothing in the system caps delivery by distance, so
      // drawing one would claim a boundary that doesn't exist in either
      // direction — it both overstates where we reach and implies we refuse
      // everywhere else. The pins show where we cook; the checker answers
      // whether we deliver to a given address.
      const pinIcon = L.divIcon({
        className: '',
        html: `<div class="dc-map-pin">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([lat, lng], { icon: pinIcon }).addTo(layer).bindPopup(
        `<strong>${loc.title}</strong><br>${loc.brief_address || loc.exact_address || ''}` +
        (loc.accepting_orders === false ? '<br>Pickup only right now' : '')
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
      // Quote from the nearest store that's actually taking online orders — the
      // rest can't fulfil it however close they happen to be.
      const nearest = locations
        .filter(l => l.latitude && l.longitude && l.accepting_orders !== false)
        .map(l => ({ ...l, distance: haversineMiles(data.lat, data.lng, parseFloat(l.latitude), parseFloat(l.longitude)) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) {
        setCheckResult({ error: 'None of our stores are taking online orders right now.' });
        return;
      }

      // The same quote checkout runs, and the only thing that actually decides
      // whether we deliver somewhere. Distance never vetoes it: the owner's rule
      // is that we deliver as far as a courier will go.
      const feeRes = await fetch(`${API_BASE}/api/dispatch/calculate-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_address: addr, location_id: nearest.id, subtotal: 0 }),
      });
      const quote = await feeRes.json();
      if (quote.out_of_range) {
        // A courier genuinely refused this address — the one real "no".
        setCheckResult({ verdict: 'no', nearest });
      } else if (quote.delivery_unavailable || typeof quote.fee !== 'number') {
        // We couldn't get a price just now. Not the same as a refusal, so it
        // must not read like one.
        setCheckResult({ verdict: 'wait', nearest });
      } else {
        setCheckResult({
          verdict: 'yes',
          nearest,
          fee: quote.fee,
          freeDelivery: quote.free_delivery_applied,
          distanceText: quote.distance_text,
          etaText: quote.estimated_delivery_text,
        });
      }
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

            {checkResult?.verdict === 'yes' && (
              <div className="dc-checker-result dc-checker-result--yes">
                <CheckCircle size={22} />
                <div className="dc-checker-result-text">
                  <p className="dc-checker-result-title">Yes — we deliver to you</p>
                  <p className="dc-checker-result-sub">
                    {checkResult.freeDelivery ? 'Delivery is free on this order' : `$${checkResult.fee.toFixed(2)} delivery`}
                    {checkResult.distanceText ? ` · ${checkResult.distanceText}` : ''} from our {checkResult.nearest.title} location
                    {checkResult.etaText ? ` · about ${checkResult.etaText}` : ''}.
                  </p>
                </div>
                <Link to={`/checkout?location=${checkResult.nearest.id}`} className="dc-checker-cta">
                  Order Now <ChevronRight size={14} />
                </Link>
              </div>
            )}

            {checkResult?.verdict === 'no' && (
              <div className="dc-checker-result dc-checker-result--no">
                <AlertCircle size={22} />
                <div className="dc-checker-result-text">
                  <p className="dc-checker-result-title">We can't deliver to this address</p>
                  <p className="dc-checker-result-sub">
                    No courier will pick this one up right now. You're welcome to order for pickup from our {checkResult.nearest.title} location, or call us to ask.
                  </p>
                </div>
                <Link to="/menu" className="dc-checker-cta dc-checker-cta--outline">
                  Order Pickup <ChevronRight size={14} />
                </Link>
              </div>
            )}

            {checkResult?.verdict === 'wait' && (
              <div className="dc-checker-result dc-checker-result--wait">
                <AlertCircle size={22} />
                <div className="dc-checker-result-text">
                  <p className="dc-checker-result-title">We couldn't price delivery just now</p>
                  <p className="dc-checker-result-sub">
                    This isn't a no — we just couldn't reach our courier for a price. Try again in a moment, or start an order and we'll quote it at checkout.
                  </p>
                </div>
                <Link to="/checkout" className="dc-checker-cta dc-checker-cta--outline">
                  Start an Order <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Map embed */}
        <section className="dc-map-section">
          <div className="dc-map-hdr">
            <h2 className="dc-section-title">Coverage Map</h2>
            <p className="dc-section-sub">Our {locations.length > 0 ? `${locations.length} ` : ''}Bronx locations. We deliver well beyond the pins — check your address above for the exact fee.</p>
          </div>
          <div className="dc-map-wrap">
            <div ref={mapContainerRef} className="dc-map-container" role="img" aria-label="Map showing our delivery locations and their delivery radii" />
            <p className="dc-map-credit">
              Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, tiles © <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>
            </p>
          </div>
        </section>

        {/* Location cards */}
        <section className="dc-locations-section">
          <h2 className="dc-section-title">Our Delivery Locations</h2>
          <p className="dc-section-sub">Order from the nearest one for the fastest service.</p>

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
          <p className="dc-section-sub">Where we deliver most often — not a boundary. If your address isn't listed, check it above: we deliver as far as a courier will take us.</p>
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
