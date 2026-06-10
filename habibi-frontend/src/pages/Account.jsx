import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, MapPin, CreditCard, ShoppingBag, LogOut,
  Edit3, Check, X, Plus, Trash2, ChevronRight, ChevronDown,
  Clock, Shield, Star, Lock, AlertTriangle, RefreshCw,
  Package, Printer, Eye, RotateCcw, Gift, Bell, Heart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { userAPI, savedPaymentsAPI, notificationsAPI, favoritesAPI, reviewsAPI } from '../services/api';
import './Account.css';

const TABS = [
  { id: 'profile',       label: 'Profile',          icon: <User size={16} /> },
  { id: 'orders',        label: 'Order History',     icon: <ShoppingBag size={16} /> },
  { id: 'addresses',     label: 'Saved Addresses',   icon: <MapPin size={16} /> },
  { id: 'payment',       label: 'Payment Methods',   icon: <CreditCard size={16} /> },
  { id: 'notifications', label: 'Notifications',     icon: <Bell size={16} /> },
  { id: 'favorites',     label: 'Saved Items',        icon: <Heart size={16} /> },
];

const STATUS_COLOR = {
  pending:     '#E5B64E',
  accepted:    '#3b82f6',
  preparing:   '#f59e0b',
  on_the_way:  '#8b5cf6',
  nearby:      '#f97316',
  delivered:   '#22c55e',
  completed:   '#22c55e',
  cancelled:   '#ef4444',
  refunded:    '#a3a3a3',
};

function StatusBadge({ status }) {
  const color = STATUS_COLOR[(status || '').toLowerCase()] || '#a3a3a3';
  return (
    <span className="acct-order-status" style={{ color, background: color + '18' }}>
      {(status || 'pending').replace(/_/g, ' ')}
    </span>
  );
}

