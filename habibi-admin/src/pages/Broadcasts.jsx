import React, { useState, useEffect } from 'react';
import { Bell, Send, Trash2, X, Users, MessageSquare, Smartphone } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Broadcasts.css';

const BLANK = { title: '', message: '', audience: 'all', channels: ['sms'] };

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getBroadcasts();
      setBroadcasts(data);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await adminAPI.sendBroadcast(form);
      setResult(`Sent to ${res.sent_count} recipient${res.sent_count!==1?'s':''}`);
      setModal(false);
      setForm(BLANK);
      load();
    } catch (e) {
      setResult(`Error: ${e.message}`);
    }
    setSending(false);
  };

  const del = async (id) => {
    if (!confirm('Delete this broadcast record?')) return;
    await adminAPI.deleteBroadcast(id);
    load();
  };

  const toggleChannel = (ch) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }));
  };

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Notification Broadcasts</h1>
          <p className="page-sub">Send SMS or messages to all customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setForm(BLANK); setResult(null); }}>
          <Send size={15}/> New Broadcast
        </button>
      </div>

      {result && (
        <div className={`bc-result ${result.startsWith('Error') ? 'bc-result-err' : 'bc-result-ok'}`}>
          {result}
        </div>
      )}

      {/* Info card */}
      <div className="card bc-info-card">
        <div className="bc-info-icon"><Bell size={20}/></div>
        <div>
          <p className="bc-info-title">How Broadcasts Work</p>
          <p className="bc-info-text">
            <strong>SMS</strong> — sent to all phone numbers that have placed an order (requires Twilio in <code>.env</code>). ~$0.0075/msg.{' '}
            <strong>Email</strong> — sent to all customers / newsletter subscribers (requires SendGrid).{' '}
            <strong>Push</strong> — Firebase Cloud Messaging to all users with registered device tokens (requires <code>FCM_SERVER_KEY</code>).
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : broadcasts.length === 0 ? (
        <div className="empty card"><Bell size={32}/><p>No broadcasts sent yet</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Message</th><th>Audience</th><th>Channels</th><th>Recipients</th><th>Status</th><th>Sent At</th><th></th></tr>
              </thead>
              <tbody>
                {broadcasts.map(b => (
                  <tr key={b.id}>
                    <td style={{fontWeight:600}}>{b.title}</td>
                    <td className="text-muted" style={{maxWidth:200,fontSize:'0.78rem'}}>{b.message.slice(0,80)}{b.message.length>80?'…':''}</td>
                    <td><span className="badge badge-muted">{b.audience}</span></td>
                    <td>
                      {(b.channels||[]).map(c => (
                        <span key={c} className={`badge ${c==='push'?'badge-success':c==='email'?'badge-info':'badge-muted'}`} style={{marginRight:2}}>
                          {c==='push' ? <Smartphone size={10} style={{marginRight:2,verticalAlign:'middle'}}/>  : null}{c}
                        </span>
                      ))}
                    </td>
                    <td style={{fontWeight:600}}>{b.sent_count}</td>
                    <td>
                      <span className={`badge ${b.status==='sent'?'badge-success':b.status==='failed'?'badge-error':'badge-muted'}`}>{b.status}</span>
                    </td>
                    <td className="text-muted" style={{fontSize:'0.72rem',whiteSpace:'nowrap'}}>
                      {b.sent_at ? new Date(b.sent_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(b.id)}><Trash2 size={13}/></button>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">New Broadcast</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Title *</label>
                <input className="input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Weekend Special!" />
              </div>
              <div className="field">
                <label>Message *</label>
                <textarea className="input textarea" rows={4} value={form.message} onChange={e => setForm({...form,message:e.target.value})} placeholder="Habibi Halal Express: Get 20% off all platters this weekend! Use code WEEKEND20." />
                <p className="bc-char-count">{form.message.length}/160 chars (1 SMS segment)</p>
              </div>
              <div className="field">
                <label>Audience</label>
                <select className="input select" value={form.audience} onChange={e => setForm({...form,audience:e.target.value})}>
                  <option value="all">All Customers (who placed orders)</option>
                  <option value="customers">Registered Users</option>
                  <option value="subscribers">Newsletter Subscribers</option>
                </select>
              </div>
              <div className="field">
                <label>Channels</label>
                <div className="bc-channels">
                  {[
                    { id: 'sms',   label: 'SMS',   note: 'Twilio — phone numbers from orders' },
                    { id: 'email', label: 'Email', note: 'SendGrid — registered customers' },
                    { id: 'push',  label: 'Push',  note: 'FCM — users with device tokens' },
                  ].map(ch => (
                    <label key={ch.id} className="bc-channel-opt">
                      <input type="checkbox" checked={form.channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                      <span>{ch.label}</span>
                      <span className="text-muted" style={{fontSize:'0.68rem'}}>({ch.note})</span>
                    </label>
                  ))}
                </div>
              </div>

              {result && <p className={result.startsWith('Error')?'text-error':'text-success'}>{result}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={send} disabled={sending||!form.title.trim()||!form.message.trim()}>
                {sending ? <div className="spinner"/> : <><Send size={14}/> Send Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
