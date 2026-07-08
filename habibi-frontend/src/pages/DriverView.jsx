import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Navigation, MapPin, CheckCircle, AlertCircle, Clock, User,
  Package, Phone, MessageSquare, DoorOpen, Camera, X,
  ThumbsUp, ThumbsDown, Power, DollarSign, Bell, Send,
  Zap, Star,
} from 'lucide-react';
import './DriverView.css';

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

export default function DriverView() {
  const [params] = useSearchParams();
  const driverId = params.get('id');
  const token    = params.get('token');

  const apiFetch = useCallback(makeApiFetch(driverId, token), [driverId, token]);

  const [assignment, setAssignment]       = useState(null);
  const [loading, setLoading]             = useState(true);
  const [tracking, setTracking]           = useState(false);
  const [gpsStatus, setGpsStatus]         = useState('');
  const [error, setError]                 = useState('');
  const [lastPos, setLastPos]             = useState(null);
  const [onDuty, setOnDuty]               = useState(false);
  const [dutyLoading, setDutyLoading]     = useState(false);
  const [deliveryPhase, setDeliveryPhase] = useState(null);
  const [proofFile, setProofFile]         = useState(null);
  const [proofPreview, setProofPreview]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [proofError, setProofError]       = useState('');
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [cashCollected, setCashCollected] = useState(null);
  const [cashSummary, setCashSummary]     = useState(null);
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

  const photoInputRef  = useRef(null);
  const watchRef       = useRef(null);
  const intervalRef    = useRef(null);
  const socketRef      = useRef(null);
  const countdownRef   = useRef(null);
  const wakeLockRef    = useRef(null);

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

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, chatOpen]);

  const loadAssignment = useCallback(async () => {
    if (!driverId) return;
    try {
      const data = await apiFetch(`/api/dispatch/driver/${driverId}`);
      setAssignment(data);
    } catch (e) { setError(e.message); }
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

  useEffect(() => {
    if (!driverId) return;
    const socket = io(API_BASE, { transports: ['websocket', 'polling'], reconnectionAttempts: 10 });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_driver', driverId);
      socket.emit('join_drivers_online', { driver_id: driverId, hmac_token: token });
    });
    socket.on('assignment_created',       () => loadAssignment());
    socket.on('assignment_status_update', () => loadAssignment());
    socket.on('new_order_broadcast', (data) => {
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
    });

    socket.on('dispatch_chat_reply', (msg) => {
      setChatMsgs(prev => [...prev, msg]);
      setChatOpen(prev => {
        if (!prev) setChatUnread(n => n + 1);
        return prev;
      });
      try { playBell(); } catch (_) {}
    });

    return () => socket.disconnect();
  }, [driverId, loadAssignment]);

  const sendGPS = useCallback(async (lat, lng) => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/gps`, {
        method: 'PATCH',
        body: JSON.stringify({ lat, lng, driver_id: driverId }),
      });
      setLastPos({ lat: lat.toFixed(5), lng: lng.toFixed(5), time: new Date().toLocaleTimeString() });
    } catch (_) {}
  }, [assignment, driverId, apiFetch]);

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsStatus('GPS not supported'); return; }
    setTracking(true);
    setGpsStatus('Acquiring position…');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus(`GPS active · ±${Math.round(pos.coords.accuracy)}m`);
        sendGPS(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => setGpsStatus(`GPS error: ${err.message}`),
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
        setBroadcastOrder(null);
        await loadAssignment();
        if (!tracking) startTracking();
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
    setDutyLoading(true);
    try {
      await apiFetch(`/api/dispatch/drivers/${driverId}/duty`, {
        method: 'PATCH',
        body: JSON.stringify({ on_duty: !onDuty }),
      });
      setOnDuty(v => !v);
    } catch (e) { setError(e.message); }
    setDutyLoading(false);
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
        body: JSON.stringify({ response: 'accepted' }),
      });
      setAssignment(prev => ({ ...prev, accepted_at: new Date().toISOString() }));
    } catch (e) { setError(e.message); }
  };

  const rejectAssignment = async () => {
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ response: 'rejected', reason: rejectReason }),
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
        body: JSON.stringify({ status: 'delivered' }),
      });
      stopTracking();
      setAssignment(prev => ({ ...prev, status: 'delivered' }));
      setDeliveryPhase(null);
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
      setAssignment(prev => ({ ...prev, status: 'delivered' }));
      setDeliveryPhase(null);
      loadCashSummary();
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
        body: JSON.stringify({ status: 'delivered', note: 'Left at door' }),
      });
      stopTracking();
      setAssignment(prev => ({ ...prev, status: 'delivered' }));
      setDeliveryPhase(null);
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

  // ── Idle screen (no active assignment) ────────────────────────────
  if (!assignment) {
    const hasEarnings = cashSummary && (cashSummary.deliveries_count > 0 || cashSummary.total_tips > 0 || cashSummary.total_cod > 0);
    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const shiftTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="dv-shell dv-idle">
        {chatOverlay}

        {/* Header */}
        <div className="dv-header">
          <div className="dv-brand">
            <img src="/images/logos/logo.png" className="dv-brand-logo" alt="Habibi" onError={e => e.target.style.display='none'}/>
            <span>Driver</span>
          </div>
          <div className="dv-header-right">
            <button className="dv-chat-fab-mini" onClick={openChat} title="Message dispatch">
              <MessageSquare size={13}/>
              {chatUnread > 0 && <span className="dv-chat-badge">{chatUnread}</span>}
            </button>
            <button
              className={`dv-badge ${onDuty ? 'dv-badge-success' : 'dv-badge-muted'} dv-duty-mini`}
              onClick={toggleDuty}
              disabled={dutyLoading}
            >
              <Power size={11}/> {onDuty ? 'On Duty' : 'Off Duty'}
            </button>
          </div>
        </div>

        {/* ── Hero with real background image ── */}
        <div className={`dv-idle-hero ${onDuty ? 'dv-hero-on-duty' : ''}`}>
          <div className="dv-hero-bg-image" />
          <div className="dv-hero-bg-overlay" />
          <div className="dv-hero-inner">
            {/* Driver badge */}
            <div className="dv-badge-container">
              <img src="/images/driver-badge.png" alt="Habibi Driver" className="dv-badge-img" />
            </div>
            <div className="dv-greeting-strip">
              <span className="dv-greeting-text">{greeting} 👋</span>
              <span className="dv-shift-time">🕐 {shiftTime}</span>
            </div>
            {/* Road scene */}
            <div className="dv-hero-scene">
              <div className="dv-hero-road-container">
                <div className="dv-road-surface">
                  <div className="dv-road-stripe"/>
                </div>
                <div className={`dv-scooter ${onDuty ? 'dv-scooter-riding' : ''}`}>🛵</div>
                {onDuty && (
                  <>
                    <div className="dv-scooter-exhaust">💨</div>
                    <div className="dv-speed-lines">
                      {[...Array(4)].map((_, i) => <div key={i} className="dv-speed-line" style={{ '--i': i }}/>)}
                    </div>
                  </>
                )}
              </div>
            </div>
            <h2 className="dv-hero-title">
              {onDuty ? '🔥 Waiting for Orders' : '👋 Ready to Roll?'}
            </h2>
            <p className="dv-hero-sub">
              {onDuty
                ? "You'll be notified the moment a new order comes in"
                : 'Go on duty to start receiving delivery orders'
              }
            </p>
            {onDuty && (
              <div className="dv-live-radar">
                <div className="dv-radar-ring dv-radar-1"/>
                <div className="dv-radar-ring dv-radar-2"/>
                <div className="dv-radar-ring dv-radar-3"/>
                <div className="dv-radar-dot"><Zap size={12}/></div>
              </div>
            )}
          </div>
        </div>

        <div className="dv-content">
          {/* Duty mega-button */}
          <button
            className={`dv-duty-mega ${onDuty ? 'dv-duty-mega-on' : 'dv-duty-mega-off'}`}
            onClick={toggleDuty}
            disabled={dutyLoading}
          >
            {onDuty && <div className="dv-duty-glow-ring"/>}
            <Power size={22}/>
            <span>{dutyLoading ? 'Updating…' : onDuty ? 'On Duty — Tap to go Off' : 'Go On Duty'}</span>
          </button>

          {/* ── Earnings Card with progress bar ── */}
          <div className="dv-card dv-earnings-card">
            <p className="dv-card-title"><Star size={11} style={{ marginRight: 4 }}/>Today's Earnings</p>
            <div className="dv-earnings-grid">
              <div className="dv-earnings-item">
                <span className="dv-earnings-icon">📦</span>
                <span className="dv-earnings-val">{hasEarnings ? cashSummary.deliveries_count : '0'}</span>
                <span className="dv-earnings-label">Deliveries</span>
              </div>
              <div className="dv-earnings-item">
                <span className="dv-earnings-icon">💵</span>
                <span className="dv-earnings-val dv-earnings-green">
                  ${hasEarnings ? cashSummary.total_tips.toFixed(2) : '0.00'}
                </span>
                <span className="dv-earnings-label">Tips</span>
              </div>
              <div className="dv-earnings-item">
                <span className="dv-earnings-icon">💰</span>
                <span className="dv-earnings-val dv-earnings-gold">
                  ${hasEarnings ? cashSummary.total_cod.toFixed(2) : '0.00'}
                </span>
                <span className="dv-earnings-label">Cash</span>
              </div>
            </div>
            {/* Goal progress bar */}
            <div className="dv-goal-bar-wrap">
              <div className="dv-goal-bar-labels">
                <span>Daily Goal</span>
                <span className="dv-goal-bar-pct">{Math.min(100, Math.round(((hasEarnings ? cashSummary.deliveries_count : 0) / 10) * 100))}%</span>
              </div>
              <div className="dv-goal-bar-track">
                <div className="dv-goal-bar-fill" style={{ width: `${Math.min(100, ((hasEarnings ? cashSummary.deliveries_count : 0) / 10) * 100)}%` }} />
              </div>
              <p className="dv-goal-bar-sub">{hasEarnings ? cashSummary.deliveries_count : 0} / 10 deliveries</p>
            </div>
            {hasEarnings && cashSummary.total_cod > 0 && (
              <p className="dv-earnings-note">💼 Hand in ${cashSummary.total_cod.toFixed(2)} to manager at end of shift</p>
            )}
            {!hasEarnings && <p className="dv-earnings-empty">No deliveries completed yet today</p>}
          </div>

          {/* ── Rank Card with image background ── */}
          <div className="dv-rank-card">
            <img src="/images/driver-rank-bg.jpg" alt="" className="dv-rank-card-bg" />
            <div className="dv-rank-card-overlay" />
            <div className="dv-rank-card-content">
              <div className="dv-rank-left">
                <span className="dv-rank-crown">👑</span>
                <div>
                  <p className="dv-rank-label">Driver Rank</p>
                  <p className="dv-rank-title">
                    {!hasEarnings ? 'Rookie' :
                     cashSummary.deliveries_count < 5 ? 'Rookie' :
                     cashSummary.deliveries_count < 10 ? '🔥 Hot Shot' :
                     cashSummary.deliveries_count < 20 ? '⭐ Star Driver' :
                     '💎 Elite Driver'}
                  </p>
                </div>
              </div>
              <div className="dv-rank-stars">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className={`dv-rank-star ${(hasEarnings ? cashSummary.deliveries_count : 0) >= s * 2 ? 'dv-star-lit' : ''}`}>★</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Motivational Banner ── */}
          <div className="dv-motive-banner">
            <img src="/images/driver-motivation.jpg" alt="Keep going" className="dv-motive-img" />
            <div className="dv-motive-overlay">
              <p className="dv-motive-quote">"Every delivery is a step closer to your goal"</p>
              <p className="dv-motive-brand">— Habibi Halal Express</p>
            </div>
          </div>

          {/* ── Quick Actions Grid ── */}
          <div className="dv-quick-actions">
            <p className="dv-card-title" style={{ marginBottom: '0.75rem' }}>⚡ Quick Actions</p>
            <div className="dv-quick-grid">
              <button className="dv-quick-btn" onClick={openChat}>
                <span className="dv-quick-icon">💬</span>
                <span>Chat Dispatch</span>
              </button>
              <a className="dv-quick-btn" href="https://maps.google.com" target="_blank" rel="noreferrer">
                <span className="dv-quick-icon">🗺️</span>
                <span>Open Maps</span>
              </a>
              <a className="dv-quick-btn" href="tel:7184000443">
                <span className="dv-quick-icon">📞</span>
                <span>Call Store</span>
              </a>
              <button className="dv-quick-btn" onClick={toggleDuty} disabled={dutyLoading}>
                <span className="dv-quick-icon">{onDuty ? '🔴' : '🟢'}</span>
                <span>{onDuty ? 'Go Off' : 'Go On'}</span>
              </button>
            </div>
          </div>

          {/* ── Achievement badges strip ── */}
          <div className="dv-achievements-strip">
            <p className="dv-card-title" style={{ padding: '0 0 0.75rem' }}>🏆 Today's Badges</p>
            <div className="dv-achievements-row">
              <div className="dv-achievement-badge dv-badge-unlocked">
                <span className="dv-ach-icon">🛵</span>
                <span className="dv-ach-label">First Drop</span>
              </div>
              <div className={`dv-achievement-badge ${hasEarnings && cashSummary.deliveries_count >= 5 ? 'dv-badge-unlocked' : 'dv-badge-locked'}`}>
                <span className="dv-ach-icon">{hasEarnings && cashSummary.deliveries_count >= 5 ? '🔥' : '🔒'}</span>
                <span className="dv-ach-label">5 Drops</span>
              </div>
              <div className={`dv-achievement-badge ${hasEarnings && cashSummary.deliveries_count >= 10 ? 'dv-badge-unlocked' : 'dv-badge-locked'}`}>
                <span className="dv-ach-icon">{hasEarnings && cashSummary.deliveries_count >= 10 ? '⭐' : '🔒'}</span>
                <span className="dv-ach-label">10 Drops</span>
              </div>
              <div className={`dv-achievement-badge ${hasEarnings && cashSummary.total_tips >= 20 ? 'dv-badge-unlocked' : 'dv-badge-locked'}`}>
                <span className="dv-ach-icon">{hasEarnings && cashSummary.total_tips >= 20 ? '💎' : '🔒'}</span>
                <span className="dv-ach-label">$20 Tips</span>
              </div>
            </div>
          </div>

          {/* ── Pro Tips Card ── */}
          <div className="dv-tips-card">
            <div className="dv-tips-header">
              <span className="dv-tips-icon">⚡</span>
              <span className="dv-tips-title">Pro Driver Tips</span>
            </div>
            <div className="dv-tips-list">
              <div className="dv-tip-item"><span>🗺️</span><span>Check traffic before heading out</span></div>
              <div className="dv-tip-item"><span>📱</span><span>Keep GPS active during deliveries</span></div>
              <div className="dv-tip-item"><span>😊</span><span>A smile earns better tips every time</span></div>
              <div className="dv-tip-item"><span>⚡</span><span>Fast &amp; accurate = 5 star ratings</span></div>
              <div className="dv-tip-item"><span>🧊</span><span>Keep hot food hot — always use the bag</span></div>
            </div>
          </div>
        </div>
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
  const isCod  = assignment.payment_method === 'cod';
  const codAmt = parseFloat(assignment.order_total || 0);

  const currentStepIdx = STEP_ORDER.indexOf(assignment.status);

  return (
    <div className="dv-shell">

      {chatOverlay}

      {/* ── New Order Broadcast Modal ── */}
      {broadcastOrder && (
        <div className="dv-broadcast-overlay">
          <div className="dv-broadcast-modal">
            <div className="dv-broadcast-pulse-ring"/>
            <div className="dv-broadcast-bell"><Bell size={28}/></div>
            <h3 className="dv-broadcast-title">New Order Available!</h3>

            <div className="dv-broadcast-info">
              <p className="dv-broadcast-ordernum"># {broadcastOrder.order_number}</p>
              <p className="dv-broadcast-name">{broadcastOrder.customer_name}</p>
              {broadcastOrder.delivery_address && (
                <p className="dv-broadcast-addr"><MapPin size={12}/> {broadcastOrder.delivery_address}</p>
              )}
              <p className="dv-broadcast-total">${parseFloat(broadcastOrder.total || 0).toFixed(2)}</p>
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
                  {claimLoading ? 'Claiming…' : <><CheckCircle size={16}/> Accept Order</>}
                </button>
                <button className="dv-btn dv-btn-skip" onClick={dismissBroadcast}>Skip</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dv-header">
        <div className="dv-brand">
          <img src="/images/logos/logo.png" className="dv-brand-logo" alt="Habibi" onError={e => e.target.style.display='none'}/>
          <span>Delivery</span>
        </div>
        <div className="dv-header-right">
          <span className={`dv-badge ${statusCls}`}>{statusLabel}</span>
          <button className="dv-chat-fab-mini" onClick={openChat} title="Message dispatch">
            <MessageSquare size={13}/>
            {chatUnread > 0 && <span className="dv-chat-badge">{chatUnread}</span>}
          </button>
          <button
            className={`dv-badge ${onDuty ? 'dv-badge-success' : 'dv-badge-muted'} dv-duty-mini`}
            onClick={toggleDuty}
            disabled={dutyLoading}
            title={onDuty ? 'Go off duty' : 'Go on duty'}
          >
            <Power size={11}/> {onDuty ? 'On Duty' : 'Off Duty'}
          </button>
        </div>
      </div>

      {/* Delivery progress stepper */}
      {assignment.status !== 'cancelled' && (
        <div className="dv-stepper">
          {DELIVERY_STEPS.map((step, i) => {
            const stepIdx = STEP_ORDER.indexOf(step.key);
            const isDone   = stepIdx < currentStepIdx;
            const isActive = stepIdx === currentStepIdx;
            return (
              <React.Fragment key={step.key}>
                <div className={`dv-step ${isDone ? 'dv-step-done' : ''} ${isActive ? 'dv-step-active' : ''}`}>
                  <div className="dv-step-dot">
                    {isDone ? <CheckCircle size={14}/> : <span className="dv-step-emoji">{step.emoji}</span>}
                  </div>
                  <span className="dv-step-label">{step.label}</span>
                </div>
                {i < DELIVERY_STEPS.length - 1 && (
                  <div className={`dv-step-line ${isDone ? 'dv-step-line-done' : isActive ? 'dv-step-line-active' : ''}`}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="dv-content">

        {/* Today's cash strip */}
        {cashSummary && (cashSummary.deliveries_count > 0 || cashSummary.total_tips > 0) && (
          <div className="dv-cash-summary-bar">
            <DollarSign size={15}/>
            <span>Today: <strong>{cashSummary.deliveries_count} drop{cashSummary.deliveries_count !== 1 ? 's' : ''}</strong></span>
            {cashSummary.total_tips > 0 && (
              <span className="dv-tip-pill">+${cashSummary.total_tips.toFixed(2)} tips</span>
            )}
            {cashSummary.total_cod > 0 && (
              <span className="dv-cash-summary-orders">· ${cashSummary.total_cod.toFixed(2)} COD</span>
            )}
          </div>
        )}

        {/* Accept / Reject card */}
        {notYetAccepted && !rejectOpen && (
          <div className="dv-card dv-accept-card">
            <div className="dv-accept-pulse"/>
            <p className="dv-card-title">🚨 New Assignment — Accept or Reject?</p>
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
            <p className="dv-card-title">Reason for rejecting (optional)</p>
            <input
              className="dv-reject-input"
              placeholder="e.g. too far, traffic, wrong area…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="dv-btn-row">
              <button className="dv-btn dv-btn-danger" onClick={rejectAssignment}>Confirm Reject</button>
              <button className="dv-btn" onClick={() => setRejectOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Order info card */}
        <div className="dv-card dv-order-card">
          {/* Food banner image */}
          <div className="dv-order-food-banner">
            <img src="/images/food/kitchen.jpg" alt="Habibi Kitchen" className="dv-order-food-banner-img" />
            <div className="dv-order-food-banner-overlay">
              <span className="dv-order-banner-label">🍗 Fresh & Hot — Handle with Care</span>
            </div>
          </div>
          <div className="dv-order-card-header">
            <span className="dv-order-food-badge">🍗</span>
            <div>
              <p className="dv-order-num">{assignment.order_number || `#${assignment.order_id}`}</p>
              <p className="dv-order-time">
                <Clock size={11}/> {new Date(assignment.assigned_at).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Route visual */}
          <div className="dv-route-visual">
            <div className="dv-route-point dv-route-origin">
              <div className="dv-route-dot dv-dot-restaurant">🏪</div>
              <span className="dv-route-label">Restaurant</span>
            </div>
            <div className="dv-route-line">
              <div className="dv-route-moving-dot"/>
            </div>
            <div className="dv-route-point dv-route-dest">
              <div className="dv-route-dot dv-dot-customer"><MapPin size={14}/></div>
              <span className="dv-route-label">Customer</span>
            </div>
          </div>

          {/* Address */}
          <div className="dv-delivery-address-block">
            <MapPin size={16} className="dv-addr-pin"/>
            <div>
              <p className="dv-label">Delivery Address</p>
              <p className="dv-value dv-addr-value">{assignment.delivery_address || '—'}</p>
            </div>
          </div>

          {/* Customer */}
          {assignment.customer_name && (
            <div className="dv-info-row">
              <User size={15}/>
              <div>
                <p className="dv-label">Customer</p>
                <p className="dv-value">{assignment.customer_name}</p>
                {assignment.customer_phone && (
                  <a className="dv-phone" href={`tel:${assignment.customer_phone}`}>{assignment.customer_phone}</a>
                )}
              </div>
            </div>
          )}

          {/* Tip */}
          {tip > 0 && (
            <div className="dv-tip-banner">
              <span className="dv-tip-icon">💵</span>
              <div>
                <p className="dv-tip-label">Tip Included</p>
                <p className="dv-tip-value">${tip.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* COD banner */}
          {isCod && assignment.status !== 'delivered' && (
            <div className="dv-cod-banner">
              <DollarSign size={20}/>
              <div>
                <p className="dv-cod-label">COLLECT CASH ON DELIVERY</p>
                <p className="dv-cod-amount">${codAmt.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pickup button */}
        {assignment.accepted_at && assignment.status === 'assigned' && (
          <button className="dv-btn dv-btn-pickup" onClick={markPickedUp}>
            <Package size={18}/> Order Picked Up from Restaurant
          </button>
        )}

        {/* GPS tracking card */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <div className="dv-card dv-gps-card">
            <div className="dv-gps-header">
              <div className={`dv-gps-icon ${tracking ? 'dv-gps-live' : ''}`}>
                <Navigation size={16}/>
                {tracking && <div className="dv-gps-ping"/>}
              </div>
              <div>
                <p className="dv-card-title" style={{ marginBottom: 0 }}>GPS Tracking</p>
                {gpsStatus && <p className="dv-gps-status-inline">{gpsStatus}</p>}
              </div>
            </div>
            {lastPos && (
              <p className="dv-coords">{lastPos.lat}, {lastPos.lng} · {lastPos.time}</p>
            )}
            <div className="dv-btn-row" style={{ marginTop: '0.75rem' }}>
              {!tracking ? (
                <button className="dv-btn dv-btn-primary" onClick={startTracking}>
                  <Navigation size={16}/> Start GPS Tracking
                </button>
              ) : (
                <button className="dv-btn dv-btn-gps-stop" onClick={stopTracking}>
                  Stop Tracking
                </button>
              )}
            </div>
          </div>
        )}

        {/* Maps navigation button */}
        {mapsUrl && (
          <a className="dv-btn dv-btn-maps" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={16}/> Navigate with Google Maps
          </a>
        )}

        {/* Arrived & delivery flow */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <>
            {deliveryPhase === null && (
              <button className="dv-btn dv-btn-arrived" onClick={() => setDeliveryPhase('arrived')}>
                <MapPin size={18}/> I've Arrived at the Address
              </button>
            )}

            {deliveryPhase === 'arrived' && (
              <div className="dv-card dv-contact-card">
                <p className="dv-card-title">📍 Arrived — Contact Customer</p>
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
                      <CheckCircle size={18}/> Yes — Delivered ✓
                    </button>
                  )}
                  {!isCod && (
                    <button className="dv-btn dv-btn-noanswer" onClick={() => setDeliveryPhase('no_answer')}>
                      No Answer
                    </button>
                  )}
                  {isCod && (
                    <button className="dv-btn dv-btn-cod-noanswer" onClick={() => setDeliveryPhase('cod_noanswer')}>
                      Customer Not Home
                    </button>
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
