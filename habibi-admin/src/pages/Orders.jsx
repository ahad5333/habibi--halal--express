import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, Phone, MapPin, Clock, Package } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Orders.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const CANCEL_REASONS = [
  'Customer requested cancellation',
  'Item(s) out of stock',
  'Restaurant too busy',
  'Duplicate order',
  'Customer unreachable',
  'Payment issue',
  'Delivery area unavailable',
  'Order placed by mistake',
];

const STATUSES = ['all', 'received', 'pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'];
const STATUS_BADGE = {
  received:   'badge-warning',
  pending:    'badge-warning',
  confirmed:  'badge-info',
  preparing:  'badge-warning',
  on_the_way: 'badge-info',
  delivered:  'badge-success',
  completed:  'badge-success',
  cancelled:  'badge-error',
};
const NEXT_STEPS = {
  received:   ['confirmed', 'cancelled'],
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['preparing', 'cancelled'],
  preparing:  ['on_the_way', 'cancelled'],
  on_the_way: ['delivered'],
  delivered:  [],
  cancelled:  [],
};

function CancelReasonPicker({ onConfirm, onDismiss }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [custom, setCustom] = useState('');
  return (
    <div className="cancel-picker" onClick={e => e.stopPropagation()}>
      <p className="cancel-picker-title">Cancellation Reason</p>
      <select className="input select cancel-picker-select" value={reason} onChange={e => setReason(e.target.value)}>
        {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        <option value="__custom">Other (type below)…</option>
      </select>
      {reason === '__custom' && (
        <input className="input cancel-picker-input" placeholder="Enter reason…" value={custom} onChange={e => setCustom(e.target.value)} />
      )}
      <div className="cancel-picker-actions">
        <button className="btn btn-sm btn-secondary" onClick={onDismiss}>Go Back</button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => onConfirm(reason === '__custom' ? (custom || 'Other') : reason)}
          disabled={reason === '__custom' && !custom.trim()}
        >
          Confirm Cancel
        </button>
      </div>
    </div>
  );
}

