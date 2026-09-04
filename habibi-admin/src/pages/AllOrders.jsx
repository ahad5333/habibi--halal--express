import React, { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, RefreshCw, Truck, Store, Bike, Package } from 'lucide-react';
import { adminAPI } from '../services/api';
import './AllOrders.css';
import { fmtDateTime } from '../utils/date.js';

// Read-only overview across every real consumer ordering channel -- taking
// action (accept/decline/status changes) still happens on each channel's own
// existing page (Orders.jsx / MarketplaceOrders.jsx), which already has that
// full workflow built. This page's job is the at-a-glance merge, not a
// duplicate management surface. Deliberately excludes partner_orders
// (B2B/wholesale) -- a different business function with its own page.
const CHANNELS = [
  { id: 'all',      label: 'All Channels' },
  { id: 'native',   label: 'Website / App', color: '#E5B64E' },
  { id: 'ubereats', label: 'Uber Eats',     color: '#06c167' },
  { id: 'grubhub',  label: 'GrubHub',       color: '#f63440' },
  { id: 'caviar',   label: 'Caviar',        color: '#cc3a00' },
];

const BUCKETS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const BUCKET_BADGE = { active: 'badge-warning', completed: 'badge-success', cancelled: 'badge-muted' };

const FULFILLMENT_ICON = { 'in-house': Bike, doordash: Truck, roadie: Package };
const FULFILLMENT_LABEL = { 'in-house': 'In-house', doordash: 'DoorDash', roadie: 'Roadie' };

function ChannelBadge({ channel }) {
  const c = CHANNELS.find(x => x.id === channel);
  return c?.color
    ? <span className="allord-channel-dot" style={{ background: c.color }}>{c.label}</span>
    : <span className="allord-channel-dot">{channel}</span>;
}

export default function AllOrders() {
  const [channel, setChannel]   = useState('all');
  const [bucket, setBucket]     = useState('all');
  const [orders, setOrders]     = useState([]);
  const [summary, setSummary]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await adminAPI.unifiedOrders({
        channel: channel === 'all' ? undefined : channel,
        bucket:  bucket  === 'all' ? undefined : bucket,
        limit: 100,
      });
      setOrders(d.orders || []);
      setSummary(d.summary || []);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [channel, bucket]);

  useEffect(() => { load(); }, [load]);

  const countFor = (predicate) => summary.filter(predicate).reduce((sum, s) => sum + s.n, 0);
  const totalOrders = countFor(() => true);

  return (
    <div className="allord-page">
      <div className="page-hdr">
        <div>
          <p className="page-title"><LayoutGrid size={20} style={{ verticalAlign: -3, marginRight: 6 }} />All Orders</p>
          <p className="page-sub">Every consumer order, across every channel, in one place</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? <div className="spinner" /> : <><RefreshCw size={14} /> Refresh</>}
        </button>
      </div>

      {/* Stat row */}
      <div className="allord-stats">
        <div className="allord-stat-box">
          <p className="allord-stat-label">Total (shown)</p>
          <p className="allord-stat-num">{totalOrders.toLocaleString()}</p>
        </div>
        {CHANNELS.filter(c => c.id !== 'all').map(c => (
          <div className="allord-stat-box" key={c.id}>
            <p className="allord-stat-label">{c.label}</p>
            <p className="allord-stat-num">{countFor(s => s.channel === c.id).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card allord-filters">
        <div className="allord-filter-group">
          {CHANNELS.map(c => (
            <button key={c.id} className={`btn btn-sm ${channel === c.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setChannel(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="allord-filter-group">
          {BUCKETS.map(b => (
            <button key={b.id} className={`btn btn-sm ${bucket === b.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBucket(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-error" style={{ margin: '0.75rem 0' }}>{err}</p>}

      <div className="card">
        {loading ? (
          <div className="empty" style={{ minHeight: 160 }}><div className="spinner" /></div>
        ) : orders.length === 0 ? (
          <div className="empty" style={{ minHeight: 160 }}>
            <Store size={32} />
            <p>No orders match these filters.</p>
            {channel !== 'native' && (
              <p className="text-muted" style={{ fontSize: '0.78rem' }}>
                Marketplace channels (Uber Eats/GrubHub/Caviar) show 0 orders until their webhook credentials are configured.
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Fulfillment</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const FulfillIcon = FULFILLMENT_ICON[o.fulfillment] || null;
                  return (
                    <tr key={`${o.channel}-${o.id}`}>
                      <td><ChannelBadge channel={o.channel} /></td>
                      <td className="mono text-primary">{o.order_ref}</td>
                      <td>{o.customer_name || '—'}</td>
                      <td className="text-muted">{o.item_count}</td>
                      <td style={{ fontWeight: 600 }}>${parseFloat(o.total || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${BUCKET_BADGE[o.status_bucket] || 'badge-muted'}`}>{o.raw_status}</span>
                      </td>
                      <td className="text-muted">
                        {FulfillIcon && <FulfillIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                        {FULFILLMENT_LABEL[o.fulfillment] || '—'}
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtDateTime(o.placed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
