import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Phone, MessageSquare, Check, Star, Clock, MapPin, ChevronRight, ShoppingBag, Search, RefreshCw } from 'lucide-react';
import { ordersAPI } from '../services/api';
import './OrderTracking.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Restaurant fixed coordinates (204 E Mosholu Pkwy S, Bronx NY)
const RESTAURANT_LAT = 40.8804;
const RESTAURANT_LNG = -73.8827;

const STEPS = [
  { id: 1, key: 'pending',     label: 'Received',   icon: '📋' },
  { id: 2, key: 'accepted',    label: 'Accepted',   icon: '✅' },
  { id: 3, key: 'preparing',   label: 'Preparing',  icon: '👨‍🍳' },
  { id: 4, key: 'on_the_way',  label: 'On the Way', icon: '🛵' },
  { id: 5, key: 'nearby',      label: 'Nearby',     icon: '📍' },
  { id: 6, key: 'delivered',   label: 'Delivered',  icon: '🎉' },
];

const STATUS_STEP = {
  pending: 1,
  accepted: 2, confirmed: 2,
  preparing: 3, cooking: 3,
  on_the_way: 4, 'in-transit': 4, in_transit: 4,
  nearby: 5,
  delivered: 6, completed: 6,
};

const STATUS_INFO = {
  1: { title: 'Order Received',               sub: 'We got your order and it\'s in the queue. We\'ll confirm shortly.',                          emoji: '📋', color: '#60a5fa' },
  2: { title: 'Order Accepted',               sub: 'The kitchen confirmed your order and is firing up the grill. Hang tight!',                  emoji: '✅', color: '#34d399' },
  3: { title: 'Chef is Crafting Perfection',  sub: 'Your order is on the grill. Every cut meets our Habibi gold standard.',                     emoji: '👨‍🍳', color: '#E5B64E', animate: 'chef' },
  4: { title: 'Driver is On The Way',         sub: 'Your order has been picked up and is heading to you now. Track live below.',                 emoji: '🛵', color: '#a78bfa', animate: 'drive' },
  5: { title: 'Almost There!',                sub: 'Your driver is nearby. Please be ready to receive your order.',                              emoji: '📍', color: '#f97316', animate: 'nearby' },
  6: { title: 'Order Delivered!',             sub: 'Your meal has arrived. Enjoy every bite — made with Habibi love. ✨',                        emoji: '🎉', color: '#4ade80', animate: 'delivered' },
};

const DRIVER = { name: 'Ahmad K.', rating: 4.9, deliveries: '1.2K' };

function statusToStep(status) {
  return STATUS_STEP[(status || '').toLowerCase()] || 1;
}

/* ── Bearing between two coords (degrees 0-360) ────────── */
function calcBearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/* ── Build rider marker HTML ────────────────────────────── */
function riderMarkerHtml(bearing = 0) {
  const flip = bearing > 180 ? 'scaleX(-1)' : 'scaleX(1)';
  return `
    <div class="ot-rider-wrap">
      <div class="ot-rider-body">
        <div class="ot-rider-ring ot-rider-ring1"></div>
        <div class="ot-rider-ring ot-rider-ring2"></div>
        <div class="ot-rider-avatar">
          <span class="ot-rider-scooter" style="display:inline-block;transform:${flip}">🛵</span>
        </div>
      </div>
      <div class="ot-rider-tag">
        <span class="ot-rider-dot"></span>Your Rider
      </div>
    </div>
  `;
}

