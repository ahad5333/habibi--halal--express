import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Link2, RefreshCw, CheckCircle2, Clock, Copy, ExternalLink,
  RotateCcw, AlertTriangle, Zap, TrendingUp, ShoppingBag, KeyRound,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './Integrations.css';

const PLATFORM_META = {
  ubereats: {
    name:     'Uber Eats',
    color:    '#06c167',
    bg:       'rgba(6,193,103,0.08)',
    docs:     'https://developer.uber.com/docs/eats/introduction',
    applyUrl: 'https://restaurants.ubereats.com',
    applyLabel: 'Apply as Restaurant',
  },
  grubhub: {
    name:     'GrubHub',
    color:    '#f63440',
    bg:       'rgba(246,52,64,0.08)',
    docs:     'https://developer.grubhub.com',
    applyUrl: 'https://get.grubhub.com',
    applyLabel: 'Apply as Restaurant',
  },
  doordash: {
    name:     'DoorDash',
    color:    '#ff3008',
    bg:       'rgba(255,48,8,0.08)',
    docs:     'https://developer.doordash.com',
    applyUrl: 'https://get.doordash.com',
    applyLabel: 'Apply as Merchant',
  },
  caviar: {
    name:     'Caviar',
    color:    '#cc3a00',
    bg:       'rgba(204,58,0,0.08)',
    docs:     'https://developer.doordash.com',
    applyUrl: 'https://www.trycaviar.com/merchant',
    applyLabel: 'Apply as Restaurant',
  },
};

