import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingBag, RefreshCw, CheckCircle, XCircle,
  AlertCircle, ExternalLink, Clock, User, MapPin, Utensils, Bell
} from 'lucide-react';
import io from 'socket.io-client';
import { adminAPI } from '../services/api';
import './MarketplaceOrders.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const PLATFORMS = [
  { id: 'all',      label: 'All Platforms' },
  { id: 'ubereats', label: 'Uber Eats',  color: '#06c167' },
  { id: 'grubhub',  label: 'GrubHub',    color: '#f63440' },
  { id: 'caviar',   label: 'Caviar',     color: '#cc3a00' },
];

const STATUS_MAP = {
  new:        { cls: 'mp-badge-warn',    label: 'New' },
  accepted:   { cls: 'mp-badge-info',    label: 'Accepted' },
  preparing:  { cls: 'mp-badge-info',    label: 'Preparing' },
  ready:      { cls: 'mp-badge-primary', label: 'Ready' },
  completed:  { cls: 'mp-badge-success', label: 'Completed' },
  cancelled:  { cls: 'mp-badge-muted',   label: 'Cancelled' },
};

function PlatformDot({ platform }) {
  const p = PLATFORMS.find(x => x.id === platform);
  return p?.color
    ? <span className="mp-platform-dot" style={{ background: p.color }}>{p.label}</span>
    : <span className="mp-platform-dot">{platform}</span>;
}

