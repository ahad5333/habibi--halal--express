import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Navigation, MapPin, CheckCircle, AlertCircle, Clock, User,
  Package, Phone, MessageSquare, DoorOpen, Camera, X,
  ThumbsUp, ThumbsDown, Power, DollarSign, Bell, Send,
  Zap, Star, History,
} from 'lucide-react';
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

  const photoInputRef  = useRef(null);
  const watchRef       = useRef(null);
  const intervalRef    = useRef(null);
  const socketRef      = useRef(null);
  const countdownRef   = useRef(null);
  const wakeLockRef    = useRef(null);
  const onBreakRef     = useRef(false);

  // Keep ref in sync so socket handler always sees current break state
  useEffect(() => { onBreakRef.current = onBreak; }, [onBreak]);

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

  const loadHistory = useCallback(async () => {
    if (!driverId) return;
    setHistoryLoading(true);
    try {
      const data = await apiFetch(`/api/dispatch/drivers/${driverId}/history`);
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (_) {}
    setHistoryLoading(false);
  }, [driverId, apiFetch]);

  useEffect(() => {
    if (!assignment?.delivery_address) { setDestCoords(null); return; }
    const addr = [assignment.delivery_address, assignment.delivery_city].filter(Boolean).join(', ');
    apiFetch(`/api/dispatch/geocode?addr=${encodeURIComponent(addr)}`)
      .then(d => setDestCoords({ lat: d.lat, lng: d.lng }))
      .catch(() => {});
  }, [assignment?.delivery_address, assignment?.delivery_city]);

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
      setLastPos({ lat, lng, time: new Date().toLocaleTimeString() });
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
      setShiftStartTime(new Date());
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
      loadCashSummary();
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
              const isCodH = h.payment_method === 'cod';
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
        {historyDrawer}

        {/* Header */}
        <header className="dv-hdr">
          <div className="dv-hdr-left">
            <img src="/images/logos/logo.png" className="dv-logo-sm" alt="" onError={e => e.target.style.display='none'}/>
            <span className="dv-hdr-title">Habibi Driver</span>
          </div>
          <div className="dv-hdr-right">
            <button className="dv-icon-btn" onClick={() => { loadHistory(); setShowHistory(true); }} title="Delivery history">
              <History size={18}/>
              {cashSummary && cashSummary.deliveries_count > 0 && (
                <span className="dv-badge-dot">{cashSummary.deliveries_count}</span>
              )}
            </button>
            <button className="dv-icon-btn" onClick={openChat} title="Chat dispatch">
              <MessageSquare size={18}/>
              {chatUnread > 0 && <span className="dv-badge-dot">{chatUnread}</span>}
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
            <h1 className="dv-hero-h1">{greeting} 👋</h1>
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

          {/* Stats row */}
          <div className="dv-stats">
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
            <a className="dv-quick" href="tel:7184000443">
              <Phone size={22}/>
              <span>Call Store</span>
            </a>
            <button className="dv-quick" onClick={toggleDuty} disabled={dutyLoading}>
              <Power size={22}/>
              <span>{onDuty ? 'Go Off' : 'Go On'}</span>
            </button>
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
      {shiftSummaryModal}

      {/* Broadcast modal */}
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

      {/* Header */}
      <header className="dv-hdr dv-hdr-active">
        <div className="dv-hdr-order">
          <span className="dv-order-tag">{assignment.order_number || `#${assignment.order_id}`}</span>
          <span className={`dv-status-chip ${statusCls}`}>{statusLabel}</span>
        </div>
        <div className="dv-hdr-right">
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

      <div className="dv-body">

        {/* Live map */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <DriverMap
            driverPos={lastPos ? { lat: lastPos.lat, lng: lastPos.lng } : null}
            destPos={destCoords}
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
          <a href="tel:7184000443" className="dv-restaurant-call">
            <div className="dv-restaurant-call-left">
              <div className="dv-restaurant-call-icon"><Phone size={15}/></div>
              <div>
                <span className="dv-restaurant-call-label">Call Restaurant</span>
                <span className="dv-restaurant-call-num">(718) 400-0443</span>
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