const CHECKLIST = [
  { done: true,  text: 'Webhook endpoints live and tested' },
  { done: true,  text: 'Marketplace orders database table ready' },
  { done: true,  text: 'Order intake dashboard built (Marketplace page)' },
  { done: true,  text: 'Commission tracking configured per platform' },
  { done: true,  text: 'Catalog sync engine built' },
  { done: false, text: 'UberEats partner account approved' },
  { done: false, text: 'GrubHub merchant account approved' },
  { done: false, text: 'DoorDash marketplace account approved' },
  { done: false, text: 'API credentials received and saved to environment' },
  { done: false, text: 'Menu synced and live on all platforms' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className="int-copy-btn" onClick={copy} title="Copy URL">
      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PlatformCard({ platform, data, onSave, onSync, syncing }) {
  const meta = PLATFORM_META[platform] || {};
  const [editing, setEditing]   = useState(false);
  const [rate, setRate]         = useState(String(data.commission_rate));
  const [saving, setSaving]     = useState(false);
  const apiBase = typeof window !== 'undefined'
    ? window.location.origin.replace(':5174', ':5001').replace(':5173', ':5001')
    : 'https://yourapi.com';
  const webhookUrl = `${apiBase}/api/marketplace/webhook/${platform}`;

  const save = async () => {
    setSaving(true);
    await onSave(platform, { commission_rate: parseFloat(rate) });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="int-card" style={{ borderTopColor: meta.color }}>
      <div className="int-card-hdr" style={{ background: meta.bg }}>
        <div>
          <span className="int-platform-name" style={{ color: meta.color }}>{meta.name}</span>
          <span className={`int-status-badge ${data.is_active ? 'int-badge-live' : 'int-badge-pending'}`}>
            {data.is_active ? <><Zap size={10}/> Live</> : <><Clock size={10}/> Pending Approval</>}
          </span>
        </div>
        <div className="int-card-actions">
          <a href={meta.docs} target="_blank" rel="noreferrer" className="int-icon-btn" title="Docs">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="int-card-body">
        {/* Stats row */}
        <div className="int-stats-row">
          <div className="int-stat">
            <ShoppingBag size={13} />
            <span className="int-stat-val">{data.order_count}</span>
            <span className="int-stat-lbl">Orders</span>
          </div>
          <div className="int-stat">
            <TrendingUp size={13} />
            <span className="int-stat-val">${data.gross_revenue.toFixed(2)}</span>
            <span className="int-stat-lbl">Gross</span>
          </div>
          <div className="int-stat int-stat-net">
            <TrendingUp size={13} />
            <span className="int-stat-val">${data.net_revenue.toFixed(2)}</span>
            <span className="int-stat-lbl">Net</span>
          </div>
        </div>

        {/* Commission rate */}
        <div className="int-field-row">
          <label className="int-field-label">Commission Rate</label>
          {editing ? (
            <div className="int-edit-row">
              <input
                type="number" min="0" max="100" step="0.5"
                className="int-rate-input"
                value={rate}
                onChange={e => setRate(e.target.value)}
              />
              <span className="int-pct">%</span>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <div className="spinner" /> : 'Save'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setRate(String(data.commission_rate)); }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="int-rate-display">
              <span className="int-rate-val">{data.commission_rate}%</span>
              <button className="int-text-btn" onClick={() => setEditing(true)}>Edit</button>
            </div>
          )}
        </div>

        {/* Webhook URL */}
        <div className="int-field-row">
          <label className="int-field-label">Webhook URL</label>
          <div className="int-url-row">
            <code className="int-url">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>

        {/* Last sync */}
        {data.last_sync_at && (
          <p className="int-last-sync">
            Last sync: {new Date(data.last_sync_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="int-card-footer">
        <a href={meta.applyUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          <ExternalLink size={12} /> {meta.applyLabel}
        </a>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSync(platform)}
          disabled={syncing === platform}
        >
          {syncing === platform ? <div className="spinner" /> : <><RotateCcw size={12}/> Sync Menu</>}
        </button>
      </div>
    </div>
  );
}

export default function Integrations() {
  const [data, setData]       = useState({ platforms: [], menu_item_count: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await adminAPI.getPlatformSettings();
      setData(d);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (platform, body) => {
    try {
      await adminAPI.updatePlatformSettings(platform, body);
      await load();
    } catch (_) {}
  };

  const handleSync = async (platform) => {
    setSyncing(platform);
    setSyncMsg(null);
    try {
      const res = await adminAPI.triggerCatalogSync({ platform });
      setSyncMsg(res.message);
      await load();
    } catch (_) {}
    setSyncing(null);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    setSyncMsg(null);
    try {
      const res = await adminAPI.triggerCatalogSync({});
      setSyncMsg(res.message);
      await load();
    } catch (_) {}
    setSyncing(null);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const totalGross = data.platforms.reduce((s, p) => s + p.gross_revenue, 0);
  const totalNet   = data.platforms.reduce((s, p) => s + p.net_revenue,   0);
  const liveCount  = data.platforms.filter(p => p.is_active).length;

  return (
    <div className="int-page">
      <div className="page-hdr">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link2 size={22} /> Platform Integrations
          </h1>
          <p className="page-sub">
            Milestone 2 — UberEats · GrubHub · DoorDash · Caviar
            &nbsp;·&nbsp; {liveCount}/{data.platforms.length} platforms live
            &nbsp;·&nbsp; {data.menu_item_count} menu items ready to sync
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <Link to="/credentials" className="btn btn-secondary">
            <KeyRound size={14} /> API Keys
          </Link>
          <button
            className="btn btn-primary"
            onClick={handleSyncAll}
            disabled={syncing === 'all'}
          >
            {syncing === 'all' ? <div className="spinner" /> : <><RotateCcw size={14} /> Sync All Platforms</>}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="int-sync-toast">
          <CheckCircle2 size={15} /> {syncMsg}
        </div>
      )}

      {/* Summary stats */}
      <div className="int-summary-row">
        <div className="int-summary-card">
          <p className="int-summary-val">{data.platforms.reduce((s, p) => s + p.order_count, 0)}</p>
          <p className="int-summary-lbl">Total Marketplace Orders</p>
        </div>
        <div className="int-summary-card">
          <p className="int-summary-val">${totalGross.toFixed(2)}</p>
          <p className="int-summary-lbl">Gross Revenue</p>
        </div>
        <div className="int-summary-card int-summary-net">
          <p className="int-summary-val">${totalNet.toFixed(2)}</p>
          <p className="int-summary-lbl">Net Revenue (after commission)</p>
        </div>
        <div className="int-summary-card">
          <p className="int-summary-val">{data.menu_item_count}</p>
          <p className="int-summary-lbl">Menu Items Ready to Sync</p>
        </div>
      </div>

      {/* Platform cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="int-platforms-grid">
          {data.platforms.map(p => (
            <PlatformCard
              key={p.platform}
              platform={p.platform}
              data={p}
              onSave={handleSave}
              onSync={handleSync}
              syncing={syncing}
            />
          ))}
        </div>
      )}

      {/* Two-column bottom section */}
      <div className="int-bottom-grid">

        {/* Setup Checklist */}
        <div className="int-panel">
          <h3 className="int-panel-title">Milestone 2 Checklist</h3>
          <div className="int-checklist">
            {CHECKLIST.map((item, i) => (
              <div key={i} className={`int-check-row ${item.done ? 'int-check-done' : 'int-check-pending'}`}>
                {item.done
                  ? <CheckCircle2 size={15} className="int-check-icon-done" />
                  : <Clock size={15} className="int-check-icon-pending" />
                }
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="int-checklist-summary">
            <span className="int-done-count">{CHECKLIST.filter(c => c.done).length}/{CHECKLIST.length}</span>
            &nbsp;items complete
          </div>
        </div>

        {/* Webhook Reference */}
        <div className="int-panel">
          <h3 className="int-panel-title">Webhook Endpoints</h3>
          <p className="int-panel-sub">Register these URLs in each platform's developer portal to receive live orders.</p>
          {['ubereats', 'grubhub', 'doordash', 'caviar'].map(plat => {
            const meta = PLATFORM_META[plat];
            const apiBase = typeof window !== 'undefined'
              ? window.location.origin.replace(':5174', ':5001').replace(':5173', ':5001')
              : 'https://yourapi.com';
            const url = `${apiBase}/api/marketplace/webhook/${plat}`;
            return (
              <div key={plat} className="int-webhook-row">
                <div>
                  <p className="int-webhook-platform" style={{ color: meta.color }}>{meta.name}</p>
                  <code className="int-webhook-url">{url}</code>
                </div>
                <CopyButton text={url} />
              </div>
            );
          })}
          <div className="int-warning-box">
            <AlertTriangle size={14} />
            <p>Webhooks only activate after receiving merchant API credentials from each platform.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
