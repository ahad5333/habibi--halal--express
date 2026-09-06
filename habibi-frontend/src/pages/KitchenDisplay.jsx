import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, UtensilsCrossed, RefreshCw, ChevronRight, CheckCircle, Truck, ShoppingBag } from 'lucide-react';
import { COLUMN_MAP, BUMP_NEXT, COLUMNS, canStaffBump, bumpLabel, blockedReason } from '../utils/orderFlow';
import './KitchenDisplay.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const KITCHEN_TOKEN = import.meta.env.VITE_KITCHEN_TOKEN || '';
const KITCHEN_HEADERS = KITCHEN_TOKEN ? { 'X-Kitchen-Token': KITCHEN_TOKEN } : {};
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

function minutesOld(placedAt) {
  return Math.floor((Date.now() - new Date(placedAt)) / 60000);
}

function elapsedLabel(placedAt) {
  const diff = minutesOld(placedAt);
  if (diff < 1) return 'Just now';
  if (diff === 1) return '1 min';
  return `${diff} min`;
}

// Regular new-order beep
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

// 3-tone ascending chime for Zelle/CashApp payment-pending orders
function zelleChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tones = [523, 659, 784]; // C5 → E5 → G5 (major chord ascending)
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

export default function KitchenDisplay() {
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastSync,  setLastSync]  = useState(null);
  const [tick,      setTick]      = useState(0);
  const [bumping,   setBumping]   = useState({});       // id → true
  const prevIds = useRef(new Set());

  const endpoint = '/api/dine-in/kitchen-all';

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { headers: KITCHEN_HEADERS });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Detect new orders — play distinct chime for payment-pending
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
  }, [endpoint]);

  useEffect(() => {
    setLoading(true);
    setOrders([]);
    fetchOrders();
    const poll = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchOrders]);

  // Re-render elapsed times every 30 s
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
        headers: { 'Content-Type': 'application/json', ...KITCHEN_HEADERS },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      // Optimistic update
      setOrders(prev => next === 'delivered'
        ? prev.filter(o => o.id !== order.id)
        : prev.map(o => o.id === order.id ? { ...o, order_status: next } : o)
      );
    } catch {
      // Refresh on failure
      fetchOrders();
    } finally {
      setBumping(p => { const { [order.id]: _, ...rest } = p; return rest; });
    }
  };

  const filtered = orders;

  if (error && orders.length === 0) return (
    <div className="kd-root kd-center">
      <UtensilsCrossed size={36} />
      <p className="kd-err-title">Kitchen display unavailable</p>
      <p className="kd-err-sub">{error}</p>
      <button className="kd-retry-btn" onClick={fetchOrders}><RefreshCw size={14} /> Retry</button>
    </div>
  );

  return (
    <div className="kd-root">
      {error && <div className="kd-warn-bar">Warning: last refresh failed — {error}</div>}

      {/* Header */}
      <header className="kd-header">
        <div className="kd-header-left">
          <UtensilsCrossed size={22} />
          <span className="kd-header-title">Kitchen Display</span>
        </div>
        <div className="kd-header-right">
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
        </div>
      </header>

      {/* Kanban */}
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ title, count, accent, orders, onBump, bumping, tick }) {
  return (
    <div className="kd-col">
      <div className="kd-col-header" style={{ borderBottomColor: accent }}>
        <span className="kd-col-title">{title}</span>
        {count > 0 && <span className="kd-col-count" style={{ background: accent }}>{count}</span>}
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
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onBump, bumping, tick }) {
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
  );
}
