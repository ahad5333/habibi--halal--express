import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Tag } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Coupons.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const DISCOUNT_TYPES = [
  { value: 'percentage',           label: 'Percentage Off (%)',               needsValue: true,  needsCategory: false },
  { value: 'fixed_amount',         label: 'Fixed Amount Off ($)',              needsValue: true,  needsCategory: false },
  { value: 'free_delivery',        label: 'Free Delivery',                    needsValue: false, needsCategory: false },
  { value: 'bogo',                 label: 'Buy One Get One Free (no Family Tray)', needsValue: false, needsCategory: false },
  { value: 'bogo_half',            label: 'Buy One Get One 50% Off (no Family Tray)', needsValue: false, needsCategory: false },
  { value: 'free_item',            label: 'Free Item (cheapest in cart)',     needsValue: false, needsCategory: false },
  { value: 'free_item_from_category', label: 'Free Item from Category',      needsValue: false, needsCategory: true  },
];

const EMPTY = { code:'', discount_type:'percentage', discount_value:'', min_order:'', max_uses:'', valid_from:'', expires_at:'', customer_email:'', location_id:'', free_item_category:'' };

function CouponModal({ onClose, onCreate }) {
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [locations, setLocations] = useState([]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    adminAPI.getLocations().then(d => setLocations(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const needsValue = DISCOUNT_TYPES.find(dt => dt.value === form.discount_type)?.needsValue;
    if (!form.code.trim()) { setError('Coupon code is required.'); return; }
    if (needsValue && !form.discount_value) { setError('Discount value is required for this type.'); return; }
    setSaving(true); setError('');
    try { await onCreate(form); onClose(); }
    catch (err) { setError(err.message || 'Failed to create coupon.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">Create Coupon</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="menu-error">⚠ {error}</div>}
            <div className="field">
              <label>Coupon Code *</label>
              <input className="input" style={{textTransform:'uppercase',letterSpacing:'0.1em'}} placeholder="HABIBI20" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} required />
            </div>
            <div className="coupon-row">
              <div className="field">
                <label>Discount Type</label>
                <select className="input select" value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                  {DISCOUNT_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              {DISCOUNT_TYPES.find(dt => dt.value === form.discount_type)?.needsValue && (
                <div className="field">
                  <label>Value *</label>
                  <input type="number" min="0" step="0.01" className="input" placeholder={form.discount_type==='percentage'?'20':'5.00'} value={form.discount_value} onChange={e => set('discount_value', e.target.value)} required />
                </div>
              )}
              {DISCOUNT_TYPES.find(dt => dt.value === form.discount_type)?.needsCategory && (
                <div className="field">
                  <label>Free Item Category *</label>
                  <input className="input" placeholder="e.g. Drinks" value={form.free_item_category} onChange={e => set('free_item_category', e.target.value)} required />
                </div>
              )}
            </div>
            <div className="coupon-row">
              <div className="field">
                <label>Min Order ($)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.min_order} onChange={e => set('min_order', e.target.value)} />
              </div>
              <div className="field">
                <label>Max Uses</label>
                <input type="number" min="1" className="input" placeholder="Unlimited" value={form.max_uses} onChange={e => set('max_uses', e.target.value)} />
              </div>
            </div>
            <div className="coupon-row">
              <div className="field">
                <label>Start Date</label>
                <input type="date" className="input" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
              </div>
              <div className="field">
                <label>Expiry Date</label>
                <input type="date" className="input" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
              </div>
            </div>
            <div style={{borderTop:'1px solid var(--color-border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
              <p style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Restrictions (optional)</p>
              <div className="coupon-row">
                <div className="field">
                  <label>Specific Customer Email</label>
                  <input type="email" className="input" placeholder="only@customer.com" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
                </div>
                <div className="field">
                  <label>Restrict to Location</label>
                  <select className="input select" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                    <option value="">All locations</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" style={{width:14,height:14}} /> : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);

  useEffect(() => {
    // Use coupon-stats endpoint for usage data; fall back to plain coupons
    adminAPI.couponStats()
      .then(d => setCoupons(Array.isArray(d) ? d : []))
      .catch(() => adminAPI.coupons().then(d => setCoupons(Array.isArray(d) ? d : [])))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form) => {
    const created = await adminAPI.createCoupon(form);
    setCoupons(prev => [created, ...prev]);
  };

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggleCoupon(id);
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await adminAPI.deleteCoupon(id); setCoupons(prev => prev.filter(c => c.id !== id)); }
    catch (_) {}
  };

  return (
    <div className="coupons-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Coupons</p>
          <p className="page-sub">{coupons.length} codes · {coupons.filter(c=>c.is_active).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Create Coupon</button>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : coupons.length === 0 ? (
          <div className="empty"><Tag size={36} /><p>No coupons yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Uses (Limit)</th>
                  <th>Total Saved</th>
                  <th>Starts</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{fontWeight:600,letterSpacing:'0.08em'}}>{c.code}</td>
                    <td style={{fontWeight:600,color:'var(--color-primary)'}}>
                      {c.discount_type === 'percentage'    ? `${c.discount_value}% off` :
                       c.discount_type === 'fixed_amount'  ? `$${parseFloat(c.discount_value||0).toFixed(2)} off` :
                       c.discount_type === 'free_delivery' ? '🚚 Free Delivery' :
                       c.discount_type === 'bogo'          ? 'BOGO Free' :
                       c.discount_type === 'bogo_half'     ? 'BOGO 50%' :
                       c.discount_type === 'free_item'     ? '🎁 Free Item' :
                       c.discount_type}
                    </td>
                    <td className="text-muted">{c.condition_value > 0 ? `$${parseFloat(c.condition_value).toFixed(2)}` : '—'}</td>
                    <td>
                      <span style={{fontWeight:600}}>{c.actual_uses ?? c.used_count ?? 0}</span>
                      <span className="text-muted"> / {c.usage_limit || '∞'}</span>
                    </td>
                    <td className="text-error" style={{fontWeight:600}}>
                      {c.total_saved > 0 ? `-$${parseFloat(c.total_saved).toFixed(2)}` : '—'}
                    </td>
                    <td className="text-muted" style={{fontSize:'0.72rem'}}>
                      {c.valid_from ? fmtDateShort(c.valid_from) : '—'}
                    </td>
                    <td className="text-muted" style={{fontSize:'0.72rem'}}>
                      {c.expiry_date || c.valid_until ? fmtDateShort(c.expiry_date || c.valid_until) : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {c.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:'0.4rem',justifyContent:'flex-end'}}>
                        <button className="btn btn-ghost btn-icon" onClick={() => handleToggle(c.id)} title={c.is_active ? 'Disable' : 'Enable'}>
                          {c.is_active ? <ToggleRight size={16} style={{color:'var(--color-success)'}} /> : <ToggleLeft size={16} />}
                        </button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDelete(c.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <CouponModal onClose={() => setModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
