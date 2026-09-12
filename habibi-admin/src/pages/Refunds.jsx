import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, Download, RefreshCw, AlertTriangle, DollarSign, Hash, Search } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Refunds.css';
import { fmtDateTime } from '../utils/date.js';

const TODAY     = new Date().toISOString().split('T')[0];
const MONTH_AGO = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];

const METHOD_LABEL = {
  card: 'Card', cash: 'Cash', cashapp: 'Cash App', zelle: 'Zelle',
  paypal: 'PayPal', googlepay: 'Google Pay', apple: 'Apple Pay',
};
const methodLabel = (m) => METHOD_LABEL[(m || '').toLowerCase()] || m || '—';
const money = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

function Stat({ label, value, sub, icon: Icon, color, alert }) {
  return (
    <div className={`card rf-stat${alert ? ' rf-stat-alert' : ''}`}>
      <div className="rf-stat-icon" style={{ background: `${color}18`, color }}><Icon size={18} /></div>
      <div>
        <p className="rf-stat-label">{label}</p>
        <p className="rf-stat-value">{value}</p>
        {sub && <p className="rf-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

export default function Refunds() {
  const [start, setStart]     = useState(MONTH_AGO);
  const [end, setEnd]         = useState(TODAY);
  const [rows, setRows]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [query, setQuery]     = useState('');
  const [onlyManual, setOnlyManual] = useState(false);

  const load = useCallback(async (s = start, e = end) => {
    setLoading(true); setErr('');
    try {
      const data = await adminAPI.refunds(`?start=${s || ''}&end=${e || ''}`);
      setRows(data.refunds || []);
      setSummary(data.summary || null);
    } catch (ex) {
      setErr(ex.message || 'Could not load refunds.');
      setRows([]); setSummary(null);
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quick = (days) => {
    const s = days === null ? '' : new Date(Date.now() - days * 864e5).toISOString().split('T')[0];
    const e = days === null ? '' : TODAY;
    setStart(s); setEnd(e); load(s, e);
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (onlyManual) out = out.filter(r => r.manual);
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_email || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.admin_name || '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, query, onlyManual]);

  const exportCSV = () => {
    const headers = ['Refunded At', 'Order #', 'Customer', 'Email', 'Amount', 'Order Total', 'Method', 'Sent automatically', 'Reason', 'Issued by', 'Refund ID'];
    const body = filtered.map(r => [
      fmtDateTime(r.refunded_at), r.order_number, r.customer_name || '', r.customer_email || '',
      parseFloat(r.amount || 0).toFixed(2), parseFloat(r.order_total || 0).toFixed(2),
      methodLabel(r.payment_method), r.manual ? 'No — send by hand' : 'Yes',
      r.reason || '', r.admin_name || '', r.refund_id || '',
    ]);
    const csv = [headers, ...body]
      .map(line => line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `habibi-refunds-${start || 'all'}_${end || 'all'}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Refunds</h1>
          <p className="page-sub">Every refund issued, who issued it, and which ones still need paying back by hand</p>
        </div>
        <button className="btn btn-secondary" onClick={() => exportCSV()} disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Range */}
      <div className="card rf-controls">
        <div className="field">
          <label>From</label>
          <input className="input" type="date" value={start} max={end || TODAY} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input className="input" type="date" value={end} min={start} max={TODAY} onChange={e => setEnd(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => load()} disabled={loading}>
          {loading ? <div className="spinner" /> : <><RefreshCw size={14} /> Show</>}
        </button>
        <div className="rf-quick">
          <button className="btn btn-secondary btn-sm" onClick={() => quick(7)}>7D</button>
          <button className="btn btn-secondary btn-sm" onClick={() => quick(30)}>30D</button>
          <button className="btn btn-secondary btn-sm" onClick={() => quick(90)}>90D</button>
          <button className="btn btn-secondary btn-sm" onClick={() => quick(null)}>All time</button>
        </div>
      </div>

      {err && <p className="text-error" style={{ margin: '0.75rem 0' }}>{err}</p>}

      {/* Summary */}
      {summary && (
        <div className="rf-stats">
          <Stat label="Refunded" value={money(summary.total)} sub={`${summary.count} refund${summary.count === 1 ? '' : 's'}`} icon={DollarSign} color="#dc2626" />
          <Stat label="Sent automatically" value={money(parseFloat(summary.total || 0) - parseFloat(summary.manual_total || 0))}
                sub={`${summary.count - summary.manual_count} through the processor`} icon={RotateCcw} color="#16a34a" />
          <Stat label="Still to send by hand" value={money(summary.manual_total)}
                sub={summary.manual_count ? `${summary.manual_count} Zelle / Cash App / cash refund${summary.manual_count === 1 ? '' : 's'}` : 'Nothing outstanding'}
                icon={AlertTriangle} color="#d97706" alert={summary.manual_count > 0} />
          <Stat label="Average refund" value={money(summary.count ? parseFloat(summary.total || 0) / summary.count : 0)}
                sub="Per refund in this range" icon={Hash} color="#2563eb" />
        </div>
      )}

      {summary?.manual_count > 0 && (
        <div className="rf-banner">
          <AlertTriangle size={16} />
          <span>
            <strong>{summary.manual_count}</strong> of these were paid by Zelle, Cash App or cash. Those cannot be
            refunded automatically — someone has to send <strong>{money(summary.manual_total)}</strong> back to those
            customers by hand.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="rf-filters">
        <div className="rf-search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search order number, customer, reason or who issued it"
          />
        </div>
        <label className="rf-check">
          <input type="checkbox" checked={onlyManual} onChange={e => setOnlyManual(e.target.checked)} />
          <span>Only ones needing manual payback</span>
        </label>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : !filtered.length ? (
          <div className="empty">
            <RotateCcw size={32} />
            <p>{rows.length ? 'No refund matches that filter.' : 'No refunds were issued in this date range.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Refunded</th><th>Order</th><th>Customer</th><th>Amount</th>
                  <th>Method</th><th>Reason</th><th>Issued by</th><th>Refund ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className={r.manual ? 'rf-row-manual' : ''}>
                    <td className="text-muted rf-nowrap">{fmtDateTime(r.refunded_at)}</td>
                    <td className="mono text-primary">{r.order_number}</td>
                    <td>
                      <p style={{ fontWeight: 500 }}>{r.customer_name || '—'}</p>
                      {r.customer_email && <p className="text-muted" style={{ fontSize: '0.7rem' }}>{r.customer_email}</p>}
                    </td>
                    <td className="rf-amount">
                      {money(r.amount)}
                      {parseFloat(r.amount) < parseFloat(r.order_total || 0) - 0.005 && (
                        <span className="rf-partial">part of {money(r.order_total)}</span>
                      )}
                    </td>
                    <td>
                      <span className="rf-method">{methodLabel(r.payment_method)}</span>
                      {r.manual
                        ? <span className="badge badge-warning rf-tag">Send by hand</span>
                        : <span className="badge badge-success rf-tag">Sent</span>}
                    </td>
                    <td className="rf-reason">{r.reason || <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{r.admin_name || '—'}</td>
                    <td className="mono text-muted rf-id">{r.refund_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