function OrderRow({ order, onUpdate }) {
  const [open, setOpen]         = useState(false);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const nexts = NEXT_STEPS[order.status] || [];

  const handleStatus = async (s, reason) => {
    setUpdating(true);
    try { await onUpdate(order.id, s, reason); }
    catch (_) {}
    finally { setUpdating(false); setCancelling(false); }
  };

  return (
    <>
      <tr className={`order-row ${open ? 'expanded' : ''}`} onClick={() => setOpen(!open)}>
        <td className="mono text-primary" style={{whiteSpace:'nowrap'}}>{order.id}</td>
        <td>
          <p style={{fontWeight:500}}>{order.user_name}</p>
          <p className="text-muted" style={{fontSize:'0.7rem'}}>{order.user_phone}</p>
        </td>
        <td style={{maxWidth:180}}>
          <p style={{fontSize:'0.78rem'}}>{(order.items || []).map(i => i.name).join(', ').slice(0,60)}{((order.items||[]).map(i=>i.name).join(', ').length > 60) ? '…' : ''}</p>
          <p className="text-muted" style={{fontSize:'0.7rem'}}>{(order.items||[]).length} item{(order.items||[]).length!==1?'s':''}</p>
        </td>
        <td style={{fontWeight:700, whiteSpace:'nowrap'}}>${parseFloat(order.total_amount||0).toFixed(2)}</td>
        <td>{order.delivery_method}</td>
        <td>{order.payment_method}</td>
        <td>
          <span className={`badge ${STATUS_BADGE[order.status] || 'badge-muted'}`}>
            {(order.status||'pending').replace(/_/g,' ')}
          </span>
        </td>
        <td style={{fontSize:'0.72rem', color:'var(--color-text-muted)', whiteSpace:'nowrap'}}>
          {order.created_at ? fmtDateTime(order.created_at, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}
        </td>
        <td>
          <ChevronDown size={14} className="text-muted" style={{transform: open ? 'rotate(180deg)' : '', transition:'transform 0.2s'}} />
        </td>
      </tr>
      {open && (
        <tr className="order-detail-row">
          <td colSpan={9}>
            <div className="order-detail">
              {/* Items */}
              <div className="order-detail-section">
                <p className="order-detail-label">ORDER ITEMS</p>
                <div className="order-items-list">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="order-item">
                      <div>
                        <p style={{fontWeight:500}}>{item.name}</p>
                        {(item.choices||[]).length > 0 && <p className="text-muted" style={{fontSize:'0.72rem'}}>Choice: {item.choices.join(', ')}</p>}
                        {(item.addons||[]).length > 0 && <p className="text-muted" style={{fontSize:'0.72rem'}}>Add-ons: {item.addons.join(', ')}</p>}
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{fontWeight:500}}>×{item.quantity}</p>
                        <p className="text-muted" style={{fontSize:'0.72rem'}}>${parseFloat(item.price||0).toFixed(2)} ea</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer info */}
              <div className="order-detail-section">
                <p className="order-detail-label">CUSTOMER</p>
                <div className="order-detail-fields">
                  {order.user_email && <div><p className="text-muted">Email</p><p>{order.user_email}</p></div>}
                  {order.user_phone && <div><p className="text-muted">Phone</p><a href={`tel:${order.user_phone}`} className="text-primary">{order.user_phone}</a></div>}
                  {order.user_address && <div><p className="text-muted">Address</p><p>{order.user_address}</p></div>}
                  {order.location_name && <div><p className="text-muted">Location</p><p>{order.location_name}</p></div>}
                  {order.driver_instructions && <div><p className="text-muted">Instructions</p><p>{order.driver_instructions}</p></div>}
                </div>
              </div>

              {/* Actions */}
              {nexts.length > 0 && (
                <div className="order-detail-section">
                  <p className="order-detail-label">UPDATE STATUS</p>
                  {cancelling ? (
                    <CancelReasonPicker
                      onConfirm={(reason) => handleStatus('cancelled', reason)}
                      onDismiss={() => setCancelling(false)}
                    />
                  ) : (
                    <div className="order-action-btns">
                      {nexts.map(s => (
                        <button
                          key={s}
                          className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (s === 'cancelled') { setCancelling(true); }
                            else { handleStatus(s); }
                          }}
                          disabled={updating}
                        >
                          {updating && s !== 'cancelled' ? <span className="spinner" style={{width:12,height:12}} /> : `→ ${s.replace(/_/g,' ')}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {order.cancellation_reason && (
                <div className="order-detail-section">
                  <p className="order-detail-label">CANCELLATION REASON</p>
                  <p style={{fontSize:'0.82rem',color:'var(--color-error)'}}>{order.cancellation_reason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Orders() {
  const [orders, setOrders]       = useState([]);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminAPI.orders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const handleUpdate = async (id, status, cancellation_reason) => {
    const prev = orders;
    setOrders(p => p.map(o => o.id === id ? { ...o, status, ...(cancellation_reason ? { cancellation_reason } : {}) } : o));
    try {
      await adminAPI.updateOrder(id, status, cancellation_reason);
    } catch (err) {
      setOrders(prev);
      alert(`Failed to update order: ${err.message}`);
    }
  };

  const visible = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.id + o.user_name + o.user_phone + o.user_email).toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {};
  STATUSES.forEach(s => { counts[s] = s === 'all' ? orders.length : orders.filter(o => o.status === s).length; });

  return (
    <div className="orders-page">
      {/* Controls */}
      <div className="orders-toolbar">
        <div className="orders-filters">
          {STATUSES.map(s => (
            <button
              key={s}
              className={`orders-filter-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              {counts[s] > 0 && <span className="orders-filter-count">{counts[s]}</span>}
            </button>
          ))}
        </div>
        <div className="orders-right">
          <input
            className="input orders-search"
            placeholder="Search orders, customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-secondary btn-icon" onClick={() => fetchOrders(true)} title="Refresh">
            <RefreshCw size={14} className={refreshing ? 'spin-once' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="empty"><Package size={36} /><p>No orders match your filter</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(o => (
                  <OrderRow key={o.id} order={o} onUpdate={handleUpdate} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
