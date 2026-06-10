import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Send, Trash2, X, Eye, Mail } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Broadcasts.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const BLANK = {
  title: '', message: '', audience: 'all', channels: ['sms'],
  email_template: {
    subject: '', banner_type: 'default', hero_text: '', cta_text: '', cta_url: '', footer_note: '',
  },
};

const BANNER_TYPES = [
  { value: 'default',      label: 'Gold (Default)',   bg: '#E5B64E', text: '#0f172a' },
  { value: 'promo',        label: 'Navy (Promo)',      bg: '#1e3a8a', text: '#ffffff' },
  { value: 'announcement', label: 'Dark (Announcement)', bg: '#0f172a', text: '#E5B64E' },
  { value: 'discount',     label: 'Red (Discount)',    bg: '#dc2626', text: '#ffffff' },
];

function EmailPreview({ title, message, template }) {
  const { banner_type = 'default', hero_text = '', cta_text = '', cta_url = '', footer_note = '' } = template || {};
  const bt = BANNER_TYPES.find(b => b.value === banner_type) || BANNER_TYPES[0];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 540, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', fontSize: 14 }}>
      {/* Email client header mock */}
      <div style={{ background: '#f8fafc', padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
        <strong>Subject:</strong> {template?.subject || title || '(no subject)'}
      </div>

      {/* Email body */}
      <div style={{ background: '#fff', padding: '1.5rem' }}>
        {/* Banner */}
        {hero_text && (
          <div style={{ background: bt.bg, padding: '1.25rem 1.5rem', borderRadius: 6, marginBottom: '1.25rem', textAlign: 'center' }}>
            <p style={{ color: bt.text, fontWeight: 800, fontSize: 18, margin: 0, lineHeight: 1.3 }}>{hero_text}</p>
          </div>
        )}

        {/* Body text */}
        <div style={{ color: '#1e293b', lineHeight: 1.75, fontSize: 15 }}>
          {(message || '').split('\n').map((line, i) => (
            <span key={i}>{line}{i < message.split('\n').length - 1 && <br />}</span>
          ))}
        </div>

        {/* CTA button */}
        {cta_text && cta_url && (
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <span style={{ display: 'inline-block', background: '#1e3a8a', color: '#fff', padding: '0.75rem 2rem', borderRadius: 6, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {cta_text}
            </span>
          </div>
        )}

        {/* Footer note */}
        {footer_note && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            {footer_note}
          </p>
        )}

        {/* Unsubscribe mock */}
        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: '0.75rem' }}>
          © Habibi Halal Express, INC. · 2974 Jerome Ave, Bronx, NY 10468
          · <span style={{ color: '#1e3a8a' }}>Unsubscribe</span>
        </p>
      </div>
    </div>
  );
}

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [previewMode, setPreview]   = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);

  const isEmailSelected = form.channels.includes('email');

  const load = async () => {
    setLoading(true);
    try { setBroadcasts(await adminAPI.getBroadcasts()); } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true); setResult(null);
    try {
      const payload = {
        title:   form.title,
        message: form.message,
        audience: form.audience,
        channels: form.channels,
        ...(isEmailSelected ? { email_template: form.email_template } : {}),
      };
      const res = await adminAPI.sendBroadcast(payload);
      setResult(`✓ Sent to ${res.sent_count} recipient${res.sent_count !== 1 ? 's' : ''}`);
      setModal(false); setForm(BLANK); load();
    } catch (e) {
      setResult(`Error: ${e.message}`);
    }
    setSending(false);
  };

  const toggleChannel = (ch) =>
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));

  const setTmpl = (key, val) =>
    setForm(f => ({ ...f, email_template: { ...f.email_template, [key]: val } }));

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Notification Broadcasts</h1>
          <p className="page-sub">Send SMS, email, or push messages to customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setForm(BLANK); setResult(null); setPreview(false); }}>
          <Send size={15} /> New Broadcast
        </button>
      </div>

      {result && (
        <div className={`bc-result ${result.startsWith('Error') ? 'bc-result-err' : 'bc-result-ok'}`}>{result}</div>
      )}

      {/* Info card */}
      <div className="card bc-info-card">
        <div className="bc-info-icon"><Bell size={20} /></div>
        <div>
          <p className="bc-info-title">How Broadcasts Work</p>
          <p className="bc-info-text">
            <strong>SMS</strong> — sent via Twilio to phone numbers from orders. ~$0.0075/msg.{' '}
            <strong>Email</strong> — sent via SendGrid with your custom template including banner, CTA button, and footer.{' '}
            <strong>Push</strong> — Firebase Cloud Messaging to all users with device tokens.
          </p>
        </div>
      </div>

      {/* Broadcasts table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : broadcasts.length === 0 ? (
        <div className="empty card"><Bell size={32} /><p>No broadcasts sent yet</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Message</th><th>Audience</th><th>Channels</th><th>Recipients</th><th>Status</th><th>Sent At</th><th /></tr>
              </thead>
              <tbody>
                {broadcasts.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.title}</td>
                    <td className="text-muted" style={{ maxWidth: 200, fontSize: '0.78rem' }}>
                      {b.message.slice(0, 80)}{b.message.length > 80 ? '…' : ''}
                    </td>
                    <td><span className="badge badge-muted">{b.audience}</span></td>
                    <td>
                      {(b.channels || []).map(c => (
                        <span key={c} className={`badge ${c === 'push' ? 'badge-success' : c === 'email' ? 'badge-info' : 'badge-muted'}`} style={{ marginRight: 2 }}>
                          {c}
                        </span>
                      ))}
                    </td>
                    <td style={{ fontWeight: 600 }}>{b.sent_count}</td>
                    <td>
                      <span className={`badge ${b.status === 'sent' ? 'badge-success' : b.status === 'failed' ? 'badge-error' : 'badge-muted'}`}>{b.status}</span>
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {b.sent_at ? fmtDateTime(b.sent_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => { if (confirm('Delete this broadcast record?')) { adminAPI.deleteBroadcast(b.id).then(load); } }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal bc-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">New Broadcast</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {isEmailSelected && (
                  <button
                    className={`btn btn-sm ${previewMode ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPreview(v => !v)}
                    title="Toggle email preview"
                  >
                    <Eye size={13} /> {previewMode ? 'Hide Preview' : 'Preview Email'}
                  </button>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setModal(false)}><X size={16} /></button>
              </div>
            </div>

            <div className={`bc-modal-body ${previewMode && isEmailSelected ? 'bc-modal-split' : ''}`}>
              {/* ── Left: Form ── */}
              <div className="bc-form-col">
                <div className="field">
                  <label>Title *<span className="text-muted" style={{ fontSize: '0.7rem', marginLeft: 6 }}>(shown in SMS / push subject)</span></label>
                  <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekend Special Offer!" />
                </div>

                <div className="field">
                  <label>Message *<span className="text-muted" style={{ fontSize: '0.7rem', marginLeft: 6 }}>(SMS body + email body text)</span></label>
                  <textarea className="input textarea" rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="e.g. Get 20% off all platters this weekend. Use code WEEKEND20 at checkout." />
                  <p className="bc-char-count">{form.message.length} chars · {Math.ceil(form.message.length / 160)} SMS segment{Math.ceil(form.message.length / 160) !== 1 ? 's' : ''}</p>
                </div>

                <div className="field">
                  <label>Audience</label>
                  <select className="input select" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                    <option value="all">All Customers (placed orders)</option>
                    <option value="customers">Registered Users</option>
                    <option value="subscribers">Newsletter Subscribers</option>
                  </select>
                </div>

                <div className="field">
                  <label>Channels</label>
                  <div className="bc-channels">
                    {[
                      { id: 'sms',   label: 'SMS',   note: 'Twilio · phone numbers from orders' },
                      { id: 'email', label: 'Email', note: 'SendGrid · registered customers' },
                      { id: 'push',  label: 'Push',  note: 'FCM · users with device tokens' },
                    ].map(ch => (
                      <label key={ch.id} className="bc-channel-opt">
                        <input type="checkbox" checked={form.channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                        <span>{ch.label}</span>
                        <span className="text-muted" style={{ fontSize: '0.68rem' }}>({ch.note})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── Email Template Section ── */}
                {isEmailSelected && (
                  <div className="bc-email-template">
                    <p className="bc-email-template-title"><Mail size={14} /> Email Template Options</p>

                    <div className="field">
                      <label>Email Subject <span className="text-muted">(overrides title for email only)</span></label>
                      <input className="input" value={form.email_template.subject} onChange={e => setTmpl('subject', e.target.value)} placeholder={form.title || 'e.g. 🔥 Weekend Special — 20% Off Platters!'} />
                    </div>

                    <div className="field">
                      <label>Banner Style</label>
                      <div className="bc-banner-grid">
                        {BANNER_TYPES.map(bt => (
                          <button
                            key={bt.value}
                            type="button"
                            className={`bc-banner-btn ${form.email_template.banner_type === bt.value ? 'active' : ''}`}
                            style={{ '--banner-bg': bt.bg, '--banner-text': bt.text }}
                            onClick={() => setTmpl('banner_type', bt.value)}
                          >
                            <span className="bc-banner-swatch" style={{ background: bt.bg }} />
                            {bt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label>Hero Tagline <span className="text-muted">(big headline in the banner — optional)</span></label>
                      <input className="input" value={form.email_template.hero_text} onChange={e => setTmpl('hero_text', e.target.value)} placeholder="e.g. 🎉 WEEKEND SPECIAL — 20% OFF PLATTERS" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="field">
                        <label>CTA Button Text</label>
                        <input className="input" value={form.email_template.cta_text} onChange={e => setTmpl('cta_text', e.target.value)} placeholder="e.g. Order Now" />
                      </div>
                      <div className="field">
                        <label>CTA Button URL</label>
                        <input className="input" type="url" value={form.email_template.cta_url} onChange={e => setTmpl('cta_url', e.target.value)} placeholder="https://habibihe.com/menu" />
                      </div>
                    </div>

                    <div className="field">
                      <label>Footer Note <span className="text-muted">(fine print — optional)</span></label>
                      <input className="input" value={form.email_template.footer_note} onChange={e => setTmpl('footer_note', e.target.value)} placeholder="e.g. Offer valid through Sunday. One use per customer." />
                    </div>
                  </div>
                )}

                {result && (
                  <p className={result.startsWith('Error') ? 'text-error' : 'text-success'} style={{ marginTop: '0.75rem' }}>{result}</p>
                )}
              </div>

              {/* ── Right: Email Preview ── */}
              {previewMode && isEmailSelected && (
                <div className="bc-preview-col">
                  <p className="bc-preview-label">Email Preview</p>
                  <div className="bc-preview-wrap">
                    <EmailPreview
                      title={form.title}
                      message={form.message}
                      template={form.email_template}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={send}
                disabled={sending || !form.title.trim() || !form.message.trim() || form.channels.length === 0}
              >
                {sending ? <div className="spinner" /> : <><Send size={14} /> Send Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
