import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Pencil, Trash2, X, Check, ShieldCheck, AlertCircle, Smartphone } from 'lucide-react';
import { adminAPI } from '../services/api';
import './PaymentAccounts.css';

const BLANK = {
  nickname: '',
  api_login_id: '',
  transaction_key: '',
  client_key: '',
  environment: 'production',
};

// ── Digital Payment Handles (Zelle / Cash App) ─────────────────────
function OfflineHandlesCard() {
  const [handles, setHandles]   = useState({ zelle: {}, cashapp: {} });
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({ zelle_email: '', cashapp_cashtag: '' });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState('');

  const load = async () => {
    try {
      const data = await adminAPI.getOfflineHandles();
      setHandles(data);
      setForm({ zelle_email: data.zelle?.email || '', cashapp_cashtag: data.cashapp?.cashtag || '' });
    } catch (_) {}
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (form.zelle_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.zelle_email)) {
      setErr('Zelle email must be a valid email address'); return;
    }
    if (form.cashapp_cashtag && !form.cashapp_cashtag.startsWith('$')) {
      setErr('Cash App cashtag must start with $ (e.g. $HabibiHalal)'); return;
    }
    setSaving(true); setErr('');
    try {
      await adminAPI.updateOfflineHandles(form);
      await load();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message || 'Save failed'); }
    setSaving(false);
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div className="an-card-top" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <div className="an-card-info">
          <Smartphone size={18}/>
          <div>
            <div className="an-nickname">Digital Payment Handles</div>
            <div className="an-meta" style={{ marginTop: 2 }}>Zelle email and Cash App $cashtag shown to customers at checkout</div>
          </div>
        </div>
        <div className="an-actions">
          {saved && <span className="badge badge-success"><Check size={11}/> Saved</span>}
          {!editing
            ? <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(true)}><Pencil size={13}/> Edit</button>
            : <>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? <div className="spinner spinner-sm"/> : <><Check size={13}/> Save</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setErr(''); }}>Cancel</button>
              </>
          }
        </div>
      </div>

      {err && <div className="an-err" style={{ marginBottom: '1rem' }}><AlertCircle size={14}/> {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Zelle */}
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.4rem' }}>
            💙 Zelle Email
          </p>
          {editing
            ? <input className="input" placeholder="e.g. payments@habibihe.com"
                value={form.zelle_email}
                onChange={e => setForm(f => ({ ...f, zelle_email: e.target.value }))} />
            : <p style={{ fontWeight: 600, color: handles.zelle?.email ? '#111' : '#9ca3af' }}>
                {handles.zelle?.email || 'Not set'}
              </p>
          }
        </div>

        {/* Cash App */}
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.4rem' }}>
            💚 Cash App $Cashtag
          </p>
          {editing
            ? <input className="input" placeholder="e.g. $HabibiHalal"
                value={form.cashapp_cashtag}
                onChange={e => setForm(f => ({ ...f, cashapp_cashtag: e.target.value }))} />
            : <p style={{ fontWeight: 600, color: handles.cashapp?.cashtag ? '#111' : '#9ca3af' }}>
                {handles.cashapp?.cashtag || 'Not set'}
              </p>
          }
        </div>
      </div>

      {!editing && (
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
          These are shown to customers when they choose Zelle or Cash App at checkout. Click Edit to update them anytime — no server restart needed.
        </p>
      )}
    </div>
  );
}

