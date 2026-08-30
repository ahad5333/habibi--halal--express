import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck, User, MapPin, Clock, CheckCircle, XCircle,
  RefreshCw, Navigation, ExternalLink, Phone, AlertCircle,
  Package, ChevronDown, Bell, Map, MessageSquare, Send, BarChart2, Download,
} from 'lucide-react';
import io from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { adminAPI } from '../services/api';
import './DeliveryDispatch.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

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
                    {d.name}
                    {d.is_on_duty ? ' 🟢' : ' 🔴'}
                    {d.active_assignments > 0 ? ` (${d.active_assignments} active)` : ' (available)'}
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
          <div className="dd-info-row"><Clock size={13}/> ETA: {fmtTime(delivery.estimated_dropoff_time)}</div>
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
  const badge  = STATUS_COLORS[assignment.status] || 'dd-badge-muted';
  const hasGPS = assignment.current_lat && assignment.current_lng;
  const mapsUrl = hasGPS
    ? `https://www.google.com/maps?q=${assignment.current_lat},${assignment.current_lng}`
    : assignment.delivery_address
      ? `https://www.google.com/maps/search/${encodeURIComponent(assignment.delivery_address)}`
      : null;
  const tip          = parseFloat(assignment.tip_amount  || 0);
  const isCod        = assignment.payment_method === 'cod';
  const orderTotal   = parseFloat(assignment.order_total || 0);
  const cashClaimed  = assignment.cash_collected_at;
  const proofUrl     = assignment.proof_photo_url
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${assignment.proof_photo_url}`
    : null;
  const [proofOpen, setProofOpen] = useState(false);

  return (
    <div className="dd-card">
      <div className="dd-card-hdr">
        <div>
          <p className="dd-order-num">{assignment.order_number || `#${assignment.order_id}`}</p>
          <p className="dd-timestamp">{elapsed(assignment.assigned_at)}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isCod && <span className="dd-badge dd-badge-cod">💵 COD</span>}
          <span className={`dd-badge ${badge}`}>{statusLabel(assignment.status)}</span>
        </div>
      </div>

      <div className="dd-card-body">
        <div className="dd-info-row"><Navigation size={13}/> Driver: <strong>{assignment.driver_name}</strong>
          {assignment.accepted_at && <span className="dd-accepted-pill">✓ accepted</span>}
        </div>
        {assignment.driver_phone_number && <div className="dd-info-row"><Phone size={13}/> {assignment.driver_phone_number}</div>}
        <div className="dd-info-row"><MapPin size={13}/> {assignment.delivery_address || '—'}</div>
        {assignment.customer_name && <div className="dd-info-row"><User size={13}/> {assignment.customer_name}</div>}
        {tip > 0 && (
          <div className="dd-info-row dd-tip-row">
            💵 Tip: <strong style={{ color: '#4ade80' }}>${tip.toFixed(2)}</strong>
          </div>
        )}
        {assignment.rejection_reason && (
          <div className="dd-info-row dd-rejection-note">
            ⚠ Rejected: {assignment.rejection_reason}
          </div>
        )}
        {hasGPS && (
          <div className="dd-info-row dd-gps-live">
            <span className="dd-gps-dot"/>
            GPS: {parseFloat(assignment.current_lat).toFixed(5)}, {parseFloat(assignment.current_lng).toFixed(5)}
            <span className="dd-gps-time">{assignment.last_location_update ? elapsed(assignment.last_location_update) : ''}</span>
          </div>
        )}
        {proofUrl && (
          <div className="dd-proof-row">
            <button className="dd-btn-outline dd-btn-sm" onClick={() => setProofOpen(v => !v)}>
              📷 {proofOpen ? 'Hide' : 'View'} Proof Photo
            </button>
            {proofOpen && (
              <div className="dd-proof-img-wrap">
                <img src={proofUrl} alt="Delivery proof" className="dd-proof-img" />
                {assignment.proof_note && <p className="dd-proof-note">{assignment.proof_note}</p>}
              </div>
            )}
          </div>
        )}
        {cashClaimed && (
          <div className="dd-info-row dd-cash-confirmed">
            ✅ Cash collected: <strong>${orderTotal.toFixed(2)}</strong>
            {assignment.cash_collected_by && <> by {assignment.cash_collected_by}</>}
            <span className="dd-gps-time">{fmtTime(cashClaimed)}</span>
          </div>
        )}
        {isCod && assignment.status === 'delivered' && !cashClaimed && (
          <div className="dd-info-row dd-cash-unconfirmed">
            ⚠ COD — cash collection not confirmed by driver
          </div>
        )}
      </div>

      <div className="dd-card-footer">
        {mapsUrl && (
          <a className="dd-btn-outline" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={12}/> Map
          </a>
        )}
        {assignment.status !== 'delivered' && assignment.status !== 'cancelled' && (
          <button className="dd-btn-success dd-btn-sm" onClick={() => onStatusChange(assignment.id, 'delivered')}>
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

// ── Driver ↔ Dispatch Chat Panel ───────────────────────────────────
function DriverChatPanel({ socket }) {
  const [threads, setThreads]       = useState([]);
  const [activeId, setActiveId]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [reply, setReply]           = useState('');
  const [sending, setSending]       = useState(false);
  const [newCounts, setNewCounts]   = useState({}); // driver_id → unread delta from socket
  const messagesEndRef              = useRef(null);

  const loadThreads = useCallback(async () => {
    try { setThreads(await adminAPI.getChatThreads()); } catch (_) {}
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Auto-scroll messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Open a thread
  const openThread = async (driver_id) => {
    setActiveId(driver_id);
    setNewCounts(prev => ({ ...prev, [driver_id]: 0 }));
    try {
      const data = await adminAPI.getDriverChat(driver_id);
      setMessages(Array.isArray(data) ? data : []);
      await adminAPI.markChatRead(driver_id).catch(() => {});
      setThreads(prev => prev.map(t => t.driver_id === driver_id ? { ...t, unread_count: 0 } : t));
    } catch (_) {}
  };

  // Real-time: new message from a driver
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      // Update thread list
      setThreads(prev => {
        const existing = prev.find(t => t.driver_id === msg.driver_id);
        if (existing) {
          return prev.map(t => t.driver_id === msg.driver_id
            ? { ...t, last_message: msg.message, last_direction: 'inbound', last_sent: msg.sent_at, unread_count: activeId === msg.driver_id ? 0 : (parseInt(t.unread_count||0)+1) }
            : t
          ).sort((a, b) => new Date(b.last_sent) - new Date(a.last_sent));
        }
        return [{ driver_id: msg.driver_id, driver_name: msg.driver_name, last_message: msg.message, last_direction: 'inbound', last_sent: msg.sent_at, unread_count: 1 }, ...prev];
      });
      // If this thread is open, append message
      if (msg.driver_id === activeId) {
        setMessages(prev => [...prev, msg]);
        adminAPI.markChatRead(msg.driver_id).catch(() => {});
      } else {
        setNewCounts(prev => ({ ...prev, [msg.driver_id]: (prev[msg.driver_id] || 0) + 1 }));
      }
    };
    socket.on('driver_chat_message', handler);
    return () => socket.off('driver_chat_message', handler);
  }, [socket, activeId]);

  const sendReply = async () => {
    const msg = reply.trim();
    if (!msg || !activeId || sending) return;
    setSending(true);
    try {
      const row = await adminAPI.replyToDriver(activeId, msg);
      setMessages(prev => [...prev, row]);
      setReply('');
      setThreads(prev => prev.map(t => t.driver_id === activeId
        ? { ...t, last_message: msg, last_direction: 'outbound', last_sent: row.sent_at }
        : t
      ));
    } catch (_) {}
    setSending(false);
  };

  const active = threads.find(t => t.driver_id === activeId);
  const totalUnread = threads.reduce((s, t) => s + parseInt(t.unread_count || 0), 0) + Object.values(newCounts).reduce((s, n) => s + n, 0);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 520 }}>
      {/* Thread list */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto' }}>
        {threads.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '2rem' }}>
            No driver messages yet
          </p>
        )}
        {threads.map(t => {
          const unread = parseInt(t.unread_count || 0) + (newCounts[t.driver_id] || 0);
          return (
            <div
              key={t.driver_id}
              onClick={() => openThread(t.driver_id)}
              style={{
                background: activeId === t.driver_id ? 'rgba(229,182,78,0.12)' : 'var(--color-surface-2)',
                border: `1px solid ${activeId === t.driver_id ? 'rgba(229,182,78,0.3)' : 'var(--color-border)'}`,
                borderRadius: 10, padding: '0.65rem 0.8rem', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)' }}>{t.driver_name || `Driver #${t.driver_id}`}</span>
                {unread > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, borderRadius: 8, padding: '1px 6px' }}>{unread}</span>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {t.last_direction === 'outbound' ? '↩ ' : ''}{t.last_message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        {!activeId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Select a driver to view their messages
          </div>
        ) : (
          <>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
              {active?.driver_name || `Driver #${activeId}`}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.direction === 'inbound' ? 'flex-start' : 'flex-end', gap: '0.1rem' }}>
                  {m.direction === 'outbound' && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', paddingRight: '0.4rem' }}>{m.sent_by || 'You'}</span>
                  )}
                  <div style={{
                    maxWidth: '75%', padding: '0.5rem 0.8rem', borderRadius: m.direction === 'inbound' ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                    background: m.direction === 'inbound' ? 'var(--color-surface-2)' : '#E5B64E',
                    color: m.direction === 'inbound' ? 'var(--color-text)' : '#0a0a0a',
                    fontSize: '0.875rem', lineHeight: 1.4, wordBreak: 'break-word',
                  }}>{m.message}</div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>
                    {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)' }}>
              <input
                className="dd-input"
                style={{ flex: 1 }}
                placeholder="Reply to driver…"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
                disabled={sending}
                maxLength={500}
              />
              <button className="dd-btn-primary dd-btn-sm" onClick={sendReply} disabled={sending || !reply.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Send size={13}/> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Same small local helper as Reports.jsx -- Blob + <a download>, no shared util.
function csvExport(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

// ── Driver Performance Panel ────────────────────────────────────────
function DriverPerformancePanel() {
  const [rows, setRows]   = useState([]);
  const [days, setDays]   = useState(30);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]   = useState({ col: 'deliveries', dir: -1 });
  const [payrollStart, setPayrollStart] = useState(mondayOfThisWeek());
  const [payrollEnd, setPayrollEnd]     = useState(new Date().toISOString().slice(0, 10));
  const [exporting, setExporting]       = useState(false);
  const [checkoutSettings, setCheckoutSettings] = useState(null); // current tax/fee/goal -- needed so saving the goal doesn't clobber the others
  const [goalInput, setGoalInput]       = useState('10');
  const [savingGoal, setSavingGoal]     = useState(false);

  const handleExportPayroll = async () => {
    setExporting(true);
    try {
      const data = await adminAPI.exportPayroll(payrollStart, payrollEnd);
      csvExport(Array.isArray(data) ? data : [], `payroll_${payrollStart}_${payrollEnd}.csv`);
    } catch (_) {}
    setExporting(false);
  };

  const handleSaveGoal = async () => {
    const goal = parseInt(goalInput, 10);
    if (!(goal > 0) || !checkoutSettings) return;
    setSavingGoal(true);
    try {
      await adminAPI.updateSystemSettings({
        tax_rate: checkoutSettings.tax_rate,
        service_fee_rate: checkoutSettings.service_fee_rate,
        driver_daily_goal: goal,
      });
    } catch (_) {}
    setSavingGoal(false);
  };

  useEffect(() => {
    setLoading(true);
    adminAPI.getDriverPerformance(days)
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    adminAPI.getCheckoutSettings()
      .then(data => {
        setCheckoutSettings(data);
        if (data?.driver_daily_goal) setGoalInput(String(data.driver_daily_goal));
      })
      .catch(() => {});
  }, []);

  const sorted = [...rows].sort((a, b) => {
    const av = parseFloat(a[sort.col]) || 0;
    const bv = parseFloat(b[sort.col]) || 0;
    return (av - bv) * sort.dir;
  });

  const colClick = (col) => setSort(s => ({ col, dir: s.col === col ? -s.dir : -1 }));
  const arrow = (col) => sort.col === col ? (sort.dir === -1 ? ' ↓' : ' ↑') : '';

  const thStyle = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.65rem 0.75rem', fontSize: '0.85rem', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };

  return (
    <div>
      {/* Period filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Period:</span>
        {[{ label: '7 days', val: 7 }, { label: '30 days', val: 30 }, { label: '90 days', val: 90 }, { label: 'All time', val: 0 }].map(p => (
          <button
            key={p.val}
            onClick={() => setDays(p.val)}
            className={days === p.val ? 'dd-btn-primary dd-btn-sm' : 'dd-btn-outline dd-btn-sm'}
          >{p.label}</button>
        ))}
      </div>

      {/* Payroll export -- separate date range from the table's own period filter above,
          since payroll periods (e.g. this week) rarely line up with the table's presets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Payroll export:</span>
        <input type="date" value={payrollStart} onChange={e => setPayrollStart(e.target.value)} className="dd-input" style={{ width: 'auto' }} />
        <span style={{ color: 'var(--color-text-muted)' }}>to</span>
        <input type="date" value={payrollEnd} onChange={e => setPayrollEnd(e.target.value)} className="dd-input" style={{ width: 'auto' }} />
        <button className="dd-btn-outline dd-btn-sm" onClick={handleExportPayroll} disabled={exporting}>
          <Download size={13}/> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Daily deliveries goal shown on each driver's own dashboard -- was
          hardcoded to 10 with no admin control at all */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Driver daily goal:</span>
        <input
          type="number" min="1" value={goalInput}
          onChange={e => setGoalInput(e.target.value)}
          className="dd-input" style={{ width: 70 }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>deliveries/day</span>
        <button className="dd-btn-outline dd-btn-sm" onClick={handleSaveGoal} disabled={savingGoal || !checkoutSettings}>
          {savingGoal ? 'Saving…' : 'Save'}
        </button>
      </div>

      {loading ? (
        <div className="dd-loading"><div className="dd-spinner-lg"/></div>
      ) : sorted.length === 0 ? (
        <div className="dd-empty">No driver data yet for this period.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Driver</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('deliveries')}>Deliveries{arrow('deliveries')}</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('acceptance_rate')}>Accept Rate{arrow('acceptance_rate')}</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('avg_rating')}>Avg Rating{arrow('avg_rating')}</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('avg_delivery_mins')}>Avg Time{arrow('avg_delivery_mins')}</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('total_tips')}>Tips Earned{arrow('total_tips')}</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => colClick('rejections')}>Rejections{arrow('rejections')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => {
                const rate = parseFloat(d.acceptance_rate) || 0;
                const rateColor = rate >= 85 ? '#22c55e' : rate >= 65 ? '#E5B64E' : '#ef4444';
                const mins = parseInt(d.avg_delivery_mins) || null;
                return (
                  <tr key={d.id} style={{ background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background='var(--color-surface-2)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: d.is_on_duty ? 'rgba(34,197,94,0.15)' : 'var(--color-surface-2)', color: d.is_on_duty ? '#22c55e' : 'var(--color-text-muted)' }}>
                        {d.is_on_duty ? '● On Duty' : '○ Off'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{d.deliveries ?? 0}</span>
                      {parseInt(d.total_dispatched) > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '0.35rem' }}>/ {d.total_dispatched} dispatched</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {d.total_dispatched > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: rateColor, borderRadius: 3 }}/>
                          </div>
                          <span style={{ color: rateColor, fontWeight: 600, fontSize: '0.85rem' }}>{rate}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {parseInt(d.rating_count) > 0
                        ? <span>★ {d.avg_rating} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({d.rating_count})</span></span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {mins !== null && !isNaN(mins)
                        ? <span>{mins} min</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>${parseFloat(d.total_tips || 0).toFixed(2)}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: parseInt(d.rejections) > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>{d.rejections ?? 0}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Live Driver Map (Leaflet, bundled — the admin panel's CSP doesn't
// allowlist any third-party script CDN, so this can't load from unpkg.com) ──
function DriverMapPanel({ assignments }) {
  const mapDivRef     = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef    = useRef({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapDivRef.current || leafletMapRef.current) return;
    leafletMapRef.current = L.map(mapDivRef.current).setView([40.8448, -73.8648], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(leafletMapRef.current);
    setReady(true);

    return () => {
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
    };
  }, []);

  // Update markers whenever assignments change
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !ready) return;

    const active = assignments.filter(a =>
      ['assigned', 'en_route'].includes(a.status) && a.current_lat && a.current_lng
    );

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!active.find(a => String(a.id) === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add / move markers
    active.forEach(a => {
      const lat  = parseFloat(a.current_lat);
      const lng  = parseFloat(a.current_lng);
      const name = a.driver_name || a.driver_full_name || 'Driver';
      const popup = `<strong>${name}</strong><br/>${a.delivery_address || '—'}<br/><small>${a.order_number || ''}</small>`;

      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng([lat, lng]).setPopupContent(popup);
      } else {
        const icon = L.divIcon({
          html: `<div style="background:#E5B64E;color:#0a0a0a;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🛵 ${name}</div>`,
          className: '',
          iconAnchor: [0, 12],
        });
        markersRef.current[a.id] = L.marker([lat, lng], { icon })
          .bindPopup(popup)
          .addTo(map);
      }
    });
  }, [assignments, ready]);

  const withGPS   = assignments.filter(a => ['assigned','en_route'].includes(a.status) && a.current_lat);
  const noGPS     = assignments.filter(a => ['assigned','en_route'].includes(a.status) && !a.current_lat);

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span className="dd-badge dd-badge-success">🟢 {withGPS.length} on map</span>
        {noGPS.length > 0 && <span className="dd-badge dd-badge-warn">⚠ {noGPS.length} no GPS yet</span>}
      </div>
      <div ref={mapDivRef} style={{ height: 460, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }} />
      {noGPS.length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <strong>Waiting for GPS:</strong>{' '}
          {noGPS.map(a => a.driver_name || a.driver_full_name || `#${a.id}`).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function DeliveryDispatch() {
  const [tab, setTab]             = useState('inhouse');
  const [socket, setSocket]       = useState(null);
  const [assignments, setAssign]  = useState([]);
  const [ddDeliveries, setDD]     = useState([]);
  const [drivers, setDrivers]     = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [loadErr, setLoadErr]     = useState('');
  const [ddConfigured, setDDConf] = useState(false);
  const [newAlert, setNewAlert]   = useState(null); // { order_number, miles }
  const [sosAlert, setSosAlert]   = useState(null); // { name, phone, order_id, message, created_at }
  const [cashAlert, setCashAlert] = useState(null); // { driver_id, driver_name, amount }
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    setLoadErr('');
    try {
      const [a, d, dr, sc] = await Promise.all([
        adminAPI.getAssignments(),
        adminAPI.getDoorDashDeliveries(),
        adminAPI.getDeliveryDrivers(),
        adminAPI.getScheduledOrders(),
      ]);
      setAssign(a);
      setDD(d.deliveries || d);
      setDDConf(d.configured !== false);
      setDrivers(dr);
      setScheduled(Array.isArray(sc) ? sc : []);
    } catch (e) { setLoadErr(e.message || 'Failed to load dispatch data.'); }
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
    const sock = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      transports: ['websocket'],
    });
    sock.on('connect', () => { sock.emit('join_admin'); setSocket(sock); });
    const socket = sock;
    socket.on('inhouse_dispatch_needed', ({ order_number, miles }) => {
      setNewAlert({ order_number, miles: parseFloat(miles).toFixed(1) });
      load();
      if (Notification.permission === 'granted') {
        new Notification('Driver Needed', {
          body: `Order #${order_number} (${parseFloat(miles).toFixed(1)} mi) needs an in-house driver.`,
        });
      }
    });
    socket.on('scheduled_dispatch_fired', ({ order_number, expected_time, mins_until }) => {
      load();
      if (Notification.permission === 'granted') {
        new Notification('Scheduled Order Dispatched', {
          body: `Order #${order_number} scheduled for ${expected_time} has been dispatched (${mins_until} min away).`,
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
    // Driver went on/off duty — refresh driver list
    socket.on('driver_duty_change', ({ driver_id, on_duty }) => {
      setDrivers(prev => prev.map(d => d.id === driver_id ? { ...d, is_on_duty: on_duty } : d));
    });
    // Driver rejected assignment — reload so admin can reassign
    socket.on('assignment_rejected', () => { load(); });
    // Driver panic button — highest-priority alert, shown alongside (not
    // instead of) the SMS this same event already triggers server-side.
    socket.on('driver_sos', (payload) => {
      setSosAlert(payload);
      if (Notification.permission === 'granted') {
        new Notification('🚨 Driver Safety SOS', {
          body: `${payload.name || 'A driver'} triggered an emergency alert.`,
          requireInteraction: true,
        });
      }
    });
    // Driver went off duty with real, uncollected COD cash still outstanding.
    socket.on('driver_offline_with_cash', (payload) => {
      setCashAlert(payload);
      if (Notification.permission === 'granted') {
        new Notification('💰 Driver Went Off Duty With Cash', {
          body: `${payload.driver_name || 'A driver'} still has $${parseFloat(payload.amount || 0).toFixed(2)} uncollected.`,
        });
      }
    });
    return () => { sock.disconnect(); setSocket(null); };
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

      {/* Driver safety SOS — highest priority, shown above the routine dispatch alert */}
      {sosAlert && (() => {
        const locMatch = /Location: (-?\d+\.\d+),(-?\d+\.\d+)/.exec(sosAlert.message || '');
        const mapsUrl = locMatch ? `https://www.google.com/maps?q=${locMatch[1]},${locMatch[2]}` : null;
        const note = (sosAlert.message || '').replace(/Location: -?\d+\.\d+,-?\d+\.\d+\.\s*/, '');
        return (
          <div className="dd-alert-banner dd-alert-banner-sos">
            <Bell size={16} />
            <span>
              🚨 <strong>{sosAlert.name || 'A driver'}</strong> ({sosAlert.phone || 'no phone on file'}) triggered a safety SOS
              {sosAlert.order_id && <> on order <strong>#{sosAlert.order_id}</strong></>}.
              {note && note !== 'No additional details provided.' && <> "{note}"</>}
            </span>
            {sosAlert.phone && (
              <a className="dd-alert-assign" href={`tel:${sosAlert.phone}`}>Call Driver</a>
            )}
            {mapsUrl && (
              <a className="dd-alert-assign" href={mapsUrl} target="_blank" rel="noreferrer">View Location</a>
            )}
            <button className="dd-alert-dismiss" onClick={() => setSosAlert(null)}>✕</button>
          </div>
        );
      })()}

      {/* Driver went off duty with cash still outstanding */}
      {cashAlert && (
        <div className="dd-alert-banner dd-alert-banner-cash">
          <Bell size={16} />
          <span>
            💰 <strong>{cashAlert.driver_name || 'A driver'}</strong> went off duty with{' '}
            <strong>${parseFloat(cashAlert.amount || 0).toFixed(2)}</strong> in uncollected cash still outstanding.
          </span>
          <a className="dd-alert-assign" href="/cash-log">View Cash Log</a>
          <button className="dd-alert-dismiss" onClick={() => setCashAlert(null)}>✕</button>
        </div>
      )}

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
          { label: 'Scheduled', val: scheduled.length,          icon: <Clock size={16}/> },
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
        <button className={`dd-tab ${tab==='scheduled'?'active':''}`} onClick={() => setTab('scheduled')}>
          <Clock size={14}/> Scheduled
          {scheduled.length > 0 && <span className="dd-tab-badge">{scheduled.length}</span>}
        </button>
        <button className={`dd-tab ${tab==='map'?'active':''}`} onClick={() => setTab('map')}>
          <Map size={14}/> Live Map
          {activeAssign.filter(a => a.current_lat).length > 0 && (
            <span className="dd-tab-badge">{activeAssign.filter(a => a.current_lat).length}</span>
          )}
        </button>
        <button className={`dd-tab ${tab==='chat'?'active':''}`} onClick={() => setTab('chat')}>
          <MessageSquare size={14}/> Driver Chat
        </button>
        <button className={`dd-tab ${tab==='performance'?'active':''}`} onClick={() => setTab('performance')}>
          <BarChart2 size={14}/> Performance
        </button>
      </div>

      {loadErr && <div className="dd-err" style={{margin:'0.75rem 1rem'}}>⚠ {loadErr} — <button className="dd-link" onClick={load}>Retry</button></div>}

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

          {tab === 'scheduled' && (
            <>
              {scheduled.length === 0 ? (
                <div className="dd-empty">
                  <Clock size={40}/>
                  <p>No scheduled orders pending dispatch.</p>
                  <p className="dd-empty-sub">Orders scheduled for a future time appear here until dispatched 60 min before their pickup time.</p>
                </div>
              ) : (
                <div>
                  <p className="dd-section-label">Queued for dispatch ({scheduled.length})</p>
                  <div className="dd-sched-list">
                    {scheduled.map(o => {
                      const addr = [o.delivery_address, o.delivery_city, o.delivery_state].filter(Boolean).join(', ');
                      return (
                        <div key={o.id} className="dd-sched-row">
                          <div className="dd-sched-info">
                            <span className="dd-sched-num">#{o.order_number}</span>
                            <span className="dd-sched-time"><Clock size={12}/> {o.expected_time}</span>
                          </div>
                          <div className="dd-sched-detail">
                            <span>{o.customer_name}</span>
                            <span className="dd-sched-addr">{addr}</span>
                          </div>
                          <span className="dd-sched-total">${parseFloat(o.total || 0).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'map' && (
            <DriverMapPanel assignments={assignments} />
          )}

          {tab === 'chat' && (
            <DriverChatPanel socket={socket} />
          )}

          {tab === 'performance' && (
            <DriverPerformancePanel />
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
