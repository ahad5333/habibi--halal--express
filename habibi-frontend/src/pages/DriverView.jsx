import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Navigation, MapPin, CheckCircle, AlertCircle, Clock, User, Package, Phone, MessageSquare, DoorOpen, Camera, X } from 'lucide-react';
import './DriverView.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${API_BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${res.status}`);
  return data;
}

const STATUS_LABELS = {
  assigned:  { label: 'Assigned',   cls: 'dv-badge-warn' },
  en_route:  { label: 'En Route',   cls: 'dv-badge-info' },
  delivered: { label: 'Delivered',  cls: 'dv-badge-success' },
  cancelled: { label: 'Cancelled',  cls: 'dv-badge-muted' },
};

export default function DriverView() {
  const [params]         = useSearchParams();
  const driverId         = params.get('id');

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [tracking, setTracking]     = useState(false);
  const [gpsStatus, setGpsStatus]   = useState('');
  const [error, setError]           = useState('');
  const [lastPos, setLastPos]       = useState(null);
  // Arrived-at-door flow: null | 'arrived' | 'no_answer'
  const [deliveryPhase, setDeliveryPhase] = useState(null);
  const [proofFile, setProofFile]         = useState(null);
  const [proofPreview, setProofPreview]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [proofError, setProofError]       = useState('');
  const photoInputRef = useRef(null);
  const watchRef      = useRef(null);
  const intervalRef   = useRef(null);
  const socketRef     = useRef(null);

  const loadAssignment = useCallback(async () => {
    if (!driverId) return;
    try {
      const data = await apiFetch(`/api/dispatch/driver/${driverId}`);
      setAssignment(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [driverId]);

  useEffect(() => { loadAssignment(); }, [loadAssignment]);

  // ── Socket.IO — real-time assignment notifications ──────────────────
  useEffect(() => {
    if (!driverId) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_driver', driverId);
    });

    // Admin assigned a new order — reload from API
    socket.on('assignment_created', (data) => {
      if (String(data.driver_id) === String(driverId)) {
        loadAssignment();
      }
    });

    // Admin cancelled or updated — reload to get current state
    socket.on('assignment_status_update', () => {
      loadAssignment();
    });

    return () => socket.disconnect();
  }, [driverId, loadAssignment]);

  // Send GPS update to backend
  const sendGPS = useCallback(async (lat, lng) => {
    if (!assignment?.id) return;
    try {
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/gps`, {
        method: 'PATCH',
        body: JSON.stringify({ lat, lng, driver_id: driverId }),
      });
      setLastPos({ lat: lat.toFixed(5), lng: lng.toFixed(5), time: new Date().toLocaleTimeString() });
    } catch (_) {}
  }, [assignment, driverId]);

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsStatus('GPS not supported by this browser'); return; }

    setTracking(true);
    setGpsStatus('Acquiring position…');

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsStatus(`GPS active · accuracy ${Math.round(pos.coords.accuracy)}m`);
        sendGPS(latitude, longitude);
      },
      (err) => {
        setGpsStatus(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Also push every 15 seconds even if position didn't change
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendGPS(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }, 15000);
  };

  const stopTracking = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setTracking(false);
    setGpsStatus('Tracking stopped');
  };

  useEffect(() => () => stopTracking(), []); // cleanup on unmount

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

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setProofError('');
  };

  const submitProofAndDeliver = async () => {
    if (!proofFile) { setProofError('Please take a photo of the parcel at the door.'); return; }
    setSubmitting(true);
    setProofError('');
    try {
      // Upload proof photo
      const form = new FormData();
      form.append('photo', proofFile);
      form.append('driver_id', driverId);
      form.append('note', 'Left at door — no answer');
      await fetch(`${API_BASE}/api/dispatch/assignments/${assignment.id}/proof`, {
        method: 'POST',
        body: form,
      });
      // Mark delivered
      await apiFetch(`/api/dispatch/assignments/${assignment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'delivered', note: 'Left at door — photo proof uploaded' }),
      });
      stopTracking();
      setAssignment(prev => ({ ...prev, status: 'delivered' }));
      setDeliveryPhase(null);
    } catch (e) {
      // Even if upload fails, still mark delivered so driver isn't blocked
      try {
        await apiFetch(`/api/dispatch/assignments/${assignment.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'delivered', note: 'Left at door' }),
        });
        stopTracking();
        setAssignment(prev => ({ ...prev, status: 'delivered' }));
        setDeliveryPhase(null);
      } catch (e2) { setProofError(e2.message); }
    } finally {
      setSubmitting(false);
    }
  };

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
          <span className="dv-live-dot" /> Live — you'll be notified automatically
        </p>
      </div>
    );
  }

  const { label: statusLabel, cls: statusCls } = STATUS_LABELS[assignment.status] || { label: assignment.status, cls: 'dv-badge-muted' };
  const mapsUrl = assignment.delivery_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignment.delivery_address)}`
    : null;

  return (
    <div className="dv-shell">
      <div className="dv-header">
        <div className="dv-brand">
          <Navigation size={20}/>
          <span>Driver Delivery</span>
        </div>
        <span className={`dv-badge ${statusCls}`}>{statusLabel}</span>
      </div>

      <div className="dv-content">
        {/* Order info */}
        <div className="dv-card">
          <p className="dv-card-title">Current Assignment</p>
          <div className="dv-info-row">
            <Package size={15}/>
            <div>
              <p className="dv-label">Order</p>
              <p className="dv-value">{assignment.order_number || `#${assignment.order_id}`}</p>
            </div>
          </div>
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

        {/* GPS Tracking */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <div className="dv-card">
            <p className="dv-card-title">GPS Tracking</p>
            {gpsStatus && <p className="dv-gps-status">{gpsStatus}</p>}
            {lastPos && (
              <p className="dv-coords">{lastPos.lat}, {lastPos.lng} · {lastPos.time}</p>
            )}
            <div className="dv-btn-row">
              {!tracking ? (
                <button className="dv-btn dv-btn-primary" onClick={startTracking}>
                  <Navigation size={16}/> Start Tracking
                </button>
              ) : (
                <button className="dv-btn dv-btn-danger" onClick={stopTracking}>
                  Stop Tracking
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        {mapsUrl && (
          <a className="dv-btn dv-btn-maps" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={16}/> Open in Google Maps
          </a>
        )}

        {/* ── Arrived at door flow ── */}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <>
            {/* Step 1 — Arrive */}
            {deliveryPhase === null && (
              <button className="dv-btn dv-btn-arrived" onClick={() => setDeliveryPhase('arrived')}>
                <MapPin size={18}/> I've Arrived at the Address
              </button>
            )}

            {/* Step 2 — Contact customer */}
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
                    <a className="dv-btn dv-btn-sms" href={`sms:${assignment.customer_phone}?body=Hi, your Habibi Halal Express delivery is here! Please come to the door.`}>
                      <MessageSquare size={18}/> Send Message
                    </a>
                  )}
                </div>

                <div className="dv-contact-divider">
                  <span>Customer responded?</span>
                </div>

                <div className="dv-btn-row">
                  <button className="dv-btn dv-btn-delivered" onClick={markDelivered}>
                    <CheckCircle size={18}/> Yes — Delivered ✓
                  </button>
                  <button className="dv-btn dv-btn-noanswer" onClick={() => setDeliveryPhase('no_answer')}>
                    No Answer
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — No answer: leave at door with photo */}
            {deliveryPhase === 'no_answer' && (
              <div className="dv-card dv-proof-card">
                <div className="dv-proof-header">
                  <DoorOpen size={22} className="dv-proof-icon"/>
                  <div>
                    <p className="dv-card-title" style={{ marginBottom: 0 }}>Leave at Door</p>
                    <p className="dv-proof-sub">Place the parcel safely at the door and take a photo as proof.</p>
                  </div>
                </div>

                {/* Photo capture */}
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

                <button className="dv-btn dv-btn-back" onClick={() => setDeliveryPhase('arrived')}>
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
            <p className="dv-muted">Delivered at {assignment.delivered_at ? new Date(assignment.delivered_at).toLocaleTimeString() : 'just now'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