export default function PaymentAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'add' | account object
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDelete] = useState(null);
  const [activating, setActivating] = useState(null);
  const [err, setErr]           = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.listAuthNetAccounts();
      setAccounts(data);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(BLANK); setErr(''); setModal('add'); };
  const openEdit = (a) => { setForm({ ...a, transaction_key: '' }); setErr(''); setModal(a); };

  const save = async () => {
    if (!form.nickname.trim() || !form.api_login_id.trim()) {
      setErr('Nickname and API Login ID are required.');
      return;
    }
    if (modal === 'add' && !form.transaction_key.trim()) {
      setErr('Transaction Key is required for new accounts.');
      return;
    }
    setSaving(true); setErr('');
    try {
      if (modal === 'add') {
        await adminAPI.createAuthNetAccount(form);
      } else {
        await adminAPI.updateAuthNetAccount(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) { setErr(e.message || 'Save failed.'); }
    setSaving(false);
  };

  const del = async () => {
    try {
      await adminAPI.deleteAuthNetAccount(deleteTarget.id);
      setDelete(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const activate = async (id) => {
    setActivating(id);
    try {
      await adminAPI.activateAuthNetAccount(id);
      load();
    } catch (e) { alert(e.message); }
    setActivating(null);
  };

  const active = accounts.find(a => a.is_active);

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Payment Accounts</h1>
          <p className="page-sub">Authorize.net merchant accounts — switch active account anytime</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add Account</button>
      </div>

      {/* Active account banner */}
      {active && (
        <div className="an-active-banner">
          <ShieldCheck size={16}/>
          <span>Active: <strong>{active.nickname}</strong> — {active.environment === 'sandbox' ? '🟡 Sandbox / Test Mode' : '🟢 Production / Live'}</span>
        </div>
      )}

      {!active && !loading && (
        <div className="an-warn-banner">
          <AlertCircle size={16}/>
          <span>No active account — card payments are disabled. Add an account and click "Set Active".</span>
        </div>
      )}

      <OfflineHandlesCard />

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : accounts.length === 0 ? (
        <div className="empty card">
          <CreditCard size={32}/>
          <p>No payment accounts yet. Add your Authorize.net VAR sheet credentials to start accepting card payments.</p>
        </div>
      ) : (
        <div className="an-list">
          {accounts.map(a => (
            <div key={a.id} className={`an-card card ${a.is_active ? 'an-active' : ''}`}>
              <div className="an-card-top">
                <div className="an-card-info">
                  <CreditCard size={18}/>
                  <div>
                    <div className="an-nickname">{a.nickname}</div>
                    <div className="an-meta">
                      <span>API Login: <code>{a.api_login_id}</code></span>
                      <span className={`an-env-badge ${a.environment}`}>{a.environment}</span>
                      {a.is_active && <span className="badge badge-success">Active</span>}
                    </div>
                  </div>
                </div>
                <div className="an-actions">
                  {!a.is_active && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => activate(a.id)}
                      disabled={activating === a.id}
                    >
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
              <h2 className="modal-title">{modal === 'add' ? 'Add Authorize.net Account' : `Edit: ${modal.nickname}`}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16}/></button>
            </div>

            <div className="modal-body">
              {err && <div className="an-err"><AlertCircle size={14}/> {err}</div>}

              <div className="field">
                <label>Account Nickname *</label>
                <input className="input" placeholder="e.g. Main Account, Backup Account"
                  value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} />
              </div>

              <div className="field">
                <label>Environment *</label>
                <select className="input select" value={form.environment}
                  onChange={e => setForm({...form, environment: e.target.value})}>
                  <option value="production">Production (Live payments)</option>
                  <option value="sandbox">Sandbox (Test mode)</option>
                </select>
              </div>

              <div className="field">
                <label>API Login ID * <span className="an-hint">(from VAR sheet)</span></label>
                <input className="input" placeholder="e.g. 5KP3u95bQpv"
                  value={form.api_login_id} onChange={e => setForm({...form, api_login_id: e.target.value})} />
              </div>

              <div className="field">
                <label>Transaction Key * <span className="an-hint">(from VAR sheet — secret, never shown again)</span></label>
                <input className="input" type="password"
                  placeholder={modal === 'add' ? 'Enter transaction key' : 'Leave blank to keep existing'}
                  value={form.transaction_key} onChange={e => setForm({...form, transaction_key: e.target.value})} />
              </div>

              <div className="field">
                <label>Client Key <span className="an-hint">(from Authorize.net portal → Account → Public Client Key)</span></label>
                <input className="input" placeholder="Required for Accept.js card form"
                  value={form.client_key} onChange={e => setForm({...form, client_key: e.target.value})} />
                <p className="an-field-note">Get this from: Merchant portal → Account → Settings → Manage Public Client Key</p>
              </div>
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
