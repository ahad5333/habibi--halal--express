import React, { useState, useEffect } from 'react';
import { Save, CreditCard, ToggleLeft, ToggleRight, Lock, Eye, EyeOff } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Settings.css';

function IntegrationsSection() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    adminAPI.integrationStatus()
      .then(d => setIntegrations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="settings-section">
      <div className="settings-section-hdr">
        <p className="settings-section-title">Integrations</p>
        <p className="settings-section-sub">Third-party service connection status — derived from server environment variables.</p>
      </div>
      <div className="integrations-list">
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : integrations.map(int => (
          <div key={int.name} className="integration-row card">
            <div>
              <p style={{fontWeight:600,fontSize:'0.88rem'}}>{int.name}</p>
              <p className="text-muted" style={{fontSize:'0.72rem'}}>{int.detail}</p>
            </div>
            <span className={`badge ${int.status === 'configured' ? 'badge-success' : 'badge-warning'}`}>
              {int.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SystemSettingsSection() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    fetch('/api/settings/checkout', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCfg(d))
      .catch(() => {});
  }, []);

  const rows = cfg ? [
    { label: 'Tax Rate',              value: `${(cfg.tax_rate * 100).toFixed(3)}%` },
    { label: 'Service Fee',           value: `${(cfg.service_fee_rate * 100).toFixed(3)}%` },
    { label: 'Base Delivery Fee',     value: `$${parseFloat(cfg.delivery_fee).toFixed(2)}` },
    { label: 'Free Delivery Threshold', value: `$${parseFloat(cfg.free_delivery_threshold).toFixed(2)}` },
  ] : [];

  return (
    <section className="settings-section">
      <div className="settings-section-hdr">
        <p className="settings-section-title">System Settings</p>
        <p className="settings-section-sub">Read-only — update TAX_RATE, SERVICE_FEE_RATE, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD in your server .env to change these values.</p>
      </div>
      {!cfg ? (
        <div className="empty" style={{minHeight:80}}><div className="spinner" /></div>
      ) : (
        <div className="card" style={{padding:'0.75rem 1rem'}}>
          <table className="table" style={{marginBottom:0}}>
            <tbody>
              {rows.map(r => (
                <tr key={r.label}>
                  <td style={{fontWeight:600,fontSize:'0.85rem',width:220}}>{r.label}</td>
                  <td className="mono" style={{fontSize:'0.85rem'}}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Settings() {
  const [tiers, setTiers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(null);
  const [saved, setSaved]               = useState(null);

  const [payMethods, setPayMethods]     = useState([]);
  const [pmLoading, setPmLoading]       = useState(true);
  const [pmToggling, setPmToggling]     = useState(null);

  const [pwForm, setPwForm]   = useState({ current: '', newPw: '', confirm: '' });
  const [pwShow, setPwShow]   = useState({ current: false, newPw: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await adminAPI.changePassword(pwForm.current, pwForm.newPw);
      setPwSuccess('Password updated successfully.');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setPwSuccess(''), 4000);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
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

      {/* Security — Change Password */}
      <section className="settings-section">
        <div className="settings-section-hdr">
          <p className="settings-section-title">Security</p>
          <p className="settings-section-sub">Change your admin account password.</p>
        </div>
        <div className="card" style={{padding:'1.25rem'}}>
          <form onSubmit={handleChangePassword} style={{display:'flex',flexDirection:'column',gap:'0.875rem',maxWidth:360}}>
            {pwError   && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:6,padding:'0.45rem 0.75rem',fontSize:'0.8rem',color:'#f87171'}}>⚠ {pwError}</div>}
            {pwSuccess && <div style={{background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.35)',borderRadius:6,padding:'0.45rem 0.75rem',fontSize:'0.8rem',color:'#4ade80'}}>✓ {pwSuccess}</div>}

            {[
              { key: 'current', label: 'Current Password',     complete: 'current-password' },
              { key: 'newPw',   label: 'New Password',         complete: 'new-password' },
              { key: 'confirm', label: 'Confirm New Password', complete: 'new-password' },
            ].map(({ key, label, complete }) => (
              <div className="field" key={key}>
                <label style={{fontSize:'0.78rem'}}>{label}</label>
                <div style={{position:'relative'}}>
                  <input
                    type={pwShow[key] ? 'text' : 'password'}
                    className="input"
                    value={pwForm[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                    required
                    minLength={key !== 'current' ? 8 : undefined}
                    autoComplete={complete}
                    style={{paddingRight:'2.4rem'}}
                  />
                  <button
                    type="button"
                    onClick={() => setPwShow(p => ({ ...p, [key]: !p[key] }))}
                    style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#888',cursor:'pointer',lineHeight:1,padding:0}}
                  >
                    {pwShow[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}

            <button type="submit" className="btn btn-primary btn-sm" disabled={pwLoading} style={{alignSelf:'flex-start',gap:6}}>
              {pwLoading
                ? <span className="spinner" style={{width:12,height:12}} />
                : <><Lock size={13} /> Update Password</>}
            </button>
          </form>
        </div>
      </section>

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
      <IntegrationsSection />

      {/* System Settings (read-only — sourced from env vars) */}
      <SystemSettingsSection />
    </div>
  );
}
