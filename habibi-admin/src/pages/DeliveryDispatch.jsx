import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck, User, MapPin, Clock, CheckCircle, XCircle,
  RefreshCw, Navigation, ExternalLink, Phone, AlertCircle,
  Package, ChevronDown, Bell
} from 'lucide-react';
import io from 'socket.io-client';
import { adminAPI } from '../services/api';
import './DeliveryDispatch.css';

const STATUS_COLORS = {
  assigned:   'dd-badge-warn',
  en_route:   'dd-badge-info',
  delivered:  'dd-badge-success',
  cancelled:  'dd-badge-muted',
  pending:    'dd-badge-warn',
  created:    'dd-badge-info',
  dasher_assigned: 'dd-badge-info',
  at_pickup:  'dd-badge-info',
  picked_up:  'dd-badge-primary',
  at_dropoff: 'dd-badge-primary',
  failed:     'dd-badge-error',
};

function statusLabel(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function elapsed(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

// ── Assign Driver Modal ────────────────────────────────────────────
function AssignModal({ drivers, onAssign, onClose }) {
  const [driverId, setDriverId]   = useState('');
  const [orderId, setOrderId]     = useState('');
  const [orderNum, setOrderNum]   = useState('');
  const [address, setAddress]     = useState('');
  const [custName, setCustName]   = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');

  const submit = async () => {
    if (!driverId || !orderId || !address) { setErr('Driver, Order ID, and Address are required'); return; }
    setLoading(true); setErr('');
    try {
      await onAssign({ driver_id: driverId, order_id: orderId, order_number: orderNum, delivery_address: address, customer_name: custName, customer_phone: custPhone });
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="dd-overlay" onClick={onClose}>
      <div className="dd-modal" onClick={e => e.stopPropagation()}>
        <div className="dd-modal-hdr">
          <h3>Assign In-House Driver</h3>
          <button onClick={onClose}><XCircle size={18}/></button>
        </div>
        <div className="dd-modal-body">
          <div className="dd-form-row">
            <div className="dd-field">
              <label>Driver *</label>
              <select className="dd-input" value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">— Select driver —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.active_assignments > 0 ? `(${d.active_assignments} active)` : '(available)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="dd-field">
              <label>Order ID *</label>
              <input className="dd-input" value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="DB id" />
            </div>
          </div>
          <div className="dd-field">
            <label>Order Number</label>
            <input className="dd-input" value={orderNum} onChange={e => setOrderNum(e.target.value)} placeholder="e.g. HH-20240522-001" />
          </div>
          <div className="dd-field">
            <label>Delivery Address *</label>
            <input className="dd-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full delivery address" />
          </div>
          <div className="dd-form-row">
            <div className="dd-field">
              <label>Customer Name</label>
              <input className="dd-input" value={custName} onChange={e => setCustName(e.target.value)} />
            </div>
            <div className="dd-field">
              <label>Customer Phone</label>
              <input className="dd-input" value={custPhone} onChange={e => setCustPhone(e.target.value)} />
            </div>
          </div>
          {err && <p className="dd-err">{err}</p>}
          <button className="dd-btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="dd-spinner"/> : <><Truck size={14}/> Assign Driver</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DoorDash Delivery Card ─────────────────────────────────────────
function DDCard({ delivery, onDispatch, onCancel }) {
  const badge = STATUS_COLORS[delivery.status] || 'dd-badge-muted';
  return (
    <div className="dd-card">
      <div className="dd-card-hdr">
        <div>
          <p className="dd-order-num">{delivery.order_number || delivery.doordash_delivery_id}</p>
          <p className="dd-timestamp">{elapsed(delivery.created_at)}</p>
        </div>
        <span className={`dd-badge ${badge}`}>{statusLabel(delivery.status)}</span>
      </div>

      <div className="dd-card-body">
        <div className="dd-info-row"><MapPin size={13}/> {delivery.delivery_address || '—'}</div>
        {delivery.customer_name && <div className="dd-info-row"><User size={13}/> {delivery.customer_name}</div>}
        {delivery.dasher_name   && <div className="dd-info-row"><Navigation size={13}/> Dasher: {delivery.dasher_name} {delivery.dasher_phone && <a href={`tel:${delivery.dasher_phone}`}><Phone size={11}/></a>}</div>}
        {delivery.estimated_dropoff_time && (
          <div className="dd-info-row"><Clock size={13}/> ETA: {new Date(delivery.estimated_dropoff_time).toLocaleTimeString()}</div>
        )}
        {delivery.order_total && <div className="dd-info-row"><Package size={13}/> ${parseFloat(delivery.order_total).toFixed(2)}</div>}
      </div>

      <div className="dd-card-footer">
        {delivery.tracking_url && (
          <a className="dd-btn-outline" href={delivery.tracking_url} target="_blank" rel="noreferrer">
            <ExternalLink size={12}/> Track
          </a>
        )}
        {!delivery.doordash_delivery_id && (
          <button className="dd-btn-primary dd-btn-sm" onClick={() => onDispatch(delivery.order_id)}>
            <Truck size={12}/> Dispatch
          </button>
        )}
        {['created','pending','dasher_assigned','at_pickup'].includes(delivery.status) && delivery.doordash_delivery_id && (
          <button className="dd-btn-danger dd-btn-sm" onClick={() => onCancel(delivery.doordash_delivery_id)}>
            Cancel
          </button>
        )}
        {delivery.fee > 0 && <span className="dd-fee">Fee: ${parseFloat(delivery.fee).toFixed(2)}</span>}
      </div>
    </div>
  );
}

// ── In-House Assignment Card ────────────────────────────────────────
function AssignCard({ assignment, onStatusChange }) {
  const badge = STATUS_COLORS[assignment.status] || 'dd-badge-muted';
  const hasGPS = assignment.current_lat && assignment.current_lng;
  const mapsUrl = hasGPS
    ? `https://www.google.com/maps?q=${assignment.current_lat},${assignment.current_lng}`
    : assignment.delivery_address
      ? `https://www.google.com/maps/search/${encodeURIComponent(assignment.delivery_address)}`
      : null;

  return (
    <div className="dd-card">
      <div className="dd-card-hdr">
        <div>
          <p className="dd-order-num">{assignment.order_number || `#${assignment.order_id}`}</p>
          <p className="dd-timestamp">{elapsed(assignment.assigned_at)}</p>
        </div>
        <span className={`dd-badge ${badge}`}>{statusLabel(assignment.status)}</span>
      </div>

      <div className="dd-card-body">
        <div className="dd-info-row"><Navigation size={13}/> Driver: <strong>{assignment.driver_name}</strong></div>
        {assignment.driver_phone_number && <div className="dd-info-row"><Phone size={13}/> {assignment.driver_phone_number}</div>}
        <div className="dd-info-row"><MapPin size={13}/> {assignment.delivery_address || '—'}</div>
        {assignment.customer_name  && <div className="dd-info-row"><User size={13}/> {assignment.customer_name}</div>}
        {hasGPS && (
          <div className="dd-info-row dd-gps-live">
            <span className="dd-gps-dot"/>
            GPS: {parseFloat(assignment.current_lat).toFixed(5)}, {parseFloat(assignment.current_lng).toFixed(5)}
            <span className="dd-gps-time">{assignment.last_location_update ? elapsed(assignment.last_location_update) : ''}</span>
          </div>
        )}
      </div>

      <div className="dd-card-footer">
        {mapsUrl && (
          <a className="dd-btn-outline" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={12}/> Map
          </a>
        )}
        <a className="dd-btn-outline" href={`/driver?id=${assignment.driver_id}`} target="_blank" rel="noreferrer">
          Driver View
        </a>
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <button
            className="dd-btn-success dd-btn-sm"
            onClick={() => onStatusChange(assignment.id, 'delivered')}
          >
            <CheckCircle size={12}/> Mark Delivered
          </button>
        )}
        {assignment.status === 'assigned' && (
          <button className="dd-btn-danger dd-btn-sm" onClick={() => onStatusChange(assignment.id, 'cancelled')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Fee Calculator Widget ───────────────────────────────────────────
function FeeCalculator() {
  const [addr, setAddr]   = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    if (!addr.trim()) return;
    setLoading(true);
    try {
      const data = await adminAPI.calculateDeliveryFee(addr);
      setResult(data);
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <div className="dd-fee-calc">
      <h4><Navigation size={14}/> Delivery Fee Calculator</h4>
      <div className="dd-fee-row">
        <input className="dd-input" value={addr} onChange={e => setAddr(e.target.value)}
          placeholder="Customer address..." onKeyDown={e => e.key === 'Enter' && calculate()} />
        <button className="dd-btn-primary dd-btn-sm" onClick={calculate} disabled={loading}>
          {loading ? <span className="dd-spinner-sm"/> : 'Calculate'}
        </button>
      </div>
      {result && !result.error && (
        <div className="dd-fee-result">
          <span>{result.distance_text} · {result.duration}</span>
          {result.out_of_range
            ? <span className="dd-badge dd-badge-error">Out of range</span>
            : <span className="dd-badge dd-badge-success">${result.fee?.toFixed(2)} fee</span>
          }
        </div>
      )}
      {result?.error && <p className="dd-err">{result.error}</p>}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function DeliveryDispatch() {
  const [tab, setTab]             = useState('inhouse');
  const [assignments, setAssign]  = useState([]);
  const [ddDeliveries, setDD]     = useState([]);
  const [drivers, setDrivers]     = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [ddConfigured, setDDConf] = useState(false);
  const [newAlert, setNewAlert]   = useState(null); // { order_number, miles }
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [a, d, dr] = await Promise.all([
        adminAPI.getAssignments(),
        adminAPI.getDoorDashDeliveries(),
        adminAPI.getDeliveryDrivers(),
      ]);
      setAssign(a);
      setDD(d.deliveries || d);
      setDDConf(d.configured !== false);
      setDrivers(dr);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Real-time socket — fires when an in-house order needs a driver assigned
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      transports: ['websocket'],
    });
    socket.on('inhouse_dispatch_needed', ({ order_number, miles }) => {
      setNewAlert({ order_number, miles: parseFloat(miles).toFixed(1) });
      load(); // refresh assignments list immediately
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('🚗 Driver Needed', {
          body: `Order #${order_number} (${parseFloat(miles).toFixed(1)} mi) needs an in-house driver.`,
        });
      }
    });
    socket.on('assignment_status_update', ({ id, status }) => {
      setAssign(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    });
    socket.on('driver_location_update', ({ assignment_id, lat, lng }) => {
      setAssign(prev => prev.map(a =>
        a.id === assignment_id ? { ...a, current_lat: lat, current_lng: lng } : a
      ));
    });
    return () => socket.disconnect();
  }, [load]);

  const handleAssign = async (body) => {
    await adminAPI.assignDriver(body);
    load();
  };

  const handleStatusChange = async (id, status) => {
    await adminAPI.updateAssignmentStatus(id, status);
    setAssign(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const handleDDCancel = async (deliveryId) => {
    await adminAPI.cancelDoorDashDelivery(deliveryId);
    load();
  };

  const handleDispatch = async (orderId) => {
    await adminAPI.createDoorDashDelivery(orderId);
    load();
  };

  const activeAssign  = assignments.filter(a => ['assigned','en_route'].includes(a.status));
  const doneAssign    = assignments.filter(a => !['assigned','en_route'].includes(a.status));
  const activeDDs     = ddDeliveries.filter(d => !['delivered','cancelled','failed'].includes(d.status));
  const doneDDs       = ddDeliveries.filter(d =>  ['delivered','cancelled','failed'].includes(d.status));

  return (
    <div className="dd-page">
      <div className="dd-topbar">
        <div>
          <h1 className="dd-title">Delivery Dispatch</h1>
          <p className="dd-sub">In-house driver assignment · DoorDash Drive · Distance calculator</p>
        </div>
        <div className="dd-topbar-actions">
          <button className="dd-btn-outline" onClick={load}><RefreshCw size={14}/> Refresh</button>
          <button className="dd-btn-primary" onClick={() => setShowAssign(true)}>
            <Truck size={14}/> Assign Driver
          </button>
        </div>
      </div>

      {/* Real-time alert banner */}
      {newAlert && (
        <div className="dd-alert-banner">
          <Bell size={16} />
          <span>
            Order <strong>#{newAlert.order_number}</strong> ({newAlert.miles} mi) needs an in-house driver.
          </span>
          <button className="dd-alert-assign" onClick={() => { setShowAssign(true); setNewAlert(null); }}>
            Assign Now
          </button>
          <button className="dd-alert-dismiss" onClick={() => setNewAlert(null)}>✕</button>
        </div>
      )}

      <FeeCalculator />

      {/* Stats strip */}
      <div className="dd-stats-row">
        {[
          { label: 'Active In-House', val: activeAssign.length, icon: <Truck size={16}/> },
          { label: 'Active DoorDash', val: activeDDs.length,   icon: <Navigation size={16}/> },
          { label: 'Available Drivers', val: drivers.filter(d => parseInt(d.active_assignments) === 0).length, icon: <User size={16}/> },
          { label: 'Delivered Today', val: assignments.filter(a => a.status === 'delivered' && new Date(a.delivered_at) > new Date(new Date().setHours(0,0,0,0))).length, icon: <CheckCircle size={16}/> },
        ].map(s => (
          <div key={s.label} className="dd-stat-card">
            <span className="dd-stat-icon">{s.icon}</span>
            <div>
              <p className="dd-stat-val">{s.val}</p>
              <p className="dd-stat-label">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="dd-tabs">
        <button className={`dd-tab ${tab==='inhouse'?'active':''}`} onClick={() => setTab('inhouse')}>
          <Truck size={14}/> In-House
          {activeAssign.length > 0 && <span className="dd-tab-badge">{activeAssign.length}</span>}
        </button>
        <button className={`dd-tab ${tab==='doordash'?'active':''}`} onClick={() => setTab('doordash')}>
          <Navigation size={14}/> DoorDash Drive
          {activeDDs.length > 0 && <span className="dd-tab-badge">{activeDDs.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="dd-loading"><div className="dd-spinner-lg"/></div>
      ) : (
        <div className="dd-tab-content">
          {tab === 'inhouse' && (
            <>
              {activeAssign.length === 0 && doneAssign.length === 0 && (
                <div className="dd-empty">
                  <Truck size={40}/>
                  <p>No deliveries assigned yet.</p>
                  <p className="dd-empty-sub">Click "Assign Driver" to dispatch an in-house delivery.</p>
                </div>
              )}
              {activeAssign.length > 0 && (
                <div>
                  <p className="dd-section-label">Active ({activeAssign.length})</p>
                  <div className="dd-grid">
                    {activeAssign.map(a => (
                      <AssignCard key={a.id} assignment={a} onStatusChange={handleStatusChange} />
                    ))}
                  </div>
                </div>
              )}
              {doneAssign.length > 0 && (
                <details className="dd-history">
                  <summary><ChevronDown size={14}/> History ({doneAssign.length})</summary>
                  <div className="dd-grid dd-grid-sm">
                    {doneAssign.map(a => <AssignCard key={a.id} assignment={a} onStatusChange={handleStatusChange} />)}
                  </div>
                </details>
              )}
            </>
          )}

          {tab === 'doordash' && (
            <>
              {!ddConfigured && (
                <div className="dd-notice dd-notice-warn">
                  <AlertCircle size={16}/>
                  <div>
                    <strong>DoorDash Drive not configured.</strong> Add <code>DOORDASH_DEVELOPER_ID</code>, <code>DOORDASH_KEY_ID</code>, and <code>DOORDASH_SIGNING_SECRET</code> to your .env file.
                    Then register your webhook URL: <code>{window.location.origin}/api/doordash/webhook</code>
                  </div>
                </div>
              )}
              {activeDDs.length === 0 && doneDDs.length === 0 ? (
                <div className="dd-empty">
                  <Navigation size={40}/>
                  <p>No DoorDash Drive deliveries yet.</p>
                  <p className="dd-empty-sub">Deliveries auto-dispatch when an order is placed, or use the Dispatch button on any order.</p>
                </div>
              ) : (
                <>
                  {activeDDs.length > 0 && (
                    <div>
                      <p className="dd-section-label">Active ({activeDDs.length})</p>
                      <div className="dd-grid">
                        {activeDDs.map(d => <DDCard key={d.id} delivery={d} onDispatch={handleDispatch} onCancel={handleDDCancel} />)}
                      </div>
                    </div>
                  )}
                  {doneDDs.length > 0 && (
                    <details className="dd-history">
                      <summary><ChevronDown size={14}/> History ({doneDDs.length})</summary>
                      <div className="dd-grid dd-grid-sm">
                        {doneDDs.map(d => <DDCard key={d.id} delivery={d} onDispatch={handleDispatch} onCancel={handleDDCancel} />)}
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {showAssign && (
        <AssignModal drivers={drivers} onAssign={handleAssign} onClose={() => setShowAssign(false)} />
      )}
    </div>
  );
}
