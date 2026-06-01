import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Handshake } from 'lucide-react';
import { adminAPI } from '../services/api';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const STATUS_CLASS = {
  pending:    'badge-muted',
  confirmed:  'badge-info',
  processing: 'badge-info',
  shipped:    'badge-info',
  delivered:  'badge-success',
  cancelled:  'badge-error',
};

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch (_) { return []; }
}

function fmt(v) { return `$${parseFloat(v || 0).toFixed(2)}`; }
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function PartnerOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setOrders(await adminAPI.getPartnerOrders()); }
    catch (_) {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleStatus = async (id, status) => {
    setUpdating(id);
    try {
      const updated = await adminAPI.updatePartnerOrderStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: updated.status } : o));
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(null);
    }
  };

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const countFor = (s) => orders.filter(o => o.status === s).length;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Partner Orders</h1>
          <p className="page-sub">Wholesale / B2B orders from registered partners</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          className={`orders-filter-btn${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All <span className="badge badge-muted" style={{ marginLeft: 4, fontSize: '0.65rem' }}>{orders.length}</span>
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            className={`orders-filter-btn${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {countFor(s) > 0 && (
              <span className="badge badge-muted" style={{ marginLeft: 4, fontSize: '0.65rem' }}>{countFor(s)}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty card">
          <Handshake size={32} style={{ opacity: 0.3 }} />
          <p>No partner orders{filter !== 'all' ? ` with status "${filter}"` : ' yet'}.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Order #</th>
                  <th>Partner / Business</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(o => {
                  const items = parseItems(o.items);
                  const isOpen = expanded === o.id;
                  return (
                    <React.Fragment key={o.id}>
                      <tr>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setExpanded(isOpen ? null : o.id)}
                            title={isOpen ? 'Collapse' : 'Expand'}
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>#{o.order_number}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{o.business_name || '—'}</div>
                          {o.partner_email && (
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>{o.partner_email}</div>
                          )}
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.78rem', maxWidth: 200 }}>
                          {items.length === 0 && '—'}
                          {items.slice(0, 2).map((item, i) => (
                            <span key={i}>
                              {item.quantity || item.qty || '?'}× {item.name || item.title || 'Item'}
                              {i < Math.min(items.length, 2) - 1 ? ', ' : ''}
                            </span>
                          ))}
                          {items.length > 2 && <span className="text-muted"> +{items.length - 2} more</span>}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt(o.total)}</td>
                        <td>
                          <span className="badge badge-muted" style={{ textTransform: 'none' }}>
                            {o.price_tier || 'tier_1'}
                          </span>
                        </td>
                        <td>
                          <select
                            className="input select"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', minWidth: 130 }}
                            value={o.status}
                            disabled={updating === o.id}
                            onChange={e => handleStatus(o.id, e.target.value)}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {fmtDate(o.placed_at)}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                              {/* Items list */}
                              <div>
                                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                  Line Items
                                </p>
                                {items.length === 0 ? (
                                  <p className="text-muted" style={{ fontSize: '0.82rem' }}>No items recorded</p>
                                ) : items.map((item, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                      {item.quantity || item.qty || 1}×
                                    </span>{' '}
                                    {item.name || item.title || 'Unknown item'}
                                    {item.unit_price != null && (
                                      <span className="text-muted">
                                        {' '}@ ${parseFloat(item.unit_price).toFixed(2)}/{item.unit || 'ea'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Totals */}
                              <div>
                                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                  Totals
                                </p>
                                <div style={{ fontSize: '0.82rem', lineHeight: 1.7 }}>
                                  <div>Subtotal: {fmt(o.sub_total)}</div>
                                  <div>Tax: {fmt(o.tax)}</div>
                                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Total: {fmt(o.total)}</div>
                                </div>
                              </div>

                              {/* Delivery address */}
                              {o.delivery_address && (
                                <div>
                                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    Delivery Address
                                  </p>
                                  <p style={{ fontSize: '0.82rem', maxWidth: 280 }}>{o.delivery_address}</p>
                                </div>
                              )}

                              {/* Notes */}
                              {o.notes && (
                                <div>
                                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    Notes
                                  </p>
                                  <p style={{ fontSize: '0.82rem', maxWidth: 300, color: 'var(--color-text-muted)' }}>{o.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
