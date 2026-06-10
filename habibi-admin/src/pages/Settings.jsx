import React, { useState, useEffect } from 'react';
import { Save, CreditCard, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Settings.css';

export default function Settings() {
  const [tiers, setTiers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(null);
  const [saved, setSaved]               = useState(null);

  const [payMethods, setPayMethods]     = useState([]);
  const [pmLoading, setPmLoading]       = useState(true);
  const [pmToggling, setPmToggling]     = useState(null);

  useEffect(() => {
    adminAPI.tiers()
      .then(d => setTiers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));

    adminAPI.paymentSettings()
      .then(d => setPayMethods(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setPmLoading(false));
  }, []);

  const updateTier = (id, key, val) => {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [key]: val } : t));
  };

  const saveTier = async (tier) => {
    setSaving(tier.id);
    try {
      await adminAPI.updateTier(tier.id, tier);
      setSaved(tier.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (_) {}
    finally { setSaving(null); }
  };

  const togglePayMethod = async (method) => {
    setPmToggling(method.id);
    const next = !method.is_active;
    setPayMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: next } : m));
    try {
      await adminAPI.updatePaymentSetting(method.id, next);
    } catch (_) {
      setPayMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: method.is_active } : m));
    } finally {
      setPmToggling(null);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Settings</p>
          <p className="page-sub">System configuration and delivery tiers</p>
        </div>
      </div>

      {/* Delivery Tiers */}
      <section className="settings-section">
        <div className="settings-section-hdr">
          <p className="settings-section-title">Delivery Tiers</p>
          <p className="settings-section-sub">Configure distance-based delivery routing to DoorDash, Uber, or in-house drivers.</p>
        </div>

        {loading ? (
          <div className="empty" style={{minHeight:120}}><div className="spinner" /></div>
        ) : tiers.length === 0 ? (
          <div className="empty" style={{minHeight:120}}><p>No delivery tiers configured</p></div>
        ) : (
          <div className="tiers-list">
            {tiers.map(tier => (
              <div key={tier.id} className="tier-card card">
                <div className="tier-top">
                  <div className="tier-range">
                    <span className="tier-range-label">Distance Range</span>
                    <div className="tier-range-inputs">
                      <input type="number" className="input" style={{width:80}} value={tier.min_distance||0} onChange={e => updateTier(tier.id,'min_distance',e.target.value)} />
                      <span className="text-muted">—</span>
                      <input type="number" className="input" style={{width:80}} value={tier.max_distance||0} onChange={e => updateTier(tier.id,'max_distance',e.target.value)} />
                      <span className="text-muted" style={{fontSize:'0.75rem'}}>miles</span>
                    </div>
                  </div>
                  <div className="field" style={{minWidth:160}}>
                    <label>Provider</label>
                    <select className="input select" value={tier.provider_type||'doordash'} onChange={e => updateTier(tier.id,'provider_type',e.target.value)}>
                      <option value="doordash">DoorDash</option>
                      <option value="uber">Uber Eats</option>
                      <option value="in-house">In-House Driver</option>
                      <option value="pickup">Pickup Only</option>
                    </select>
                  </div>
                  <div className="tier-active">
                    <label>Active</label>
                    <input type="checkbox" checked={tier.is_active !== false} onChange={e => updateTier(tier.id,'is_active',e.target.checked)} />
                  </div>
                  <button
                    className={`btn ${saved === tier.id ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    onClick={() => saveTier(tier)}
                    disabled={saving === tier.id}
                  >
                    {saving === tier.id ? <span className="spinner" style={{width:12,height:12}} /> : saved === tier.id ? '✓ Saved' : <><Save size={12} /> Save</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment Methods */}
      <section className="settings-section">
        <div className="settings-section-hdr">
          <p className="settings-section-title">Payment Methods</p>
          <p className="settings-section-sub">Enable or disable payment options shown at checkout.</p>
        </div>

        {pmLoading ? (
          <div className="empty" style={{minHeight:80}}><div className="spinner" /></div>
        ) : payMethods.length === 0 ? (
          <div className="empty" style={{minHeight:80}}><p>No payment methods found</p></div>
        ) : (
          <div className="pm-list">
            {payMethods.map(m => (
              <div key={m.id} className="pm-row card">
                <CreditCard size={16} className="text-muted" />
                <div style={{flex:1}}>
                  <p style={{fontWeight:600,fontSize:'0.88rem'}}>{m.label}</p>
                  {m.provider && <p className="text-muted" style={{fontSize:'0.72rem'}}>{m.provider}</p>}
                </div>
                <span className={`badge ${m.is_active ? 'badge-success' : 'badge-muted'}`} style={{fontSize:'0.7rem'}}>
                  {m.is_active ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  className="btn btn-ghost btn-icon"
                  title={m.is_active ? 'Disable' : 'Enable'}
                  onClick={() => togglePayMethod(m)}
                  disabled={pmToggling === m.id}
                  style={{color: m.is_active ? 'var(--color-primary)' : '#555'}}
                >
                  {pmToggling === m.id
                    ? <span className="spinner" style={{width:14,height:14}} />
                    : m.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Integrations info */}
      <section className="settings-section">
        <div className="settings-section-hdr">
          <p className="settings-section-title">Integrations</p>
          <p className="settings-section-sub">Third-party service connection status.</p>
        </div>
        <div className="integrations-list">
          {[
            { name: 'DoorDash Drive', status: 'configured', detail: 'Webhook active at /api/webhooks/doordash' },
            { name: 'Uber Eats',      status: 'configured', detail: 'Webhook active at /api/webhooks/uber' },
            { name: 'Square Payments',status: 'pending',    detail: 'API keys not yet configured in .env' },
            { name: 'Twilio SMS',     status: 'pending',    detail: 'Add TWILIO_* credentials to .env' },
          ].map(int => (
            <div key={int.name} className="integration-row card">
              <div>
                <p style={{fontWeight:600,fontSize:'0.88rem'}}>{int.name}</p>
                <p className="text-muted" style={{fontSize:'0.72rem'}}>{int.detail}</p>
              </div>
              <span className={`badge ${int.status==='configured'?'badge-success':'badge-warning'}`}>
                {int.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
