import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Navigation, MapPin, CheckCircle, AlertCircle, Clock, User,
  Package, Phone, MessageSquare, DoorOpen, Camera, X,
  ThumbsUp, ThumbsDown, Power, DollarSign, Bell,
} from 'lucide-react';
import './DriverView.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// All driver API calls include X-Driver-Token and driver_id for authentication
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

export default function DriverView() {
  const [params] = useSearchParams();
  const driverId = params.get('id');
  const token    = params.get('token');   // HMAC auth token embedded in SMS link

  const apiFetch = useCallback(makeApiFetch(driverId, token), [driverId, token]);

  const [assignment, setAssignment]       = useState(null);
  const [loading, setLoading]             = useState(true);
  const [tracking, setTracking]           = useState(false);
  const [gpsStatus, setGpsStatus]         = useState('');
  const [error, setError]                 = useState('');
  const [lastPos, setLastPos]             = useState(null);
  const [onDuty, setOnDuty]               = useState(false);
  const [dutyLoading, setDutyLoading]     = useState(false);
  // Delivery flow: null | 'arrived' | 'no_answer'
  const [deliveryPhase, setDeliveryPhase] = useState(null);
  const [proofFile, setProofFile]         = useState(null);
  const [proofPreview, setProofPreview]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [proofError, setProofError]       = useState('');
  // Accept/reject
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  // COD cash collection
  const [cashCollected, setCashCollected] = useState(null);
  // Today's running total across all COD deliveries
  const [cashSummary, setCashSummary]     = useState(null);
  // Broadcast order notification (new order available to claim)
  const [broadcastOrder, setBroadcastOrder] = useState(null);
  const [claimCountdown, setClaimCountdown] = useState(30);
  const [claimLoading, setClaimLoading]     = useState(false);
  const [claimResult, setClaimResult]       = useState(null); // 'won' | 'lost'

  const photoInputRef  = useRef(null);
  const watchRef       = useRef(null);
  const intervalRef    = useRef(null);
  const socketRef      = useRef(null);
  const countdownRef   = useRef(null);
  const wakeLockRef    = useRef(null);

  // ── Screen Wake Lock — keep phone screen on ───────────────────────
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock; })
        .catch(() => {});
    }
    return () => { wakeLockRef.current?.release(); };
  }, []);

  const loadAssignment = useCallback(async () => {
    if (!driverId) return;
    try {
      const data = await apiFetch(`/api/dispatch/driver/${driverId}`);
      setAssignment(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [driverId, apiFetch]);

  useEffect(() => { loadAssignment(); }, [loadAssignment]);

  // Load today's cash total for this driver
  const loadCashSummary = useCallback(async () => {
    if (!driverId) return;
    try {
      const data = await apiFetch(`/api/dispatch/drivers/${driverId}/cash-summary`);
      setCashSummary(data);
    } catch (_) {}
  }, [driverId, apiFetch]);

  useEffect(() => { loadCashSummary(); }, [loadCashSummary]);

  // ── Socket.IO ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!driverId) return;
    const socket = io(API_BASE, { transports: ['websocket', 'polling'], reconnectionAttempts: 10 });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_driver', driverId);
      // Join broadcast room so new orders ring this driver
      socket.emit('join_drivers_online', { driver_id: driverId, hmac_token: token });
    });
    socket.on('assignment_created',       () => loadAssignment());
    socket.on('assignment_status_update', () => loadAssignment());
    socket.on('new_order_broadcast', (data) => {
      setBroadcastOrder(data);
      setClaimCountdown(30);
      setClaimResult(null);
      playBell();
    });

    return () => socket.disconnect();
  }, [driverId, loadAssignment]);

  // ── GPS ────────────────────────────────────────────────────────────
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

  // ── Broadcast countdown — auto-dismisses after 30s ────────────────
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

  // ── Claim a broadcast order (first-come first-served) ─────────────
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

  // ── On-duty toggle ─────────────────────────────────────────────────
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

  // ── Mark order picked up from restaurant ──────────────────────────
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

  // ── Accept / reject ────────────────────────────────────────────────
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

  // ── Delivery completion ────────────────────────────────────────────
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
      // 409 = already recorded (double-tap) — treat as success
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
    // Mark delivered regardless of photo upload success
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

  // ── Render ─────────────────────────────────────────────────────────
  if (!driverId) {
    return (
      <div className="dv-shell dv-center">
        <AlertCircle size={40}/>
        <p>No driver ID in URL. Use the link provided by dispatch.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dv-shell dv-center">
        <div className="dv-spinner"/>
        <p>Loading assignment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dv-shell dv-center">
        <AlertCircle size={40}/>
        <p>{error}</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="dv-shell dv-center">
        <Package size={40}/>
        <p>No active assignment</p>
        <p className="dv-muted">Waiting for dispatch to assign you an order…</p>
        <p className="dv-live-waiting">
          <span className="dv-live-dot"/> Live — you'll be notified automatically
        </p>
        {/* On-duty toggle even when no assignment */}
        <button
          className={`dv-btn dv-duty-btn ${onDuty ? 'dv-duty-on' : 'dv-duty-off'}`}
          onClick={toggleDuty}
          disabled={dutyLoading}
          style={{ marginTop: '1.5rem' }}
        >
          <Power size={16}/> {onDuty ? 'On Duty — tap to go off duty' : 'Go On Duty'}
        </button>
      </div>
    );
  }

  const { label: statusLabel, cls: statusCls } = STATUS_LABELS[assignment.status] || { label: assignment.status, cls: 'dv-badge-muted' };
  const mapsUrl = assignment.delivery_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignment.delivery_address)}`
    : null;
  const notYetAccepted = !assignment.accepted_at && assignment.status === 'assigned';
  const tip    = parseFloat(assignment.tip_amount  || 0);
  const isCod  = assignment.payment_method === 'cod';
  const codAmt = parseFloat(assignment.order_total || 0);

  return (
    <div className="dv-shell">

      {/* ── New Order Broadcast Modal ── */}
      {broadcastOrder && (
        <div className="dv-broadcast-overlay">
          <div className="dv-broadcast-modal">
            <div className="dv-broadcast-bell"><Bell size={32}/></div>
            <h3 className="dv-broadcast-title">New Order Available!</h3>
            <div className="dv-broadcast-info">
              <p className="dv-broadcast-ordernum">{broadcastOrder.order_number}</p>
              <p className="dv-broadcast-name">{broadcastOrder.customer_name}</p>
              {broadcastOrder.delivery_address && (
                <p className="dv-broadcast-addr"><MapPin size={12}/> {broadcastOrder.delivery_address}</p>
              )}
              <p className="dv-broadcast-total">${parseFloat(broadcastOrder.total || 0).toFixed(2)}</p>
            </div>
            <div className={`dv-broadcast-countdown ${claimCountdown <= 10 ? 'dv-countdown-urgent' : ''}`}>
              {claimCountdown}s
            </div>
            {claimResult === 'lost' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#f87171', marginBottom: '0.75rem' }}>Order taken by another driver</p>
                <button className="dv-btn" onClick={dismissBroadcast}>Close</button>
              </div>
            ) : (
              <div className="dv-btn-row">
                <button className="dv-btn dv-btn-primary" onClick={claimBroadcastOrder} disabled={claimLoading}>
                  {claimLoading ? 'Claiming…' : <><CheckCircle size={16}/> Accept</>}
                </button>
                <button className="dv-btn dv-btn-danger" onClick={dismissBroadcast}>Skip</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dv-header">
        <div className="dv-brand"><Navigation size={20}/><span>Driver Delivery</span></div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`dv-badge ${statusCls}`}>{statusLabel}</span>
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

      <div className="dv-content">

        {/* ── Today's cash summary ── */}
        {cashSummary && cashSummary.total_collected > 0 && (
          <div className="dv-cash-summary-bar">
            <DollarSign size={16}/>
            <span>Today's cash: <strong>${parseFloat(cashSummary.total_collected).toFixed(2)}</strong></span>
            <span className="dv-cash-summary-orders">({cashSummary.orders.length} order{cashSummary.orders.length !== 1 ? 's' : ''})</span>
            <span className="dv-cash-summary-note">Hand in to manager at end of shift</span>
          </div>
        )}

        {/* ── Accept / Reject prompt ── */}
        {notYetAccepted && !rejectOpen && (
          <div className="dv-card dv-accept-card">
            <p className="dv-card-title">New Assignment — Accept or Reject?</p>
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

        {/* ── Order info ── */}
        <div className="dv-card">
          <p className="dv-card-title">Current Assignment</p>

          <div className="dv-info-row">
            <Package size={15}/>
            <div>
              <p className="dv-label">Order</p>
              <p className="dv-value">{assignment.order_number || `#${assignment.order_id}`}</p>
            </div>
          </div>

          {tip > 0 && (
            <div className="dv-info-row">
              <DollarSign size={15}/>
              <div>
                <p className="dv-label">Tip</p>
                <p className="dv-value dv-tip">${tip.toFixed(2)}</p>
              </div>
            </div>
          )}

          {isCod && assignment.status !== 'delivered' && (
            <div className="dv-cod-banner">
              <DollarSign size={18}/>
              <div>
                <p className="dv-cod-label">COLLECT CASH FROM CUSTOMER</p>
                <p className="dv-cod-amount">${codAmt.toFixed(2)}</p>
              </div>
            </div>
          )}

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

          <div className="dv-info-row">
            <MapPin size={15}/>
            <div>
              <p className="dv-label">Delivery Address</p>
              <p className="dv-value">{assignment.delivery_address || '—'}</p>
            </div>
          </div>

          <div className="dv-info-row">
            <Clock size={15}/>
            <div>
              <p className="dv-label">Assigned</p>
              <p className="dv-value">{new Date(assignment.assigned_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        {/* ── Picked Up button — after accepting, before GPS en_route ── */}
        {assignment.accepted_at && assignment.status === 'assigned' && (
          <button className="dv-btn dv-btn-pickup" onClick={markPickedUp}>
            <Package size={18}/> Order Picked Up from Restaurant
          </button>
        )}

        {/* ── GPS Tracking ── */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <div className="dv-card">
            <p className="dv-card-title">GPS Tracking</p>
            {gpsStatus && <p className="dv-gps-status">{gpsStatus}</p>}
            {lastPos && <p className="dv-coords">{lastPos.lat}, {lastPos.lng} · {lastPos.time}</p>}
            <div className="dv-btn-row">
              {!tracking ? (
                <button className="dv-btn dv-btn-primary" onClick={startTracking}>
                  <Navigation size={16}/> Start Tracking
                </button>
              ) : (
                <button className="dv-btn dv-btn-danger" onClick={stopTracking}>Stop Tracking</button>
              )}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        {mapsUrl && (
          <a className="dv-btn dv-btn-maps" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={16}/> Open in Google Maps
          </a>
        )}

        {/* ── Arrived-at-door flow ── */}
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
                      <MessageSquare size={18}/> Send Message
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
                  {/* COD: cannot leave at door without collecting cash */}
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

            {/* Non-COD: leave at door flow */}
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

            {/* COD: customer not home — cannot leave, must call manager */}
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

        {assignment.status === 'delivered' && (
          <div className="dv-success">
            <CheckCircle size={32}/>
            <p>Delivery complete!</p>
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