// ── Birthday Coupon Banner ────────────────────────────────────────────────────
function BirthdayCouponBanner() {
  const [coupon, setCoupon] = useState(() => {
    try { return JSON.parse(localStorage.getItem('habibi_birthday_coupon') || 'null'); } catch { return null; }
  });
  const [copied, setCopied] = useState(false);

  if (!coupon) return null;

  const dismiss = () => {
    localStorage.removeItem('habibi_birthday_coupon');
    setCoupon(null);
  };

  const copy = () => {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="birthday-banner">
      <span className="birthday-banner-emoji">🎂</span>
      <div className="birthday-banner-body">
        <p className="birthday-banner-title">Happy Birthday! Here's your gift 🎁</p>
        <p className="birthday-banner-sub">Use code <strong>{coupon.code}</strong> for {coupon.discount_value}% off your order. Valid until {coupon.expiry_date}.</p>
      </div>
      <button className="birthday-banner-copy" onClick={copy}>{copied ? 'Copied!' : 'Copy Code'}</button>
      <button className="birthday-banner-close" onClick={dismiss}><X size={14} /></button>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, logout, refreshUser }) {
  const navigate = useNavigate();
  const [editing, setEditing]       = useState(false);
  const [name, setName]             = useState('');
  const [phone, setPhone]           = useState('');
  const [dob, setDob]               = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  const [pwOpen, setPwOpen]         = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw]     = useState('');
  const [deleting, setDeleting]     = useState(false);
  const [deleteErr, setDeleteErr]   = useState('');

  // Load fresh profile data including loyalty points
  useEffect(() => {
    userAPI.getProfile().then(p => {
      setName(p.name || '');
      setPhone(p.phone_number || '');
      setDob(p.date_of_birth ? p.date_of_birth.slice(0, 10) : '');
      setLoyaltyPoints(p.loyalty_points || 0);
    }).catch(() => {
      setName(user?.name || '');
      setPhone(user?.phone || '');
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const updated = await userAPI.updateProfile({ name, phone_number: phone, date_of_birth: dob || null });
      refreshUser({ name: updated.name, phone_number: updated.phone_number });
      setEditing(false);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg('Error: ' + (err.message || 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('Passwords do not match.'); return; }
    if (newPw.length < 6)    { setPwMsg('Min. 6 characters.'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await userAPI.changePassword(currentPw, newPw);
      setPwMsg('Password updated!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwOpen(false); setPwMsg(''); }, 2000);
    } catch (err) {
      setPwMsg(err.message || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true); setDeleteErr('');
    try {
      await userAPI.deleteAccount(deletePw);
      logout();
      navigate('/');
    } catch (err) {
      setDeleteErr(err.message || 'Incorrect password.');
    } finally {
      setDeleting(false);
    }
  };

  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="acct-profile">
      <BirthdayCouponBanner />
      {/* Avatar + name row */}
      <div className="acct-avatar-row">
        <div className="acct-avatar">{initial}</div>
        <div>
          <p className="acct-profile-name">{user?.name || 'Guest'}</p>
          <p className="acct-profile-role">{user?.role === 'admin' ? 'Administrator' : 'Member'}</p>
        </div>
        <button className="acct-edit-btn" onClick={() => { setEditing(e => !e); setSaveMsg(''); }}>
          {editing ? <X size={15} /> : <Edit3 size={15} />}
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Fields */}
      <div className="acct-fields">
        <div className="acct-field">
          <label>Full Name</label>
          {editing
            ? <input className="acct-input" value={name} onChange={e => setName(e.target.value)} />
            : <p>{name || '—'}</p>}
        </div>
        <div className="acct-field">
          <label>Email Address</label>
          <p className="acct-field-locked">{user?.email || '—'} <Lock size={11} /></p>
        </div>
        <div className="acct-field">
          <label>Phone Number</label>
          {editing
            ? <input type="tel" className="acct-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (718) 000-0000" />
            : <p>{phone || '—'}</p>}
        </div>
        <div className="acct-field">
          <label>Date of Birth <span style={{fontSize:'0.72rem',color:'var(--color-text-muted)',fontWeight:400}}>(optional — for birthday reward)</span></label>
          {editing
            ? <input type="date" className="acct-input" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().slice(0,10)} />
            : <p>{dob ? new Date(dob + 'T00:00:00').toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'}) : '—'}</p>}
        </div>
      </div>

      {editing && (
        <button className="btn btn-primary acct-save-btn" onClick={handleSave} disabled={saving}>
          <Check size={15} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      )}
      {saveMsg && <p className={`acct-inline-msg ${saveMsg.startsWith('Error') ? 'err' : 'ok'}`}>{saveMsg}</p>}

      {/* Badges */}
      <div className="acct-badges">
        <div className="acct-badge"><Shield size={14} /><span>Verified Account</span></div>
        <div className="acct-badge"><Star size={14} /><span>Halal Loyalty Member</span></div>
      </div>

      {/* Loyalty Card */}
      <div className="acct-loyalty-card">
        <div className="acct-loyalty-top">
          <div className="acct-loyalty-icon"><Gift size={18} /></div>
          <div>
            <p className="acct-loyalty-label">Habibi Rewards</p>
            <p className="acct-loyalty-sub">10 pts per $1 · 100 pts = $1 off</p>
          </div>
          <div className="acct-loyalty-pts">{loyaltyPoints.toLocaleString()}<span> pts</span></div>
        </div>
        <div className="acct-loyalty-bar-track">
          <div
            className="acct-loyalty-bar-fill"
            style={{ width: `${Math.min((loyaltyPoints % 100) / 100 * 100, 100)}%` }}
          />
        </div>
        <div className="acct-loyalty-footer">
          <span className="acct-loyalty-value">${(Math.floor(loyaltyPoints / 100)).toFixed(0)} redeemable</span>
          <span className="acct-loyalty-next">
            {loyaltyPoints % 100 === 0 && loyaltyPoints > 0
              ? 'Reward available!'
              : `${100 - (loyaltyPoints % 100)} pts to next $1 off`}
          </span>
        </div>
      </div>

      {/* Change password */}
      <button className="acct-secondary-btn" onClick={() => setPwOpen(o => !o)}>
        <Lock size={14} /> {pwOpen ? 'Cancel Password Change' : 'Change Password'}
      </button>

      {pwOpen && (
        <form className="acct-pw-form" onSubmit={handleChangePassword}>
          <input
            type="password" className="acct-input" placeholder="Current password"
            value={currentPw} onChange={e => setCurrentPw(e.target.value)} required
          />
          <input
            type="password" className="acct-input" placeholder="New password (min 6)"
            value={newPw} onChange={e => setNewPw(e.target.value)} required
          />
          <input
            type="password" className="acct-input" placeholder="Confirm new password"
            value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
          />
          {pwMsg && <p className={`acct-inline-msg ${pwMsg.includes('!') ? 'ok' : 'err'}`}>{pwMsg}</p>}
          <button type="submit" className="btn btn-primary acct-save-btn" disabled={pwSaving}>
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}

      {/* Sign out */}
      <button className="acct-logout-btn" onClick={logout}>
        <LogOut size={15} /> Sign Out
      </button>

      {/* Delete account */}
      <div className="acct-danger-zone">
        <button className="acct-delete-trigger" onClick={() => setDeleteOpen(o => !o)}>
          <AlertTriangle size={14} /> Delete Account
        </button>
        {deleteOpen && (
          <div className="acct-delete-confirm">
            <p className="acct-delete-warn">
              This is permanent. Your account will be anonymised to comply with GDPR. Your order history will be preserved for our records.
            </p>
            <input
              type="password" className="acct-input" placeholder="Confirm with your password"
              value={deletePw} onChange={e => setDeletePw(e.target.value)}
            />
            {deleteErr && <p className="acct-inline-msg err">{deleteErr}</p>}
            <button className="acct-delete-btn" onClick={handleDeleteAccount} disabled={deleting || !deletePw}>
              {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onReorder }) {
  const items = order.items || [];
  const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
  const dateStr = order.placed_at
    ? new Date(order.placed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const handlePrint = () => {
    const rows = items.map(i => {
      const q = i.qty || i.quantity || 1;
      return `<div class="row"><span>${esc(q)}x ${esc(i.name)}</span><span>${fmt(parseFloat(i.price || i.unit_price || 0) * q)}</span></div>`;
    }).join('');
    const addr = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip]
      .filter(Boolean).map(esc).join(', ');
    const html = `<!DOCTYPE html><html><head><title>Receipt #${esc(order.order_number)}</title>
      <style>body{font-family:monospace;font-size:12px;max-width:340px;margin:0 auto;padding:20px}
      h2,p.c{text-align:center;margin:4px 0}.d{border-top:1px dashed #555;margin:10px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0}.bold{font-weight:700}.lg{font-size:14px}</style>
      </head><body>
      <h2>HABIBI HALAL EXPRESS</h2><p class="c">204 E Mosholu Pkwy S, Bronx, NY</p>
      <div class="d"></div>
      <p class="c">Order #${esc(order.order_number)}</p><p class="c">${esc(dateStr)}</p>
      <p class="c">${order.delivery_method === 'delivery' ? 'Delivery' : 'Pickup'}</p>
      <div class="d"></div>${rows}<div class="d"></div>
      <div class="row"><span>Subtotal</span><span>${fmt(order.sub_total)}</span></div>
      ${parseFloat(order.tax||0)>0?`<div class="row"><span>Tax</span><span>${fmt(order.tax)}</span></div>`:''}
      ${parseFloat(order.service_fee||0)>0?`<div class="row"><span>Service fee</span><span>${fmt(order.service_fee)}</span></div>`:''}
      ${parseFloat(order.delivery_fee||0)>0?`<div class="row"><span>Delivery</span><span>${fmt(order.delivery_fee)}</span></div>`:''}
      ${parseFloat(order.tip||0)>0?`<div class="row"><span>Tip</span><span>${fmt(order.tip)}</span></div>`:''}
      ${parseFloat(order.discount||0)>0?`<div class="row"><span>Discount</span><span>-${fmt(order.discount)}</span></div>`:''}
      <div class="d"></div>
      <div class="row bold lg"><span>TOTAL</span><span>${fmt(order.total)}</span></div>
      ${addr?`<div class="d"></div><p class="c">${addr}</p>`:''}
      <div class="d"></div><p class="c">Thank you for your order!</p>
      </body></html>`;
    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) { alert('Please allow popups to print your receipt.'); return; }
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div className="acct-receipt-overlay" onClick={onClose}>
      <div className="acct-receipt-modal" onClick={e => e.stopPropagation()}>
        <button className="acct-receipt-close" onClick={onClose}><X size={18} /></button>

        <div className="acct-receipt-head">
          <div>
            <p className="acct-receipt-num">#{order.order_number}</p>
            <p className="acct-receipt-date"><Clock size={12} /> {dateStr}</p>
          </div>
          <StatusBadge status={order.order_status} />
        </div>

        <p className="acct-receipt-method">
          {order.delivery_method === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}
          {order.payment_method && <span className="acct-receipt-pay"> · {order.payment_method}</span>}
        </p>

        <div className="acct-receipt-divider" />

        <div className="acct-receipt-items">
          {items.length === 0 && <p className="acct-receipt-empty">No item details available.</p>}
          {items.map((item, idx) => {
            const q = item.qty || item.quantity || 1;
            const p = parseFloat(item.price || item.unit_price || 0);
            return (
              <div key={idx} className="acct-receipt-item">
                <span className="acct-receipt-item-qty">{q}×</span>
                <span className="acct-receipt-item-name">{item.name}</span>
                <span className="acct-receipt-item-price">{fmt(p * q)}</span>
              </div>
            );
          })}
        </div>

        <div className="acct-receipt-divider" />

        <div className="acct-receipt-totals">
          <div className="acct-receipt-row"><span>Subtotal</span><span>{fmt(order.sub_total)}</span></div>
          {parseFloat(order.tax||0) > 0 && <div className="acct-receipt-row"><span>Tax</span><span>{fmt(order.tax)}</span></div>}
          {parseFloat(order.service_fee||0) > 0 && <div className="acct-receipt-row"><span>Service fee</span><span>{fmt(order.service_fee)}</span></div>}
          {parseFloat(order.delivery_fee||0) > 0 && <div className="acct-receipt-row"><span>Delivery</span><span>{fmt(order.delivery_fee)}</span></div>}
          {parseFloat(order.tip||0) > 0 && <div className="acct-receipt-row"><span>Tip</span><span>{fmt(order.tip)}</span></div>}
          {parseFloat(order.discount||0) > 0 && <div className="acct-receipt-row discount"><span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>−{fmt(order.discount)}</span></div>}
          <div className="acct-receipt-row total"><span>Total</span><span>{fmt(order.total)}</span></div>
        </div>

        {order.delivery_method === 'delivery' && (order.delivery_address || order.delivery_city) && (
          <>
            <div className="acct-receipt-divider" />
            <p className="acct-receipt-addr-label">Delivered to</p>
            <p className="acct-receipt-addr">
              {[order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_zip].filter(Boolean).join(', ')}
            </p>
          </>
        )}

        <div className="acct-receipt-divider" />

        <div className="acct-receipt-actions">
          <button className="acct-receipt-btn print" onClick={handlePrint}>
            <Printer size={14} /> Print Receipt
          </button>
          <button className="acct-receipt-btn reorder" onClick={() => onReorder(order)}>
            <RotateCcw size={14} /> Order Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ order, onClose, onSubmitted }) {
  const [rating, setRating]     = useState(0);
  const [hover, setHover]       = useState(0);
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    setLoading(true); setError('');
    try {
      await reviewsAPI.submit({
        order_number: order.order_number,
        rating,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      onSubmitted?.(order.order_number);
    } catch (err) {
      setError(err.message || 'Could not submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="acct-modal-overlay" onClick={onClose}>
      <div className="acct-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⭐</div>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-text-main)' }}>Thank you!</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Your review has been submitted and is pending approval.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="acct-modal-header">
              <h3 className="acct-modal-title">Rate Your Order</h3>
              <button type="button" className="acct-modal-close" onClick={onClose}><X size={18} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Order #{order.order_number}
              </p>

              {/* Star rating */}
              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem' }}>
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '2rem', padding: '0.1rem',
                      color: s <= (hover || rating) ? '#E5B64E' : 'var(--color-border)',
                      transition: 'color 0.15s',
                    }}
                    aria-label={`${s} star${s > 1 ? 's' : ''}`}
                  >★</button>
                ))}
                {rating > 0 && (
                  <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#E5B64E', marginLeft: '0.5rem', fontWeight: 600 }}>
                    {['','Poor','Fair','Good','Great','Excellent'][rating]}
                  </span>
                )}
              </div>

              {/* Comment */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">YOUR REVIEW <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
                <textarea
                  className="form-input"
                  rows={4}
                  maxLength={1000}
                  placeholder="Tell us about your experience — food quality, delivery speed, packaging…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
                  {comment.length}/1000
                </p>
              </div>

              {error && <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠ {error}</p>}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
                  {loading ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [expandedOrder, setExpanded]   = useState(null);
  const [reviewOrder, setReviewOrder]   = useState(null);
  const [reviewedOrders, setReviewed]   = useState(new Set());

  const load = useCallback(() => {
    setLoading(true); setError('');
    userAPI.getOrders()
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message || 'Could not load orders.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReorder = (order) => {
    (order.items || []).forEach(item =>
      addItem({ id: item.id || item.menuItemId || item.menu_item_id, name: item.name, price: parseFloat(item.price || item.unit_price) || 0, qty: item.qty || item.quantity || 1, img: item.img || null, tag: item.tag || '' })
    );
    setExpanded(null);
    navigate('/cart');
  };

  if (loading) return <div className="acct-empty"><div className="acct-spinner" /></div>;

  if (error) return (
    <div className="acct-empty">
      <p className="acct-empty-err">{error}</p>
      <button className="btn btn-outline" onClick={load}><RefreshCw size={14} /> Retry</button>
    </div>
  );

  if (orders.length === 0) return (
    <div className="acct-empty">
      <Package size={40} className="acct-empty-icon" />
      <p>No orders yet.</p>
      <Link to="/menu" className="btn btn-primary">Browse Menu</Link>
    </div>
  );

  return (
    <>
      <div className="acct-orders">
        {orders.map(o => {
          const itemNames = (o.items || []).map(i => i.name || '').filter(Boolean);
          const dateStr = o.placed_at
            ? new Date(o.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—';
          return (
            <div key={o.order_number} className="acct-order-card">
              <div className="acct-order-top">
                <div>
                  <p className="acct-order-id">#{o.order_number}</p>
                  <p className="acct-order-date"><Clock size={12} /> {dateStr}</p>
                </div>
                <StatusBadge status={o.order_status} />
              </div>
              {itemNames.length > 0 && (
                <p className="acct-order-items">
                  {itemNames.slice(0, 3).join(' · ')}
                  {itemNames.length > 3 && ` +${itemNames.length - 3} more`}
                </p>
              )}
              <div className="acct-order-bottom">
                <span className="acct-order-total">${parseFloat(o.total || 0).toFixed(2)}</span>
                <button className="acct-reorder-btn" onClick={() => handleReorder(o)}>
                  <RotateCcw size={12} /> Order Again
                </button>
                {o.order_status === 'delivered' && !reviewedOrders.has(o.order_number) && (
                  <button className="acct-track-btn" style={{ color: '#E5B64E', borderColor: 'rgba(229,182,78,0.3)' }} onClick={() => setReviewOrder(o)}>
                    <Star size={12} /> Rate
                  </button>
                )}
                {reviewedOrders.has(o.order_number) && (
                  <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>✓ Reviewed</span>
                )}
                <button className="acct-track-btn" onClick={() => setExpanded(o)}>
                  <Eye size={12} /> Details
                </button>
                <Link to={`/order-tracking?order=${o.order_number}`} className="acct-track-btn">
                  Track <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmitted={(orderNum) => {
            setReviewed(prev => new Set([...prev, orderNum]));
            setReviewOrder(null);
          }}
        />
      )}

      {expandedOrder && (
        <OrderDetailModal
          order={expandedOrder}
          onClose={() => setExpanded(null)}
          onReorder={handleReorder}
        />
      )}
    </>
  );
}

// ── Addresses Tab ─────────────────────────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ receiver_name: '', street_address: '', second_line: '', city: '', state: 'NY', zip_code: '', driver_instruction: '' });
  const [err, setErr]             = useState('');

  const load = useCallback(() => {
    setLoading(true);
    userAPI.getAddresses()
      .then(data => setAddresses(Array.isArray(data) ? data : []))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.street_address.trim() || !form.city.trim() || !form.zip_code.trim()) {
      setErr('Street address, city and ZIP are required.'); return;
    }
    setSaving(true); setErr('');
    try {
      await userAPI.addAddress(form);
      setAdding(false);
      setForm({ receiver_name: '', street_address: '', second_line: '', city: '', state: 'NY', zip_code: '', driver_instruction: '' });
      load();
    } catch (e) {
      setErr(e.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await userAPI.deleteAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (_) {}
  };

  const handleSetDefault = async (id) => {
    try {
      await userAPI.setDefaultAddress(id);
      setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    } catch (_) {}
  };

  if (loading) return <div className="acct-empty"><div className="acct-spinner" /></div>;

  return (
    <div className="acct-addresses">
      {addresses.map(a => (
        <div key={a.id} className={`acct-addr-card ${a.is_default ? 'default' : ''}`}>
          <div className="acct-addr-icon"><MapPin size={16} /></div>
          <div className="acct-addr-body">
            <p className="acct-addr-label">
              {a.receiver_name || 'Address'}
              {a.is_default && <span className="acct-default-tag">Default</span>}
            </p>
            <p className="acct-addr-line">{a.street_address}{a.second_line ? `, ${a.second_line}` : ''}</p>
            <p className="acct-addr-line muted">{[a.city, a.state, a.zip_code].filter(Boolean).join(', ')}</p>
            {a.driver_instruction && (
              <p className="acct-addr-note">📝 {a.driver_instruction}</p>
            )}
          </div>
          <div className="acct-addr-actions">
            {!a.is_default && (
              <button className="acct-link-btn" onClick={() => handleSetDefault(a.id)}>Set Default</button>
            )}
            <button className="acct-icon-btn danger" onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="acct-add-form">
          <div className="acct-add-form-row">
            <input className="acct-input" placeholder="Receiver name" value={form.receiver_name} onChange={e => setForm(f => ({ ...f, receiver_name: e.target.value }))} />
          </div>
          <input className="acct-input" placeholder="Street address *" value={form.street_address} onChange={e => setForm(f => ({ ...f, street_address: e.target.value }))} />
          <input className="acct-input" placeholder="Apt, floor, suite (optional)" value={form.second_line} onChange={e => setForm(f => ({ ...f, second_line: e.target.value }))} />
          <div className="acct-add-form-row">
            <input className="acct-input" placeholder="City *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            <input className="acct-input acct-input-sm" placeholder="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} />
            <input className="acct-input acct-input-sm" placeholder="ZIP *" value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
          </div>
          <input className="acct-input" placeholder="Driver instructions (optional)" value={form.driver_instruction} onChange={e => setForm(f => ({ ...f, driver_instruction: e.target.value }))} />
          {err && <p className="acct-inline-msg err">{err}</p>}
          <div className="acct-add-form-btns">
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              <Check size={14} /> {saving ? 'Saving…' : 'Save Address'}
            </button>
            <button className="btn btn-outline" onClick={() => { setAdding(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {addresses.length < 12 ? (
            <button className="acct-add-btn" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add New Address
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                {addresses.length}/12
              </span>
            </button>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.75rem 0' }}>
              ℹ You've reached the 12-address limit. Remove one to add a new address.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Payment Methods Tab ───────────────────────────────────────────────────────
function PaymentTab() {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);

  const BRAND_ICON = { visa: '💳', mastercard: '💳', amex: '💳', discover: '💳', paypal: '🅿️', default: '💳' };

  useEffect(() => {
    savedPaymentsAPI.getAll()
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    try {
      await savedPaymentsAPI.remove(id);
      setCards(prev => prev.filter(c => c.id !== id));
    } catch (_) {}
  };

  const handleSetDefault = async (id) => {
    try {
      await savedPaymentsAPI.setDefault(id);
      setCards(prev => prev.map(c => ({ ...c, is_default: c.id === id })));
    } catch (_) {}
  };

  if (loading) return <div className="acct-empty"><div className="acct-spinner" /></div>;

  return (
    <div className="acct-payment">
      {cards.length === 0 && (
        <div className="acct-empty">
          <CreditCard size={36} className="acct-empty-icon" />
          <p>No saved payment methods.</p>
          <p className="acct-empty-sub">Payment methods are saved automatically after your first card checkout.</p>
        </div>
      )}

      {cards.map(c => {
        const brand = (c.brand || '').toLowerCase();
        return (
          <div key={c.id} className={`acct-card-card ${c.is_default ? 'default' : ''}`}>
            <div className="acct-card-icon">
              <span>{BRAND_ICON[brand] || BRAND_ICON.default}</span>
            </div>
            <div className="acct-card-body">
              <p className="acct-card-num">
                {c.brand || 'Card'} •••• {c.last4 || '****'}
              </p>
              <p className="acct-card-exp muted">
                Exp {c.expiry || '—'}
                {c.is_default && <span className="acct-default-tag">Default</span>}
              </p>
            </div>
            <div className="acct-addr-actions">
              {!c.is_default && (
                <button className="acct-link-btn" onClick={() => handleSetDefault(c.id)}>Set Default</button>
              )}
              <button className="acct-icon-btn danger" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        );
      })}

      <div className="acct-payment-note">
        <Shield size={14} />
        <span>Cards are stored securely via Stripe. New cards are added at checkout.</span>
      </div>
    </div>
  );
}

// ── Favorites Tab ─────────────────────────────────────────────────────────────
function FavoritesTab() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoritesAPI.getAll()
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = async (menuItemId) => {
    await favoritesAPI.remove(menuItemId).catch(() => {});
    setItems(prev => prev.filter(f => f.menu_item_id !== menuItemId));
  };

  if (loading) return <div className="acct-empty"><div className="acct-spinner" /></div>;

  return (
    <div>
      <p className="acct-section-title" style={{ marginBottom: '1rem' }}>
        Saved Items <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>({items.length})</span>
      </p>
      {items.length === 0 ? (
        <div className="acct-empty">
          <Heart size={32} />
          <p>No saved items yet.</p>
          <a href="/menu" className="acct-link-btn">Browse the menu →</a>
        </div>
      ) : (
        <div className="acct-fav-grid">
          {items.map(f => (
            <div key={f.menu_item_id} className="acct-fav-card">
              {f.image_url && (
                <img src={f.image_url} alt={f.name || 'Item'} className="acct-fav-img" />
              )}
              <div className="acct-fav-info">
                <p className="acct-fav-name">{f.name || 'Menu Item'}</p>
                {f.price && <p className="acct-fav-price">${parseFloat(f.price).toFixed(2)}</p>}
              </div>
              <button className="acct-icon-btn danger" onClick={() => remove(f.menu_item_id)} title="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
// ── Push Notification Permission Toggle ───────────────────────────────────────
function PushNotificationToggle() {
  const [status, setStatus] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  const handleEnable = async () => {
    setLoading(true); setMsg('');
    const { requestPushPermission, isFirebaseConfigured } = await import('../utils/pushNotifications.js');
    if (!isFirebaseConfigured()) {
      setMsg('Push notifications are not yet configured on this server.');
      setLoading(false);
      return;
    }
    const result = await requestPushPermission();
    setLoading(false);
    if (result.ok) {
      setStatus('granted');
      setMsg('✓ Push notifications enabled! You will receive order updates in real time.');
    } else if (result.reason === 'denied') {
      setStatus('denied');
      setMsg('Notifications were blocked. Please enable them in your browser settings and try again.');
    } else {
      setMsg('Could not enable notifications. Please try again later.');
    }
  };

  if (status === 'unsupported') return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', flexWrap: 'wrap',
      background: 'rgba(229,182,78,0.05)', border: '1px solid rgba(229,182,78,0.15)',
      borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem',
    }}>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: '0 0 0.2rem', color: 'var(--color-text-main)' }}>
          🔔 Order Push Notifications
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0 }}>
          {status === 'granted'
            ? 'Enabled — you will be notified about your orders even when this tab is closed.'
            : 'Get real-time order status updates directly in your browser.'}
        </p>
        {msg && <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: status === 'granted' ? '#22c55e' : 'var(--color-text-muted)' }}>{msg}</p>}
      </div>
      {status !== 'granted' && status !== 'denied' && (
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem', whiteSpace: 'nowrap' }}
          onClick={handleEnable}
          disabled={loading}
        >
          {loading ? 'Enabling…' : 'Enable Notifications'}
        </button>
      )}
      {status === 'granted' && (
        <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>✓ Active</span>
      )}
      {status === 'denied' && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Blocked in browser settings</span>
      )}
    </div>
  );
}

function NotificationsTab() {
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setNotifs(await notificationsAPI.getAll()); }
    catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await notificationsAPI.markRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAll = async () => {
    await notificationsAPI.markAllRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unread = notifs.filter(n => !n.read).length;

  if (loading) return <div className="acct-empty"><div className="acct-spinner" /></div>;

  return (
    <div className="acct-notifs">
      <div className="acct-notifs-hdr">
        <p className="acct-section-title">
          Notifications {unread > 0 && <span className="notif-count-badge">{unread} new</span>}
        </p>
        {unread > 0 && (
          <button className="acct-link-btn" onClick={markAll}>Mark all read</button>
        )}
      </div>
      {/* Push notification permission toggle */}
      <PushNotificationToggle />

      {notifs.length === 0 ? (
        <div className="acct-empty">
          <Bell size={32} />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="acct-notifs-list">
          {notifs.map(n => (
            <div
              key={n.id}
              className={`acct-notif-item${n.read ? '' : ' unread'}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="acct-notif-dot" />
              <div className="acct-notif-body">
                <p className="acct-notif-title">{n.title}</p>
                <p className="acct-notif-text">{n.body}</p>
                <p className="acct-notif-time">
                  {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Account Page ──────────────────────────────────────────────────────────
const Account = () => {
  const { user, isLoggedIn, logout, loading, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const validTabs = TABS.map(t => t.id);
  const [activeTab, setActiveTab] = useState(validTabs.includes(initialTab) ? initialTab : 'profile');

  if (loading) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="account-page">
      <section className="acct-hero">
        <div className="acct-hero-overlay" />
        <div className="container acct-hero-content">
          <p className="acct-eyebrow">MY ACCOUNT</p>
          <h1 className="acct-hero-title">
            Welcome back, <span className="text-primary">{(user?.name || '').split(' ')[0] || 'Friend'}</span>
          </h1>
          <p className="acct-hero-sub">Manage your profile, track orders, and update your preferences.</p>
        </div>
      </section>

      <section className="section">
        <div className="container acct-layout">
          <nav className="acct-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`acct-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {activeTab === tab.id && <ChevronRight size={14} className="acct-nav-arrow" />}
              </button>
            ))}
          </nav>

          <div className="acct-content">
            {activeTab === 'profile'       && <ProfileTab user={user} logout={logout} refreshUser={refreshUser} />}
            {activeTab === 'orders'        && <OrdersTab />}
            {activeTab === 'addresses'     && <AddressesTab />}
            {activeTab === 'payment'       && <PaymentTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'favorites'     && <FavoritesTab />}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Account;
