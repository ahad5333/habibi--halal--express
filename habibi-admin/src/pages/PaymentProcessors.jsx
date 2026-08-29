import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Pencil, Trash2, X, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { adminAPI } from '../services/api';
import './PaymentProcessors.css';

const PROVIDER_LABEL = { square: 'Square', clover: 'Clover', authorize_net: 'Authorize.net' };

const BLANK = {
  provider: 'square',
  nickname: '',
  environment: 'production',
  credentials: {},
};

// Field definitions per provider — `secret: true` fields get a password
// input with "leave blank to keep existing" semantics on edit, matching
// how transaction_key works on the Authorize.net Payment Accounts page.
const PROVIDER_FIELDS = {
  square: [
    { key: 'applicationId', label: 'Application ID *', placeholder: 'sq0idp-...' },
    { key: 'accessToken',   label: 'Access Token *', secret: true, hint: 'Production Access Token — secret, never shown again' },
    { key: 'locationId',    label: 'Location ID *', placeholder: 'e.g. LTPA2X0N57B1Y' },
    { key: 'mcc',           label: 'MCC', placeholder: 'e.g. 5814 (optional)' },
  ],
  clover: [
    { key: 'merchantId',  label: 'Merchant ID (MID) *', placeholder: 'e.g. 11112111111' },
    { key: 'publicToken', label: 'Public Token *', hint: 'Used client-side for card tokenization (apiAccessKey)' },
    { key: 'privateToken', label: 'Private Token *', secret: true, hint: 'Bearer credential for Ecommerce API calls — secret, never shown again' },
  ],
};

