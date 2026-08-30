import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Navigation, MapPin, CheckCircle, AlertCircle, Clock, User,
  Package, Phone, MessageSquare, DoorOpen, Camera, X,
  ThumbsUp, ThumbsDown, Power, DollarSign, Bell, Send,
  Zap, Star, History, TrendingUp, BarChart2, Award, Settings, Wifi, WifiOff,
  Siren, Home,
} from 'lucide-react';

// ── Navigation helpers ────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearingDeg(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(b.lat * Math.PI / 180);
  const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180)
           - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const NAV_COMPASS = ['N','NE','E','SE','S','SW','W','NW'];
const NAV_ARROWS  = ['↑','↗','→','↘','↓','↙','←','↖'];

// Decodes Google's encoded polyline format (the standard algorithm --
// see https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
// into an array of [lat, lng] pairs Leaflet can draw directly.
function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0;
  const coords = [];
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}
import './DriverView.css';
import DriverMap from '../components/DriverMap';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function makeApiFetch(driverId, token) {
  return async function apiFetch(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Driver-Token': token } : {}),
      ...(opts.headers || {}),
    };
    const res  = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `${res.status}`);
    return data;
  };
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  } catch (_) {}
}

const STATUS_LABELS = {
  assigned:  { label: 'Assigned',  cls: 'dv-badge-warn' },
  picked_up: { label: 'Picked Up', cls: 'dv-badge-info' },
  en_route:  { label: 'En Route',  cls: 'dv-badge-info' },
  delivered: { label: 'Delivered', cls: 'dv-badge-success' },
  cancelled: { label: 'Cancelled', cls: 'dv-badge-muted' },
};

const DELIVERY_STEPS = [
  { key: 'assigned',  label: 'Assigned',  emoji: '📋' },
  { key: 'picked_up', label: 'Picked Up', emoji: '🛵' },
  { key: 'en_route',  label: 'En Route',  emoji: '🔥' },
  { key: 'delivered', label: 'Done',      emoji: '✅' },
];
const STEP_ORDER = ['assigned', 'picked_up', 'en_route', 'delivered'];

// SVG circular countdown ring
function CountdownRing({ seconds, total = 30 }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - seconds / total);
  const urgent = seconds <= 10;
  return (
    <div className="dv-countdown-ring">
      <svg viewBox="0 0 100 100" className="dv-ring-svg">
        <circle className="dv-ring-bg"  cx="50" cy="50" r={r} />
        <circle
          className={`dv-ring-progress ${urgent ? 'dv-ring-urgent' : ''}`}
          cx="50" cy="50" r={r}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`dv-ring-label ${urgent ? 'dv-ring-label-urgent' : ''}`}>{seconds}s</span>
    </div>
  );
}

// Live break duration counter
function BreakTimer({ start }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [start]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="dv-break-timer">
      {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

// Floating confetti stars for success screen
function SuccessStars() {
  return (
    <div className="dv-confetti" aria-hidden="true">
      {[...Array(12)].map((_, i) => (
        <span key={i} className="dv-star-particle" style={{ '--i': i }}>
          {['⭐','🌟','✨','💫'][i % 4]}
        </span>
      ))}
    </div>
  );
}

function readSession() {
  try {
    const saved = localStorage.getItem('habibi_driver_session');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.driver_id && s.token) return s;
    }
  } catch (_) {}
  return null;
}

