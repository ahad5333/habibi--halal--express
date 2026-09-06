import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, UtensilsCrossed, RefreshCw, ChevronRight, CheckCircle, Truck, ShoppingBag, LogOut } from 'lucide-react';
import { COLUMN_MAP, BUMP_NEXT, COLUMNS, ROLE_STATION, canStaffBump, bumpLabel, blockedReason } from '../utils/orderFlow';
import './KitchenDisplay.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const POLL_MS  = 15000;

// No dine_in entry: the client doesn't offer dine-in service, the QR-landing
// route that was the only way to create such an order is gone, and there are
// no dine_in orders in the database. UtensilsCrossed stays as the fallback
// icon for anything unrecognised.
const DELIVERY_ICON = {
  pickup:   <ShoppingBag size={12} />,
  delivery: <Truck size={12} />,
};
const DELIVERY_LABEL = {
  pickup:   'Pickup',
  delivery: 'Delivery',
};

const ROLE_LABEL = {
  kitchen: 'Kitchen',
  manager: 'Manager',
  cashier: 'Cashier',
  server:  'Server',
};

function minutesOld(placedAt) {
  return Math.floor((Date.now() - new Date(placedAt)) / 60000);
}

function elapsedLabel(placedAt) {
  const diff = minutesOld(placedAt);
  if (diff < 1) return 'Just now';
  if (diff === 1) return '1 min';
  return `${diff} min`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function zelleChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tones = [523, 659, 784];
    tones.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch (_) {}
}

function readSession() {
  try {
    const saved = localStorage.getItem('habibi_staff_session');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.staff_id && s.token) return s;
    }
  } catch (_) {}
  return null;
}

