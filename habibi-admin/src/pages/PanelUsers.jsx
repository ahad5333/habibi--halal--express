import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, UserPlus, RefreshCw, AlertCircle, Check, Power } from 'lucide-react';
import { adminAPI } from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ROLE_LABEL } from '../utils/roles';
import './PanelUsers.css';
import { fmtDate } from '../utils/date.js';

// What each role can do, in the words the person granting it would use.
const WHAT_THEY_SEE = {
  admin:   'Everything, including takings, refunds, customers and settings.',
  manager: 'Orders, the menu, stock and waste, opening hours, staff and the rota. No takings, no customer records, no settings.',
};

export default function PanelUsers() {
  const { admin } = useAdminAuth();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [msg, setMsg]         = useState('');
  const [busy, setBusy]       = useState(null);

  const [email, setEmail] = useState('');
  const [role, setRole]   = useState('manager');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setUsers((await adminAPI.panelUsers()).users || []); }
    catch (e) { setErr(e.message || 'Could not load panel logins.'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  const grant = async (e) => {
    e.preventDefault();
    setAdding(true); setErr('');
    try {
      const res = await adminAPI.grantPanelAccess(email.trim(), role);
      flash(res.message);
      setEmail('');
      await load();
    } catch (ex) { setErr(ex.message || 'Could not give access.'); }
    setAdding(false);
  };

  const change = async (user, patch, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(user.id); setErr('');
    try {
      const res = await adminAPI.updatePanelUser(user.id, patch);
      flash(res.message);
      await load();
    } catch (ex) { setErr(ex.message || 'Could not change access.'); }
    setBusy(null);
  };

  const name = (u) => u.name || u.email;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Panel Logins</h1>
          <p className="page-sub">Who can sign in to this control panel, and how much of it they see</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {err && <div className="pu-alert pu-alert-err"><AlertCircle size={15} /><span>{err}</span></div>}
      {msg && <div className="pu-alert pu-alert-ok"><Check size={15} /><span>{msg}</span></div>}

      {/* Give access */}
      <form className="card pu-grant" onSubmit={grant}>
        <div className="pu-grant-row">
          <div className="field pu-grow">
            <label>Email address</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="someone@example.com"
            />
          </div>
          <div className="field">
            <label>Access</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={adding || !email.trim()}>
            {adding ? <div className="spinner" /> : <><UserPlus size={14} /> Give access</>}
          </button>
        </div>
        <p className="pu-hint">{WHAT_THEY_SEE[role]}</p>
        <p className="pu-hint pu-hint-muted">
          They need an account on the website first — ask them to register with this email, then give them
          access here. They keep their own password, and they’ll be emailed a code each time they sign in.
        </p>
      </form>

      {/* Existing logins */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : !users.length ? (
          <div className="empty"><ShieldCheck size={32} /><p>No panel logins yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Person</th><th>Access</th><th>Status</th><th>Added</th><th /></tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const self     = u.id === admin?.id;
                  const active   = u.is_active !== false;
                  const isAdminRole = u.role === 'admin' || u.role === 'superadmin';
                  return (
                    <tr key={u.id} className={active ? '' : 'pu-row-off'}>
                      <td>
                        <p style={{ fontWeight: 600 }}>
                          {name(u)}{self && <span className="pu-you">you</span>}
                        </p>
                        <p className="text-muted" style={{ fontSize: '0.72rem' }}>{u.email}</p>
                      </td>
                      <td>
                        <span className={`badge ${isAdminRole ? 'badge-success' : 'badge-warning'}`}>
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {active
                          ? <span className="text-muted" style={{ fontSize: '0.8rem' }}>Can sign in</span>
                          : <span className="badge badge-danger">Switched off</span>}
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {u.created_at ? fmtDate(u.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="pu-actions">
                        {self ? (
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>You can’t change your own access</span>
                        ) : (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={busy === u.id}
                              onClick={() => change(u, { role: isAdminRole ? 'manager' : 'admin' },
                                isAdminRole
                                  ? `Make ${name(u)} a manager? They will lose access to takings, refunds, customers and settings.`
                                  : `Make ${name(u)} an administrator? They will be able to see and change everything, including payments.`)}
                            >
                              {isAdminRole ? 'Make manager' : 'Make administrator'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={busy === u.id}
                              onClick={() => change(u, { is_active: !active },
                                active ? `Switch off ${name(u)}’s login? They won’t be able to sign in until it's switched back on.` : null)}
                            >
                              <Power size={13} /> {active ? 'Switch off' : 'Switch on'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm pu-danger"
                              disabled={busy === u.id}
                              onClick={() => change(u, { role: 'customer' },
                                `Remove ${name(u)}’s panel access completely? Their website account stays, they just can't open this panel.`)}
                            >
                              Remove access
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="pu-foot">
        Changes take effect straight away — if someone is signed in when you change their access, their next
        click uses the new one. Every change here is recorded in the Audit Log.
      </p>
    </div>
  );
}
