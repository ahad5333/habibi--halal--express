import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, ShoppingBag, Clock, Utensils, TrendingUp, ChevronRight, Circle } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Dashboard.css';

const STATUS_BADGE = {
  pending:    'badge-warning',
  confirmed:  'badge-info',
  preparing:  'badge-warning',
  on_the_way: 'badge-info',
  delivered:  'badge-success',
  completed:  'badge-success',
  cancelled:  'badge-error',
};

const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-card-icon" style={{ background: color + '18', color }}>{icon}</div>
    <div>
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-label">{label}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.stats(), adminAPI.orders()])
      .then(([s, o]) => { setStats(s); setOrders(o.slice(0, 8)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty"><div className="spinner" /></div>;

  return (
    <div className="dashboard">
      {/* Stats */}
      <div className="dash-stats">
        <StatCard
          icon={<DollarSign size={20} />} color="#22c55e"
          label="Total Revenue" value={`$${parseFloat(stats?.revenue || 0).toLocaleString()}`}
          sub="All time"
        />
        <StatCard
          icon={<ShoppingBag size={20} />} color="#3b82f6"
          label="Total Orders" value={parseInt(stats?.orders || 0).toLocaleString()}
          sub="All time"
        />
        <StatCard
          icon={<Clock size={20} />} color="#f59e0b"
          label="Pending Orders" value={parseInt(stats?.pending || 0)}
          sub="Need action"
        />
        <StatCard
          icon={<Utensils size={20} />} color="#E5B64E"
          label="Menu Items" value={parseInt(stats?.menus || 0)}
          sub="Active items"
        />
      </div>

      {/* Recent orders */}
      <div className="card dash-orders-card">
        <div className="dash-orders-hdr">
          <div>
            <p className="dash-section-title">Recent Orders</p>
            <p className="dash-section-sub">Latest {orders.length} orders across all channels</p>
          </div>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            View All <ChevronRight size={13} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="empty"><ShoppingBag size={32} /><p>No orders yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="mono text-primary">{o.id}</td>
                    <td>
                      <p style={{fontWeight:500}}>{o.user_name}</p>
                      <p className="text-muted" style={{fontSize:'0.7rem'}}>{o.user_phone}</p>
                    </td>
                    <td className="text-muted">{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}</td>
                    <td style={{fontWeight:600}}>${parseFloat(o.total_amount || 0).toFixed(2)}</td>
                    <td>{o.delivery_method}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[o.status] || 'badge-muted'}`}>
                        {(o.status || 'pending').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                      {o.created_at ? new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="dash-quick">
        {[
          { to: '/menu',     label: 'Add Menu Item',      icon: <Utensils size={16} />,   color: '#E5B64E' },
          { to: '/coupons',  label: 'Create Coupon',      icon: <TrendingUp size={16} />, color: '#3b82f6' },
          { to: '/partners', label: 'Review Applications',icon: <Circle size={16} />,     color: '#22c55e' },
          { to: '/urgent',   label: 'Urgent Inbox',       icon: <Clock size={16} />,      color: '#ef4444' },
        ].map(q => (
          <Link key={q.to} to={q.to} className="dash-quick-card">
            <div className="dash-quick-icon" style={{ color: q.color, background: q.color + '18' }}>
              {q.icon}
            </div>
            <span>{q.label}</span>
            <ChevronRight size={14} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
