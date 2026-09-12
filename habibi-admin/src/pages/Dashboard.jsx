import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Clock, Utensils, ChevronRight, Circle,
  AlertTriangle, Wallet, PackageX, Users, CheckCircle2, XCircle, RefreshCw, BookOpen,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { isManager, canOpen } from '../utils/roles';
import './Dashboard.css';
import { fmtTime } from '../utils/date.js';

const STATUS_BADGE = {
  pending:          'badge-warning',
  accepted:         'badge-info',
  preparing:        'badge-warning',
  cooking:          'badge-warning',
  ready:            'badge-info',
  out_for_delivery: 'badge-info',
  delivered:        'badge-success',
  completed:        'badge-success',
  cancelled:        'badge-error',
};

// The order of the shift, so the in-progress list reads like the kitchen works.
const STATUS_ORDER = ['pending', 'accepted', 'preparing', 'cooking', 'ready', 'out_for_delivery'];

const label = (s) => (s || '').replace(/_/g, ' ');
const money = (n) => `$${parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const since = (mins) => {
  const m = Math.max(0, parseInt(mins, 10) || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  // An order abandoned days ago reads as nonsense in hours ("1076h 13m"), and
  // there are real ones sitting in the data that were never finished.
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Tile = ({ icon: Icon, label: text, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-card-icon" style={{ background: color + '18', color }}><Icon size={20} /></div>
    <div>
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-label">{text}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  </div>
);

export default function Dashboard() {
  const { admin, role } = useAdminAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const load = () => adminAPI.today()
    .then(d => { setData(d); setErr(''); })
    .catch(e => setErr(e.message || 'Could not load today.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="empty"><div className="spinner" /></div>;
  if (!data)   return <div className="empty"><p className="text-error">{err || 'Could not load today.'}</p></div>;

  const { today, active, awaiting_payment: awaiting, stock, on_shift: onShift } = data;
  const stuck = active.orders.filter(o => o.stuck);
  const firstName = (admin?.name || '').split(' ')[0];

  // Everything that wants a person to do something about it, right now.
  const attention = [
    stuck.length     && { key: 'stuck',  icon: AlertTriangle, tone: 'bad',
                          text: `${stuck.length} order${stuck.length === 1 ? '' : 's'} waiting longer than ${stuck.length === 1 ? 'it' : 'they'} should`,
                          to: '/orders' },
    awaiting.length  && { key: 'pay',    icon: Wallet, tone: 'warn',
                          text: `${awaiting.length} order${awaiting.length === 1 ? '' : 's'} waiting on payment confirmation`,
                          to: '/orders' },
    stock.out.length && { key: 'stock',  icon: PackageX, tone: 'warn',
                          text: `${stock.out.length} ingredient${stock.out.length === 1 ? '' : 's'} out of stock`,
                          to: '/inventory' },
  ].filter(Boolean);

  const grouped = STATUS_ORDER
    .map(s => ({ status: s, orders: active.orders.filter(o => o.order_status === s) }))
    .filter(g => g.orders.length);
  // Anything with a status we don't know about still has to appear somewhere.
  const others = active.orders.filter(o => !STATUS_ORDER.includes(o.order_status));
  if (others.length) grouped.push({ status: 'other', orders: others });

  return (
    <div className="dashboard">
      {/* Today */}
      <div className="dash-hello">
        <div>
          <h1 className="dash-greeting">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="dash-section-sub">
            {today.placed === 0
              ? 'No orders yet today.'
              : `${today.placed} order${today.placed === 1 ? '' : 's'} placed today.`}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="dash-stats">
        <Tile icon={ShoppingBag} color="#3b82f6" label="In progress now" value={active.total}
              sub={active.total ? `oldest ${since(active.orders[0]?.minutes)}` : 'nothing cooking'} />
        <Tile icon={CheckCircle2} color="#22c55e" label="Completed today" value={today.completed} sub="delivered or collected" />
        <Tile icon={XCircle} color="#ef4444" label="Cancelled today" value={today.cancelled} sub={today.cancelled ? 'worth a look' : 'none'} />
        {!isManager(role) && (
          <Tile icon={DollarSign} color="#E5B64E" label="Taken today" value={money(today.revenue)} sub="completed orders" />
        )}
      </div>

      {/* Needs you now */}
      {attention.length > 0 && (
        <div className="dash-attention">
          {attention.map(a => (
            <Link key={a.key} to={a.to} className={`dash-flag dash-flag-${a.tone}`}>
              <a.icon size={16} />
              <span>{a.text}</span>
              <ChevronRight size={14} />
            </Link>
          ))}
        </div>
      )}

      <div className="dash-split">
        {/* In progress */}
        <div className="card dash-orders-card">
          <div className="dash-orders-hdr">
            <div>
              <p className="dash-section-title">In progress</p>
              <p className="dash-section-sub">
                {active.total ? 'By stage, longest wait first. Orange has been sitting too long.' : 'Nothing in the kitchen right now.'}
              </p>
            </div>
            <Link to="/orders" className="btn btn-secondary btn-sm">All orders <ChevronRight size={13} /></Link>
          </div>

          {!active.total ? (
            <div className="empty"><ShoppingBag size={30} /><p>Nothing in progress</p></div>
          ) : (
            <div className="dash-groups">
              {grouped.map(g => (
                <div key={g.status} className="dash-group">
                  <p className="dash-group-hd">
                    <span className={`badge ${STATUS_BADGE[g.status] || 'badge-muted'}`}>{label(g.status)}</span>
                    <span className="text-muted">{g.orders.length}</span>
                  </p>
                  <ul className="dash-order-list">
                    {g.orders.map(o => (
                      <li key={o.order_number} className={o.stuck ? 'is-stuck' : ''}>
                        <span className="mono dash-order-no">{o.order_number}</span>
                        <span className="dash-order-who">{o.customer_name || '—'}</span>
                        <span className="text-muted dash-order-via">{label(o.delivery_method)}</span>
                        <span className={`dash-order-age${o.stuck ? ' is-stuck-age' : ''}`}>{since(o.minutes)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="dash-rail">
          {awaiting.length > 0 && (
            <div className="card dash-panel">
              <p className="dash-section-title"><Wallet size={14} /> Waiting on payment</p>
              <p className="dash-section-sub">These don’t reach the kitchen until someone confirms the money arrived.</p>
              <ul className="dash-mini">
                {awaiting.map(o => (
                  <li key={o.order_number}>
                    <span className="mono dash-order-no">{o.order_number}</span>
                    <span>{o.customer_name || '—'}</span>
                    <span className="text-muted">{o.payment_method} · {money(o.total)}</span>
                    <span className="dash-order-age">{since(o.minutes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card dash-panel">
            <p className="dash-section-title"><Users size={14} /> On shift</p>
            {!onShift.length ? (
              <p className="dash-section-sub">Nobody is clocked in.</p>
            ) : (
              <ul className="dash-mini">
                {onShift.map((s, i) => (
                  <li key={i}>
                    <span>{s.name}</span>
                    <span className="text-muted">{s.role}</span>
                    <span className="text-muted">since {s.clock_in ? fmtTime(s.clock_in, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    <span className="dash-order-age">{since(s.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(stock.out.length > 0 || stock.low.length > 0 || stock.unavailable_dishes.length > 0) && (
            <div className="card dash-panel">
              <p className="dash-section-title"><PackageX size={14} /> Stock</p>
              {stock.out.length > 0 && (
                <>
                  <p className="dash-mini-hd">Out</p>
                  <ul className="dash-chips">
                    {stock.out.map(s => <li key={s.name} className="is-out">{s.name}</li>)}
                  </ul>
                </>
              )}
              {stock.low.length > 0 && (
                <>
                  <p className="dash-mini-hd">Running low</p>
                  <ul className="dash-chips">
                    {stock.low.map(s => <li key={s.name}>{s.name} <small>{s.stock}{s.unit}</small></li>)}
                  </ul>
                </>
              )}
              {stock.unavailable_dishes.length > 0 && (
                <>
                  <p className="dash-mini-hd">Dishes switched off</p>
                  <ul className="dash-chips">
                    {stock.unavailable_dishes.map(n => <li key={n}>{n}</li>)}
                  </ul>
                </>
              )}
              <Link to="/inventory" className="btn btn-secondary btn-sm dash-panel-btn">Open Inventory</Link>
            </div>
          )}
        </div>
      </div>

      {err && <p className="text-muted" style={{ fontSize: '0.78rem' }}>Last refresh failed ({err}) — showing the previous figures.</p>}

      {/* Quick links */}
      <div className="dash-quick">
        {[
          { to: '/liveboard',      label: 'Live Board',     icon: <Utensils size={16} />, color: '#E5B64E' },
          { to: '/menu',           label: 'Menu Builder',   icon: <BookOpen size={16} />, color: '#3b82f6' },
          { to: '/business-hours', label: 'Business Hours', icon: <Clock size={16} />,    color: '#8b5cf6' },
          { to: '/coupons',        label: 'Coupons',        icon: <Circle size={16} />,   color: '#22c55e' },
        ].filter(q => canOpen(role, q.to)).map(q => (
          <Link key={q.to} to={q.to} className="dash-quick-card">
            <div className="dash-quick-icon" style={{ color: q.color, background: q.color + '18' }}>{q.icon}</div>
            <span>{q.label}</span>
            <ChevronRight size={14} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
