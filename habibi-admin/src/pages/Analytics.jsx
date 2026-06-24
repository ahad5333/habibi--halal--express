import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, DollarSign, ShoppingBag, Download } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Analytics.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const StatBox = ({ label, value, sub, color = 'var(--color-primary)' }) => (
  <div className="card analytics-stat">
    <p className="analytics-stat-label">{label}</p>
    <p className="analytics-stat-value" style={{color}}>{value}</p>
    {sub && <p className="analytics-stat-sub">{sub}</p>}
  </div>
);

function exportCsv(payments) {
  const header = ['Order Number', 'Date', 'Amount', 'Payment Method', 'Status'];
  const rows = payments.map(p => [
    p.order_number || p.id || '',
    p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
    parseFloat(p.total || p.amount || 0).toFixed(2),
    p.payment_method || '',
    p.order_status || p.status || '',
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

const TODAY = new Date().toISOString().split('T')[0];
const D30   = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];

export default function Analytics() {
  const [revenue, setRevenue]   = useState(null);
  const [growth, setGrowth]     = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [start, setStart]       = useState(D30);
  const [end, setEnd]           = useState(TODAY);

  const load = useCallback((s = start, e = end) => {
    setLoading(true);
    Promise.allSettled([adminAPI.revenue(), adminAPI.growth(), adminAPI.payments()])
      .then(([rv, gv, pv]) => {
        if (rv.status === 'fulfilled') setRevenue(rv.value);
        if (gv.status === 'fulfilled') setGrowth(gv.value);
        if (pv.status === 'fulfilled') {
          const v = pv.value;
          // Filter client-side by date range since payments endpoint doesn't support qs yet
          const all = Array.isArray(v) ? v : (Array.isArray(v?.transactions) ? v.transactions : []);
          const filtered = all.filter(p => {
            const d = p.created_at ? p.created_at.slice(0, 10) : '';
            return (!s || d >= s) && (!e || d <= e);
          });
          setPayments(filtered);
        }
      })
      .finally(() => setLoading(false));
  }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalRevenue = payments.reduce((s, p) => s + parseFloat(p.total || p.amount || 0), 0);
  const avgOrder = payments.length ? totalRevenue / payments.length : 0;

  if (loading) return <div className="empty"><div className="spinner" /></div>;

  return (
    <div className="analytics-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Analytics</p>
          <p className="page-sub">Revenue, growth, and order performance</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
          {['7d','30d','90d'].map(p => (
            <button key={p} className="btn btn-sm btn-secondary" onClick={() => {
              const s = new Date(Date.now() - parseInt(p)*864e5).toISOString().split('T')[0];
              setStart(s); setEnd(TODAY); load(s, TODAY);
            }}>{p.toUpperCase()}</button>
          ))}
          <input type="date" className="input" style={{width:140}} max={TODAY} value={start} onChange={e => setStart(e.target.value)} />
          <input type="date" className="input" style={{width:140}} max={TODAY} value={end}   onChange={e => setEnd(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={() => load(start, end)}>Apply</button>
          <button className="btn btn-secondary" onClick={() => exportCsv(payments)} disabled={!payments.length}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      {/* Stats */}
      <div className="analytics-stats">
        <StatBox label="Total Revenue" value={`$${totalRevenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`} sub="All paid orders" color="var(--color-success)" />
        <StatBox label="Total Transactions" value={payments.length.toLocaleString()} sub="Completed payments" color="var(--color-info)" />
        <StatBox label="Average Order Value" value={`$${avgOrder.toFixed(2)}`} sub="Per order" />
        <StatBox label="New Customers" value={growth?.new_customers ?? '—'} sub={growth?.period || 'This month'} color="var(--color-warning)" />
      </div>

      {/* Revenue by category (from revenue endpoint if available) */}
      {revenue?.by_category && (
        <div className="card analytics-chart-card">
          <p className="analytics-section-title">Revenue by Category</p>
          <div className="analytics-bars">
            {Object.entries(revenue.by_category).map(([cat, val]) => {
              const max = Math.max(...Object.values(revenue.by_category));
              const pct = max ? (val / max) * 100 : 0;
              return (
                <div key={cat} className="analytics-bar-row">
                  <span className="analytics-bar-label">{cat}</span>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{width:`${pct}%`}} />
                  </div>
                  <span className="analytics-bar-val">${parseFloat(val).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="card analytics-tx-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--color-border)'}}>
          <p className="analytics-section-title">Recent Transactions</p>
        </div>
        {payments.length === 0 ? (
          <div className="empty"><DollarSign size={32} /><p>No transactions yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map((p, i) => (
                  <tr key={i}>
                    <td className="mono text-primary" style={{fontSize:'0.78rem'}}>{p.order_number || p.order_id || '—'}</td>
                    <td style={{fontSize:'0.82rem'}}>{p.customer_name || p.user_name || '—'}</td>
                    <td className="text-muted">{p.payment_method || '—'}</td>
                    <td style={{fontWeight:600,color:'var(--color-success)'}}>${parseFloat(p.total||p.amount||0).toFixed(2)}</td>
                    <td><span className={`badge ${(p.order_status||p.status)==='completed'||( p.order_status||p.status)==='delivered'?'badge-success':'badge-warning'}`}>{p.order_status||p.status||'—'}</span></td>
                    <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                      {(p.placed_at||p.created_at) ? fmtDate(p.placed_at||p.created_at, {month:'short',day:'numeric',year:'numeric'}) : '—'}
                    </td>
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