/* ── Haversine distance ─────────────────────────────────── */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/* ── Leaflet loader ─────────────────────────────────────── */
function loadLeaflet() {
  return new Promise(resolve => {
    if (window.L) { resolve(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

/* ── Geocode via Nominatim (no API key) ────────────────── */
async function geocodeAddress(addr) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const [res] = await r.json();
    if (!res) return null;
    return { lat: parseFloat(res.lat), lng: parseFloat(res.lon) };
  } catch { return null; }
}

export default function OrderTracking() {
  const [params] = useSearchParams();
  const urlOrder = params.get('order') || '';

  const [searchInput, setSearchInput]   = useState(urlOrder || localStorage.getItem('last_order_number') || '');
  const [orderNum, setOrderNum]         = useState('');
  const [order, setOrder]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [notFound, setNotFound]         = useState(false);
  const [currentStep, setCurrentStep]   = useState(1);
  const [etaSeconds, setEtaSeconds]     = useState(22 * 60 + 37);
  const [etaFromGPS, setEtaFromGPS]     = useState(null); // recalculated from live GPS
  const [showItems, setShowItems]       = useState(false);
  const [driverProgress, setDriverProgress] = useState(0);
  const [liveConnected, setLiveConnected]   = useState(false);
  const [driverLatLng, setDriverLatLng]     = useState(null);
  const [leafletReady, setLeafletReady]     = useState(false);
  const [queuePosition, setQueuePosition]   = useState(null); // null = not in queue, 0 = next up, N = N orders ahead
  const [driverInfo, setDriverInfo]         = useState(null); // { name, phone, rating } from dispatch

  const socketRef            = useRef(null);
  const timerRef             = useRef(null);
  const mapContainerRef      = useRef(null);  // DOM div for Leaflet
  const leafletRef           = useRef(null);  // L.Map instance
  const driverMarkerRef      = useRef(null);  // L.Marker for driver
  const customerLatRef       = useRef(null);  // geocoded customer lat
  const customerLngRef       = useRef(null);  // geocoded customer lng
  const assignmentIdRef      = useRef(null);  // active delivery assignment ID
  const prevDriverLatLngRef  = useRef(null);  // previous GPS position for bearing calc

  // ── Fetch queue position ──────────────────────────────────
  const fetchQueuePosition = async (num) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/queue/${encodeURIComponent(num)}`);
      if (!res.ok) return;
      const data = await res.json();
      setQueuePosition(data.position ?? null);
    } catch (_) {}
  };

  // ── Fetch order ──────────────────────────────────────────
  const fetchOrder = async (num) => {
    if (!num) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await ordersAPI.track(num.trim().toUpperCase());
      setOrder(data);
      const step = statusToStep(data.order_status);
      setCurrentStep(step);
      setOrderNum(data.order_number || num.trim().toUpperCase());
      // Fetch queue position for orders still in the kitchen queue
      if (['pending', 'accepted', 'preparing'].includes((data.order_status || '').toLowerCase())) {
        fetchQueuePosition(data.order_number || num.trim().toUpperCase());
      } else {
        setQueuePosition(null);
      }
      if (step >= 4) setDriverProgress(step === 4 ? 40 : step === 5 ? 80 : 100);

      // Fetch delivery assignment for this order
      if (data.delivery_method !== 'pickup') {
        fetch(`${API_BASE}/api/dispatch/order/${data.order_number || num}`)
          .then(r => r.json())
          .then(assignment => {
            if (!assignment) return;
            assignmentIdRef.current = assignment.id;
            if (assignment.current_lat && assignment.current_lng) {
              setDriverLatLng({ lat: parseFloat(assignment.current_lat), lng: parseFloat(assignment.current_lng) });
            }
            // Set real driver info if available from assignment
            if (assignment.driver_name || assignment.driver_phone) {
              setDriverInfo({
                name:   assignment.driver_name  || 'Your Driver',
                phone:  assignment.driver_phone || '',
                rating: assignment.driver_rating || null,
              });
            }
          })
          .catch(() => {});
      }
    } catch {
      setNotFound(true);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = urlOrder || localStorage.getItem('last_order_number') || '';
    if (initial) fetchOrder(initial);
  }, []); // eslint-disable-line

  // ── ETA countdown (static until GPS available) ───────────
  useEffect(() => {
    if (currentStep >= 6 || !order) return;
    timerRef.current = setInterval(() => setEtaSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [currentStep, order]);

  // ── Socket.IO ────────────────────────────────────────────
  useEffect(() => {
    if (!orderNum) return;
    const token = localStorage.getItem('habibi_token');
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setLiveConnected(true);
      socket.emit('join_order', orderNum);
    });
    socket.on('disconnect', () => setLiveConnected(false));
    socket.on('connect_error', () => setLiveConnected(false));

    socket.on('order_status_updated', ({ status }) => {
      const step = statusToStep(status);
      setCurrentStep(step);
      if (step >= 4) setDriverProgress(step === 4 ? 40 : step === 5 ? 80 : 100);
      // Clear queue position once order moves past kitchen queue
      if (!['pending', 'accepted', 'preparing'].includes(status)) setQueuePosition(null);
    });

    // Live queue position updates broadcast whenever any order status changes
    socket.on('queue_update', ({ position }) => {
      setQueuePosition(position ?? null);
    });

    // Real GPS from driver app (backend emits 'driver_location_update')
    socket.on('driver_location_update', ({ lat, lng, assignment_id }) => {
      // Only accept if this is our assignment (or we haven't identified one yet)
      if (assignment_id && assignmentIdRef.current && assignment_id !== assignmentIdRef.current) return;
      setDriverLatLng({ lat, lng });
      setDriverProgress(prev => Math.min(prev + 1, 95)); // smooth visual progress

      // Recalculate ETA from Haversine if we have the customer location
      if (customerLatRef.current && customerLngRef.current) {
        const km = haversineKm(lat, lng, customerLatRef.current, customerLngRef.current);
        const etaMin = Math.ceil((km / 24) * 60); // ~15 mph NYC
        setEtaFromGPS(etaMin);
        setEtaSeconds(etaMin * 60);
      }
    });

    return () => socket.disconnect();
  }, [orderNum]);

  // ── Load Leaflet when order is delivery + confirmed ───────
  useEffect(() => {
    if (!order || order.delivery_method === 'pickup') return;
    loadLeaflet().then(() => setLeafletReady(true));
  }, [order]);

  // ── Initialize Leaflet map ────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || leafletRef.current) return;
    const L = window.L;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    // CartoDB Dark Matter — no API key required
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Attribution bottom-right
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    // Restaurant pin
    const goldDot = L.divIcon({
      className: '',
      html: `<div style="background:#E5B64E;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(229,182,78,0.9);"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    L.marker([RESTAURANT_LAT, RESTAURANT_LNG], { icon: goldDot })
      .addTo(map)
      .bindPopup('<strong style="font-family:sans-serif">🏪 Habibi Halal Express</strong>');

    map.setView([RESTAURANT_LAT, RESTAURANT_LNG], 14);
    leafletRef.current = map;

    // Geocode customer delivery address
    if (order?.delivery_address) {
      const fullAddr = [order.delivery_address, order.delivery_city, 'NY 10000'].filter(Boolean).join(', ');
      geocodeAddress(fullAddr).then(pos => {
        if (!pos || !leafletRef.current) return;
        customerLatRef.current = pos.lat;
        customerLngRef.current = pos.lng;

        const greenDot = L.divIcon({
          className: '',
          html: `<div style="background:#4ade80;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(74,222,128,0.9);"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        L.marker([pos.lat, pos.lng], { icon: greenDot })
          .addTo(leafletRef.current)
          .bindPopup('<strong style="font-family:sans-serif">📍 Your Location</strong>');

        leafletRef.current.fitBounds(
          [[RESTAURANT_LAT, RESTAURANT_LNG], [pos.lat, pos.lng]],
          { padding: [40, 40] }
        );
      });
    }
  }, [leafletReady, order]);

  // ── Update driver marker on GPS change ────────────────────
  useEffect(() => {
    if (!leafletRef.current || !driverLatLng) return;
    const L = window.L;
    const { lat, lng } = driverLatLng;

    // Bearing from previous position (default 90° = east on first fix)
    const prev = prevDriverLatLngRef.current;
    const bearing = prev ? calcBearing(prev.lat, prev.lng, lat, lng) : 90;
    prevDriverLatLngRef.current = { lat, lng };

    const riderIcon = L.divIcon({
      className: '',
      html: riderMarkerHtml(bearing),
      iconSize: [72, 70],
      iconAnchor: [36, 22],  // anchor at center of avatar circle
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([lat, lng]);
      driverMarkerRef.current.setIcon(riderIcon);
    } else {
      driverMarkerRef.current = L.marker([lat, lng], { icon: riderIcon, zIndexOffset: 1000 })
        .addTo(leafletRef.current)
        .bindPopup('<strong style="font-family:sans-serif">🛵 Your Driver</strong>');
    }

    // Pan map to keep driver in view
    leafletRef.current.panTo([lat, lng], { animate: true, duration: 1.5 });
  }, [driverLatLng]);

  // ── Simulate driver movement for demo (step 4 only) ────────
  useEffect(() => {
    if (currentStep !== 4 || driverLatLng) return; // skip if we have real GPS
    let prog = driverProgress || 20;
    const iv = setInterval(() => {
      prog = Math.min(75, prog + 1);
      setDriverProgress(prog);
      if (prog >= 75) clearInterval(iv);
    }, 3000);
    return () => clearInterval(iv);
  }, [currentStep]); // eslint-disable-line

  const fmtEta = (s) => {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  };
  const isDelivered = currentStep >= 6;
  const status = STATUS_INFO[currentStep] || STATUS_INFO[1];
  const isDeliveryOrder = order && order.delivery_method !== 'pickup';

  // Fake truck position (CSS map fallback when Leaflet not loaded)
  const truckLeft = 20 + (driverProgress / 100) * 55;

  return (
    <div className="ot-page">

      {/* ── Order lookup bar ── */}
      <div className="ot-lookup-bar">
        <div className="container ot-lookup-inner">
          <form
            className="ot-lookup-form"
            onSubmit={e => { e.preventDefault(); fetchOrder(searchInput); }}
          >
            <Search size={15} className="ot-lookup-icon" />
            <input
              className="ot-lookup-input"
              placeholder="Enter order number (e.g. HAB-1234567890)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value.toUpperCase())}
            />
            <button type="submit" className="ot-lookup-btn" disabled={loading}>
              {loading ? <RefreshCw size={14} className="spin" /> : 'Track'}
            </button>
          </form>
          {liveConnected && orderNum && (
            <div className="ot-live-pill">
              <span className="dot-pulse" /> Live
            </div>
          )}
        </div>
      </div>

      {/* ── Not found ── */}
      {notFound && (
        <div className="container ot-not-found">
          <p>Order not found. Check your order number and try again.</p>
          <p className="ot-not-found-sub">Look for <strong>HAB-</strong> in your confirmation email.</p>
        </div>
      )}

      {/* ── No order yet ── */}
      {!order && !notFound && !loading && (
        <div className="container ot-empty-state">
          <span className="ot-empty-icon">🛵</span>
          <h2>Track Your Order</h2>
          <p>Enter your order number above to see live status updates.</p>
          <Link to="/menu" className="btn btn-primary" style={{ marginTop: '1rem' }}>Place an Order</Link>
        </div>
      )}

      {order && (
        <>
          {/* ── Top bar ── */}
          <div className="ot-topbar">
            <div className="container ot-topbar-inner">
              <div className="ot-order-id">
                <ShoppingBag size={15} className="ot-order-icon" />
                <span>Order <strong>#{orderNum}</strong></span>
                <span className="ot-placed-at">
                  Placed {order.placed_at ? new Date(order.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
              <div className="ot-eta-chip">
                <Clock size={13} />
                <span>
                  {isDelivered
                    ? 'Delivered ✓'
                    : etaFromGPS != null
                      ? `~${etaFromGPS} min away`
                      : `ETA ${fmtEta(etaSeconds)}`}
                </span>
              </div>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="ot-timeline-bar">
            <div className="container">
              <div className="ot-timeline">
                {STEPS.map((step, i) => {
                  const done   = currentStep > step.id;
                  const active = currentStep === step.id;
                  return (
                    <React.Fragment key={step.id}>
                      <div className={`ot-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                        <div className="ot-step-circle">
                          {done ? <Check size={14} /> : <span className="ot-step-emoji">{step.icon}</span>}
                        </div>
                        <span className="ot-step-label">{step.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`ot-connector ${currentStep > step.id ? 'done' : ''}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="container ot-body">
            <div className="ot-cols">

              {/* ── Left: Status hero ── */}
              <div className="ot-left">
                <div className={`ot-status-hero ${status.animate || ''}`}>
                  <div className="ot-hero-glow" style={{ background: `radial-gradient(circle, ${status.color}22 0%, transparent 70%)` }} />
                  <div
                    className={`ot-hero-icon-ring ${status.animate === 'chef' ? 'ring-pulse' : ''}`}
                    style={{ borderColor: status.color, boxShadow: `0 0 30px ${status.color}33` }}
                  >
                    {status.animate === 'chef' ? (
                      <div className="chef-wrap">
                        <span className="chef-emoji">👨‍🍳</span>
                        <div className="smoke-wrap">
                          <span className="smoke s1" /><span className="smoke s2" /><span className="smoke s3" />
                        </div>
                        <div className="flame-wrap">
                          <span className="flame f1">🔥</span><span className="flame f2">🔥</span>
                        </div>
                      </div>
                    ) : (
                      <span className="ot-status-emoji">{status.emoji}</span>
                    )}
                  </div>
                  <h2 className="ot-hero-title">{status.title}</h2>
                  <p className="ot-hero-sub">{status.sub}</p>

                  {/* Queue position — shown only while order is in kitchen queue */}
                  {queuePosition !== null && currentStep <= 3 && (
                    <div className="ot-queue-widget">
                      <div className="ot-queue-dots">
                        {queuePosition === 0 ? (
                          <span className="ot-queue-dot you pulse" title="Your order" />
                        ) : (
                          Array.from({ length: Math.min(queuePosition, 5) }).map((_, i) => (
                            <span key={i} className="ot-queue-dot ahead" />
                          ))
                        )}
                        {queuePosition > 0 && (
                          <span className="ot-queue-dot you" title="Your order" />
                        )}
                        {queuePosition > 5 && (
                          <span className="ot-queue-more">+{queuePosition - 5}</span>
                        )}
                      </div>
                      <p className="ot-queue-label">
                        {queuePosition === 0
                          ? "You're next! 🔥 Kitchen is starting your order"
                          : queuePosition === 1
                            ? '1 order ahead of yours'
                            : `${queuePosition} orders ahead of yours`}
                      </p>
                      <p className="ot-queue-sub">Queue updates in real time</p>
                    </div>
                  )}

                  {!isDelivered && (
                    <div className="ot-eta-block">
                      <span className="ot-eta-num">
                        {etaFromGPS != null ? `~${etaFromGPS}` : fmtEta(etaSeconds)}
                      </span>
                      <span className="ot-eta-label">
                        {etaFromGPS != null ? 'minutes away · GPS live' : 'estimated arrival'}
                      </span>
                    </div>
                  )}

                  {isDelivered && (
                    <div className="ot-delivered-actions">
                      <Link to="/menu" className="btn btn-primary">Order Again</Link>
                      <button className="btn btn-outline">Rate Your Order</button>
                    </div>
                  )}
                </div>

                <div className="ot-location-row">
                  <MapPin size={14} className="ot-loc-icon" />
                  <span>
                    {order.delivery_method === 'pickup'
                      ? 'Pickup from Habibi Bedford Park Blvd'
                      : `Delivering to ${[order.delivery_address, order.delivery_city].filter(Boolean).join(', ')}`}
                  </span>
                </div>
              </div>

              {/* ── Right: Map + Driver + Receipt ── */}
              <div className="ot-right">

                {/* Live Map */}
                <div className="ot-map">
                  <div className="ot-map-live-badge">
                    <span className={liveConnected ? 'dot-pulse' : 'dot-static'} />
                    {driverLatLng ? 'GPS Live' : liveConnected ? 'Live Tracking' : orderNum ? 'Reconnecting…' : 'Enter order number to track'}
                  </div>

                  {/* Real Leaflet map for delivery orders */}
                  {isDeliveryOrder ? (
                    <div
                      ref={mapContainerRef}
                      style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
                    />
                  ) : (
                    /* CSS mock map for pickup orders */
                    <>
                      <div className="map-grid">
                        <div className="map-road-h" />
                        <div className="map-road-v" />
                        <div className="map-road-h2" />
                        <div className="map-road-v2" />
                      </div>
                      <div className="map-pin restaurant-pin">
                        <div className="map-pin-dot gold" />
                        <div className="map-pin-ring gold-ring" />
                        <span className="map-pin-label">Habibi</span>
                      </div>
                      <div className="map-pin home-pin">
                        <div className="map-pin-dot green" />
                        <span className="map-pin-label">You</span>
                      </div>
                    </>
                  )}

                  {/* CSS-based driver truck (only for delivery + no real GPS yet) */}
                  {isDeliveryOrder && !leafletReady && currentStep >= 4 && currentStep < 6 && (
                    <div
                      className={`map-truck ${currentStep === 5 ? 'nearby' : ''}`}
                      style={{ left: `${truckLeft}%`, transition: 'left 2s ease', position: 'absolute', zIndex: 10 }}
                    >
                      🛵
                    </div>
                  )}

                  {!isDeliveryOrder && (
                    <div className="map-zoom">
                      <button>+</button>
                      <button>−</button>
                    </div>
                  )}
                </div>

                {/* Driver Card */}
                {currentStep >= 4 && currentStep < 6 && (
                  <div className="ot-driver-card">
                    <div className="ot-driver-avatar">
                      <span className="driver-emoji">🧑</span>
                    </div>
                    <div className="ot-driver-info">
                      <p className="ot-driver-name">{driverInfo?.name || DRIVER.name}</p>
                      <p className="ot-driver-meta">
                        {(driverInfo?.rating || DRIVER.rating) && (
                          <><Star size={11} fill="var(--color-primary)" stroke="none" />
                          {driverInfo?.rating || DRIVER.rating}</>
                        )}
                        {driverLatLng && <span className="ot-gps-live"> · GPS live</span>}
                      </p>
                    </div>
                    <div className="ot-driver-actions">
                      <a href={`tel:${driverInfo?.phone || order.customer_phone || '+17185550000'}`} className="ot-driver-btn"><Phone size={16} /></a>
                      <button className="ot-driver-btn"><MessageSquare size={16} /></button>
                    </div>
                  </div>
                )}

                {/* Receipt */}
                <div className="ot-receipt">
                  <div className="ot-receipt-hdr">
                    <span className="ot-receipt-label">ORDER SUMMARY</span>
                    <button className="ot-receipt-toggle" onClick={() => setShowItems(v => !v)}>
                      {showItems ? 'Hide' : 'View'} items
                      <ChevronRight size={13} className={`receipt-chevron ${showItems ? 'open' : ''}`} />
                    </button>
                  </div>

                  {showItems && (
                    <div className="ot-receipt-items">
                      {(order.items || []).map((it, i) => (
                        <div key={i} className="ot-receipt-item">
                          <span className="ot-item-qty">{it.quantity || it.qty || 1}×</span>
                          <span className="ot-item-name">{it.name}</span>
                          <span className="ot-item-price">${parseFloat(it.price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="ot-receipt-divider" />
                      <div className="ot-receipt-row"><span>Subtotal</span><span>${parseFloat(order.sub_total || 0).toFixed(2)}</span></div>
                      <div className="ot-receipt-row"><span>Tax</span><span>${parseFloat(order.tax || 0).toFixed(2)}</span></div>
                      <div className="ot-receipt-row"><span>Service fee</span><span>${parseFloat(order.service_fee || 0).toFixed(2)}</span></div>
                      {parseFloat(order.delivery_fee) > 0 && (
                        <div className="ot-receipt-row"><span>Delivery fee</span><span>${parseFloat(order.delivery_fee).toFixed(2)}</span></div>
                      )}
                      {parseFloat(order.tip) > 0 && (
                        <div className="ot-receipt-row"><span>Tip</span><span>${parseFloat(order.tip).toFixed(2)}</span></div>
                      )}
                      {parseFloat(order.discount) > 0 && (
                        <div className="ot-receipt-row discount"><span>Discount</span><span>−${parseFloat(order.discount).toFixed(2)}</span></div>
                      )}
                    </div>
                  )}

                  <div className="ot-receipt-total">
                    <div>
                      <p className="ot-total-label">TOTAL CHARGED</p>
                      <p className="ot-total-amount">${parseFloat(order.total || 0).toFixed(2)}</p>
                    </div>
                    <span className="ot-payment-badge">
                      Paid · {order.payment_method || 'Card'}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