function OrderCard({ order, onAccept, onDecline }) {
  const badge = STATUS_MAP[order.status] || { cls: 'mp-badge-muted', label: order.status };
  let items = [];
  try {
    items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
  } catch { items = []; }

  return (
    <div className={`mp-card ${order.status === 'new' ? 'mp-card-new' : ''}`}>
      <div className="mp-card-hdr">
        <div>
          <PlatformDot platform={order.platform} />
          <p className="mp-order-id">{order.platform_order_id}</p>
          <p className="mp-timestamp">{fmtTime(order.placed_at, { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <span className={`mp-badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="mp-card-body">
        {order.customer_name && <div className="mp-info-row"><User size={12}/> {order.customer_name}</div>}
        {order.delivery_address && <div className="mp-info-row"><MapPin size={12}/> {order.delivery_address}</div>}
        <div className="mp-items-list">
          {items.slice(0, 4).map((item, i) => (
            <span key={i} className="mp-item-pill">{item.qty}× {item.name}</span>
          ))}
          {items.length > 4 && <span className="mp-item-pill mp-more">+{items.length - 4} more</span>}
        </div>
      </div>

      <div className="mp-card-footer">
        <span className="mp-total">${parseFloat(order.total || 0).toFixed(2)}</span>
        {order.status === 'new' && (
          <div className="mp-actions">
            <button className="mp-btn-accept" onClick={() => onAccept(order.id)}>
              <CheckCircle size={13}/> Accept
            </button>
            <button className="mp-btn-decline" onClick={() => onDecline(order.id)}>
              <XCircle size={13}/> Decline
            </button>
          </div>
        )}
        {order.status === 'accepted' && (
          <div className="mp-actions">
            <button className="mp-btn-sm mp-btn-info" onClick={() => onAccept(order.id, 'preparing')}>
              <Utensils size={13}/> Preparing
            </button>
            <button className="mp-btn-sm mp-btn-success" onClick={() => onAccept(order.id, 'ready')}>
              <CheckCircle size={13}/> Ready
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupGuide() {
  const base = typeof window !== 'undefined' ? window.location.origin.replace(':5174', ':5001') : 'https://yourapi.com';
  return (
    <div className="mp-setup">
      <h3 className="mp-setup-title"><AlertCircle size={16}/> Webhook Setup Required</h3>
      <p className="mp-setup-sub">Register these URLs in each platform's developer portal so orders flow into this dashboard automatically.</p>
      <div className="mp-webhook-list">
        {[
          { platform: 'Uber Eats', url: `${base}/api/marketplace/webhook/ubereats`, env: 'UBEREATS_WEBHOOK_SECRET', docs: 'developers.uber.com/docs/eats/orders' },
          { platform: 'GrubHub', url: `${base}/api/marketplace/webhook/grubhub`, env: 'GRUBHUB_RESTAURANT_ID', docs: 'developer.grubhub.com' },
          { platform: 'Caviar', url: `${base}/api/marketplace/webhook/caviar`, env: '(uses DoorDash)', docs: 'developer.doordash.com' },
        ].map(w => (
          <div key={w.platform} className="mp-webhook-row">
            <div>
              <p className="mp-webhook-platform">{w.platform}</p>
              <code className="mp-webhook-url">{w.url}</code>
              <p className="mp-webhook-env">Env: <code>{w.env}</code></p>
            </div>
            <a className="mp-btn-outline" href={`https://${w.docs}`} target="_blank" rel="noreferrer">
              <ExternalLink size={12}/> Docs
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MarketplaceOrders() {
  const [platform, setPlatform]   = useState('all');
  const [orders, setOrders]       = useState([]);
  const [stats, setStats]         = useState([]);
  const [platSettings, setPlatSettings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null); // { platform, platform_order_id }
  const socketRef = useRef(null);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';
    const socket = io(SOCKET_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
    socketRef.current = socket;
    socket.on('marketplace_order', (data) => {
      setNewOrderAlert({ platform: data.platform, platform_order_id: data.platform_order_id });
      setOrders(prev => {
        const exists = prev.some(o => o.platform_order_id === data.platform_order_id);
        return exists ? prev : [{ ...data, status: 'new' }, ...prev];
      });
    });
    return () => socket.disconnect();
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = platform !== 'all' ? `?platform=${platform}` : '';
      const [o, s, ps] = await Promise.all([
        adminAPI.getMarketplaceOrders(qs),
        adminAPI.getMarketplaceStats(),
        adminAPI.getPlatformSettings(),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setStats(Array.isArray(s) ? s : []);
      setPlatSettings(Array.isArray(ps?.platforms) ? ps.platforms : []);
    } catch (_) {}
    setLoading(false);
  }, [platform]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (id, status = 'accepted') => {
    await adminAPI.updateMarketplaceOrder(id, { status });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const handleDecline = async (id) => {
    await adminAPI.updateMarketplaceOrder(id, { status: 'cancelled' });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
  };

  const newOrders   = orders.filter(o => o.status === 'new');
  const otherOrders = orders.filter(o => o.status !== 'new');

  const totalGross = stats.reduce((s, p) => s + parseFloat(p.revenue || 0), 0);
  const totalNet   = platSettings.reduce((s, p) => s + p.net_revenue, 0);

  return (
    <div className="mp-page">
      <div className="mp-topbar">
        <div>
          <h1 className="mp-title">Marketplace Orders</h1>
          <p className="mp-sub">Uber Eats · GrubHub · Caviar — all in one dashboard</p>
        </div>
        <button className="mp-btn-outline" onClick={load}><RefreshCw size={14}/> Refresh</button>
      </div>

      {newOrderAlert && (
        <div className="mp-alert-banner">
          <Bell size={16}/>
          <span>New <strong>{newOrderAlert.platform}</strong> order <strong>#{newOrderAlert.platform_order_id}</strong> received.</span>
          <button className="mp-alert-dismiss" onClick={() => setNewOrderAlert(null)}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="mp-stats-row">
        <div className="mp-stat-card">
          <p className="mp-stat-val">{orders.length}</p>
          <p className="mp-stat-label">Total Orders</p>
        </div>
        <div className="mp-stat-card mp-stat-alert">
          <p className="mp-stat-val">{newOrders.length}</p>
          <p className="mp-stat-label">Awaiting Action</p>
        </div>
        <div className="mp-stat-card">
          <p className="mp-stat-val">${totalGross.toFixed(2)}</p>
          <p className="mp-stat-label">Gross Revenue</p>
        </div>
        <div className="mp-stat-card mp-stat-net">
          <p className="mp-stat-val">${totalNet.toFixed(2)}</p>
          <p className="mp-stat-label">Net Revenue (after commission)</p>
        </div>
        {stats.map(s => (
          <div key={s.platform} className="mp-stat-card">
            <p className="mp-stat-val">{s.total}</p>
            <p className="mp-stat-label" style={{ textTransform: 'capitalize' }}>{s.platform}</p>
          </div>
        ))}
      </div>

      {/* Platform Tabs */}
      <div className="mp-tabs">
        {PLATFORMS.map(p => (
          <button key={p.id} className={`mp-tab ${platform === p.id ? 'active' : ''}`} onClick={() => setPlatform(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mp-loading"><div className="mp-spinner"/></div>
      ) : orders.length === 0 ? (
        <>
          <div className="mp-empty">
            <ShoppingBag size={40}/>
            <p>No marketplace orders yet.</p>
            <p className="mp-empty-sub">Orders will appear here once webhooks are configured.</p>
          </div>
          <SetupGuide />
        </>
      ) : (
        <>
          {newOrders.length > 0 && (
            <div className="mp-section">
              <div className="mp-section-hdr">
                <span className="mp-section-title"><Clock size={14}/> New — Awaiting Action ({newOrders.length})</span>
              </div>
              <div className="mp-grid">
                {newOrders.map(o => <OrderCard key={o.id} order={o} onAccept={handleAccept} onDecline={handleDecline} />)}
              </div>
            </div>
          )}
          {otherOrders.length > 0 && (
            <div className="mp-section">
              <p className="mp-section-title">All Orders</p>
              <div className="mp-grid">
                {otherOrders.map(o => <OrderCard key={o.id} order={o} onAccept={handleAccept} onDecline={handleDecline} />)}
              </div>
            </div>
          )}
          {newOrders.length === 0 && <SetupGuide />}
        </>
      )}
    </div>
  );
}
