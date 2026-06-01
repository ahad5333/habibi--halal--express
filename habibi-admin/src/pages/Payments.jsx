import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, ShoppingBag, TrendingUp, CreditCard,
  Search, RefreshCw, Download, ChevronUp, ChevronDown, RotateCcw, X
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './Payments.css';

const METHOD_ICONS = {
  card:    '💳',
  cash:    '💵',
  apple:   '🍎',
  google:  '📱',
  paypal:  '🅿️',
  cashapp: '💸',
};

const STATUS_CLASS = {
  pending:   'badge-warning',
  processing:'badge-warning',
  completed: 'badge-success',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  refunded:  'badge-danger',
};

function fmt(n) { return parseFloat(n || 0).toFixed(2); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function methodLabel(m) {
  const map = { card: 'Credit Card', cash: 'Cash on Delivery', apple: 'Apple Pay', google: 'Google Pay', paypal: 'PayPal', cashapp: 'Cash App' };
  return map[(m || '').toLowerCase()] || m || '—';
}

export default function Payments() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [method, setMethod]         = useState('all');
  const [sort, setSort]             = useState({ col: 'placed_at', dir: 'desc' });
  const [page, setPage]             = useState(1);
  const [refundTarget, setRefundTarget] = useState(null); // { order_number, total }
  const [refunding, setRefunding]       = useState(false);
  const [refundMsg, setRefundMsg]       = useState('');
  const PER_PAGE = 20;

  const load = async () => {
    setLoading(true);
    try { setData(await adminAPI.payments()); }
    catch (_) { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const methods = useMemo(() => {
    if (!data) return [];
    return ['all', ...new Set(data.transactions.map(t => (t.payment_method || '').toLowerCase()).filter(Boolean))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.transactions;
    if (method !== 'all') rows = rows.filter(r => (r.payment_method || '').toLowerCase() === method);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_email || '').toLowerCase().includes(q)
      );
    }
    rows = [...rows].sort((a, b) => {
      let va = a[sort.col], vb = b[sort.col];
      if (sort.col === 'total' || sort.col === 'sub_total') { va = parseFloat(va||0); vb = parseFloat(vb||0); }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, method, search, sort]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
    setPage(1);
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true); setRefundMsg('');
    try {
      const res = await adminAPI.refundOrder(refundTarget.order_number);
      setRefundMsg(res.message || 'Refund processed.');
      await load();
      setTimeout(() => { setRefundTarget(null); setRefundMsg(''); }, 2000);
    } catch (err) {
      setRefundMsg('Error: ' + (err.message || 'Refund failed.'));
    } finally {
      setRefunding(false);
    }
  };

  const canRefund = (row) => {
    const s = (row.order_status || '').toLowerCase();
    return s !== 'refunded' && s !== 'cancelled';
  };

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return null;
    return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const exportCSV = () => {
    const headers = ['Order #','Customer','Email','Date','Method','Subtotal','Tax','Service Fee','Tip','Discount','Total','Status'];
    const rows = filtered.map(t => [
      t.order_number, t.customer_name, t.customer_email,
      fmtDate(t.placed_at), methodLabel(t.payment_method),
      fmt(t.sub_total), fmt(t.tax), fmt(t.service_fee),
      fmt(t.tip), fmt(t.discount), fmt(t.total), t.order_status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `habibi-payments-${Date.now()}.csv`;
    a.click();
  };

  if (loading) return <div className="empty"><div className="spinner" /></div>;

  const s = data?.stats || {};
  const byMethod = data?.by_method || [];

  return (
    <div className="pay-page">
      {/* Header */}
      <div className="page-hdr">
        <div>
          <p className="page-title">Payments</p>
          <p className="page-sub">All transactions &amp; revenue breakdown</p>
        </div>
        <div className="pay-hdr-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="pay-stats">
        <div className="pay-stat-card">
          <div className="pay-stat-icon" style={{ background: 'rgba(229,182,78,0.12)', color: 'var(--color-primary)' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <p className="pay-stat-label">Total Revenue</p>
            <p className="pay-stat-val">${parseFloat(s.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="pay-stat-card">
          <div className="pay-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="pay-stat-label">Total Orders</p>
            <p className="pay-stat-val">{s.total_orders || 0}</p>
          </div>
        </div>
        <div className="pay-stat-card">
          <div className="pay-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="pay-stat-label">Avg Order Value</p>
            <p className="pay-stat-val">${fmt(s.avg_order_value)}</p>
          </div>
        </div>
        <div className="pay-stat-card">
          <div className="pay-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
            <CreditCard size={20} />
          </div>
          <div>
            <p className="pay-stat-label">Pending</p>
            <p className="pay-stat-val">{s.pending || 0}</p>
            <p className="pay-stat-sub">{s.completed || 0} completed · {s.cancelled || 0} cancelled</p>
          </div>
        </div>
      </div>

      {/* Payment method breakdown */}
      {byMethod.length > 0 && (
        <div className="pay-methods-card card">
          <p className="pay-methods-title">Revenue by Payment Method</p>
          <div className="pay-methods-list">
            {byMethod.map(m => {
              const pct = s.total_revenue > 0 ? (parseFloat(m.revenue) / parseFloat(s.total_revenue)) * 100 : 0;
              return (
                <div key={m.payment_method} className="pay-method-row">
                  <div className="pay-method-left">
                    <span className="pay-method-icon">{METHOD_ICONS[(m.payment_method||'').toLowerCase()] || '💰'}</span>
                    <div>
                      <p className="pay-method-name">{methodLabel(m.payment_method)}</p>
                      <p className="pay-method-count">{m.count} order{m.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="pay-method-bar-wrap">
                    <div className="pay-method-bar">
                      <div className="pay-method-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="pay-method-amt">${parseFloat(m.revenue).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table toolbar */}
      <div className="pay-toolbar">
        <div className="pay-method-filters">
          {methods.map(m => (
            <button
              key={m}
              className={`orders-filter-btn${method === m ? ' active' : ''}`}
              onClick={() => { setMethod(m); setPage(1); }}
            >
              {m === 'all' ? 'All Methods' : methodLabel(m)}
            </button>
          ))}
        </div>
        <div className="pay-search-wrap">
          <Search size={14} className="pay-search-icon" />
          <input
            className="input pay-search"
            placeholder="Search order #, customer…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="pay-table-wrap card">
        <table className="pay-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('order_number')} className="sortable">
                Order # <SortIcon col="order_number" />
              </th>
              <th onClick={() => toggleSort('customer_name')} className="sortable">
                Customer <SortIcon col="customer_name" />
              </th>
              <th onClick={() => toggleSort('placed_at')} className="sortable">
                Date <SortIcon col="placed_at" />
              </th>
              <th>Method</th>
              <th onClick={() => toggleSort('sub_total')} className="sortable num">
                Subtotal <SortIcon col="sub_total" />
              </th>
              <th className="num">Tax</th>
              <th className="num">Svc Fee</th>
              <th className="num">Tip</th>
              <th onClick={() => toggleSort('total')} className="sortable num">
                Total <SortIcon col="total" />
              </th>
              <th>Status</th>
              <th className="num">Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={11} className="pay-empty-row">No transactions found.</td>
              </tr>
            ) : paged.map(t => (
              <tr key={t.id}>
                <td><span className="pay-order-num">{t.order_number || `#${t.id}`}</span></td>
                <td>
                  <p className="pay-customer-name">{t.customer_name || 'Guest'}</p>
                  {t.customer_email && <p className="pay-customer-email">{t.customer_email}</p>}
                </td>
                <td className="pay-date">{fmtDate(t.placed_at)}</td>
                <td>
                  <span className="pay-method-badge">
                    {METHOD_ICONS[(t.payment_method || '').toLowerCase()] || '💰'}{' '}
                    {methodLabel(t.payment_method)}
                  </span>
                </td>
                <td className="num">${fmt(t.sub_total)}</td>
                <td className="num muted">${fmt(t.tax)}</td>
                <td className="num muted">${fmt(t.service_fee)}</td>
                <td className="num muted">${fmt(t.tip)}</td>
                <td className="num pay-total">${fmt(t.total)}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[(t.order_status||'').toLowerCase()] || 'badge-warning'}`}>
                    {t.order_status || 'pending'}
                  </span>
                </td>
                <td className="num">
                  {canRefund(t) ? (
                    <button
                      className="pay-refund-btn"
                      onClick={() => setRefundTarget({ order_number: t.order_number || String(t.id), total: t.total })}
                      title="Issue refund"
                    >
                      <RotateCcw size={13} /> Refund
                    </button>
                  ) : (
                    <span className="pay-refunded-label">
                      {(t.order_status||'').toLowerCase() === 'refunded' ? '↩ Refunded' : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pay-pagination">
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span className="pay-page-info">Page {page} of {totalPages} ({filtered.length} records)</span>
          <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {/* Refund confirmation modal */}
      {refundTarget && (
        <div className="pay-modal-overlay" onClick={() => { if (!refunding) setRefundTarget(null); }}>
          <div className="pay-modal" onClick={e => e.stopPropagation()}>
            <div className="pay-modal-hdr">
              <h3>Confirm Refund</h3>
              <button className="pay-modal-close" onClick={() => setRefundTarget(null)} disabled={refunding}>
                <X size={18} />
              </button>
            </div>
            <p className="pay-modal-body">
              Issue a full refund of <strong>${fmt(refundTarget.total)}</strong> for order{' '}
              <strong>{refundTarget.order_number}</strong>?
            </p>
            <p className="pay-modal-sub">
              If this order was paid via Stripe, the refund will be processed automatically.
              For cash/offline orders, mark it as refunded for record-keeping.
            </p>
            {refundMsg && (
              <p className={`pay-modal-msg ${refundMsg.startsWith('Error') ? 'error' : 'success'}`}>
                {refundMsg}
              </p>
            )}
            <div className="pay-modal-actions">
              <button className="btn btn-secondary" onClick={() => setRefundTarget(null)} disabled={refunding}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleRefund} disabled={refunding}>
                {refunding ? 'Processing…' : 'Yes, Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
