import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingBag, RefreshCw, CheckCircle, XCircle,
  AlertCircle, ExternalLink, Clock, User, MapPin, Utensils, Bell, Settings, Store
} from 'lucide-react';
import io from 'socket.io-client';
import { adminAPI } from '../services/api';
import './MarketplaceOrders.css';
import { fmtTime, fmtDateTime } from '../utils/date.js';

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
  try { items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]'); }
  catch { items = []; }

  return (
    <div className={`mp-card ${order.status === 'new' ? 'mp-card-new' : ''}`}>
      <div className="mp-card-hdr">
        <div>
          <PlatformDot platform={order.platform} />
          <p className="mp-order-id">{order.platform_order_id}</p>
          <p className="mp-timestamp">{fmtTime(order.placed_at)}</p>
        </div>
        <span className={`mp-badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="mp-card-body">
        {order.location_name && (
          <div className="mp-info-row mp-location-row">
            <Store size={12}/> {order.location_name}
            {order.location_address && <span className="mp-location-addr"> · {order.location_address}</span>}
          </div>
        )}
        {order.customer_name    && <div className="mp-info-row"><User   size={12}/> {order.customer_name}</div>}
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
            <button className="mp-btn-accept"  onClick={() => onAccept(order.id)}><CheckCircle size={13}/> Accept</button>
            <button className="mp-btn-decline" onClick={() => onDecline(order.id)}><XCircle size={13}/> Decline</button>
          </div>
        )}
        {order.status === 'accepted' && (
          <div className="mp-actions">
            <button className="mp-btn-sm mp-btn-info"    onClick={() => onAccept(order.id, 'preparing')}><Utensils size={13}/> Preparing</button>
            <button className="mp-btn-sm mp-btn-success" onClick={() => onAccept(order.id, 'ready')}><CheckCircle size={13}/> Ready</button>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationMappingModal({ locations, mappings, onSave, onClose }) {
  const [form, setForm] = useState({ location_id: '', platform: 'ubereats', platform_store_id: '', platform_restaurant_id: '', is_active: true, notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.location_id || !form.platform) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title"><Settings size={16}/> Platform Location Mappings</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Existing mappings */}
        {mappings.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Configured</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {mappings.map(m => (
                <div key={m.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.location_name}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                      {m.platform} · Store ID: <code>{m.platform_store_id || '—'}</code>
                    </p>
                  </div>
                  <span className={`badge ${m.is_active ? 'badge-success' : 'badge-muted'}`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add / update mapping */}
        <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Add / Update Mapping</p>
        <div className="modal-body">
          <div className="field">
            <label>Location</label>
            <select className="input select" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.title} — {l.brief_address}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Platform</label>
            <select className="input select" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
              <option value="ubereats">Uber Eats</option>
              <option value="grubhub">GrubHub</option>
              <option value="caviar">Caviar</option>
            </select>
          </div>
          <div className="field">
            <label>Platform Store ID</label>
            <input className="input" placeholder="e.g. store_abc123 (from platform dashboard)" value={form.platform_store_id} onChange={e => setForm(f => ({ ...f, platform_store_id: e.target.value }))} />
          </div>
          <div className="field">
            <label>Platform Restaurant ID <span style={{ color: 'var(--color-text-dim)' }}>(optional)</span></label>
            <input className="input" placeholder="e.g. restaurant_xyz456" value={form.platform_restaurant_id} onChange={e => setForm(f => ({ ...f, platform_restaurant_id: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="is_active" style={{ fontSize: '0.82rem' }}>Active (orders from this store will be routed to the selected location)</label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.location_id}>
            {saving ? 'Saving…' : 'Save Mapping'}
          </button>
        </div>
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
          { platform: 'GrubHub',   url: `${base}/api/marketplace/webhook/grubhub`,  env: 'GRUBHUB_WEBHOOK_SECRET',  docs: 'developer.grubhub.com' },
          { platform: 'Caviar',    url: `${base}/api/marketplace/webhook/caviar`,   env: '(uses DoorDash secret)',   docs: 'developer.doordash.com' },
        ].map(w => (
          <div key={w.platform} className="mp-webhook-row">
            <div>
              <p className="mp-webhook-platform">{w.platform}</p>
              <code className="mp-webhook-url">{w.url}</code>
              <p className="mp-webhook-env">Env var: <code>{w.env}</code></p>
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
  const [platform, setPlatform]     = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [orders, setOrders]         = useState([]);
  const [stats, setStats]           = useState({ platforms: [], locations: [] });
  const [locations, setLocations]   = useState([]);
  const [mappings, setMappings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
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
      const params = new URLSearchParams();
      if (platform    !== 'all') params.set('platform',    platform);
      if (locationFilter !== 'all') params.set('location_id', locationFilter);
      const qs = params.toString() ? `?${params}` : '';

      const [o, s, locs, maps] = await Promise.all([
        adminAPI.getMarketplaceOrders(qs),
        adminAPI.getMarketplaceStats(),
        adminAPI.getLocations(),
        adminAPI.getMarketplaceLocationMappings(),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setStats(s || { platforms: [], locations: [] });
      setLocations(Array.isArray(locs) ? locs : []);
      setMappings(Array.isArray(maps) ? maps : []);
    } catch (_) {}
    setLoading(false);
  }, [platform, locationFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAccept  = async (id, status = 'accepted') => {
    await adminAPI.updateMarketplaceOrder(id, { status });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };
  const handleDecline = async (id) => {
    await adminAPI.updateMarketplaceOrder(id, { status: 'cancelled' });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
  };
  const handleSaveMapping = async (form) => {
    await adminAPI.saveMarketplaceLocationMapping(form);
    const maps = await adminAPI.getMarketplaceLocationMappings();
    setMappings(Array.isArray(maps) ? maps : []);
    setShowConfig(false);
  };

  const newOrders   = orders.filter(o => o.status === 'new');
  const otherOrders = orders.filter(o => o.status !== 'new');
  const platformStats = Array.isArray(stats.platforms) ? stats.platforms : [];
  const locationStats = Array.isArray(stats.locations) ? stats.locations : [];
  const totalGross = platformStats.reduce((s, p) => s + parseFloat(p.revenue || 0), 0);

  return (
    <div className="mp-page">
      <div className="mp-topbar">
        <div>
          <h1 className="mp-title">Marketplace Orders</h1>
          <p className="mp-sub">Uber Eats · GrubHub · Caviar — all in one dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="mp-btn-outline" onClick={() => setShowConfig(true)}><Settings size={14}/> Configure Locations</button>
          <button className="mp-btn-outline" onClick={load}><RefreshCw size={14}/> Refresh</button>
        </div>
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
        {platformStats.map(s => (
          <div key={s.platform} className="mp-stat-card">
            <p className="mp-stat-val">{s.total}</p>
            <p className="mp-stat-label" style={{ textTransform: 'capitalize' }}>{s.platform}</p>
          </div>
        ))}
      </div>

      {/* Per-location revenue */}
      {locationStats.some(l => l.total_orders > 0) && (
        <div className="mp-location-stats">
          {locationStats.filter(l => l.total_orders > 0).map(l => (
            <div key={l.id} className="mp-location-stat-card">
              <Store size={13}/>
              <div>
                <p className="mp-location-stat-name">{l.title}</p>
                <p className="mp-location-stat-sub">{l.brief_address}</p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{l.total_orders} orders</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>${parseFloat(l.revenue).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div className="mp-tabs" style={{ margin: 0 }}>
          {PLATFORMS.map(p => (
            <button key={p.id} className={`mp-tab ${platform === p.id ? 'active' : ''}`} onClick={() => setPlatform(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {locations.length > 0 && (
          <select className="input select" style={{ width: 'auto', minWidth: 180 }} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        )}
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

      {showConfig && (
        <LocationMappingModal
          locations={locations}
          mappings={mappings}
          onSave={handleSaveMapping}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