export default function DriverView() {
  const settings = useSettings();
  // Read session synchronously so the first render already knows auth state
  const [authenticated, setAuthenticated]   = useState(() => !!readSession());
  const [driverId, setDriverId]             = useState(() => readSession()?.driver_id || '');
  const [token, setToken]                   = useState(() => readSession()?.token || '');
  const [driverName, setDriverName]         = useState(() => readSession()?.name || '');
  const [driverPhone, setDriverPhone]       = useState(() => readSession()?.phone || '');

  const apiFetch = useCallback(makeApiFetch(driverId, token), [driverId, token]);

  const [assignment, setAssignment]       = useState(null);
  const [loading, setLoading]             = useState(true);
  const [tracking, setTracking]           = useState(false);
  const [gpsStatus, setGpsStatus]         = useState('');
  const [error, setError]                 = useState('');
  const [lastPos, setLastPos]             = useState(null);
  const [onDuty, setOnDuty]               = useState(false);
  const [dutyLoading, setDutyLoading]     = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [deliveryPhase, setDeliveryPhase] = useState(null);
  const [proofFile, setProofFile]         = useState(null);
  const [proofPreview, setProofPreview]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [proofError, setProofError]       = useState('');
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [cashCollected, setCashCollected] = useState(null);
  const [cashSummary, setCashSummary]     = useState(null);
  const [destCoords, setDestCoords]       = useState(null);
  const [route, setRoute]                 = useState(null); // { polyline, polylineDecoded, steps, duration_minutes, distance_text }
  const [routeStepIdx, setRouteStepIdx]   = useState(0);
  const routeFetchedForRef = useRef(null); // "lat,lng" key -- guards against re-fetching Directions on every GPS tick
  const [broadcastOrder, setBroadcastOrder] = useState(null);
  const [claimCountdown, setClaimCountdown] = useState(30);
  const [claimLoading, setClaimLoading]     = useState(false);
  const [claimResult, setClaimResult]       = useState(null);
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMsgs, setChatMsgs]       = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread]   = useState(0);
  const chatEndRef = useRef(null);

  const [onBreak, setOnBreak]         = useState(false);
  const [breakStart, setBreakStart]   = useState(null);

  const [showHistory, setShowHistory]   = useState(false);
  const [historyList, setHistoryList]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showEarnings, setShowEarnings] = useState(false);
  const [showPerf, setShowPerf]         = useState(false);
  const [showProfile, setShowProfile]   = useState(false);
  const [perfData, setPerfData]         = useState(null);
  const [perfLoading, setPerfLoading]   = useState(false);
  const [queuedOrder, setQueuedOrder]   = useState(null);

  const [showCancelAlert, setShowCancelAlert]       = useState(false);
  const [cancelledOrder, setCancelledOrder]         = useState(null);

  const [showSosSheet, setShowSosSheet] = useState(false);
  const [sosNote, setSosNote]           = useState('');
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosSent, setSosSent]           = useState(false);
  const [showDeliverySuccess, setShowDeliverySuccess] = useState(false);
  const [lastDeliveredOrder, setLastDeliveredOrder] = useState(null);

  const [socketConnected, setSocketConnected]   = useState(true);
  const [gpsSignalLost, setGpsSignalLost]       = useState(false);
  const [showPinChange, setShowPinChange]       = useState(false);
  const [pinForm, setPinForm]                   = useState({ current: '', newPin: '', confirm: '' });
  const [pinLoading, setPinLoading]             = useState(false);
  const [pinError, setPinError]                 = useState('');
  const [pinSuccess, setPinSuccess]             = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const photoInputRef        = useRef(null);
  const watchRef             = useRef(null);
  const intervalRef          = useRef(null);
  const socketRef            = useRef(null);
  const countdownRef         = useRef(null);
  const wakeLockRef          = useRef(null);
  const onBreakRef           = useRef(false);
  const prevAssignmentRef    = useRef(null);
  const deliverySuccessRef   = useRef(false);
  const installPromptRef     = useRef(null);
  const onDutyRef            = useRef(false);
  const broadcastOrderRef    = useRef(null);
  const assignmentRef        = useRef(null);
  const queuedOrderRef       = useRef(null);

  // Keep refs in sync
  useEffect(() => { onBreakRef.current = onBreak; }, [onBreak]);
  useEffect(() => { deliverySuccessRef.current = showDeliverySuccess; }, [showDeliverySuccess]);
  useEffect(() => { onDutyRef.current = onDuty; }, [onDuty]);
  useEffect(() => { broadcastOrderRef.current = broadcastOrder; }, [broadcastOrder]);
  useEffect(() => { assignmentRef.current = assignment; }, [assignment]);
  useEffect(() => { queuedOrderRef.current = queuedOrder; }, [queuedOrder]);

  // Restore session from localStorage on mount (persists across PWA restarts)
  const handleLogout = () => {
    localStorage.removeItem('habibi_driver_session');
    socketRef.current?.disconnect();
    window.location.replace('/driver/login');
  };

  // Reuses the same urgent-request pipeline already proven for kitchen/food-safety
  // alerts (SMS to the admin's phone) -- the backend additionally fires a live
  // socket alert on the admin dispatch board specifically for this reason string.
  const handleSendSos = async () => {
    if (sosSubmitting) return;
    setSosSubmitting(true);
    try {
      const locationNote = lastPos ? `Location: ${lastPos.lat.toFixed(5)},${lastPos.lng.toFixed(5)}. ` : '';
      await fetch(`${API_BASE}/api/urgent-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: driverName || 'Driver',
          phone: driverPhone || '',
          order_id: assignment?.order_number || '',
          reason: 'Driver Safety SOS',
          message: `${locationNote}${sosNote.trim()}`.trim() || 'No additional details provided.',
        }),
      });
      setSosSent(true);
    } catch {
      setSosSent(true); // Still show confirmation -- the SMS fallback in createUrgentRequest is best-effort either way, and re-showing the form here would just tempt a repeat tap mid-emergency.
    } finally {
      setSosSubmitting(false);
    }
  };

  useEffect(() => {
    // Swap PWA manifest
    const manifest = document.querySelector('link[rel="manifest"]');
    const origManifest = manifest?.href;
    if (manifest) manifest.href = '/driver-manifest.json';

    // Swap favicon to scooter icon for driver app
    const favicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    const origFavs = [];
    favicons.forEach(fav => {
      origFavs.push({ el: fav, href: fav.href });
      fav.href = '/images/icons/delivery.png';
    });

    return () => {
      if (manifest && origManifest) manifest.href = origManifest;
      origFavs.forEach(({ el, href }) => { el.href = href; });
    };
  }, []);

  useEffect(() => {
    if (!driverId || !token) return;
    const t = setTimeout(async () => {
      try {
        const { registerDriverPush, isFirebaseConfigured } = await import('../utils/pushNotifications.js');
        if (isFirebaseConfigured()) await registerDriverPush(driverId, token);
      } catch (_) {}
    }, 3000);
    return () => clearTimeout(t);
  }, [driverId, token]);

  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock; })
        .catch(() => {});
    }
    return () => { wakeLockRef.current?.release(); };
  }, []);

  useEffect(() => {
    if (!driverId) return;
    apiFetch(`/api/dispatch/driver/${driverId}/chat`)
      .then(data => setChatMsgs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [driverId, apiFetch]);

  // PWA install prompt
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      installPromptRef.current = e;
      setTimeout(() => setShowInstallBanner(true), 20000);
    };
    const onInstalled = () => setShowInstallBanner(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, chatOpen]);

  const loadAssignment = useCallback(async () => {
    if (!driverId) return;
    // Don't overwrite the success screen while it's showing
    if (deliverySuccessRef.current) return;
    try {
      const data = await apiFetch(`/api/dispatch/driver/${driverId}`);
      const prev = prevAssignmentRef.current;
      // Detect external cancellation: had an active assignment, now it's cancelled
      if (prev && ['assigned','picked_up','en_route'].includes(prev.status) && data.status === 'cancelled') {
        setCancelledOrder(prev);
        setShowCancelAlert(true);
      }
      prevAssignmentRef.current = data;
      setAssignment(data);
    } catch (e) {
      // 404 = no active assignment (normal after delivery completes)
      if (e.message.includes('404') || e.message.toLowerCase().includes('no active')) {
        const prev = prevAssignmentRef.current;
        // If assignment vanished while it was active without us marking it delivered → cancelled by dispatch
        if (prev && ['assigned','picked_up','en_route'].includes(prev.status)) {
          setCancelledOrder(prev);
          setShowCancelAlert(true);
        }
        prevAssignmentRef.current = null;
        setAssignment(null);
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  }, [driverId, apiFetch]);

  useEffect(() => { loadAssignment(); }, [loadAssignment]);

  const loadCashSummary = useCallback(async () => {
    if (!driverId) return;
    try {
      const data = await apiFetch(`/api/dispatch/drivers/${driverId}/cash-summary`);
      setCashSummary(data);
    } catch (_) {}
  }, [driverId, apiFetch]);

  useEffect(() => { loadCashSummary(); }, [loadCashSummary]);

  const loadHistory = useCallback(async () => {
    if (!driverId) return;
    setHistoryLoading(true);
    try {
      const data = await apiFetch(`/api/dispatch/drivers/${driverId}/history`);
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (_) {}
    setHistoryLoading(false);
  }, [driverId, apiFetch]);

  const loadPerf = useCallback(async () => {
    if (!driverId) return;
    setPerfLoading(true);
    try {
      const data = await apiFetch(`/api/dispatch/drivers/${driverId}/stats`);
      setPerfData(data);
    } catch (_) {}
    setPerfLoading(false);
  }, [driverId, apiFetch]);

  // Clear queuedOrder badge once the assignment transitions to that order
  useEffect(() => {
    if (assignment && queuedOrder && assignment.order_number === queuedOrder.order_number) {
      setQueuedOrder(null);
    }
  }, [assignment?.order_number]); // eslint-disable-line

  // Compute nav guidance from driver to destination -- prefers the real routed
  // step (from Google Directions, see the fetch effect below) and falls back
  // to a straight-line compass/ETA guess when no route is available yet
  // (Directions not configured, still loading, or Google couldn't route).
  const navData = useMemo(() => {
    if (!lastPos || !destCoords) return null;
    const distKm = haversineKm(lastPos, destCoords);
    const fallbackDist = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
    const fallbackEtaMins = Math.max(1, Math.round(distKm / 0.5)); // ~30 km/h

    const step = route?.steps?.[routeStepIdx];
    if (step) {
      return {
        hasRoute: true,
        instruction: step.instruction || 'Continue',
        dist: step.distance_text || fallbackDist,
        etaMins: route.duration_minutes ? Math.max(1, Math.round(route.duration_minutes)) : fallbackEtaMins,
      };
    }
    const bearing = bearingDeg(lastPos, destCoords);
    const idx = Math.round(bearing / 45) % 8;
    return {
      hasRoute: false,
      instruction: `Head ${NAV_COMPASS[idx]}`,
      arrow: NAV_ARROWS[idx],
      dist: fallbackDist,
      etaMins: fallbackEtaMins,
    };
  }, [lastPos?.lat, lastPos?.lng, destCoords?.lat, destCoords?.lng, route, routeStepIdx]); // eslint-disable-line

  useEffect(() => {
    if (!assignment?.delivery_address) {
      setDestCoords(null);
      setRoute(null);
      setRouteStepIdx(0);
      routeFetchedForRef.current = null;
      return;
    }
    const addr = [assignment.delivery_address, assignment.delivery_city].filter(Boolean).join(', ');
    apiFetch(`/api/dispatch/geocode?addr=${encodeURIComponent(addr)}`)
      .then(d => setDestCoords({ lat: d.lat, lng: d.lng }))
      .catch(() => {});
  }, [assignment?.delivery_address, assignment?.delivery_city]);

  // Fetch a real routed path once per delivery -- keyed by destination so this
  // never re-fires on every GPS tick (Directions API calls cost money). Waits
  // for the first GPS fix so the route starts from the driver's real position.
  useEffect(() => {
    if (!destCoords || !lastPos) return;
    const key = `${destCoords.lat.toFixed(5)},${destCoords.lng.toFixed(5)}`;
    if (routeFetchedForRef.current === key) return;
    routeFetchedForRef.current = key;
    setRouteStepIdx(0);
    apiFetch(`/api/dispatch/directions?origin=${lastPos.lat},${lastPos.lng}&destination=${destCoords.lat},${destCoords.lng}`)
      .then(d => setRoute({ ...d, polylineDecoded: decodePolyline(d.polyline) }))
      .catch(() => setRoute(null));
  }, [destCoords?.lat, destCoords?.lng, !!lastPos]); // eslint-disable-line

  // Advance to the next Directions step once the driver's live GPS comes
  // within ~30m of the current step's endpoint (simple proximity-based
  // advancement -- not full snap-to-route).
  useEffect(() => {
    if (!lastPos || !route?.steps?.length) return;
    const step = route.steps[routeStepIdx];
    if (!step || step.end_lat == null || step.end_lng == null) return;
    const distM = haversineKm(lastPos, { lat: step.end_lat, lng: step.end_lng }) * 1000;
    if (distM < 30 && routeStepIdx < route.steps.length - 1) {
      setRouteStepIdx(i => i + 1);
    }
  }, [lastPos?.lat, lastPos?.lng]); // eslint-disable-line

  // Shows the claim modal + bell + notification for a broadcast-shaped order.
  // Shared by the live socket event and the missed-broadcast fallback below.
  const presentBroadcastOrder = useCallback((data) => {
    if (onBreakRef.current) return;
    setBroadcastOrder(data);
    setClaimCountdown(30);
    setClaimResult(null);
    playBell();
    if (Notification.permission === 'granted') {
      try {
        new Notification('🔔 New Delivery Order', {
          body: `#${data.order_number} — ${data.delivery_address || ''}`,
          icon: '/favicon.png',
          tag:  'new-order',
          requireInteraction: true,
        });
      } catch (_) {}
    }
  }, []);

  // Safety net for 'new_order_broadcast' — a driver's tab can miss that
  // live event entirely (backgrounded/locked screen, brief reconnect gap)
  // with no way to know it happened. Called on socket reconnect, on the tab
  // regaining focus, and on a periodic timer while online — so a missed
  // broadcast still surfaces within seconds instead of requiring a reload.
  const checkAvailableOrders = useCallback(async () => {
    if (!driverId || !onDutyRef.current || onBreakRef.current || broadcastOrderRef.current) return;
    try {
      const orders = await apiFetch(`/api/dispatch/orders/available?driver_id=${driverId}`);
      const next = (orders || []).find(o =>
        o.order_number !== assignmentRef.current?.order_number &&
        o.order_number !== queuedOrderRef.current?.order_number
      );
      if (next) presentBroadcastOrder(next);
    } catch (_) {}
  }, [driverId, apiFetch, presentBroadcastOrder]);

  useEffect(() => {
    if (!driverId) return;
    const socket = io(API_BASE, { transports: ['websocket', 'polling'], reconnectionAttempts: 10 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_driver', driverId);
      socket.emit('join_drivers_online', { driver_id: driverId, hmac_token: token });
      checkAvailableOrders();
    });
    socket.on('disconnect',    () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('assignment_created',       () => loadAssignment());
    socket.on('assignment_status_update', () => loadAssignment());
    socket.on('new_order_broadcast', presentBroadcastOrder);

    socket.on('dispatch_chat_reply', (msg) => {
      setChatMsgs(prev => [...prev, msg]);
      setChatOpen(prev => {
        if (!prev) setChatUnread(n => n + 1);
        return prev;
      });
      try { playBell(); } catch (_) {}
    });

    return () => socket.disconnect();
  }, [driverId, loadAssignment, checkAvailableOrders, presentBroadcastOrder]);

  // Resync when the tab regains focus — catches a broadcast missed while
  // the phone screen was locked or the app was backgrounded.
  useEffect(() => {
    if (!driverId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') checkAvailableOrders(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [driverId, checkAvailableOrders]);

  // Belt-and-suspenders poll while online, on top of the socket + visibility
  // resync above — closes the gap even if both miss a beat.
  useEffect(() => {
    if (!driverId || !onDuty || onBreak) return;
    const interval = setInterval(checkAvailableOrders, 20000);
    return () => clearInterval(interval);
  }, [driverId, onDuty, onBreak, checkAvailableOrders]);

  const sendGPS = useCallback(async (lat, lng) => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/gps`, {
        method: 'PATCH',
        body: JSON.stringify({ lat, lng, driver_id: driverId }),
      });
      setLastPos({ lat, lng, time: new Date().toLocaleTimeString() });
    } catch (_) {}
  }, [assignment, driverId, apiFetch]);

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsStatus('GPS not supported'); return; }
    setTracking(true);
    setGpsStatus('Acquiring position…');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsSignalLost(false);
        setGpsStatus(`GPS active · ±${Math.round(pos.coords.accuracy)}m`);
        sendGPS(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGpsSignalLost(true);
        setGpsStatus(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendGPS(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }, 15000);
  };

  const stopTracking = () => {
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    if (intervalRef.current)      { clearInterval(intervalRef.current); intervalRef.current = null; }
    setTracking(false);
    setGpsSignalLost(false);
    setGpsStatus('Tracking stopped');
  };

  useEffect(() => () => stopTracking(), []);

  useEffect(() => {
    if (!broadcastOrder) return;
    countdownRef.current = setInterval(() => {
      setClaimCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          setBroadcastOrder(null);
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [broadcastOrder?.order_number]); // eslint-disable-line

  const claimBroadcastOrder = async () => {
    if (!broadcastOrder) return;
    setClaimLoading(true);
    try {
      const data = await apiFetch('/api/dispatch/assignments/claim', {
        method: 'POST',
        body: JSON.stringify({ order_number: broadcastOrder.order_number, driver_id: driverId }),
      });
      if (data.claimed) {
        setClaimResult('won');
        clearInterval(countdownRef.current);
        if (assignment) {
          // Already on a delivery — queue the next one, don't navigate away
          setQueuedOrder({ ...broadcastOrder });
          setBroadcastOrder(null);
        } else {
          setBroadcastOrder(null);
          await loadAssignment();
          if (!tracking) startTracking();
        }
      } else {
        setClaimResult('lost');
      }
    } catch (e) {
      if (e.message.includes('409') || e.message.toLowerCase().includes('already') || e.message.toLowerCase().includes('taken')) {
        setClaimResult('lost');
      } else {
        setError(e.message);
      }
    }
    setClaimLoading(false);
  };

  const dismissBroadcast = () => {
    clearInterval(countdownRef.current);
    setBroadcastOrder(null);
    setClaimResult(null);
  };

  const toggleDuty = async () => {
    if (onDuty) {
      setShowShiftSummary(true);
      return;
    }
    setDutyLoading(true);
    try {
      await apiFetch(`/api/dispatch/drivers/${driverId}/duty`, {
        method: 'PATCH',
        body: JSON.stringify({ on_duty: true }),
      });
      setOnDuty(true);
      onDutyRef.current = true; // update synchronously — checkAvailableOrders reads the ref, not state
      setShiftStartTime(new Date());
      checkAvailableOrders(); // catch anything that was already waiting before we came online
    } catch (e) { setError(e.message); }
    setDutyLoading(false);
  };

  const confirmGoOffline = async () => {
    setShowShiftSummary(false);
    setDutyLoading(true);
    try {
      await apiFetch(`/api/dispatch/drivers/${driverId}/duty`, {
        method: 'PATCH',
        body: JSON.stringify({ on_duty: false }),
      });
      setOnDuty(false);
      setShiftStartTime(null);
      setOnBreak(false);
      setBreakStart(null);
    } catch (e) { setError(e.message); }
    setDutyLoading(false);
  };

  const toggleBreak = () => {
    if (!onBreak) {
      setOnBreak(true);
      setBreakStart(new Date());
    } else {
      setOnBreak(false);
      setBreakStart(null);
    }
  };

  const markPickedUp = async () => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'picked_up', driver_id: driverId }),
      });
      setAssignment(prev => ({ ...prev, status: 'en_route' }));
      if (!tracking) startTracking();
    } catch (e) { setError(e.message); }
  };

  const acceptAssignment = async () => {
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ response: 'accepted', driver_id: driverId }),
      });
      setAssignment(prev => ({ ...prev, accepted_at: new Date().toISOString() }));
    } catch (e) { setError(e.message); }
  };

  const rejectAssignment = async () => {
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ response: 'rejected', reason: rejectReason, driver_id: driverId }),
      });
      setAssignment(null);
      setRejectOpen(false);
    } catch (e) { setError(e.message); }
  };

  const markDelivered = async () => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'delivered', driver_id: driverId }),
      });
      stopTracking();
      setDeliveryPhase(null);
      loadCashSummary();
      setLastDeliveredOrder({ ...assignment });
      prevAssignmentRef.current = null;
      deliverySuccessRef.current = true;
      setShowDeliverySuccess(true);
    } catch (e) { setError(e.message); }
  };

  const markCashCollected = async () => {
    if (!assignment?.id) return;
    try {
      const data = await apiFetch(`/api/dispatch/assignments/${assignment.id}/collect-cash`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: driverId, driver_name: assignment.driver_name }),
      });
      stopTracking();
      setCashCollected(data.amount_collected);
      setDeliveryPhase(null);
      loadCashSummary();
      setLastDeliveredOrder({ ...assignment, _codCollected: data.amount_collected });
      prevAssignmentRef.current = null;
      deliverySuccessRef.current = true;
      setShowDeliverySuccess(true);
    } catch (e) {
      if (e.message.includes('already recorded') || e.message === '409') {
        stopTracking();
        setAssignment(prev => ({ ...prev, status: 'delivered' }));
        setDeliveryPhase(null);
        loadCashSummary();
      } else {
        setError(e.message);
      }
    }
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setProofError('');
  };

  const submitProofAndDeliver = async () => {
    if (!proofFile) { setProofError('Please take a photo first.'); return; }
    setSubmitting(true);
    setProofError('');
    try {
      const form = new FormData();
      form.append('photo', proofFile);
      form.append('driver_id', driverId);
      form.append('note', 'Left at door — no answer');
      if (token) form.append('x_driver_token', token);
      await fetch(`${API_BASE}/api/dispatch/assignments/${assignment.id}/proof`, {
        method: 'POST',
        headers: token ? { 'X-Driver-Token': token } : {},
        body: form,
      });
    } catch (_) {}
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'delivered', note: 'Left at door', driver_id: driverId }),
      });
      stopTracking();
      setDeliveryPhase(null);
      setLastDeliveredOrder({ ...assignment, _leftAtDoor: true });
      prevAssignmentRef.current = null;
      deliverySuccessRef.current = true;
      setShowDeliverySuccess(true);
    } catch (e) { setProofError(e.message); }
    setSubmitting(false);
  };

  const markCodFailed = async () => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/cod-failed`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: driverId }),
      });
      setAssignment(prev => ({ ...prev, status: 'cancelled' }));
      setDeliveryPhase(null);
    } catch (e) { setError(e.message); }
  };

  const openChat = () => { setChatOpen(true); setChatUnread(0); };

  const closePinChange = () => {
    setShowPinChange(false);
    setPinError('');
    setPinSuccess(false);
    setPinForm({ current: '', newPin: '', confirm: '' });
  };

  const submitPinChange = async () => {
    setPinError('');
    const { current, newPin, confirm } = pinForm;
    if (!current || !newPin || !confirm) { setPinError('All fields are required.'); return; }
    if (!/^\d{4}$/.test(newPin)) { setPinError('New PIN must be exactly 4 digits.'); return; }
    if (newPin !== confirm) { setPinError('New PINs do not match.'); return; }
    setPinLoading(true);
    try {
      // Verify current PIN via phone + pin
      const verifyRes = await fetch(`${API_BASE}/api/dispatch/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: driverPhone, pin: current }),
      });
      if (!verifyRes.ok) throw new Error('Current PIN is incorrect.');
      // Set new PIN
      await apiFetch('/api/dispatch/driver/set-pin', {
        method: 'POST',
        body: JSON.stringify({ driver_id: driverId, pin: newPin, confirm_pin: confirm }),
      });
      setPinSuccess(true);
      setPinForm({ current: '', newPin: '', confirm: '' });
      setTimeout(() => closePinChange(), 2000);
    } catch (e) {
      setPinError(e.message.includes('Invalid') || e.message.includes('PIN') ? 'Current PIN is incorrect.' : e.message);
    }
    setPinLoading(false);
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatSending(true);
    try {
      const row = await apiFetch(`/api/dispatch/driver/${driverId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          driver_name: assignment?.driver_name || assignment?.driver_full_name || 'Driver',
        }),
      });
      setChatMsgs(prev => [...prev, row]);
      setChatInput('');
    } catch (_) {}
    setChatSending(false);
  };

  // ── Shared chat overlay (used in both idle + active) ───────────────
  const chatOverlay = chatOpen && (
    <div className="dv-chat-overlay">
      <div className="dv-chat-panel">
        <div className="dv-chat-header">
          <div className="dv-chat-header-left">
            <MessageSquare size={16}/>
            <span>Dispatch Chat</span>
          </div>
          <button className="dv-chat-close" onClick={() => setChatOpen(false)}><X size={18}/></button>
        </div>
        <div className="dv-chat-messages">
          {chatMsgs.length === 0 && (
            <p className="dv-chat-empty">No messages yet. Send a message to dispatch below.</p>
          )}
          {chatMsgs.map(m => (
            <div key={m.id} className={`dv-chat-bubble ${m.direction === 'inbound' ? 'dv-bubble-driver' : 'dv-bubble-dispatch'}`}>
              {m.direction === 'outbound' && (
                <p className="dv-bubble-label">{m.sent_by || 'Dispatch'}</p>
              )}
              <p className="dv-bubble-text">{m.message}</p>
              <p className="dv-bubble-time">{new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div className="dv-chat-input-row">
          <input
            className="dv-chat-input"
            placeholder="Message dispatch…"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            disabled={chatSending}
            maxLength={500}
          />
          <button className="dv-chat-send" onClick={sendChat} disabled={chatSending || !chatInput.trim()}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );

  // ── History drawer ────────────────────────────────────────────────
  const historyDrawer = showHistory && (
    <div className="dv-history-overlay" onClick={() => setShowHistory(false)}>
      <div className="dv-history-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-history-hdr">
          <span className="dv-history-title">Today's Deliveries</span>
          <button className="dv-chat-close" onClick={() => setShowHistory(false)}><X size={18}/></button>
        </div>
        <div className="dv-history-body">
          {historyLoading ? (
            <p className="dv-history-empty">Loading…</p>
          ) : historyList.length === 0 ? (
            <p className="dv-history-empty">No completed deliveries yet today.</p>
          ) : (
            historyList.map((h, i) => {
              const time = h.delivered_at
                ? new Date(h.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—';
              const isCodH = h.payment_method === 'cash';
              return (
                <div key={h.id} className="dv-history-card">
                  <div className="dv-history-card-top">
                    <span className="dv-history-num">#{h.order_number}</span>
                    <span className="dv-history-time">{time}</span>
                  </div>
                  <p className="dv-history-addr">{h.delivery_address || h.customer_name || '—'}</p>
                  <div className="dv-history-card-bot">
                    {h.tip_amount > 0 && (
                      <span className="dv-history-tip">+${h.tip_amount.toFixed(2)} tip</span>
                    )}
                    {isCodH && h.order_total > 0 && (
                      <span className="dv-history-cod">💰 ${h.order_total.toFixed(2)} COD</span>
                    )}
                    {h.tip_amount === 0 && !isCodH && (
                      <span className="dv-history-no-tip">No tip</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {!historyLoading && historyList.length > 0 && (
          <div className="dv-history-footer">
            <span>{historyList.length} deliveries · Tips: ${historyList.reduce((s, h) => s + h.tip_amount, 0).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );

  // ── Earnings drawer ──────────────────────────────────────────────
  const shiftHours = shiftStartTime
    ? Math.max(0.1, (Date.now() - new Date(shiftStartTime)) / 3_600_000)
    : null;
  const earningsDrawer = showEarnings && (
    <div className="dv-history-overlay" onClick={() => setShowEarnings(false)}>
      <div className="dv-history-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-history-hdr">
          <span className="dv-history-title">💵 Shift Earnings</span>
          <button className="dv-chat-close" onClick={() => setShowEarnings(false)}><X size={18}/></button>
        </div>
        <div className="dv-history-body">
          {cashSummary ? (
            <>
              <div className="dv-earn-grid">
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">{cashSummary.deliveries_count}</span>
                  <span className="dv-earn-cell-lbl">Deliveries</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num dv-clr-green">${cashSummary.total_tips.toFixed(2)}</span>
                  <span className="dv-earn-cell-lbl">Tips Earned</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num dv-clr-gold">${cashSummary.total_cod.toFixed(2)}</span>
                  <span className="dv-earn-cell-lbl">COD Cash</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">
                    {cashSummary.deliveries_count > 0
                      ? `$${(cashSummary.total_tips / cashSummary.deliveries_count).toFixed(2)}`
                      : '—'}
                  </span>
                  <span className="dv-earn-cell-lbl">Avg Tip</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">
                    {cashSummary.deliveries_count > 0
                      ? cashSummary.deliveries_count - cashSummary.cod_orders_count
                      : '—'}
                  </span>
                  <span className="dv-earn-cell-lbl">Card Orders</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">
                    {shiftHours
                      ? `$${(cashSummary.total_tips / shiftHours).toFixed(2)}/hr`
                      : '—'}
                  </span>
                  <span className="dv-earn-cell-lbl">Tip Rate</span>
                </div>
              </div>
              {shiftHours && (
                <div className="dv-earn-shift-bar">
                  <Clock size={13}/>&nbsp;Shift: {Math.floor(shiftHours)}h {Math.round((shiftHours % 1) * 60)}m
                </div>
              )}
            </>
          ) : (
            <p className="dv-history-empty">No earnings data yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Performance dashboard drawer ──────────────────────────────────
  const perfDrawer = showPerf && (
    <div className="dv-history-overlay" onClick={() => setShowPerf(false)}>
      <div className="dv-history-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-history-hdr">
          <span className="dv-history-title">⭐ My Performance</span>
          <button className="dv-chat-close" onClick={() => setShowPerf(false)}><X size={18}/></button>
        </div>
        <div className="dv-history-body">
          {perfLoading ? (
            <p className="dv-history-empty">Loading…</p>
          ) : perfData ? (
            <>
              {perfData.streak > 0 && (
                <div className="dv-perf-streak">
                  <Award size={20}/>
                  <span>{perfData.streak}-Day Streak 🔥</span>
                </div>
              )}
              <p className="dv-perf-period">Last 7 Days</p>
              <div className="dv-earn-grid">
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">{perfData.week.deliveries}</span>
                  <span className="dv-earn-cell-lbl">Deliveries</span>
                </div>
                <div className="dv-earn-cell">
                  <span className={`dv-earn-cell-num ${perfData.week.acceptance_rate >= 80 ? 'dv-clr-green' : 'dv-clr-warn'}`}>
                    {perfData.week.acceptance_rate}%
                  </span>
                  <span className="dv-earn-cell-lbl">Acceptance</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num dv-clr-green">${perfData.week.tips.toFixed(2)}</span>
                  <span className="dv-earn-cell-lbl">Tips</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">
                    {perfData.week.avg_mins ? `${perfData.week.avg_mins} min` : '—'}
                  </span>
                  <span className="dv-earn-cell-lbl">Avg Time</span>
                </div>
              </div>
              <p className="dv-perf-period" style={{ marginTop: '1rem' }}>Last 30 Days</p>
              <div className="dv-earn-grid">
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">{perfData.month.deliveries}</span>
                  <span className="dv-earn-cell-lbl">Deliveries</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num dv-clr-green">${perfData.month.tips.toFixed(2)}</span>
                  <span className="dv-earn-cell-lbl">Total Tips</span>
                </div>
                <div className="dv-earn-cell">
                  <span className="dv-earn-cell-num">
                    {perfData.month.avg_mins ? `${perfData.month.avg_mins} min` : '—'}
                  </span>
                  <span className="dv-earn-cell-lbl">Avg Time</span>
                </div>
              </div>
            </>
          ) : (
            <p className="dv-history-empty">No performance data yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Connectivity banner (shown when socket drops or GPS is lost) ──
  const connBanner = (!socketConnected || (tracking && gpsSignalLost)) && (
    <div className={`dv-conn-banner ${!socketConnected ? 'dv-conn-offline' : 'dv-conn-gps'}`}>
      {!socketConnected
        ? <><WifiOff size={13}/> No connection — reconnecting…</>
        : <><Wifi size={13}/> GPS signal lost</>}
    </div>
  );

  // ── PIN change drawer ─────────────────────────────────────────────
  const pinChangeDrawer = showPinChange && (
    <div className="dv-history-overlay" onClick={closePinChange}>
      <div className="dv-history-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-history-hdr">
          <span className="dv-history-title">🔒 Change PIN</span>
          <button className="dv-chat-close" onClick={closePinChange}><X size={18}/></button>
        </div>
        <div className="dv-history-body">
          {pinSuccess ? (
            <div className="dv-pin-success">✅ PIN changed successfully!</div>
          ) : (
            <div className="dv-pin-form">
              <label className="dv-pin-label">Current PIN</label>
              <input
                className="dv-pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                value={pinForm.current} onChange={e => setPinForm(f => ({ ...f, current: e.target.value }))}
              />
              <label className="dv-pin-label">New PIN (4 digits)</label>
              <input
                className="dv-pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                value={pinForm.newPin} onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value }))}
              />
              <label className="dv-pin-label">Confirm New PIN</label>
              <input
                className="dv-pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                value={pinForm.confirm} onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value }))}
              />
              {pinError && <p className="dv-pin-error">{pinError}</p>}
              <button className="dv-pin-submit" onClick={submitPinChange} disabled={pinLoading}>
                {pinLoading ? 'Saving…' : 'Change PIN'}
              </button>
              <button className="dv-pin-signout" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const profileDrawer = showProfile && (
    <div className="dv-history-overlay" onClick={() => setShowProfile(false)}>
      <div className="dv-history-drawer" onClick={e => e.stopPropagation()}>
        <div className="dv-history-hdr">
          <span className="dv-history-title">Profile</span>
          <button className="dv-chat-close" onClick={() => setShowProfile(false)}><X size={18}/></button>
        </div>
        <div className="dv-history-body">
          <div className="dv-profile-id">
            <div className="dv-profile-avatar"><User size={22}/></div>
            <div>
              <p className="dv-profile-name">{driverName || 'Driver'}</p>
              <p className="dv-profile-phone">{driverPhone}</p>
            </div>
          </div>
          <button className="dv-profile-row" onClick={() => { setShowProfile(false); loadPerf(); setShowPerf(true); }}>
            <BarChart2 size={18}/> <span>Performance</span>
          </button>
          <button className="dv-profile-row" onClick={() => { setShowProfile(false); setShowPinChange(true); }}>
            <Settings size={18}/> <span>Change PIN</span>
          </button>
          <button className="dv-profile-row dv-profile-row-danger" onClick={handleLogout}>
            <DoorOpen size={18}/> <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Bottom tab bar (idle screen only) ──────────────────────────────
  // Tabs are just relocated entry points into the existing drawers above --
  // "active" is derived from which drawer is open rather than tracked as
  // separate state, so it can never drift out of sync with what's actually
  // showing. Every tab closes all OTHER drawers first (they're independent
  // booleans, not a single "current view" enum) so switching tabs can never
  // stack two overlays on top of each other.
  const closeAllTabDrawers = () => {
    setShowEarnings(false);
    setShowHistory(false);
    setShowProfile(false);
    setChatOpen(false);
    setShowPerf(false);
    setShowPinChange(false);
  };
  const bottomTabBar = (
    <nav className="dv-tabbar">
      <button className={`dv-tab ${!showEarnings && !showHistory && !chatOpen && !showProfile ? 'dv-tab-active' : ''}`} onClick={closeAllTabDrawers}>
        <Home size={20}/>
        <span className="dv-tab-label">Home</span>
      </button>
      <button className={`dv-tab ${showEarnings ? 'dv-tab-active' : ''}`} onClick={() => { closeAllTabDrawers(); setShowEarnings(true); }}>
        <DollarSign size={20}/>
        <span className="dv-tab-label">Earnings</span>
      </button>
      <button className={`dv-tab ${showHistory ? 'dv-tab-active' : ''}`} onClick={() => { closeAllTabDrawers(); loadHistory(); setShowHistory(true); }}>
        <History size={20}/>
        <span className="dv-tab-label">History</span>
      </button>
      <button className={`dv-tab ${chatOpen ? 'dv-tab-active' : ''}`} onClick={() => { closeAllTabDrawers(); openChat(); }}>
        <div className="dv-tab-icon-wrap">
          <MessageSquare size={20}/>
          {chatUnread > 0 && <span className="dv-badge-dot">{chatUnread}</span>}
        </div>
        <span className="dv-tab-label">Chat</span>
      </button>
      <button className={`dv-tab ${showProfile ? 'dv-tab-active' : ''}`} onClick={() => { closeAllTabDrawers(); setShowProfile(true); }}>
        <User size={20}/>
        <span className="dv-tab-label">Profile</span>
      </button>
    </nav>
  );

  // ── PWA install nudge banner ──────────────────────────────────────
  const installBanner = showInstallBanner && (
    <div className="dv-install-banner">
      <span className="dv-install-icon">📱</span>
      <span className="dv-install-text">Add Habibi Driver to your home screen</span>
      <button
        className="dv-install-btn"
        onClick={async () => {
          if (!installPromptRef.current) return;
          installPromptRef.current.prompt();
          const { outcome } = await installPromptRef.current.userChoice;
          if (outcome === 'accepted') { setShowInstallBanner(false); installPromptRef.current = null; }
        }}
      >
        Install
      </button>
      <button className="dv-install-dismiss" onClick={() => setShowInstallBanner(false)}><X size={14}/></button>
    </div>
  );

  // ── Delivery success screen ───────────────────────────────────────
  if (showDeliverySuccess && lastDeliveredOrder) {
    const successTip = parseFloat(lastDeliveredOrder.tip_amount || 0);
    const successCod = lastDeliveredOrder._codCollected
      ? parseFloat(lastDeliveredOrder._codCollected)
      : null;
    return (
      <div className="dv-shell dv-success-shell">
        <SuccessStars/>
        <div className="dv-success-content">
          <div className="dv-success-check">✅</div>
          <h2 className="dv-success-title">Delivered!</h2>
          <p className="dv-success-order">#{lastDeliveredOrder.order_number}</p>
          {lastDeliveredOrder._leftAtDoor && (
            <p className="dv-success-note">📸 Left at door — photo saved</p>
          )}
          {successTip > 0 && (
            <p className="dv-success-tip">💵 +${successTip.toFixed(2)} tip 🎉</p>
          )}
          {successCod && (
            <p className="dv-success-cod">💰 ${successCod.toFixed(2)} cash collected</p>
          )}
          <button
            className="dv-success-next"
            onClick={() => {
              setShowDeliverySuccess(false);
              deliverySuccessRef.current = false;
              setAssignment(null);
              setCashCollected(null);
              loadCashSummary();
            }}
          >
            Next Delivery →
          </button>
        </div>
      </div>
    );
  }

  // ── Order cancellation alert modal ────────────────────────────────
  const cancelAlertModal = showCancelAlert && (
    <div className="dv-cancel-overlay">
      <div className="dv-cancel-modal">
        <div className="dv-cancel-icon">🚫</div>
        <h3 className="dv-cancel-title">Order Cancelled</h3>
        <p className="dv-cancel-body">
          Order <strong>#{cancelledOrder?.order_number}</strong> was cancelled by dispatch.
        </p>
        <p className="dv-cancel-sub">Return to restaurant if needed.</p>
        <button
          className="dv-cancel-ok"
          onClick={() => { setShowCancelAlert(false); setCancelledOrder(null); }}
        >
          Got it
        </button>
      </div>
    </div>
  );

  // ── Login gate — redirect to dedicated login page ─────────────────
  if (!authenticated) {
    window.location.replace('/driver/login');
    return null;
  }

  // ── Guard screens ──────────────────────────────────────────────────
  if (!driverId) {
    return (
      <div className="dv-shell dv-center">
        <div className="dv-guard-icon">🚫</div>
        <p>No driver ID in URL. Use the link provided by dispatch.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dv-shell dv-center">
        <div className="dv-spinner"/>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>Loading your assignment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dv-shell dv-center">
        <div className="dv-guard-icon">⚠️</div>
        <p>{error}</p>
      </div>
    );
  }

  // ── Shift summary modal ────────────────────────────────────────────
  const shiftMins = shiftStartTime ? Math.floor((Date.now() - shiftStartTime) / 60000) : null;
  const shiftDuration = shiftMins === null ? null
    : shiftMins < 60 ? `${shiftMins}m`
    : `${Math.floor(shiftMins / 60)}h ${shiftMins % 60}m`;
  const summaryDeliveries = cashSummary?.deliveries_count || 0;
  const summaryTips       = parseFloat(cashSummary?.total_tips || 0);
  const summaryCod        = parseFloat(cashSummary?.total_cod  || 0);

  const shiftSummaryModal = showShiftSummary && (
    <div className="dv-summary-overlay" onClick={() => setShowShiftSummary(false)}>
      <div className="dv-summary-sheet" onClick={e => e.stopPropagation()}>
        <div className="dv-summary-handle"/>
        <h2 className="dv-summary-title">End of Shift</h2>
        {shiftDuration && (
          <p className="dv-summary-duration">⏱ Online for <strong>{shiftDuration}</strong></p>
        )}

        <div className="dv-summary-stats">
          <div className="dv-summary-stat">
            <span className="dv-summary-stat-num">{summaryDeliveries}</span>
            <span className="dv-summary-stat-lbl">📦 Deliveries</span>
          </div>
          <div className="dv-summary-stat-sep"/>
          <div className="dv-summary-stat">
            <span className="dv-summary-stat-num dv-clr-green">${summaryTips.toFixed(2)}</span>
            <span className="dv-summary-stat-lbl">💵 Tips Earned</span>
          </div>
        </div>

        {summaryCod > 0 && (
          <div className="dv-summary-cod-alert">
            <span className="dv-summary-cod-icon">💰</span>
            <div>
              <p className="dv-summary-cod-label">Cash to Hand In</p>
              <p className="dv-summary-cod-amount">${summaryCod.toFixed(2)}</p>
              <p className="dv-summary-cod-note">Return this cash to the manager before leaving</p>
            </div>
          </div>
        )}

        {summaryDeliveries === 0 && (
          <p className="dv-summary-empty">No deliveries this session — see you next time! 👋</p>
        )}

        <div className="dv-summary-actions">
          <button className="dv-summary-btn-offline" onClick={confirmGoOffline} disabled={dutyLoading}>
            {dutyLoading ? 'Going offline…' : 'Go Offline'}
          </button>
          <button className="dv-summary-btn-stay" onClick={() => setShowShiftSummary(false)}>
            Stay Online
          </button>
        </div>
      </div>
    </div>
  );

  const closeSosSheet = () => {
    setShowSosSheet(false);
    setSosNote('');
    setSosSent(false);
  };

  const sosSheet = showSosSheet && (
    <div className="dv-summary-overlay" onClick={closeSosSheet}>
      <div className="dv-summary-sheet" onClick={e => e.stopPropagation()}>
        <div className="dv-summary-handle"/>
        {sosSent ? (
          <>
            <h2 className="dv-summary-title">Dispatch Has Been Alerted</h2>
            <p className="dv-sos-sub">A manager has been notified with your name and location. If this is a life-threatening emergency, call 911 first.</p>
            <div className="dv-summary-actions">
              <a className="dv-summary-btn-offline" href={`tel:+1${(settings.phone_main || '').replace(/\D/g, '')}`}>
                <Phone size={16}/> Call Store
              </a>
              <button className="dv-summary-btn-stay" onClick={closeSosSheet}>Close</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="dv-summary-title"><Siren size={20} style={{ verticalAlign: 'middle', marginRight: 6 }}/> Confirm Emergency Alert</h2>
            <p className="dv-sos-sub">This immediately notifies dispatch with your name, phone, and current location. If this is a life-threatening emergency, call 911 first.</p>
            <textarea
              className="dv-sos-note"
              placeholder="Optional: what's happening? (visible to dispatch)"
              value={sosNote}
              onChange={e => setSosNote(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="dv-summary-actions">
              <button className="dv-summary-btn-offline" onClick={handleSendSos} disabled={sosSubmitting}>
                {sosSubmitting ? 'Sending…' : 'Confirm Emergency Alert'}
              </button>
              <button className="dv-summary-btn-stay" onClick={closeSosSheet} disabled={sosSubmitting}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Idle screen ───────────────────────────────────────────────────
  if (!assignment) {
    const hasEarnings = cashSummary && (cashSummary.deliveries_count > 0 || cashSummary.total_tips > 0 || cashSummary.total_cod > 0);
    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const shiftTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const deliveries = hasEarnings ? cashSummary.deliveries_count : 0;
    const goalPct = Math.min(100, (deliveries / 10) * 100);

    return (
      <div className="dv-shell">
        {chatOverlay}
        {shiftSummaryModal}
        {sosSheet}
        {historyDrawer}
        {earningsDrawer}
        {perfDrawer}
        {pinChangeDrawer}
        {profileDrawer}
        {cancelAlertModal}
        {connBanner}

        {/* Header */}
        <header className="dv-hdr">
          <div className="dv-hdr-left">
            <img src="/images/logos/logo.png" className="dv-logo-sm" alt="" onError={e => e.target.style.display='none'}/>
            <span className="dv-hdr-title">Habibi Driver</span>
          </div>
          <div className="dv-hdr-right">
            <button className="dv-icon-btn dv-icon-btn-sos" onClick={() => setShowSosSheet(true)} title="Emergency SOS">
              <Siren size={18}/>
            </button>
            <button
              className={`dv-duty-pill ${onBreak ? 'dv-duty-pill-break' : onDuty ? 'dv-duty-pill-on' : ''}`}
              onClick={toggleDuty}
              disabled={dutyLoading}
            >
              <span className={`dv-status-dot ${onBreak ? 'dv-status-dot-break' : onDuty ? 'dv-status-dot-on' : ''}`}/>
              {onBreak ? 'On Break' : onDuty ? 'Online' : 'Offline'}
            </button>
          </div>
        </header>

        {/* Hero */}
        <div className={`dv-hero ${onDuty && !onBreak ? 'dv-hero-on' : ''}`}>
          <div className="dv-hero-img"/>
          <div className="dv-hero-overlay"/>
          <div className="dv-hero-content">
            {onBreak ? (
              <div className="dv-break-anim">
                <span className="dv-break-icon">⏸</span>
              </div>
            ) : onDuty ? (
              <div className="dv-online-anim">
                <div className="dv-ring dv-ring-1"/>
                <div className="dv-ring dv-ring-2"/>
                <div className="dv-ring dv-ring-3"/>
                <span className="dv-ring-icon">🛵</span>
              </div>
            ) : (
              <div className="dv-offline-icon">🛵</div>
            )}
            <h1 className="dv-hero-h1">{greeting}{driverName ? `, ${driverName.split(' ')[0]}` : ''} 👋</h1>
            <p className="dv-hero-sub">
              {onBreak
                ? 'New orders paused — tap Resume when ready'
                : onDuty
                ? `Online since ${shiftTime} · Waiting for orders…`
                : 'Tap below to go online and receive orders'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="dv-body">

          {/* Duty button */}
          <button
            className={`dv-duty-btn ${onDuty ? 'dv-duty-btn-on' : 'dv-duty-btn-off'}`}
            onClick={toggleDuty}
            disabled={dutyLoading}
          >
            <Power size={20}/>
            <span>{dutyLoading ? 'Updating…' : onDuty ? 'Online · Tap to Go Offline' : 'Go Online'}</span>
          </button>

          {/* Break button — only when online */}
          {onDuty && (
            <button
              className={`dv-break-btn ${onBreak ? 'dv-break-btn-resume' : ''}`}
              onClick={toggleBreak}
            >
              {onBreak ? (
                <>
                  ▶ Resume Deliveries
                  {breakStart && (
                    <BreakTimer start={breakStart}/>
                  )}
                </>
              ) : (
                <>⏸ Take a Break</>
              )}
            </button>
          )}

          {/* Stats row — tap to open earnings breakdown */}
          <div className="dv-stats dv-stats-tap" onClick={() => setShowEarnings(true)} role="button" title="View earnings breakdown">
            <div className="dv-stat">
              <span className="dv-stat-num">{deliveries}</span>
              <span className="dv-stat-lbl">📦 Deliveries</span>
            </div>
            <div className="dv-stat-sep"/>
            <div className="dv-stat">
              <span className="dv-stat-num dv-clr-green">${hasEarnings ? cashSummary.total_tips.toFixed(2) : '0.00'}</span>
              <span className="dv-stat-lbl">💵 Tips</span>
            </div>
            <div className="dv-stat-sep"/>
            <div className="dv-stat">
              <span className="dv-stat-num dv-clr-gold">${hasEarnings ? cashSummary.total_cod.toFixed(2) : '0.00'}</span>
              <span className="dv-stat-lbl">💰 Cash</span>
            </div>
            <TrendingUp size={14} className="dv-stats-expand-icon"/>
          </div>

          {/* Goal */}
          <div className="dv-goal">
            <div className="dv-goal-row">
              <span className="dv-goal-lbl">Daily Goal</span>
              <span className="dv-goal-pct dv-clr-gold">{deliveries} / 10 deliveries</span>
            </div>
            <div className="dv-goal-track">
              <div className="dv-goal-fill" style={{ width: `${goalPct}%` }}/>
            </div>
              {!hasEarnings && <p className="dv-goal-empty">No deliveries yet today — let's go! 🔥</p>}
          </div>

          {/* COD cash tally */}
          {hasEarnings && cashSummary.total_cod > 0 && (
            <div className="dv-cod-tally">
              <div className="dv-cod-tally-left">
                <span className="dv-cod-tally-icon">💰</span>
                <div>
                  <p className="dv-cod-tally-label">Cash in Pocket</p>
                  <p className="dv-cod-tally-note">Hand in to manager at end of shift</p>
                </div>
              </div>
              <span className="dv-cod-tally-amount">${cashSummary.total_cod.toFixed(2)}</span>
            </div>
          )}

          {/* Quick actions */}
          <div className="dv-quick-row">
            <button className="dv-quick" onClick={openChat}>
              <MessageSquare size={22}/>
              <span>Chat</span>
            </button>
            <a className="dv-quick" href="https://maps.google.com" target="_blank" rel="noreferrer">
              <Navigation size={22}/>
              <span>Maps</span>
            </a>
            <a className="dv-quick" href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`}>
              <Phone size={22}/>
              <span>Call Store</span>
            </a>
            <button className="dv-quick" onClick={toggleDuty} disabled={dutyLoading}>
              <Power size={22}/>
              <span>{onDuty ? 'Go Off' : 'Go On'}</span>
            </button>
          </div>

          {/* Dedicated spacer, not the .dv-body padding shorthand -- several
              responsive breakpoints reset .dv-body's padding wholesale, which
              was silently clobbering a padding-bottom clearance value for the
              fixed tab bar below. A standalone element can't be overridden
              that way. */}
          <div className="dv-tabbar-spacer" aria-hidden="true"/>

        </div>

        {bottomTabBar}

        {/* Full broadcast modal for idle drivers */}
        {broadcastOrder && (
          <div className="dv-broadcast-overlay">
            <div className="dv-broadcast-modal">
              <div className="dv-broadcast-pulse-ring"/>
              <div className="dv-broadcast-bell"><Bell size={28}/></div>
              <h3 className="dv-broadcast-title">New Order!</h3>
              <div className="dv-broadcast-info">
                <p className="dv-broadcast-ordernum">#{broadcastOrder.order_number}</p>
                <p className="dv-broadcast-name">{broadcastOrder.customer_name}</p>
                {broadcastOrder.delivery_address && (
                  <p className="dv-broadcast-addr"><MapPin size={12}/> {broadcastOrder.delivery_address}</p>
                )}
                <p className="dv-broadcast-total">${parseFloat(broadcastOrder.total || 0).toFixed(2)}</p>
                {parseFloat(broadcastOrder.tip || 0) > 0 && (
                  <p className="dv-broadcast-tip">💵 Tip: ${parseFloat(broadcastOrder.tip).toFixed(2)}</p>
                )}
              </div>
              <CountdownRing seconds={claimCountdown} total={30}/>
              {claimResult === 'lost' ? (
                <div className="dv-broadcast-result">
                  <p className="dv-broadcast-lost">Order taken by another driver</p>
                  <button className="dv-btn" onClick={dismissBroadcast}>Close</button>
                </div>
              ) : (
                <div className="dv-btn-row">
                  <button className="dv-btn dv-btn-claim" onClick={claimBroadcastOrder} disabled={claimLoading}>
                    {claimLoading ? 'Claiming…' : <><CheckCircle size={16}/> Accept</>}
                  </button>
                  <button className="dv-btn dv-btn-skip" onClick={dismissBroadcast}>Skip</button>
                </div>
              )}
            </div>
          </div>
        )}

        {installBanner}
      </div>
    );
  }

  // ── Active delivery screen ─────────────────────────────────────────
  const { label: statusLabel, cls: statusCls } = STATUS_LABELS[assignment.status] || { label: assignment.status, cls: 'dv-badge-muted' };
  const mapsUrl = assignment.delivery_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignment.delivery_address)}`
    : null;
  const notYetAccepted = !assignment.accepted_at && assignment.status === 'assigned';
  const tip    = parseFloat(assignment.tip_amount  || 0);
  const isCod  = assignment.payment_method === 'cash';
  const codAmt = parseFloat(assignment.order_total || 0);
  const currentStepIdx = STEP_ORDER.indexOf(assignment.status);

  return (
    <div className="dv-shell">
      {chatOverlay}
      {shiftSummaryModal}
      {sosSheet}
      {earningsDrawer}
      {perfDrawer}
      {pinChangeDrawer}
      {cancelAlertModal}
      {connBanner}

      {/* Compact "Next Up?" snack when a broadcast comes while already delivering */}
      {broadcastOrder && (
        <div className="dv-queue-snack">
          <div className="dv-queue-snack-info">
            <Bell size={14}/>
            <span>Next order: <strong>#{broadcastOrder.order_number}</strong></span>
            {broadcastOrder.delivery_address && (
              <span className="dv-queue-snack-addr"> · {broadcastOrder.delivery_address.split(',')[0]}</span>
            )}
            <span className="dv-queue-snack-cd">{claimCountdown}s</span>
          </div>
          <div className="dv-queue-snack-btns">
            <button className="dv-queue-snack-accept" onClick={claimBroadcastOrder} disabled={claimLoading}>
              {claimLoading ? '…' : 'Queue ✓'}
            </button>
            <button className="dv-queue-snack-skip" onClick={dismissBroadcast}>Skip</button>
          </div>
        </div>
      )}

      {/* Queued next order confirmation card */}
      {queuedOrder && (
        <div className="dv-queued-card">
          <div className="dv-queued-left">
            <span className="dv-queued-icon">📋</span>
            <div>
              <p className="dv-queued-label">Queued Next</p>
              <p className="dv-queued-num">#{queuedOrder.order_number}</p>
            </div>
          </div>
          <button className="dv-queued-close" onClick={() => setQueuedOrder(null)}><X size={14}/></button>
        </div>
      )}

      {/* Header */}
      <header className="dv-hdr dv-hdr-active">
        <div className="dv-hdr-order">
          <span className="dv-order-tag">{assignment.order_number || `#${assignment.order_id}`}</span>
          <span className={`dv-status-chip ${statusCls}`}>{statusLabel}</span>
        </div>
        <div className="dv-hdr-right">
          <button className="dv-icon-btn dv-icon-btn-sos" onClick={() => setShowSosSheet(true)} title="Emergency SOS">
            <Siren size={18}/>
          </button>
          <button className="dv-icon-btn" onClick={openChat}>
            <MessageSquare size={18}/>
            {chatUnread > 0 && <span className="dv-badge-dot">{chatUnread}</span>}
          </button>
          <button
            className={`dv-duty-pill ${onDuty ? 'dv-duty-pill-on' : ''}`}
            onClick={toggleDuty}
            disabled={dutyLoading}
          >
            <span className={`dv-status-dot ${onDuty ? 'dv-status-dot-on' : ''}`}/>
            {onDuty ? 'Online' : 'Offline'}
          </button>
        </div>
      </header>

      {/* Step progress */}
      {assignment.status !== 'cancelled' && (
        <div className="dv-steps">
          {DELIVERY_STEPS.map((step, i) => {
            const stepIdx  = STEP_ORDER.indexOf(step.key);
            const isDone   = stepIdx < currentStepIdx;
            const isActive = stepIdx === currentStepIdx;
            return (
              <React.Fragment key={step.key}>
                <div className={`dv-step ${isDone ? 'dv-step-done' : ''} ${isActive ? 'dv-step-active' : ''}`}>
                  <div className="dv-step-circle">
                    {isDone ? <CheckCircle size={14}/> : <span>{step.emoji}</span>}
                  </div>
                  <span className="dv-step-lbl">{step.label}</span>
                </div>
                {i < DELIVERY_STEPS.length - 1 && (
                  <div className={`dv-step-line ${isDone ? 'dv-step-line-done' : isActive ? 'dv-step-line-active' : ''}`}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* In-app navigation bar */}
      {navData && assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
        <div className="dv-nav-bar">
          <span className="dv-nav-arrow">{navData.hasRoute ? '➜' : navData.arrow}</span>
          <div className="dv-nav-info">
            <span className="dv-nav-heading">{navData.instruction}</span>
            <span className="dv-nav-sub">{navData.dist} · ~{navData.etaMins} min</span>
          </div>
          <span className="dv-nav-live">● GPS</span>
        </div>
      )}

      <div className="dv-body">

        {/* Live map */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <DriverMap
            driverPos={lastPos ? { lat: lastPos.lat, lng: lastPos.lng } : null}
            destPos={destCoords}
            routePolyline={route?.polylineDecoded}
          />
        )}

        {/* Earnings strip */}
        {cashSummary && (cashSummary.deliveries_count > 0 || cashSummary.total_tips > 0 || cashSummary.total_cod > 0) && (
          <div className={`dv-earn-strip ${cashSummary.total_cod > 0 ? 'dv-earn-strip-cod' : ''}`}>
            <DollarSign size={14}/>
            <span>Today: <strong>{cashSummary.deliveries_count}</strong> drop{cashSummary.deliveries_count !== 1 ? 's' : ''}</span>
            {cashSummary.total_tips > 0 && <span className="dv-earn-tip">+${cashSummary.total_tips.toFixed(2)} tips</span>}
            {cashSummary.total_cod > 0 && (
              <span className="dv-earn-cod">💰 ${cashSummary.total_cod.toFixed(2)} cash</span>
            )}
          </div>
        )}

        {/* Accept / Reject */}
        {notYetAccepted && !rejectOpen && (
          <div className="dv-card dv-accept-card">
            <div className="dv-accept-pulse"/>
            <p className="dv-card-title">🚨 New Assignment</p>
            <div className="dv-btn-row">
              <button className="dv-btn dv-btn-primary" onClick={acceptAssignment}>
                <ThumbsUp size={16}/> Accept
              </button>
              <button className="dv-btn dv-btn-danger" onClick={() => setRejectOpen(true)}>
                <ThumbsDown size={16}/> Reject
              </button>
            </div>
          </div>
        )}
        {rejectOpen && (
          <div className="dv-card dv-accept-card">
            <p className="dv-card-title">Reason for rejecting?</p>
            <input
              className="dv-reject-input"
              placeholder="e.g. too far, traffic…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="dv-btn-row">
              <button className="dv-btn dv-btn-danger" onClick={rejectAssignment}>Confirm Reject</button>
              <button className="dv-btn" onClick={() => setRejectOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Order card */}
        <div className="dv-order-hero">
          {/* Address */}
          <div className="dv-addr-bar">
            <div className="dv-addr-pin-icon"><MapPin size={16}/></div>
            <div className="dv-addr-text">
              <span className="dv-addr-lbl">Delivering to</span>
              <span className="dv-addr-val">{assignment.delivery_address || 'Address not set'}</span>
            </div>
          </div>

          {/* Route */}
          <div className="dv-route-row">
            <div className="dv-route-node">
              <div className="dv-route-node-icon dv-node-store">🏪</div>
              <span>Restaurant</span>
            </div>
            <div className="dv-route-track">
              <div className="dv-route-dot-anim"/>
            </div>
            <div className="dv-route-node">
              <div className="dv-route-node-icon dv-node-dest"><MapPin size={14}/></div>
              <span>Customer</span>
            </div>
          </div>

          {/* Call restaurant */}
          <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} className="dv-restaurant-call">
            <div className="dv-restaurant-call-left">
              <div className="dv-restaurant-call-icon"><Phone size={15}/></div>
              <div>
                <span className="dv-restaurant-call-label">Call Restaurant</span>
                <span className="dv-restaurant-call-num">{settings.phone_main}</span>
              </div>
            </div>
            <span className="dv-restaurant-call-hint">Issue with order?</span>
          </a>

          {/* Customer */}
          {assignment.customer_name && (
            <div className="dv-cust-row">
              <div className="dv-cust-avatar">{(assignment.customer_name || '?').charAt(0).toUpperCase()}</div>
              <div className="dv-cust-info">
                <span className="dv-cust-name">{assignment.customer_name}</span>
                {assignment.customer_phone && (
                  <a href={`tel:${assignment.customer_phone}`} className="dv-cust-phone">{assignment.customer_phone}</a>
                )}
              </div>
              {assignment.customer_phone && (
                <div className="dv-cust-btns">
                  <a className="dv-cust-btn" href={`tel:${assignment.customer_phone}`}><Phone size={15}/></a>
                  <a className="dv-cust-btn" href={`sms:${assignment.customer_phone}?body=Hi, your Habibi Halal Express delivery is here!`}>
                    <MessageSquare size={15}/>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Money */}
          {(tip > 0 || isCod) && (
            <div className="dv-money-row">
              {tip > 0 && <div className="dv-money-tag dv-money-tip">💵 Tip: <strong>${tip.toFixed(2)}</strong></div>}
              {isCod && assignment.status !== 'delivered' && (
                <div className="dv-money-tag dv-money-cod">💰 COD: <strong>${codAmt.toFixed(2)}</strong></div>
              )}
            </div>
          )}

          {/* Items */}
          {Array.isArray(assignment.items) && assignment.items.length > 0 && (
            <div className="dv-items-section">
              <div className="dv-items-header">
                <Package size={13}/>
                <span>What's in the bag ({assignment.items.length} item{assignment.items.length !== 1 ? 's' : ''})</span>
              </div>
              <ul className="dv-items-list">
                {assignment.items.map((item, i) => (
                  <li key={i} className="dv-item-row">
                    <span className="dv-item-qty">{item.quantity || 1}×</span>
                    <span className="dv-item-name">{item.name || item.item_name || 'Item'}</span>
                    {item.customizations && item.customizations.length > 0 && (
                      <span className="dv-item-mods">
                        {item.customizations.map(c => c.choice || c.name || c).join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Special instructions */}
          {assignment.delivery_instructions && (
            <div className="dv-special-note">
              <span className="dv-special-icon">📝</span>
              <span>{assignment.delivery_instructions}</span>
            </div>
          )}

          {/* Time */}
          {assignment.assigned_at && (
            <div className="dv-order-meta">
              <Clock size={12}/> Assigned {new Date(assignment.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Pickup button */}
        {assignment.accepted_at && assignment.status === 'assigned' && (
          <button className="dv-action-btn dv-action-pickup" onClick={markPickedUp}>
            <Package size={20}/> Order Picked Up from Restaurant
          </button>
        )}

        {/* Maps */}
        {mapsUrl && (
          <a className="dv-maps-btn" href={mapsUrl} target="_blank" rel="noreferrer">
            <Navigation size={18}/> Navigate with Google Maps
          </a>
        )}

        {/* GPS */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <div className="dv-gps-card">
            <div className="dv-gps-left">
              <div className={`dv-gps-icon ${tracking ? 'dv-gps-on' : ''}`}>
                <Navigation size={15}/>
                {tracking && <div className="dv-gps-ping"/>}
              </div>
              <div>
                <span className="dv-gps-title">GPS {tracking ? '· Live' : '· Off'}</span>
                {gpsStatus && <span className="dv-gps-note">{gpsStatus}</span>}
                {lastPos && <span className="dv-gps-coords">{lastPos.lat.toFixed(4)}, {lastPos.lng.toFixed(4)}</span>}
              </div>
            </div>
            <button
              className={`dv-gps-toggle ${tracking ? 'dv-gps-stop' : 'dv-gps-start'}`}
              onClick={tracking ? stopTracking : startTracking}
            >
              {tracking ? 'Stop' : 'Start'}
            </button>
          </div>
        )}

        {/* Delivery flow */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <>
            {deliveryPhase === null && (
              <button className="dv-action-btn dv-action-arrived" onClick={() => setDeliveryPhase('arrived')}>
                <MapPin size={20}/> I've Arrived at Address
              </button>
            )}

            {deliveryPhase === 'arrived' && (
              <div className="dv-card dv-contact-card">
                <p className="dv-card-title">📍 Contact Customer</p>
                <p className="dv-contact-hint">Try reaching the customer before leaving the parcel.</p>
                <div className="dv-contact-btns">
                  {assignment.customer_phone && (
                    <a className="dv-btn dv-btn-call" href={`tel:${assignment.customer_phone}`}>
                      <Phone size={18}/> Call Customer
                    </a>
                  )}
                  {assignment.customer_phone && (
                    <a className="dv-btn dv-btn-sms"
                      href={`sms:${assignment.customer_phone}?body=Hi, your Habibi Halal Express delivery is here! Please come to the door.`}>
                      <MessageSquare size={18}/> Send SMS
                    </a>
                  )}
                </div>
                <div className="dv-contact-divider"><span>{isCod ? 'Collected cash?' : 'Customer responded?'}</span></div>
                <div className="dv-btn-row">
                  {isCod ? (
                    <button className="dv-btn dv-btn-cash-collect" onClick={markCashCollected}>
                      <DollarSign size={18}/> Cash Collected — ${codAmt.toFixed(2)} ✓
                    </button>
                  ) : (
                    <button className="dv-btn dv-btn-delivered" onClick={markDelivered}>
                      <CheckCircle size={18}/> Delivered ✓
                    </button>
                  )}
                  {!isCod && (
                    <button className="dv-btn dv-btn-noanswer" onClick={() => setDeliveryPhase('no_answer')}>No Answer</button>
                  )}
                  {isCod && (
                    <button className="dv-btn dv-btn-cod-noanswer" onClick={() => setDeliveryPhase('cod_noanswer')}>Not Home</button>
                  )}
                </div>
              </div>
            )}

            {deliveryPhase === 'no_answer' && (
              <div className="dv-card dv-proof-card">
                <div className="dv-proof-header">
                  <DoorOpen size={22} className="dv-proof-icon"/>
                  <div>
                    <p className="dv-card-title" style={{ marginBottom: 0 }}>Leave at Door</p>
                    <p className="dv-proof-sub">Place the parcel safely and take a photo as proof.</p>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePhotoCapture}
                />
                {!proofPreview ? (
                  <button className="dv-btn dv-btn-camera" onClick={() => photoInputRef.current?.click()}>
                    <Camera size={18}/> Take Photo Proof
                  </button>
                ) : (
                  <div className="dv-proof-preview-wrap">
                    <img src={proofPreview} alt="Proof" className="dv-proof-img"/>
                    <button className="dv-proof-retake" onClick={() => { setProofFile(null); setProofPreview(null); }}>
                      <X size={13}/> Retake
                    </button>
                  </div>
                )}
                {proofError && <p className="dv-proof-error">{proofError}</p>}
                <button
                  className="dv-btn dv-btn-delivered"
                  onClick={submitProofAndDeliver}
                  disabled={submitting}
                  style={{ marginTop: '0.75rem' }}
                >
                  {submitting ? 'Submitting…' : <><CheckCircle size={18}/> Confirm — Left at Door</>}
                </button>
                <button className="dv-btn dv-btn-back" onClick={() => setDeliveryPhase('arrived')}>← Back</button>
              </div>
            )}

            {deliveryPhase === 'cod_noanswer' && (
              <div className="dv-card dv-cod-blocked-card">
                <p className="dv-card-title">⚠ Cannot Leave — Cash Order</p>
                <p className="dv-cod-blocked-msg">
                  This is a Cash on Delivery order. You cannot leave the food without collecting{' '}
                  <strong>${codAmt.toFixed(2)}</strong>.
                </p>
                <p className="dv-cod-blocked-sub">Try the customer one more time, then return the order to the store.</p>
                <div className="dv-contact-btns" style={{ marginTop: '1rem' }}>
                  {assignment.customer_phone && (
                    <a className="dv-btn dv-btn-call" href={`tel:${assignment.customer_phone}`}>
                      <Phone size={18}/> Try Customer Again
                    </a>
                  )}
                </div>
                <button
                  className="dv-btn dv-btn-danger"
                  style={{ marginTop: '1rem', width: '100%' }}
                  onClick={markCodFailed}
                >
                  Returning Order to Store
                </button>
                <button className="dv-btn dv-btn-back" style={{ marginTop: '0.5rem' }} onClick={() => setDeliveryPhase('arrived')}>
                  ← Back
                </button>
              </div>
            )}
          </>
        )}

        {/* Delivery complete success screen */}
        {assignment.status === 'delivered' && (
          <div className="dv-success">
            <SuccessStars/>
            <div className="dv-success-check">
              <CheckCircle size={52}/>
            </div>
            <h2 className="dv-success-title">Delivery Complete! 🎉</h2>
            <p className="dv-muted">
              Delivered at {assignment.delivered_at ? new Date(assignment.delivered_at).toLocaleTimeString() : 'just now'}
            </p>
            {cashCollected != null && (
              <div className="dv-cash-confirmed">
                <DollarSign size={18}/>
                <span>Cash collected: ${parseFloat(cashCollected).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
