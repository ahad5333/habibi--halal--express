import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Bell, Send, Trash2, Users, Smartphone, Mail, MessageSquare,
  ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Broadcasts.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getAuthHeaders() {
  const token = localStorage.getItem('habibi_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const AUDIENCE_OPTIONS = [
  { value: 'all',         label: 'All Users',              icon: <Users size={14} />, desc: 'Every registered customer + newsletter subscribers' },
  { value: 'customers',   label: 'App Customers Only',     icon: <Smartphone size={14} />, desc: 'Users with an account in the app' },
  { value: 'subscribers', label: 'Newsletter Subscribers', icon: <Mail size={14} />, desc: 'Email subscribers only' },
];

const SCREEN_OPTIONS = [
  { value: '',           label: 'No deep-link (opens app home)' },
  { value: 'Offers',     label: 'Offers & Deals screen' },
  { value: 'MainTabs',   label: 'Home screen' },
  { value: 'Catering',   label: 'Catering screen' },
  { value: 'Locations',  label: 'Locations screen' },
  { value: 'Cart',       label: 'Cart screen' },
];

const INITIAL_FORM = {
  title:    '',
  message:  '',
  audience: 'all',
  channels: ['push'],
  screen:   '',
};

function PhonePreview({ title, message }) {
  const t = title   || 'Your notification title';
  const m = message || 'Your notification message will appear here for users to read.';
  return (
    <div className="bc-preview-phone">
      <div className="bc-preview-notch" />
      <div className="bc-preview-screen">
        <div className="bc-preview-status-bar">
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div className="bc-preview-card">
          <div className="bc-preview-card-header">
            <div className="bc-preview-app-icon">🥙</div>
            <span className="bc-preview-app-name">Habibi Halal</span>
            <span className="bc-preview-time">now</span>
          </div>
          <p className="bc-preview-title">{t.slice(0, 65)}</p>
          <p className="bc-preview-body">{m.slice(0, 178)}</p>
        </div>
        <p className="bc-preview-hint">Tap to open app</p>
      </div>
    </div>
  );
}

function BroadcastRow({ broadcast, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = broadcast.status === 'sent'
    ? <CheckCircle size={14} className="bc-status-sent" />
    : <AlertCircle size={14} className="bc-status-pending" />;

  const channels = Array.isArray(broadcast.channels)
    ? broadcast.channels
    : (broadcast.channels || '').replace(/[{}"]/g, '').split(',').filter(Boolean);

  return (
    <div className="bc-row">
      <div className="bc-row-header" onClick={() => setExpanded(e => !e)}>
        <div className="bc-row-left">
          {statusIcon}
          <div>
            <p className="bc-row-title">{broadcast.title}</p>
            <p className="bc-row-meta">
              {broadcast.audience} · {channels.join(', ')} · {broadcast.sent_count ?? 0} sent
            </p>
          </div>
        </div>
        <div className="bc-row-right">
          <span className="bc-row-date">
            {broadcast.sent_at
              ? new Date(broadcast.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : new Date(broadcast.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button className="bc-row-delete" onClick={e => { e.stopPropagation(); onDelete(broadcast.id); }}>
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {expanded && (
        <div className="bc-row-body">
          <p className="bc-row-message">"{broadcast.message}"</p>
          <div className="bc-row-pills">
            <span className="bc-pill">Sent by: {broadcast.created_by || 'Admin'}</span>
            {channels.map(c => <span key={c} className="bc-pill bc-pill-channel">{c.toUpperCase()}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Broadcasts() {
  const { user, loading } = useAuth();

  const [form, setForm]         = useState(INITIAL_FORM);
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);  // { success, sent_count, error }
  const [history, setHistory]   = useState([]);
  const [fetching, setFetching] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchHistory = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/broadcasts`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (_) {}
    setFetching(false);
  }, []);

  useEffect(() => { if (isAdmin) fetchHistory(); }, [isAdmin, fetchHistory]);

  const toggleChannel = (ch) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    if (form.channels.length === 0) {
      setResult({ success: false, error: 'Select at least one channel.' });
      return;
    }

    setSending(true);
    setResult(null);

    const payload = {
      title:    form.title.trim(),
      message:  form.message.trim(),
      audience: form.audience,
      channels: form.channels,
      ...(form.channels.includes('push') && form.screen ? { data: { screen: form.screen } } : {}),
    };

    try {
      const res = await fetch(`${BASE_URL}/api/admin/broadcasts`, {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult({ success: true, sent_count: data.sent_count ?? 0 });
      setForm(INITIAL_FORM);
      fetchHistory();
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setSending(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this broadcast record?')) return;
    try {
      await fetch(`${BASE_URL}/api/admin/broadcasts/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      setHistory(h => h.filter(b => b.id !== id));
    } catch (_) {}
  };

  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  if (!isAdmin) return (
    <div className="bc-access-denied">
      <AlertCircle size={48} />
      <h2>Admin Access Required</h2>
      <p>This page is only accessible to admin accounts.</p>
    </div>
  );

  const titleLeft   = 65  - form.title.length;
  const messageLeft = 178 - form.message.length;

  return (
    <div className="bc-page">
      <div className="bc-page-inner">

        {/* ── Page header ── */}
        <div className="bc-page-header">
          <div className="bc-page-header-left">
            <Bell size={28} className="bc-page-icon" />
            <div>
              <h1 className="bc-page-title">Broadcast Center</h1>
              <p className="bc-page-sub">Send push, SMS, and email campaigns to your customers</p>
            </div>
          </div>
          <button className="bc-refresh-btn" onClick={fetchHistory} disabled={fetching}>
            <RefreshCw size={16} className={fetching ? 'bc-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bc-grid">

          {/* ── Compose form ── */}
          <div className="bc-compose-panel">
            <h2 className="bc-section-title">Compose Message</h2>

            <form onSubmit={handleSend} className="bc-form">

              {/* Title */}
              <label className="bc-label">
                Notification Title
                <span className={`bc-char-count ${titleLeft < 10 ? 'bc-char-warn' : ''}`}>{titleLeft} left</span>
              </label>
              <input
                className="bc-input"
                type="text"
                maxLength={65}
                placeholder='e.g. "Your craving ends here 🔥"'
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />

              {/* Message */}
              <label className="bc-label" style={{ marginTop: '1rem' }}>
                Message Body
                <span className={`bc-char-count ${messageLeft < 20 ? 'bc-char-warn' : ''}`}>{messageLeft} left</span>
              </label>
              <textarea
                className="bc-textarea"
                maxLength={178}
                rows={4}
                placeholder='e.g. "20% off Chicken Shawarma today only — order now before it sells out!"'
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                required
              />

              {/* Audience */}
              <label className="bc-label" style={{ marginTop: '1rem' }}>Audience</label>
              <div className="bc-audience-group">
                {AUDIENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`bc-audience-btn ${form.audience === opt.value ? 'bc-audience-active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, audience: opt.value }))}
                  >
                    {opt.icon}
                    <span className="bc-audience-label">{opt.label}</span>
                    <span className="bc-audience-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Channels */}
              <label className="bc-label" style={{ marginTop: '1rem' }}>Send Via</label>
              <div className="bc-channels-row">
                {[
                  { key: 'push',  icon: <Smartphone size={16} />, label: 'Push Notification' },
                  { key: 'sms',   icon: <MessageSquare size={16} />, label: 'SMS' },
                  { key: 'email', icon: <Mail size={16} />, label: 'Email' },
                ].map(ch => (
                  <button
                    key={ch.key}
                    type="button"
                    className={`bc-channel-btn ${form.channels.includes(ch.key) ? 'bc-channel-active' : ''}`}
                    onClick={() => toggleChannel(ch.key)}
                  >
                    {ch.icon}
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* Deep-link (push only) */}
              {form.channels.includes('push') && (
                <>
                  <label className="bc-label" style={{ marginTop: '1rem' }}>
                    When tapped, open… <span className="bc-label-optional">(optional)</span>
                  </label>
                  <select
                    className="bc-input"
                    value={form.screen}
                    onChange={e => setForm(f => ({ ...f, screen: e.target.value }))}
                  >
                    {SCREEN_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </>
              )}

              {/* Result banner */}
              {result && (
                <div className={`bc-result ${result.success ? 'bc-result-ok' : 'bc-result-err'}`}>
                  {result.success
                    ? <><CheckCircle size={16} /> Sent to {result.sent_count} recipient{result.sent_count !== 1 ? 's' : ''}!</>
                    : <><AlertCircle size={16} /> {result.error}</>}
                </div>
              )}

              <button
                type="submit"
                className="bc-send-btn"
                disabled={sending || !form.title.trim() || !form.message.trim()}
              >
                {sending
                  ? <><RefreshCw size={16} className="bc-spin" /> Sending…</>
                  : <><Send size={16} /> Send Broadcast</>}
              </button>
            </form>
          </div>

          {/* ── Preview panel ── */}
          <div className="bc-preview-panel">
            <h2 className="bc-section-title">Push Preview</h2>
            <p className="bc-preview-hint-text">This is how it appears on a user's phone lock screen.</p>
            <PhonePreview title={form.title} message={form.message} />

            <div className="bc-tips">
              <h3 className="bc-tips-title">Tips from Zomato / Zepto playbook</h3>
              <ul className="bc-tips-list">
                <li>Use emojis in the title — open rates jump ~20%</li>
                <li>Create urgency: "today only", "selling fast", "ends tonight"</li>
                <li>Personalize: mention the item, not just a discount</li>
                <li>Best times: 11 AM–1 PM (lunch) and 6–8 PM (dinner)</li>
                <li>Keep body under 100 chars — anything beyond gets clipped</li>
              </ul>
            </div>
          </div>

        </div>

        {/* ── History ── */}
        <div className="bc-history">
          <div className="bc-history-header">
            <h2 className="bc-section-title">Broadcast History</h2>
            {history.length > 0 && (
              <span className="bc-history-count">{history.length} sent</span>
            )}
          </div>

          {fetching ? (
            <div className="bc-history-loading"><RefreshCw size={20} className="bc-spin" /> Loading…</div>
          ) : history.length === 0 ? (
            <div className="bc-history-empty">
              <Clock size={32} />
              <p>No broadcasts sent yet. Send your first one above!</p>
            </div>
          ) : (
            <div className="bc-history-list">
              {history.map(b => (
                <BroadcastRow key={b.id} broadcast={b} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
