import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, RefreshCw, Maximize2, Clock, ChefHat, Truck, CheckCircle2, Bell } from 'lucide-react';
import { adminAPI } from '../services/api';
import './LiveBoard.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';
import {
  unlockAudio, startContinuousRing, stopContinuousRing, playBell,
  showNewOrderNotification as showNotification,
} from '../utils/orderAlerts';

const BOARD_STATUSES = ['pending', 'accepted', 'preparing', 'cooking', 'out_for_delivery', 'delivered'];
const STATUS_LABEL  = { pending: 'New', accepted: 'Accepted', preparing: 'Preparing', cooking: 'Cooking', out_for_delivery: 'On The Way', delivered: 'Delivered' };
const STATUS_COLOR  = { pending: 'lv-pending', accepted: 'lv-confirmed', preparing: 'lv-preparing', cooking: 'lv-preparing', out_for_delivery: 'lv-on-the-way', delivered: 'lv-delivered' };
const STATUS_ICON   = { out_for_delivery: <Truck size={13}/>, delivered: <CheckCircle2 size={13}/> };
const DELIVERED_CAP = 40;

function elapsed(dateStr) {
  if (!dateStr) return '—';
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins/60)}h ${mins%60}m ago`;
}

function OrderCard({ order, onAdvance, advancing }) {
  const nexts      = { pending: 'accepted', accepted: 'preparing', preparing: 'cooking', cooking: 'out_for_delivery', out_for_delivery: 'delivered' };
  const nextLabel  = { pending: 'Accept', accepted: 'Preparing', preparing: 'Cooking', cooking: 'Out for Delivery', out_for_delivery: 'Mark Delivered' };
  const next = nexts[order.status];
  const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000);
  // Completed orders never need the urgent treatment regardless of how old they
  // are — without this exclusion, every order that simply took a normal amount
  // of total time (or is just old delivered history) got the same alarming
  // red pulse as a genuinely stuck order, making the signal meaningless.
  const isUrgent = age > 20 && !['preparing', 'delivered', 'cancelled'].includes(order.status);

  return (
    <div className={`lv-card ${STATUS_COLOR[order.status]||''} ${isUrgent?'lv-urgent':''}`}>
      <div className="lv-card-hdr">
        <span className="lv-order-num">{order.id}</span>
        <span className={`badge ${
          order.status==='pending'          ? 'badge-warning' :
          order.status==='accepted'         ? 'badge-info' :
          order.status==='out_for_delivery' ? 'badge-primary' :
          order.status==='delivered'        ? 'badge-success' :
          order.status==='cancelled'        ? 'badge-error' :
          'badge-info'
        }`}>
          {STATUS_ICON[order.status]} {STATUS_LABEL[order.status] || order.status}
        </span>
        {order.is_gift && <span className="lv-gift-badge">🎀 Gift</span>}
        {isUrgent && <span className="lv-age-warn"><Clock size={11}/> {age}m</span>}
      </div>

      <div className="lv-customer">
        <p className="lv-name">{order.user_name}</p>
        {order.is_gift && order.gift_recipient_name && (
          <p className="lv-gift-recipient">🎁 To: {order.gift_recipient_name}{order.gift_recipient_phone ? ` · ${order.gift_recipient_phone}` : ''}</p>
        )}
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
  const [pollErr, setPollErr]       = useState(false);
  const [soundOn, setSoundOn]       = useState(() => localStorage.getItem('habibi_sound_on') === '1');
  const timerRef = useRef(null);
  const knownIds = useRef(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => stopContinuousRing(); // cleanup on unmount
  }, []);

  const handleEnableSound = () => {
    unlockAudio();
    setSoundOn(true);
    localStorage.setItem('habibi_sound_on', '1');
    // Play test ring so admin hears it immediately
    setTimeout(() => { startContinuousRing(); setTimeout(stopContinuousRing, 1400); }, 100);
  };

  const load = useCallback(async () => {
    try {
      const all = await adminAPI.orders();
      const all_live = all.filter(o => BOARD_STATUSES.includes(o.status));
      // Delivered orders roll off the board after 24h — full history always
      // stays in Orders, this is just "today's activity" so the board doesn't
      // slowly fill up with weeks-old completed orders. DELIVERED_CAP is a
      // safety net on top of that: even on an exceptionally busy day, we only
      // ever render the most recent DELIVERED_CAP of them (still sorted
      // newest-first coming from the API), so the list can't balloon to
      // hundreds of cards no matter how much volume comes through.
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const deliveredOrders = all_live
        .filter(o => o.status === 'delivered' && new Date(o.created_at).getTime() >= oneDayAgo)
        .slice(0, DELIVERED_CAP);
      const otherOrders = all_live.filter(o => o.status !== 'delivered');
      const live            = [...otherOrders, ...deliveredOrders];
      live.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

      // Count unaccepted orders
      const unaccepted = live.filter(o => o.status === 'pending');

      // Detect brand-new orders (skip first load)
      if (knownIds.current !== null) {
        const incoming = live.filter(o =>
          o.status === 'pending' &&
          !knownIds.current.has(o.id)
        );
        if (incoming.length > 0) {
          showNotification(incoming.length);
          setNewAlert(true);
          setTimeout(() => setNewAlert(false), 4000);
        }
      }
      knownIds.current = new Set(live.map(o => o.id));

      // Ring continuously while unaccepted orders exist, stop when all accepted
      if (unaccepted.length > 0) {
        startContinuousRing();
      } else {
        stopContinuousRing();
      }

      setOrders(live);
      setLastUpdate(new Date());
      setPollErr(false);
    } catch (e) {
      console.error('[LiveBoard] Poll failed:', e.message);
      setPollErr(true);
    }
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
    } catch (err) {
      alert(`Failed to update order ${id}: ${err.message}`);
    }
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
            {lastUpdate && !pollErr && <span> · updated {lastUpdate.toLocaleTimeString()}</span>}
            {pollErr && <span style={{color:'var(--color-danger)'}}> · ⚠ Connection lost — showing stale data</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button
            className={`btn btn-sm ${soundOn ? 'btn-success' : 'btn-warning'}`}
            onClick={soundOn ? playBell : handleEnableSound}
            title={soundOn ? 'Sound enabled — click to test bell' : 'Click to enable order bell alerts'}
            style={{gap:'0.4rem'}}
          >
            <Bell size={14}/> {soundOn ? 'Sound On' : 'Enable Sound'}
          </button>
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
