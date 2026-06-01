import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, ShoppingCart, ClipboardList, FileText, User,
  Plus, Minus, Trash2, Package, CheckCircle, Clock, Truck,
  Download, X, AlertCircle, LogOut, RefreshCw, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { partnerPortalAPI } from '../services/api';
import './PartnerPortal.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const STATUS_BADGE = {
  pending:    { cls: 'pp-badge-warn',    label: 'Pending' },
  confirmed:  { cls: 'pp-badge-info',    label: 'Confirmed' },
  processing: { cls: 'pp-badge-info',    label: 'Processing' },
  shipped:    { cls: 'pp-badge-primary', label: 'Shipped' },
  delivered:  { cls: 'pp-badge-success', label: 'Delivered' },
  cancelled:  { cls: 'pp-badge-error',   label: 'Cancelled' },
};

const TIER_LABELS = { tier_1: 'Standard', tier_2: 'Silver', tier_3: 'Gold' };

// ── CatalogTab ────────────────────────────────────────────────────
function CatalogTab({ catalog, cart, onAdd, onRemove }) {
  const [filterCat, setFilterCat] = useState('all');
  const [view, setView]           = useState('regular'); // 'regular' | 'wholesale'

  const items = view === 'wholesale' ? catalog.wholesale_catalog : catalog.regular_menu;
  const cats  = ['all', ...new Set(items.map(i => i.category).filter(Boolean))];
  const visible = filterCat === 'all' ? items : items.filter(i => i.category === filterCat);

  const getQty = (id, src) => cart.find(c => c.id === id && c.source === src)?.qty || 0;

  return (
    <div>
      {/* Catalog switcher */}
      <div className="pp-catalog-switch">
        <button className={`pp-switch-btn ${view==='regular'?'active':''}`} onClick={() => setView('regular')}>
          Regular Menu <span className="pp-count">{catalog.regular_menu?.length||0}</span>
        </button>
        <button className={`pp-switch-btn ${view==='wholesale'?'active':''}`} onClick={() => setView('wholesale')}>
          Wholesale Catalog <span className="pp-count">{catalog.wholesale_catalog?.length||0}</span>
        </button>
      </div>

      <div className="pp-tier-badge">
        Your tier: <strong>{TIER_LABELS[catalog.price_tier] || catalog.price_tier}</strong> pricing applied
      </div>

      {/* Category filter */}
      <div className="pp-cat-row">
        {cats.map(c => (
          <button key={c} className={`pp-cat-btn ${filterCat===c?'active':''}`} onClick={() => setFilterCat(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="pp-empty">
          <Package size={40} />
          <p>No items in this catalog.</p>
          <p className="pp-empty-sub">Contact your account manager to add products.</p>
        </div>
      ) : (
        <div className="pp-catalog-grid">
          {visible.map(item => {
            const qty = getQty(item.id, item.source);
            const price = parseFloat(item.display_price || item.partner_price || item.price || 0);
            const minQty = item.min_quantity || 1;
            return (
              <div key={`${item.source}-${item.id}`} className={`pp-catalog-card ${qty > 0 ? 'in-cart' : ''}`}>
                <div className="pp-catalog-img">
                  {item.image_url
                    ? <img src={item.image_url.startsWith('http') ? item.image_url : `${API_BASE}${item.image_url}`} alt={item.name} />
                    : <Package size={32} />
                  }
                </div>
                <div className="pp-catalog-info">
                  <p className="pp-catalog-name">{item.name}</p>
                  {item.description && <p className="pp-catalog-desc">{item.description}</p>}
                  <div className="pp-catalog-meta">
                    {item.category && <span className="pp-cat-pill">{item.category}</span>}
                    {item.unit && <span className="pp-unit">per {item.unit}</span>}
                    {minQty > 1 && <span className="pp-min-qty">Min: {minQty}</span>}
                  </div>
                </div>
                <div className="pp-catalog-footer">
                  <p className="pp-catalog-price">${price.toFixed(2)}</p>
                  {qty === 0 ? (
                    <button className="pp-add-btn" onClick={() => onAdd(item, minQty)}>
                      <Plus size={14}/> Add
                    </button>
                  ) : (
                    <div className="pp-qty-ctrl">
                      <button onClick={() => onRemove(item)} className="pp-qty-btn"><Minus size={13}/></button>
                      <span className="pp-qty-num">{qty}</span>
                      <button onClick={() => onAdd(item, 1)} className="pp-qty-btn"><Plus size={13}/></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CartTab ────────────────────────────────────────────────────────
function CartTab({ cart, onQtyChange, onRemove, onClear, onSubmit, submitting }) {
  const [address, setAddress] = useState('');
  const [notes, setNotes]     = useState('');
  const [err, setErr]         = useState('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = subtotal * 0.08875; // NYC tax
  const total    = subtotal + tax;

  const submit = async () => {
    if (!address.trim()) { setErr('Delivery address is required'); return; }
    setErr('');
    await onSubmit({ items: cart, delivery_address: address, notes, sub_total: subtotal, tax, total });
  };

  if (cart.length === 0) {
    return (
      <div className="pp-empty">
        <ShoppingCart size={40}/>
        <p>Your cart is empty</p>
        <p className="pp-empty-sub">Browse the catalog to add items</p>
      </div>
    );
  }

  return (
    <div className="pp-cart">
      <div className="pp-cart-items">
        <div className="pp-cart-hdr">
          <span>Item</span><span>Unit Price</span><span>Qty</span><span>Total</span><span></span>
        </div>
        {cart.map(item => (
          <div key={`${item.source}-${item.id}`} className="pp-cart-row">
            <div className="pp-cart-name">
              <p>{item.name}</p>
              {item.unit && <span className="pp-unit">per {item.unit}</span>}
            </div>
            <span className="pp-cart-price">${parseFloat(item.price).toFixed(2)}</span>
            <div className="pp-qty-ctrl">
              <button className="pp-qty-btn" onClick={() => onQtyChange(item, item.qty - 1)}><Minus size={12}/></button>
              <span className="pp-qty-num">{item.qty}</span>
              <button className="pp-qty-btn" onClick={() => onQtyChange(item, item.qty + 1)}><Plus size={12}/></button>
            </div>
            <span className="pp-cart-line-total">${(item.price * item.qty).toFixed(2)}</span>
            <button className="pp-cart-remove" onClick={() => onRemove(item)}><Trash2 size={13}/></button>
          </div>
        ))}
      </div>

      <div className="pp-cart-side">
        <div className="pp-order-summary">
          <h3>Order Summary</h3>
          <div className="pp-summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="pp-summary-row"><span>Tax (8.875%)</span><span>${tax.toFixed(2)}</span></div>
          <div className="pp-summary-row pp-summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <div className="pp-order-fields">
          <div className="pp-field">
            <label>Delivery Address *</label>
            <textarea
              className="pp-input pp-textarea"
              rows={3}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Full delivery address"
            />
          </div>
          <div className="pp-field">
            <label>Special Instructions</label>
            <textarea
              className="pp-input pp-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Loading dock at rear, call on arrival"
            />
          </div>
          {err && <p className="pp-err">{err}</p>}
          <button className="pp-submit-btn" onClick={submit} disabled={submitting}>
            {submitting ? <span className="pp-spinner"/> : <><CheckCircle size={15}/> Place Order</>}
          </button>
          <button className="pp-clear-btn" onClick={onClear}>Clear cart</button>
        </div>
      </div>
    </div>
  );
}

// ── OrdersTab ─────────────────────────────────────────────────────
function OrdersTab({ orders, loading, onRefresh, onInvoice }) {
  return (
    <div>
      <div className="pp-section-hdr">
        <span>Order History ({orders.length})</span>
        <button className="pp-icon-btn" onClick={onRefresh} title="Refresh"><RefreshCw size={14}/></button>
      </div>
      {loading ? (
        <div className="pp-empty"><div className="pp-spinner-lg"/></div>
      ) : orders.length === 0 ? (
        <div className="pp-empty"><ClipboardList size={40}/><p>No orders yet</p></div>
      ) : (
        <div className="pp-orders-list">
          {orders.map(o => {
            const badge = STATUS_BADGE[o.status] || { cls: 'pp-badge-muted', label: o.status };
            return (
              <div key={o.id} className="pp-order-card">
                <div className="pp-order-card-hdr">
                  <div>
                    <p className="pp-order-num">{o.order_number}</p>
                    <p className="pp-order-date">{new Date(o.placed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <span className={`pp-badge ${badge.cls}`}>{badge.label}</span>
                    <button className="pp-invoice-btn" onClick={() => onInvoice(o)}>
                      <FileText size={13}/> Invoice
                    </button>
                  </div>
                </div>
                <div className="pp-order-items-row">
                  {(o.items||[]).slice(0, 4).map((item, i) => (
                    <span key={i} className="pp-order-item-pill">{item.qty}× {item.name}</span>
                  ))}
                  {o.items?.length > 4 && <span className="pp-order-item-pill pp-more">+{o.items.length - 4} more</span>}
                </div>
                <div className="pp-order-card-footer">
                  <span className="pp-order-addr"><Truck size={12}/> {o.delivery_address?.slice(0,50) || 'No address'}</span>
                  <span className="pp-order-total">${parseFloat(o.total||0).toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── InvoiceModal ──────────────────────────────────────────────────
function InvoiceModal({ order, onClose }) {
  if (!order) return null;
  const print = () => window.print();
  return (
    <div className="pp-modal-overlay" onClick={onClose}>
      <div className="pp-modal pp-invoice-modal" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-hdr">
          <h3>Invoice — {order.order_number}</h3>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="pp-icon-btn" onClick={print}><Download size={15}/></button>
            <button className="pp-icon-btn" onClick={onClose}><X size={15}/></button>
          </div>
        </div>
        <div className="pp-invoice-body" id="pp-invoice-print">
          <div className="pp-inv-header">
            <div>
              <p className="pp-inv-brand">Habibi Halal Express, INC.</p>
              <p className="pp-inv-addr">204 E Mosholu Pkwy S, Bronx, NY 10458</p>
              <p className="pp-inv-addr">info@habibihe.com</p>
            </div>
            <div className="pp-inv-meta">
              <p><strong>Invoice #</strong> {order.order_number}</p>
              <p><strong>Date</strong> {new Date(order.placed_at).toLocaleDateString()}</p>
              <p><strong>Status</strong> {order.status}</p>
              {order.price_tier && <p><strong>Tier</strong> {TIER_LABELS[order.price_tier] || order.price_tier}</p>}
            </div>
          </div>

          <div className="pp-inv-bill-to">
            <p className="pp-inv-section-label">Bill To</p>
            <p><strong>{order.app_business_name || order.business_name}</strong></p>
            {order.business_address && <p>{order.business_address}</p>}
            {order.ein_number && <p>EIN: {order.ein_number}</p>}
            {order.partner_email && <p>{order.partner_email}</p>}
          </div>

          <table className="pp-inv-table">
            <thead>
              <tr><th>Item</th><th>Unit Price</th><th>Qty</th><th>Total</th></tr>
            </thead>
            <tbody>
              {(order.items||[]).map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td>${parseFloat(item.price||0).toFixed(2)}</td>
                  <td>{item.qty}</td>
                  <td>${(parseFloat(item.price||0) * item.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pp-inv-totals">
            <div className="pp-inv-total-row"><span>Subtotal</span><span>${parseFloat(order.sub_total||0).toFixed(2)}</span></div>
            <div className="pp-inv-total-row"><span>Tax</span><span>${parseFloat(order.tax||0).toFixed(2)}</span></div>
            <div className="pp-inv-total-row pp-inv-grand"><span>Total Due</span><span>${parseFloat(order.total||0).toFixed(2)}</span></div>
          </div>

          {order.notes && <p className="pp-inv-notes"><strong>Notes:</strong> {order.notes}</p>}

          <p className="pp-inv-footer">Thank you for your partnership. Payment is due within 30 days.</p>
        </div>
      </div>
    </div>
  );
}

// ── AccountTab ────────────────────────────────────────────────────
function AccountTab({ profile, onLogout }) {
  if (!profile) return <div className="pp-empty"><div className="pp-spinner-lg"/></div>;
  const { user, application } = profile;
  return (
    <div className="pp-account">
      <div className="pp-acct-card">
        <div className="pp-acct-avatar">{(user.name||'P').charAt(0).toUpperCase()}</div>
        <div>
          <p className="pp-acct-name">{user.name}</p>
          <p className="pp-acct-email">{user.email}</p>
          {user.phone_number && <p className="pp-acct-phone">{user.phone_number}</p>}
        </div>
        <button className="pp-logout-btn" onClick={onLogout}><LogOut size={14}/> Sign Out</button>
      </div>

      {application && (
        <div className="pp-biz-card">
          <h3 className="pp-biz-title">Business Details</h3>
          <div className="pp-biz-grid">
            {[
              ['Business Name', application.business_name],
              ['Contact', application.contact_name],
              ['EIN', application.ein_number],
              ['Phone', application.phone],
              ['Price Tier', TIER_LABELS[application.price_tier] || application.price_tier || 'Standard'],
              ['Partner Since', new Date(application.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})],
            ].map(([label, value]) => value ? (
              <div key={label} className="pp-biz-field">
                <span className="pp-biz-label">{label}</span>
                <span className="pp-biz-value">{value}</span>
              </div>
            ) : null)}
          </div>
          <div className="pp-biz-address">
            <span className="pp-biz-label">Business Address</span>
            <p className="pp-biz-value">{application.address || '—'}</p>
          </div>
        </div>
      )}

      <div className="pp-acct-actions">
        <a href="/account" className="pp-acct-link"><ChevronRight size={14}/> Account Settings</a>
        <a href="mailto:partners@habibihe.com" className="pp-acct-link"><ChevronRight size={14}/> Contact Account Manager</a>
      </div>
    </div>
  );
}

// ── Main PartnerPortal ────────────────────────────────────────────
const TABS = [
  { id: 'catalog', icon: <Package size={16}/>,        label: 'Catalog' },
  { id: 'cart',    icon: <ShoppingCart size={16}/>,   label: 'Cart' },
  { id: 'orders',  icon: <ClipboardList size={16}/>,  label: 'Orders' },
  { id: 'account', icon: <User size={16}/>,           label: 'Account' },
];

export default function PartnerPortal() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]               = useState('catalog');
  const [catalog, setCatalog]       = useState(null);
  const [orders, setOrders]         = useState([]);
  const [profile, setProfile]       = useState(null);
  const [cart, setCart]             = useState(() => {
    try { return JSON.parse(localStorage.getItem('pp_cart') || '[]'); } catch { return []; }
  });
  const [loading, setLoading]       = useState({ catalog: true, orders: true, profile: true });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setSuccess]  = useState(null);
  const [invoiceOrder, setInvoice]  = useState(null);

  // Redirect if not a partner
  useEffect(() => {
    if (!isLoggedIn) { navigate('/partner/login', { replace: true }); return; }
    if (isLoggedIn && !user?.is_partner) { navigate('/partner/login', { replace: true }); }
  }, [isLoggedIn, user, navigate]);

  // Persist cart
  useEffect(() => {
    localStorage.setItem('pp_cart', JSON.stringify(cart));
  }, [cart]);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await partnerPortalAPI.getCatalog();
      setCatalog(data);
    } catch (_) {}
    setLoading(p => ({ ...p, catalog: false }));
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await partnerPortalAPI.getOrders();
      setOrders(data);
    } catch (_) {}
    setLoading(p => ({ ...p, orders: false }));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await partnerPortalAPI.getProfile();
      setProfile(data);
    } catch (_) {}
    setLoading(p => ({ ...p, profile: false }));
  }, []);

  useEffect(() => {
    if (isLoggedIn && user?.is_partner) {
      loadCatalog();
      loadOrders();
      loadProfile();
    }
  }, [isLoggedIn, user, loadCatalog, loadOrders, loadProfile]);

  // Cart helpers
  const addToCart = (item, qty) => {
    const price = parseFloat(item.display_price || item.partner_price || item.price || 0);
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.source === item.source);
      if (existing) return prev.map(c => c.id === item.id && c.source === item.source ? { ...c, qty: c.qty + qty } : c);
      return [...prev, { id: item.id, name: item.name, price, qty, unit: item.unit, source: item.source }];
    });
  };

  const removeFromCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.source === item.source);
      if (!existing) return prev;
      if (existing.qty <= (item.min_quantity || 1)) return prev.filter(c => !(c.id === item.id && c.source === item.source));
      return prev.map(c => c.id === item.id && c.source === item.source ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const changeQty = (item, newQty) => {
    if (newQty <= 0) setCart(prev => prev.filter(c => !(c.id === item.id && c.source === item.source)));
    else setCart(prev => prev.map(c => c.id === item.id && c.source === item.source ? { ...c, qty: newQty } : c));
  };

  const submitOrder = async (payload) => {
    setSubmitting(true);
    try {
      const order = await partnerPortalAPI.placeOrder(payload);
      setCart([]);
      setSuccess(order);
      setTab('orders');
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  if (!isLoggedIn || !user?.is_partner) return null;

  return (
    <div className="pp-shell">
      {/* Sidebar */}
      <aside className="pp-sidebar">
        <div className="pp-sidebar-brand">
          <div className="pp-sidebar-icon"><Briefcase size={18}/></div>
          <div>
            <p className="pp-sidebar-title">Partner Portal</p>
            <p className="pp-sidebar-sub">{user.business_name || 'Business Account'}</p>
          </div>
        </div>

        <nav className="pp-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`pp-nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.id === 'cart' && cartCount > 0 && (
                <span className="pp-cart-badge">{cartCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="pp-sidebar-footer">
          <span className="pp-tier-pill">{TIER_LABELS[user.price_tier || 'tier_1'] || 'Standard'} Partner</span>
        </div>
      </aside>

      {/* Main */}
      <main className="pp-main">
        <div className="pp-topbar">
          <h1 className="pp-page-title">
            {tab === 'catalog' && 'Product Catalog'}
            {tab === 'cart'    && `Cart (${cartCount} item${cartCount!==1?'s':''})`}
            {tab === 'orders'  && 'Order History'}
            {tab === 'account' && 'My Account'}
          </h1>
          {tab === 'catalog' && !loading.catalog && catalog && (
            <span className="pp-topbar-note">Prices shown reflect your partner tier</span>
          )}
        </div>

        <div className="pp-content">
          {/* Order success banner */}
          {orderSuccess && (
            <div className="pp-success-banner">
              <CheckCircle size={18}/>
              <span>Order <strong>{orderSuccess.order_number}</strong> placed successfully! We'll confirm it within 1 business day.</span>
              <button onClick={() => setSuccess(null)}><X size={14}/></button>
            </div>
          )}

          {tab === 'catalog' && (
            loading.catalog
              ? <div className="pp-empty"><div className="pp-spinner-lg"/></div>
              : catalog
                ? <CatalogTab catalog={catalog} cart={cart} onAdd={addToCart} onRemove={removeFromCart} />
                : <div className="pp-empty"><AlertCircle size={40}/><p>Could not load catalog</p></div>
          )}

          {tab === 'cart' && (
            <CartTab
              cart={cart}
              onQtyChange={changeQty}
              onRemove={removeFromCart}
              onClear={() => setCart([])}
              onSubmit={submitOrder}
              submitting={submitting}
            />
          )}

          {tab === 'orders' && (
            <OrdersTab
              orders={orders}
              loading={loading.orders}
              onRefresh={loadOrders}
              onInvoice={async (o) => {
                try {
                  const full = await partnerPortalAPI.getInvoice(o.id);
                  setInvoice(full);
                } catch (_) {
                  setInvoice(o);
                }
              }}
            />
          )}

          {tab === 'account' && (
            <AccountTab
              profile={loading.profile ? null : profile}
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>

      {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoice(null)} />}
    </div>
  );
}