export default function StaffQueue() {
  // Read once on mount -- readSession() parses a fresh object every call, so
  // storing it directly (without useState) breaks referential equality for
  // every effect/callback below it depends on, causing an infinite re-fetch
  // loop (each render creates a "new" session, retriggering the effect that
  // re-renders, which reads session again...).
  const [session] = useState(() => readSession());

  useEffect(() => {
    if (!session) window.location.replace('/staff/login');
  }, [session]);

  // Fire-and-forget push registration so new orders reach this device even
  // when the tab is backgrounded/screen locked -- polling alone only works
  // while the page is open and visible. Same delayed pattern as DriverView.jsx.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(async () => {
      try {
        const { registerStaffPush, isFirebaseConfigured } = await import('../utils/pushNotifications.js');
        if (isFirebaseConfigured()) await registerStaffPush(session.staff_id, session.token);
      } catch (_) {}
    }, 3000);
    return () => clearTimeout(t);
  }, [session]);

  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastSync,  setLastSync]  = useState(null);
  const [tick,      setTick]      = useState(0);
  const [bumping,   setBumping]   = useState({});       // id → true
  const [historyOrder, setHistoryOrder] = useState(null);   // order card whose history modal is open
  const [historyLog,   setHistoryLog]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const prevIds = useRef(new Set());
  const isManager = session?.role === 'manager';

  const endpoint = '/api/dine-in/kitchen-all';
  const staffHeaders = session ? { 'X-Staff-Id': session.staff_id, 'X-Staff-Token': session.token } : {};

  const handleLogout = () => {
    localStorage.removeItem('habibi_staff_session');
    window.location.replace('/staff/login');
  };

  const fetchOrders = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { headers: staffHeaders });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const newIds = new Set(list.map(o => o.id));
      if (prevIds.current.size > 0) {
        const incoming = list.filter(o => !prevIds.current.has(o.id));
        const hasZelle = incoming.some(o => o.order_status === 'pending_verification');
        const hasOther = incoming.some(o => o.order_status !== 'pending_verification');
        if (hasZelle) zelleChime();
        else if (hasOther) beep();
      }
      prevIds.current = newIds;
      setOrders(list);
      setLastSync(new Date());
      setError(null);
    } catch (err) {
      setError(err.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [endpoint, session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setOrders([]);
    fetchOrders();
    const poll = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchOrders, session]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const bumpOrder = async (order) => {
    const next = BUMP_NEXT[order.order_status];
    if (!next || !canStaffBump(order)) return;
    setBumping(p => ({ ...p, [order.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/dine-in/kitchen/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...staffHeaders },
        body: JSON.stringify({ status: next }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) throw new Error();
      setOrders(prev => next === 'delivered'
        ? prev.filter(o => o.id !== order.id)
        : prev.map(o => o.id === order.id ? { ...o, order_status: next } : o)
      );
    } catch {
      fetchOrders();
    } finally {
      setBumping(p => { const { [order.id]: _, ...rest } = p; return rest; });
    }
  };

  const openHistory = async (order) => {
    setHistoryOrder(order);
    setHistoryLoading(true);
    setHistoryLog([]);
    try {
      const res = await fetch(`${API_BASE}/api/dine-in/kitchen/orders/${order.id}/history`, { headers: staffHeaders });
      const data = await res.json();
      setHistoryLog(Array.isArray(data) ? data : []);
    } catch (_) {
      setHistoryLog([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!session) return null;

  const filtered = orders;
  const myStation = ROLE_STATION[session.role] || null;

  if (error && orders.length === 0) return (
    <div className="kd-root kd-center">
      <UtensilsCrossed size={36} />
      <p className="kd-err-title">Order queue unavailable</p>
      <p className="kd-err-sub">{error}</p>
      <button className="kd-retry-btn" onClick={fetchOrders}><RefreshCw size={14} /> Retry</button>
    </div>
  );

  return (
    <div className="kd-root">
      {error && <div className="kd-warn-bar">Warning: last refresh failed — {error}</div>}

      <header className="kd-header">
        <div className="kd-header-left">
          <UtensilsCrossed size={22} />
          <span className="kd-header-title">Order Queue</span>
        </div>
        <div className="kd-header-right">
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            {session.name || 'Staff'} · {ROLE_LABEL[session.role] || session.role}
          </span>
          <button className="kd-manual-refresh" onClick={fetchOrders}>
            <RefreshCw size={13} />
          </button>
          {lastSync && (
            <span className="kd-sync-time">
              <RefreshCw size={13} />
              {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className="kd-live-dot" />
          <span className="kd-live-label">LIVE</span>
          <button className="kd-manual-refresh" onClick={handleLogout} title="Log out">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="kd-center" style={{ flex: 1 }}>
          <div className="kd-spinner" />
          <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading orders…</p>
        </div>
      ) : (
        <div className="kd-kanban kd-kanban--4">
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => COLUMN_MAP[o.order_status] === col.key);
            return (
              <KanbanColumn
                key={col.key}
                title={col.title}
                count={colOrders.length}
                accent={col.accent}
                orders={colOrders}
                onBump={bumpOrder}
                bumping={bumping}
                tick={tick}
                isManager={isManager}
                onHistory={openHistory}
                isMine={myStation != null && col.station === myStation}
              />
            );
          })}
        </div>
      )}

      {historyOrder && (
        <div className="kd-history-overlay" onClick={() => setHistoryOrder(null)}>
          <div className="kd-history-modal" onClick={e => e.stopPropagation()}>
            <div className="kd-history-hdr">
              <span>Order #{historyOrder.order_number} — History</span>
              <button className="kd-manual-refresh" onClick={() => setHistoryOrder(null)}>✕</button>
            </div>
            {historyLoading ? (
              <p style={{ color: '#6b7280', padding: '1rem' }}>Loading…</p>
            ) : historyLog.length === 0 ? (
              <p style={{ color: '#6b7280', padding: '1rem' }}>No status changes recorded yet.</p>
            ) : (
              <ul className="kd-history-list">
                {historyLog.map((h, i) => (
                  <li key={i} className="kd-history-item">
                    <span className="kd-history-transition">
                      {h.from_status ? `${h.from_status.replace(/_/g, ' ')} → ` : ''}{h.to_status.replace(/_/g, ' ')}
                    </span>
                    <span className="kd-history-who">
                      {h.changed_by_type === 'staff'
                        ? `${h.changed_by_name || 'Staff'} (${h.changed_by_role})`
                        : h.changed_by_type === 'admin'
                        ? 'Admin'
                        : 'Shared Kitchen Screen'}
                    </span>
                    <span className="kd-history-time">
                      {new Date(h.changed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ title, count, accent, orders, onBump, bumping, tick, isManager, onHistory, isMine }) {
  return (
    <div className={`kd-col${isMine ? ' kd-col--mine' : ''}`}>
      <div className="kd-col-header" style={{ borderBottomColor: accent }}>
        <span className="kd-col-title">{title}</span>
        {count > 0 && <span className="kd-col-count" style={{ background: accent }}>{count}</span>}
        {isMine && <span className="kd-col-mine-tag">YOUR STEP</span>}
      </div>
      <div className="kd-col-body">
        {orders.length === 0 && (
          <div className="kd-col-empty">
            <CheckCircle size={32} strokeWidth={1} style={{ color: '#2a2a2a' }} />
            <span>All clear</span>
          </div>
        )}
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onBump={onBump}
            bumping={bumping[order.id]}
            tick={tick}
            isManager={isManager}
            onHistory={onHistory}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onBump, bumping, tick, isManager, onHistory }) {
  const mins = minutesOld(order.placed_at);
  const urgency = mins >= 20 ? 'urgent' : mins >= 10 ? 'warn' : '';
  const isPaymentPending = order.order_status === 'pending_verification';
  const label   = bumpLabel(order);
  const blocked = blockedReason(order);

  return (
    <div className={`kd-card kd-status--${order.order_status} ${urgency ? `kd-urgency--${urgency}` : ''}`}>

      {isPaymentPending && (
        <div className="kd-verify-banner">
          {order.payment_method === 'cashapp'
            ? '💚 AWAITING PAYMENT — Check Cash App then confirm'
            : order.payment_method === 'zelle'
            ? '💙 AWAITING PAYMENT — Check Zelle then confirm'
            : '💙 AWAITING PAYMENT — Verify payment then confirm'}
        </div>
      )}

      {order.payment_verified_at && (
        <div className="kd-verified-stamp">
          ✓ Payment verified at {new Date(order.payment_verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div className="kd-card-header">
        <div>
          <p className="kd-order-num">#{order.order_number}</p>
          <p className="kd-table-name">
            {DELIVERY_ICON[order.delivery_method] || <UtensilsCrossed size={12} />}
            {order.table_number
              ? `Table ${order.table_number}`
              : DELIVERY_LABEL[order.delivery_method] || 'Order'}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </p>
        </div>
        <div className="kd-card-badges">
          <span className={`kd-badge kd-status--${order.order_status}`}>
            {order.order_status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <ul className="kd-items">
        {(order.items || []).map((item, i) => (
          <li key={i} className="kd-item">
            <span className="kd-item-qty">×{item.quantity || item.qty || 1}</span>
            <span className="kd-item-name">{item.name}</span>
          </li>
        ))}
      </ul>

      {order.special_instructions && (
        <p className="kd-special">📝 {order.special_instructions}</p>
      )}

      <div className="kd-card-footer">
        <span className={`kd-elapsed ${urgency ? `kd-elapsed--${urgency}` : ''}`}>
          <Clock size={12} />
          {elapsedLabel(order.placed_at)}
          {urgency === 'urgent' && ' ⚠'}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {isManager && (
            <button className="kd-history-btn" onClick={() => onHistory(order)} title="View status history">
              History
            </button>
          )}
          {blocked ? (
            <span className="kd-awaiting-driver"><Truck size={12} /> {blocked}</span>
          ) : label && (
            <button
              className={`kd-bump-btn${isPaymentPending ? ' kd-bump-btn--verify' : ''}`}
              onClick={() => onBump(order)}
              disabled={bumping}
            >
              {bumping ? '…' : label}
              {!bumping && <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
