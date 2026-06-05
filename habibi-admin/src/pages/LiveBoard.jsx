import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, RefreshCw, Maximize2, Clock, ChefHat, Truck, CheckCircle2, Bell } from 'lucide-react';
import { adminAPI } from '../services/api';
import './LiveBoard.css';

// ── Bell sound via Web Audio API (no audio file needed) ──────────────────────
function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [660, 0.35], [880, 0.6]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      osc.start(t);
      osc.stop(t + 1.1);
    });
  } catch (_) {}
}

// ── Browser notification ──────────────────────────────────────────────────────
function showNotification(count) {
  if (Notification.permission !== 'granted') return;
  new Notification(`🔔 ${count} New Order${count > 1 ? 's' : ''}!`, {
    body: 'New order received — open Live Board to accept.',
    icon: '/images/logos/logo.png',
    tag:  'habibi-new-order',
  });
}

const BOARD_STATUSES = ['received', 'pending', 'confirmed', 'preparing', 'on_the_way', 'delivered'];
const STATUS_LABEL  = { received: 'New', pending: 'New', confirmed: 'Confirmed', preparing: 'Preparing', on_the_way: 'On The Way', delivered: 'Delivered' };
const STATUS_COLOR  = { received: 'lv-pending', pending: 'lv-pending', confirmed: 'lv-confirmed', preparing: 'lv-preparing', on_the_way: 'lv-on-the-way', delivered: 'lv-delivered' };
const STATUS_ICON   = { on_the_way: <Truck size={13}/>, delivered: <CheckCircle2 size={13}/> };

function elapsed(dateStr) {
  if (!dateStr) return '—';
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins/60)}h ${mins%60}m ago`;
}

function OrderCard({ order, onAdvance, advancing }) {
  const nexts      = { received: 'confirmed', pending: 'confirmed', confirmed: 'preparing', preparing: 'on_the_way', on_the_way: 'delivered' };
  const nextLabel  = { received: 'Accept', pending: 'Accept', confirmed: 'Start Cooking', preparing: 'Out for Delivery', on_the_way: 'Mark Delivered' };
  const next = nexts[order.status];
  const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000);
  const isUrgent = age > 20 && order.status !== 'preparing';

  return (
    <div className={`lv-card ${STATUS_COLOR[order.status]||''} ${isUrgent?'lv-urgent':''}`}>
      <div className="lv-card-hdr">
        <span className="lv-order-num">{order.id}</span>
        <span className={`badge ${
          order.status==='pending'    ? 'badge-warning' :
          order.status==='confirmed'  ? 'badge-info' :
          order.status==='on_the_way' ? 'badge-primary' :
          order.status==='delivered'  ? 'badge-success' :
          'badge-success'
        }`}>
          {STATUS_ICON[order.status]} {STATUS_LABEL[order.status] || order.status}
        </span>
        {isUrgent && <span className="lv-age-warn"><Clock size={11}/> {age}m</span>}
      </div>

      <div className="lv-customer">
        <p className="lv-name">{order.user_name}</p>
        <p className="lv-method">{order.delivery_method} · {order.payment_method}</p>
      </div>

      <div className="lv-items">
        {(order.items||[]).map((item, i) => (
          <div key={i} className="lv-item">
            <span className="lv-item-qty">{item.quantity}×</span>
            <span className="lv-item-name">{item.name}</span>
            {item.choices?.length > 0 && <span className="lv-item-mod">{item.choices.join(', ')}</span>}
          </div>
        ))}
      </div>

      <div className="lv-footer">
        <span className="lv-time"><Clock size={11}/> {elapsed(order.created_at)}</span>
        <span className="lv-total">${parseFloat(order.total_amount||0).toFixed(2)}</span>
        {next && (
          <button
            className="btn btn-primary btn-sm lv-advance-btn"
            onClick={() => onAdvance(order.id, next)}
            disabled={advancing === order.id}
          >
            {advancing === order.id ? <div className="spinner"/> : nextLabel[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LiveBoard() {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [advancing, setAdvancing]   = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newAlert, setNewAlert]     = useState(false);
  const timerRef   = useRef(null);
  const knownIds   = useRef(null); // null = first load, Set after

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const all = await adminAPI.orders();
      const all_live        = all.filter(o => BOARD_STATUSES.includes(o.status));
      const deliveredOrders = all_live.filter(o => o.status === 'delivered').slice(0, 20);
      const otherOrders     = all_live.filter(o => o.status !== 'delivered');
      const live            = [...otherOrders, ...deliveredOrders];
      live.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

      // Detect new orders (skip first load to avoid alerting on page open)
      if (knownIds.current !== null) {
        const incoming = live.filter(o =>
          (o.status === 'received' || o.status === 'pending') &&
          !knownIds.current.has(o.id)
        );
        if (incoming.length > 0) {
          playBell();
          showNotification(incoming.length);
          setNewAlert(true);
          setTimeout(() => setNewAlert(false), 4000);
        }
      }
      knownIds.current = new Set(live.map(o => o.id));

      setOrders(live);
      setLastUpdate(new Date());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const advance = async (id, status) => {
    setAdvancing(id);
    try {
      await adminAPI.updateOrder(id, status);
      load();
    } catch (_) {}
    setAdvancing(null);
  };

  const byStatus = BOARD_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s);
    return acc;
  }, {});

  return (
    <div className={`lv-shell ${fullscreen ? 'lv-fullscreen' : ''}`}>
      <div className="page-hdr">
        <div>
          <h1 className="page-title" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <ChefHat size={22}/> Live Order Board
          </h1>
          <p className="page-sub">
            {orders.filter(o=>o.status!=='delivered').length} active order{orders.filter(o=>o.status!=='delivered').length!==1?'s':''} · auto-refreshes every 5s
            {lastUpdate && <span> · updated {lastUpdate.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh now"><RefreshCw size={15}/></button>
          <button className="btn btn-secondary btn-icon" onClick={() => setFullscreen(f => !f)} title={fullscreen?'Exit fullscreen':'Fullscreen'}>
            <Maximize2 size={15}/>
          </button>
        </div>
      </div>

      {newAlert && (
        <div style={{
          background: '#16a34a', color: '#fff', padding: '0.75rem 1.25rem',
          borderRadius: 8, marginBottom: '1rem', display: 'flex',
          alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem',
          animation: 'pulse 0.5s ease-in-out',
        }}>
          <Bell size={18} /> New order received!
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : (
        <div className="lv-board">
          {BOARD_STATUSES.map(status => (
            <div key={status} className="lv-column">
              <div className={`lv-col-hdr lv-col-hdr-${status}`}>
                <span>{STATUS_LABEL[status]}</span>
                <span className="lv-col-count">{byStatus[status].length}</span>
              </div>
              <div className="lv-col-body">
                {byStatus[status].length === 0 ? (
                  <div className="lv-col-empty">
                    <Monitor size={24}/>
                    <p>No orders</p>
                  </div>
                ) : (
                  byStatus[status].map(o => (
                    <OrderCard key={o.id} order={o} onAdvance={advance} advancing={advancing} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
