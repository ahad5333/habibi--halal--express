import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, DollarSign, ShoppingBag, Download } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Analytics.css';

const StatBox = ({ label, value, sub, color = 'var(--color-primary)' }) => (
  <div className="card analytics-stat">
    <p className="analytics-stat-label">{label}</p>
    <p className="analytics-stat-value" style={{color}}>{value}</p>
    {sub && <p className="analytics-stat-sub">{sub}</p>}
  </div>
);

export default function Analytics() {
  const [revenue, setRevenue]   = useState(null);
  const [growth, setGrowth]     = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([adminAPI.revenue(), adminAPI.growth(), adminAPI.payments()])
      .then(([rv, gv, pv]) => {
        if (rv.status === 'fulfilled') setRevenue(rv.value);
        if (gv.status === 'fulfilled') setGrowth(gv.value);
        if (pv.status === 'fulfilled') {
          const v = pv.value;
          setPayments(Array.isArray(v) ? v : (Array.isArray(v?.transactions) ? v.transactions : []));
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
        <button className="btn btn-secondary"><Download size={14} /> Export CSV</button>
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
                      {(p.placed_at||p.created_at) ? new Date(p.placed_at||p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
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
