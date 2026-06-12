import React, { useState, useEffect, useCallback } from 'react';
import { Star, Users, Gift, TrendingUp, Plus, Minus, Settings, Search, Save, X } from 'lucide-react';
import { loyaltyAPI } from '../services/api';
import './LoyaltyProgram.css';

export default function LoyaltyProgram() {
  const [stats,     setStats]     = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [adjust,    setAdjust]    = useState(null);  // { user_id, name, loyalty_points }
  const [adjDelta,  setAdjDelta]  = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjErr,    setAdjErr]    = useState('');
  const [adjSaving, setAdjSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config,    setConfig]    = useState({ earn_rate: 10, redeem_rate: 100 });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg,    setCfgMsg]    = useState('');

  const load = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const [s, c, cfg] = await Promise.all([
        loyaltyAPI.getStats(),
        loyaltyAPI.getCustomers(q),
        loyaltyAPI.getConfig(),
      ]);
      setStats(s);
      setCustomers(c);
      setConfig({ earn_rate: cfg.earn_rate, redeem_rate: cfg.redeem_rate });
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(''); }, []);

  const doSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const openAdjust = (cust) => {
    setAdjust(cust);
    setAdjDelta('');
    setAdjReason('');
    setAdjErr('');
  };

  const submitAdjust = async () => {
    if (!adjDelta) { setAdjErr('Enter a points value'); return; }
    const delta = parseInt(adjDelta);
    if (isNaN(delta) || delta === 0) { setAdjErr('Enter a non-zero number'); return; }
    setAdjSaving(true);
    setAdjErr('');
    try {
      const updated = await loyaltyAPI.adjustPoints(adjust.id, delta, adjReason);
      setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, loyalty_points: updated.loyalty_points } : c));
      setStats(prev => prev ? {
        ...prev,
        total_outstanding_pts: prev.total_outstanding_pts + delta,
        outstanding_value: ((prev.total_outstanding_pts + delta) / prev.redeem_rate).toFixed(2),
      } : prev);
      setAdjust(null);
    } catch (e) { setAdjErr(e.message); }
    setAdjSaving(false);
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    setCfgMsg('');
    try {
      await loyaltyAPI.updateConfig(config.earn_rate, config.redeem_rate);
      setCfgMsg('Saved!');
      load('');
    } catch (e) { setCfgMsg(e.message); }
    setCfgSaving(false);
  };

  return (
    <div className="lp-page">
      <div className="lp-header-row">
        <div>
          <h1 className="lp-title"><Star size={20} /> Loyalty Program</h1>
          <p className="lp-sub">Manage member points, adjust balances, and configure earn/redeem rates.</p>
        </div>
        <button className="btn btn-outline lp-cfg-btn" onClick={() => setShowConfig(v => !v)}>
          <Settings size={14} /> {showConfig ? 'Hide' : 'Configure Rates'}
        </button>
      </div>

      {/* ── Config Panel ── */}
      {showConfig && (
        <div className="lp-config-panel">
          <p className="lp-config-title">Earn &amp; Redeem Rates</p>
          <div className="lp-config-row">
            <label className="lp-config-label">
              Earn rate
              <span className="lp-config-hint">Points per $1 spent</span>
              <input
                type="number"
                min="1"
                className="input lp-config-input"
                value={config.earn_rate}
                onChange={e => setConfig(c => ({ ...c, earn_rate: e.target.value }))}
              />
            </label>
            <label className="lp-config-label">
              Redeem rate
              <span className="lp-config-hint">Points needed for $1 off</span>
              <input
                type="number"
                min="1"
                className="input lp-config-input"
                value={config.redeem_rate}
                onChange={e => setConfig(c => ({ ...c, redeem_rate: e.target.value }))}
              />
            </label>
            <button className="btn btn-primary" onClick={saveConfig} disabled={cfgSaving}>
              <Save size={14} /> {cfgSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {cfgMsg && <p className={`lp-cfg-msg ${cfgMsg === 'Saved!' ? 'ok' : 'err'}`}>{cfgMsg}</p>}
          <p className="lp-config-eg">
            Current: customers earn <strong>{config.earn_rate} pts</strong> per $1 spent,
            and redeem <strong>{config.redeem_rate} pts</strong> for $1 off.
          </p>
        </div>
      )}

      {/* ── Stats ── */}
      {stats && (
        <div className="lp-stats">
          <div className="lp-stat-card">
            <Users size={18} className="lp-stat-icon" />
            <p className="lp-stat-val">{stats.active_members?.toLocaleString()}</p>
            <p className="lp-stat-label">Active Members</p>
          </div>
          <div className="lp-stat-card">
            <Star size={18} className="lp-stat-icon gold" />
            <p className="lp-stat-val">{(stats.total_outstanding_pts || 0).toLocaleString()}</p>
            <p className="lp-stat-label">Points Outstanding</p>
          </div>
          <div className="lp-stat-card">
            <Gift size={18} className="lp-stat-icon red" />
            <p className="lp-stat-val">${stats.outstanding_value}</p>
            <p className="lp-stat-label">Liability ($)</p>
          </div>
          <div className="lp-stat-card">
            <TrendingUp size={18} className="lp-stat-icon green" />
            <p className="lp-stat-val">{(stats.total_redeemed_pts || 0).toLocaleString()}</p>
            <p className="lp-stat-label">Total Redeemed</p>
          </div>
        </div>
      )}

      {/* ── Customer Table ── */}
      <div className="card">
        <div className="lp-table-header">
          <p className="section-title">Members by Points</p>
          <form onSubmit={doSearch} className="lp-search-row">
            <Search size={14} className="lp-search-icon" />
            <input
              className="input lp-search"
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-outline" style={{ padding: '0.45rem 0.875rem' }}>
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <p className="lp-empty">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="lp-empty">No members found.</p>
        ) : (
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Points</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td className="lp-name">{c.name || '—'}</td>
                    <td className="lp-muted">{c.email}</td>
                    <td>{c.order_count}</td>
                    <td>${parseFloat(c.total_spent || 0).toFixed(2)}</td>
                    <td>
                      <span className={`lp-pts-badge ${c.loyalty_points > 0 ? 'has-pts' : ''}`}>
                        {(c.loyalty_points || 0).toLocaleString()} pts
                      </span>
                    </td>
                    <td className="lp-muted">
                      ${(c.loyalty_points / (stats?.redeem_rate || 100)).toFixed(2)}
                    </td>
                    <td>
                      <button className="btn btn-outline lp-adj-btn" onClick={() => openAdjust(c)}>
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Adjust Modal ── */}
      {adjust && (
        <div className="modal-overlay" onClick={() => setAdjust(null)}>
          <div className="modal-box lp-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <p className="modal-title">Adjust Points — {adjust.name || adjust.email}</p>
              <button className="modal-close" onClick={() => setAdjust(null)}><X size={16} /></button>
            </div>

            <div className="lp-modal-current">
              Current balance: <strong>{(adjust.loyalty_points || 0).toLocaleString()} pts</strong>
            </div>

            <div className="lp-adj-btns">
              <button
                className={`lp-sign-btn ${adjDelta.startsWith('-') ? '' : ''}`}
                onClick={() => setAdjDelta(v => v.startsWith('-') ? v.slice(1) : (v ? '-' + v : '-'))}
              >
                <Minus size={14} /> Deduct
              </button>
              <button
                className="lp-sign-btn lp-sign-add"
                onClick={() => setAdjDelta(v => v.startsWith('-') ? v.slice(1) : v)}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="field">
              <label>Points ({adjDelta.startsWith('-') ? 'deduct' : 'add'})</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 100"
                value={adjDelta.replace('-', '')}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setAdjDelta(adjDelta.startsWith('-') ? (val ? '-' + val : '-') : val);
                }}
              />
            </div>
            <div className="field">
              <label>Reason (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Goodwill gesture, wrong charge…"
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
              />
            </div>
            {adjErr && <p className="lp-adj-err">{adjErr}</p>}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setAdjust(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAdjust} disabled={adjSaving}>
                {adjSaving ? 'Saving…' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