export default function PaymentProcessors() {
  const [accounts, setAccounts]     = useState([]);   // card_processor_accounts (Square/Clover)
  const [authNetAccounts, setAuthNetAccounts] = useState([]); // for the combined active banner only
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | 'add' | account object
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [deleteTarget, setDelete]   = useState(null);
  const [activating, setActivating] = useState(null);
  const [err, setErr]               = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [cardAccts, authNet] = await Promise.all([
        adminAPI.listCardProcessorAccounts(),
        adminAPI.listAuthNetAccounts().catch(() => []),
      ]);
      setAccounts(cardAccts);
      setAuthNetAccounts(authNet);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = (provider) => { setForm({ ...BLANK, provider }); setErr(''); setModal('add'); };
  const openEdit = (a) => {
    // Secret fields never come back from the list endpoint — leave them
    // blank so "unchanged" is the default unless the admin retypes them.
    setForm({ ...a, credentials: { ...a.credentials } });
    setErr('');
    setModal(a);
  };

  const fields = PROVIDER_FIELDS[form.provider] || [];
  const setCred = (key, value) => setForm(f => ({ ...f, credentials: { ...f.credentials, [key]: value } }));

  const save = async () => {
    if (!form.nickname.trim()) { setErr('Nickname is required.'); return; }
    if (modal === 'add') {
      const missing = fields.filter(f => f.label.includes('*') && !form.credentials[f.key]?.trim());
      if (missing.length) { setErr(`${missing.map(f => f.label.replace(' *', '')).join(', ')} required.`); return; }
    }
    setSaving(true); setErr('');
    try {
      if (modal === 'add') {
        await adminAPI.createCardProcessorAccount(form);
      } else {
        await adminAPI.updateCardProcessorAccount(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) { setErr(e.message || 'Save failed.'); }
    setSaving(false);
  };

  const del = async () => {
    try {
      await adminAPI.deleteCardProcessorAccount(deleteTarget.id);
      setDelete(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const activate = async (id) => {
    setActivating(id);
    try {
      await adminAPI.activateCardProcessorAccount(id);
      load();
    } catch (e) { alert(e.message); }
    setActivating(null);
  };

  // Exactly one row is active across BOTH tables (server-enforced) — find it
  // here so the banner always shows one unambiguous source of truth.
  const activeCardAcct = accounts.find(a => a.is_active);
  const activeAuthNet   = authNetAccounts.find(a => a.is_active);
  const active = activeCardAcct
    ? { label: `${PROVIDER_LABEL[activeCardAcct.provider]} — ${activeCardAcct.nickname}`, environment: activeCardAcct.environment }
    : activeAuthNet
    ? { label: `Authorize.net — ${activeAuthNet.nickname}`, environment: activeAuthNet.environment }
    : null;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Payment Processors</h1>
          <p className="page-sub">Square &amp; Clover merchant accounts — switch which one is live anytime</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => openAdd('square')}><Plus size={15}/> Add Square</button>
          <button className="btn btn-primary" onClick={() => openAdd('clover')}><Plus size={15}/> Add Clover</button>
        </div>
      </div>

      {active && (
        <div className="an-active-banner">
          <ShieldCheck size={16}/>
          <span>Active: <strong>{active.label}</strong> — {active.environment === 'sandbox' ? '🟡 Sandbox / Test Mode' : '🟢 Production / Live'}</span>
        </div>
      )}
      {!active && !loading && (
        <div className="an-warn-banner">
          <AlertCircle size={16}/>
          <span>No active card processor — card payments are disabled. Add a Square or Clover account and click "Set Active".</span>
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : accounts.length === 0 ? (
        <div className="empty card">
          <CreditCard size={32}/>
          <p>No Square or Clover accounts yet. Add one to start accepting card payments through it.</p>
        </div>
      ) : (
        <div className="an-list">
          {accounts.map(a => (
            <div key={a.id} className={`an-card card ${a.is_active ? 'an-active' : ''}`}>
              <div className="an-card-top">
                <div className="an-card-info">
                  <CreditCard size={18}/>
                  <div>
                    <div className="an-nickname">
                      <span className="cp-provider-badge">{PROVIDER_LABEL[a.provider]}</span> {a.nickname}
                    </div>
                    <div className="an-meta">
                      <span className={`an-env-badge ${a.environment}`}>{a.environment}</span>
                      {a.is_active && <span className="badge badge-success">Active</span>}
                    </div>
                  </div>
                </div>
                <div className="an-actions">
                  {!a.is_active && (
                    <button className="btn btn-primary btn-sm" onClick={() => activate(a.id)} disabled={activating === a.id}>
                      {activating === a.id ? <div className="spinner spinner-sm"/> : <><Check size={13}/> Set Active</>}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(a)}><Pencil size={13}/></button>
                  {!a.is_active && (
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDelete(a)}><Trash2 size={13}/></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal an-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">
                {modal === 'add' ? `Add ${PROVIDER_LABEL[form.provider]} Account` : `Edit: ${modal.nickname}`}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16}/></button>
            </div>

            <div className="modal-body">
              {err && <div className="an-err"><AlertCircle size={14}/> {err}</div>}

              <div className="field">
                <label>Account Nickname *</label>
                <input className="input" placeholder="e.g. Main Account, Backup Account"
                  value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} />
              </div>

              <div className="field">
                <label>Environment *</label>
                <select className="input select" value={form.environment}
                  onChange={e => setForm({ ...form, environment: e.target.value })}>
                  <option value="production">Production (Live payments)</option>
                  <option value="sandbox">Sandbox (Test mode)</option>
                </select>
              </div>

              {fields.map(f => (
                <div className="field" key={f.key}>
                  <label>{f.label} {f.hint && <span className="an-hint">({f.hint})</span>}</label>
                  <input
                    className="input"
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.secret ? (modal === 'add' ? `Enter ${f.label.replace(' *', '').toLowerCase()}` : 'Leave blank to keep existing') : f.placeholder}
                    value={form.credentials[f.key] || ''}
                    onChange={e => setCred(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <div className="spinner"/> : <><Check size={14}/> Save Account</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDelete(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Delete Account</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDelete(null)}><X size={16}/></button>
            </div>
            <p style={{marginBottom:'1.5rem'}}>Delete <strong>{deleteTarget.nickname}</strong>? This cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={del}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
