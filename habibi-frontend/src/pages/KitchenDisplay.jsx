import React, { useEffect, useState, useCallback } from 'react';
import { Clock, UtensilsCrossed, RefreshCw } from 'lucide-react';
import './KitchenDisplay.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const POLL_MS  = 30000;

const STATUS_META = {
  pending:    { label: 'Pending',   cls: 'kd-status--pending'   },
  confirmed:  { label: 'Confirmed', cls: 'kd-status--confirmed' },
  preparing:  { label: 'Preparing', cls: 'kd-status--preparing' },
  on_the_way: { label: 'Ready',     cls: 'kd-status--ready'     },
  ready:      { label: 'Ready',     cls: 'kd-status--ready'     },
};

function elapsed(placedAt) {
  const diff = Math.floor((Date.now() - new Date(placedAt)) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
}

export default function KitchenDisplay() {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [tick, setTick]         = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dine-in/kitchen`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setLastSync(new Date());
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  // Initial fetch + poll
  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchOrders]);

  // Re-render elapsed times every minute
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="kd-root">
      {/* Header */}
      <header className="kd-header">
        <div className="kd-header-left">
          <UtensilsCrossed size={22} />
          <span className="kd-header-title">Kitchen Display</span>
          <span className="kd-header-sub">Dine-In Orders</span>
        </div>
        <div className="kd-header-right">
          {lastSync && (
            <span className="kd-sync-time">
              <RefreshCw size={13} />
              {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className="kd-live-dot" />
          <span className="kd-live-label">LIVE</span>
        </div>
      </header>

      {/* Body */}
      <main className="kd-main">
        {loading && (
          <div className="kd-empty">
            <div className="kd-spinner" />
            <p>Loading orders…</p>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="kd-empty">
            <UtensilsCrossed size={52} strokeWidth={1} />
            <p>No active dine-in orders</p>
            <span>New orders will appear here automatically</span>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="kd-grid">
            {orders.map(order => {
              const meta = STATUS_META[order.order_status] || { label: order.order_status, cls: '' };
              return (
                <div key={order.id} className={`kd-card ${meta.cls}`}>
                  <div className="kd-card-header">
                    <div>
                      <p className="kd-order-num">#{order.order_number}</p>
                      <p className="kd-table-name">
                        <UtensilsCrossed size={13} />
                        {order.table_number || 'Dine-In'}
                      </p>
                    </div>
                    <span className={`kd-badge ${meta.cls}`}>{meta.label}</span>
                  </div>

                  <ul className="kd-items">
                    {(order.items || []).map((item, i) => (
                      <li key={i} className="kd-item">
                        <span className="kd-item-qty">×{item.quantity || item.qty || 1}</span>
                        <span className="kd-item-name">{item.name}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="kd-card-footer">
                    <span className="kd-elapsed">
                      <Clock size={12} />
                      {elapsed(order.placed_at)}
                    </span>
                    <span className="kd-total">${parseFloat(order.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
