import React, { useState, useCallback, useEffect } from 'react';
import { BarChart2, Download, RefreshCw, DollarSign, ShoppingBag, Tag, MapPin, XCircle, TrendingUp } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Reports.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const TODAY = new Date().toISOString().split('T')[0];
const MONTH_AGO = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtHour = (h) => { const n = parseInt(h, 10); const hr = n % 12 === 0 ? 12 : n % 12; return `${hr}${n < 12 ? 'AM' : 'PM'}`; };
const fmtHourBlock = (h) => `${fmtHour(h)}–${fmtHour((parseInt(h, 10) + 2) % 24)}`;

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card rpt-stat-card">
      <div className="rpt-stat-icon" style={{ background: `${color}15`, color }}><Icon size={18}/></div>
      <div>
        <p className="rpt-stat-label">{label}</p>
        <p className="rpt-stat-value">{value}</p>
        {sub && <p className="rpt-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function csvExport(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function Reports() {
  const [start, setStart]       = useState(MONTH_AGO);
  const [end, setEnd]           = useState(TODAY);
  const [tab, setTab]           = useState('summary');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  // Trends & Forecast tab -- independent of the date-range-scoped run()
  // above (trending/peak-hours/prep-forecast all use their own rolling
  // windows, not start/end), so it's fetched lazily on first open instead
  // of joining the Promise.allSettled batch.
  const [trendsLoaded, setTrendsLoaded]   = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsErr, setTrendsErr]         = useState('');
  const [trending, setTrending]           = useState([]);
  const [peakHours, setPeakHours]         = useState([]);
  const [prepDow, setPrepDow]             = useState(new Date().getDay()); // 0=Sun..6=Sat, matches Postgres EXTRACT(DOW)
  const [prepForecast, setPrepForecast]   = useState([]);
  const [prepLoading, setPrepLoading]     = useState(false);

  const loadTrendsCore = useCallback(async () => {
    setTrendsLoading(true); setTrendsErr('');
    try {
      const [t, p] = await Promise.all([adminAPI.reportTrending(), adminAPI.reportPeakHours()]);
      setTrending(t.trending || []);
      setPeakHours(p.peak_hours || []);
      setTrendsLoaded(true);
    } catch (e) { setTrendsErr(e.message); }
    setTrendsLoading(false);
  }, []);

  const loadPrepForecast = useCallback(async (dow) => {
    setPrepLoading(true);
    try {
      const f = await adminAPI.reportPrepForecast(`?dow=${dow}`);
      setPrepForecast(f.forecast || []);
    } catch (e) { setTrendsErr(e.message); }
    setPrepLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'trends' && !trendsLoaded && !trendsLoading) {
      loadTrendsCore();
      loadPrepForecast(prepDow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectPrepDow = (d) => { setPrepDow(d); loadPrepForecast(d); };

  const run = useCallback(async (overrideStart, overrideEnd) => {
    setLoading(true); setErr('');
    try {
      const qs = `?start=${overrideStart || start}&end=${overrideEnd || end}`;
      const results = await Promise.allSettled([
        adminAPI.reportRevenue(qs),
        adminAPI.reportTransactions(qs),
        adminAPI.reportByCategory(qs),
        adminAPI.reportByLocation(qs),
        adminAPI.reportTax(qs),
        adminAPI.reportCouponUsage(qs),
      ]);
      const [rev, tx, byCat, byLoc, tax, coupon] = results.map(r => r.status === 'fulfilled' ? r.value : null);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length === results.length) throw new Error(failed[0].reason?.message || 'All report endpoints failed');
      if (failed.length) setErr(`${failed.length} report section(s) failed to load.`);
      setData({ rev, tx, byCat, byLoc, tax, coupon });
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [start, end]);

  const r = data?.rev?.revenue || {};
  const fmt = (n) => `$${parseFloat(n||0).toFixed(2)}`;

  const TABS = [
    { id: 'summary',    label: 'Summary' },
    { id: 'orders',     label: 'Transactions' },
    { id: 'by_category',label: 'By Category' },
    { id: 'by_location',label: 'By Location' },
    { id: 'tax',        label: 'Tax Report' },
    { id: 'coupons',    label: 'Coupon Usage' },
    { id: 'trends',     label: 'Trends & Forecast' },
  ];

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Revenue, tax, and order analytics</p>
        </div>
      </div>

      {/* Date range controls */}
      <div className="card rpt-controls">
        <div className="rpt-date-row">
          <div className="field">
            <label>From</label>
            <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} max={end} />
          </div>
          <div className="field">
            <label>To</label>
            <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} min={start} max={TODAY} />
          </div>
          <div style={{display:'flex',gap:'0.5rem',alignItems:'flex-end'}}>
            <button className="btn btn-primary" onClick={() => run()} disabled={loading}>
              {loading ? <div className="spinner"/> : <><RefreshCw size={14}/> Run Report</>}
            </button>
            {['7d','30d','90d','ytd'].map(p => (
              <button key={p} className="btn btn-secondary btn-sm" onClick={() => {
                const now = new Date();
                const e = TODAY;
                let s;
                if (p==='7d')  s = new Date(Date.now()-7*864e5).toISOString().split('T')[0];
                if (p==='30d') s = new Date(Date.now()-30*864e5).toISOString().split('T')[0];
                if (p==='90d') s = new Date(Date.now()-90*864e5).toISOString().split('T')[0];
                if (p==='ytd') s = `${now.getFullYear()}-01-01`;
                setStart(s); setEnd(e);
                run(s, e);
              }}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {err && <p className="text-error" style={{margin:'0.75rem 0'}}>{err}</p>}

      {data && (
        <>
          {/* Summary stat cards */}
          <div className="rpt-stat-grid">
            <StatCard label="Gross Revenue" value={fmt(r.gross_revenue)} sub={`${r.total_orders||0} orders`} icon={DollarSign} color="#1e3a8a" />
            <StatCard label="Net Revenue" value={fmt(r.net_revenue)} sub="Delivered only" icon={DollarSign} color="#22c55e" />
            <StatCard label="Tax Collected" value={fmt(r.tax_collected)} sub="Sales tax" icon={ShoppingBag} color="#f59e0b" />
            <StatCard label="Discounts Given" value={fmt(r.discounts)} sub="Coupons + offers" icon={Tag} color="#ef4444" />
            <StatCard label="Delivery Fees" value={fmt(r.delivery_fees)} sub="Delivery charges" icon={MapPin} color="#8b5cf6" />
            <StatCard label="Tips" value={fmt(r.tips)} sub="Customer tips" icon={DollarSign} color="#06b6d4" />
            <StatCard label="Cancelled" value={fmt(r.cancelled_amount)} sub={`${r.cancelled_orders||0} order${r.cancelled_orders===1?'':'s'}`} icon={XCircle} color="#dc2626" />
          </div>

          {/* Tab nav */}
          <div className="rpt-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`rpt-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div className="card">
            {tab === 'summary' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Revenue Summary</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport([r], `revenue_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <table className="table">
                  <tbody>
                    {[['Gross Revenue', fmt(r.gross_revenue)], ['Subtotal', fmt(r.subtotal)], ['Tax Collected', fmt(r.tax_collected)], ['Service Fees', fmt(r.service_fees)], ['Delivery Fees', fmt(r.delivery_fees)], ['Tips', fmt(r.tips)], ['Discounts', `-${fmt(r.discounts)}`], ['Net Revenue (Delivered)', fmt(r.net_revenue)], ['Total Orders', r.total_orders||0], [`Cancelled Orders (${r.cancelled_orders||0})`, fmt(r.cancelled_amount)]].map(([k,v]) => (
                      <tr key={k}><td style={{fontWeight:600,width:'50%'}}>{k}</td><td>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'orders' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Transactions ({data.tx?.transactions?.length||0})</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport(data.tx?.transactions||[], `transactions_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Order #</th><th>Customer</th><th>Payment</th><th>Method</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {(data.tx?.transactions||[]).map(t => (
                        <tr key={t.order_number}>
                          <td className="mono text-primary">{t.order_number}</td>
                          <td>
                            <p style={{fontWeight:500}}>{t.customer_name}</p>
                            <p className="text-muted" style={{fontSize:'0.7rem'}}>{t.customer_email}</p>
                          </td>
                          <td className="text-muted">{t.payment_method}</td>
                          <td className="text-muted">{t.delivery_method}</td>
                          <td style={{fontWeight:700}}>${parseFloat(t.total||0).toFixed(2)}</td>
                          <td><span className={`badge ${t.order_status==='delivered'||t.order_status==='completed'?'badge-success':t.order_status==='cancelled'?'badge-error':'badge-warning'}`}>{t.order_status}</span></td>
                          <td className="text-muted" style={{fontSize:'0.72rem',whiteSpace:'nowrap'}}>{fmtDateShort(t.placed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'by_category' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Revenue by Category</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport(data.byCat?.by_category||[], `by_category_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Category</th><th>Items Sold</th><th>Revenue</th><th>Share</th></tr></thead>
                    <tbody>
                      {(data.byCat?.by_category||[]).map(c => {
                        const total = (data.byCat?.by_category||[]).reduce((s,x) => s+parseFloat(x.revenue||0), 0);
                        const pct = total > 0 ? ((parseFloat(c.revenue||0)/total)*100).toFixed(1) : '0';
                        return (
                          <tr key={c.category}>
                            <td style={{fontWeight:600}}>{c.category}</td>
                            <td>{c.item_count}</td>
                            <td style={{fontWeight:700}}>${parseFloat(c.revenue||0).toFixed(2)}</td>
                            <td>
                              <div className="rpt-bar-wrap">
                                <div className="rpt-bar" style={{width:`${pct}%`}}/>
                                <span>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'by_location' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Revenue by Location</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport(data.byLoc?.by_location||[], `by_location_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Location</th><th>Orders</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {(data.byLoc?.by_location||[]).map(l => (
                        <tr key={l.location}>
                          <td style={{fontWeight:600}}><MapPin size={13} style={{marginRight:4,opacity:0.5}}/>{l.location}</td>
                          <td>{l.orders}</td>
                          <td style={{fontWeight:700}}>${parseFloat(l.revenue||0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'tax' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Tax Report (Monthly)</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport(data.tax?.tax_report||[], `tax_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Month</th><th>Orders</th><th>Taxable Sales</th><th>Tax Collected</th><th>Effective Rate</th></tr></thead>
                    <tbody>
                      {(data.tax?.tax_report||[]).map(t => (
                        <tr key={t.month}>
                          <td style={{fontWeight:600}}>{t.month}</td>
                          <td>{t.orders}</td>
                          <td>${parseFloat(t.taxable_sales||0).toFixed(2)}</td>
                          <td style={{fontWeight:700}}>${parseFloat(t.tax_collected||0).toFixed(2)}</td>
                          <td>{t.effective_rate_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'coupons' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Coupon Usage</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => csvExport(data.coupon?.coupon_usage||[], `coupons_${start}_${end}.csv`)}><Download size={13}/> CSV</button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Code</th><th>Uses</th><th>Total Saved</th><th>Avg Order Value</th></tr></thead>
                    <tbody>
                      {(data.coupon?.coupon_usage||[]).length === 0 && (
                        <tr><td colSpan={4} className="text-center text-muted" style={{padding:'2rem'}}>No coupon usage in this period</td></tr>
                      )}
                      {(data.coupon?.coupon_usage||[]).map(c => (
                        <tr key={c.coupon_code}>
                          <td className="mono font-serif" style={{fontWeight:700}}>{c.coupon_code}</td>
                          <td>{c.uses}</td>
                          <td className="text-error" style={{fontWeight:700}}>-${parseFloat(c.total_discount||0).toFixed(2)}</td>
                          <td className="text-muted">${parseFloat(c.avg_order_value||0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'trends' && (
              <div>
                <div className="rpt-section-hdr">
                  <span>Trends &amp; Forecast</span>
                </div>

                {trendsLoading && <p className="text-muted" style={{padding:'1rem'}}>Loading…</p>}
                {trendsErr && <p className="text-error" style={{padding:'1rem'}}>{trendsErr}</p>}

                {trendsLoaded && (
                  <>
                    {/* Trending items -- real sales data, week-over-week */}
                    <div className="rpt-trends-section">
                      <p className="rpt-trends-subhdr">Trending This Week</p>
                      {trending.length === 0 ? (
                        <p className="text-muted" style={{fontSize:'0.82rem'}}>Not enough recent order history to show trends yet.</p>
                      ) : (
                        <div className="rpt-trending-list">
                          {trending.map(t => (
                            <div key={t.name} className="rpt-trending-row">
                              <div>
                                <p style={{fontWeight:600}}>{t.name}</p>
                                <p className="text-muted" style={{fontSize:'0.72rem'}}>{t.category}</p>
                              </div>
                              <div style={{textAlign:'right'}}>
                                <p style={{fontWeight:700}}>{parseFloat(t.qty_recent).toFixed(0)} sold</p>
                                {t.pct_change === null ? (
                                  <span className="badge badge-muted">New</span>
                                ) : t.pct_change > 0 ? (
                                  <span className="badge badge-success">🔥 +{t.pct_change}%</span>
                                ) : t.pct_change < 0 ? (
                                  <span className="badge badge-error">📉 {t.pct_change}%</span>
                                ) : (
                                  <span className="badge badge-muted">— flat</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Peak hours heatmap -- day of week x hour of day, last 90 days */}
                    <div className="rpt-trends-section">
                      <p className="rpt-trends-subhdr">Peak Hours <span className="text-muted" style={{fontWeight:400,fontSize:'0.75rem'}}>(last 90 days, orders placed)</span></p>
                      {peakHours.length === 0 ? (
                        <p className="text-muted" style={{fontSize:'0.82rem'}}>Not enough order history yet.</p>
                      ) : (() => {
                        const peakMap = {};
                        let maxCount = 1;
                        peakHours.forEach(p => { peakMap[`${p.dow}-${p.hour}`] = p.order_count; if (p.order_count > maxCount) maxCount = p.order_count; });
                        return (
                          <div className="rpt-heatmap-wrap">
                            <div className="rpt-heatmap">
                              {DOW_LABELS.map((label, dow) => (
                                <div className="rpt-heatmap-row" key={dow}>
                                  <span className="rpt-heatmap-daylabel">{label}</span>
                                  {Array.from({ length: 24 }).map((_, h) => {
                                    const count = peakMap[`${dow}-${h}`] || 0;
                                    const intensity = count / maxCount;
                                    return (
                                      <span
                                        key={h}
                                        className="rpt-heatmap-cell"
                                        style={{ background: count ? `rgba(249,115,22,${Math.max(0.12, intensity)})` : 'rgba(255,255,255,0.04)' }}
                                        title={`${label} ${fmtHour(h)} — ${count} order${count===1?'':'s'}`}
                                      />
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Prep-ahead forecast -- historical average per 2-hour block for a chosen day of week */}
                    <div className="rpt-trends-section">
                      <p className="rpt-trends-subhdr">Prep Forecast</p>
                      <div className="rpt-prep-dow-picker">
                        {DOW_LABELS.map((label, d) => (
                          <button
                            key={d}
                            className={`btn btn-sm ${prepDow === d ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => selectPrepDow(d)}
                            disabled={prepLoading}
                          >{label}</button>
                        ))}
                      </div>
                      {prepLoading ? (
                        <p className="text-muted" style={{fontSize:'0.82rem'}}>Loading…</p>
                      ) : prepForecast.length === 0 ? (
                        <p className="text-muted" style={{fontSize:'0.82rem'}}>Not enough {DOW_LABELS[prepDow]} order history yet to estimate prep quantities.</p>
                      ) : (() => {
                        const sample = prepForecast[0]?.sample_occurrences || 0;
                        const byBlock = {};
                        prepForecast.forEach(row => {
                          if (!byBlock[row.hour_block]) byBlock[row.hour_block] = [];
                          if (byBlock[row.hour_block].length < 5) byBlock[row.hour_block].push(row);
                        });
                        return (
                          <>
                            {sample < 3 && (
                              <p className="text-muted" style={{fontSize:'0.78rem'}}>
                                ⚠ Based on only {sample} {DOW_LABELS[prepDow]}{sample === 1 ? '' : 's'} of history — treat this as a rough estimate.
                              </p>
                            )}
                            <div className="rpt-prep-blocks">
                              {Object.keys(byBlock).sort((a, b) => a - b).map(block => (
                                <div key={block} className="rpt-prep-block">
                                  <p className="rpt-prep-block-hdr">{fmtHourBlock(block)}</p>
                                  <ul className="rpt-prep-block-list">
                                    {byBlock[block].map(item => (
                                      <li key={item.name}>{item.name} <strong>× {Math.ceil(item.avg_qty)}</strong></li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="empty card">
          <BarChart2 size={48}/>
          <p>Select a date range and click <strong>Run Report</strong></p>
        </div>
      )}
    </div>
  );
}
