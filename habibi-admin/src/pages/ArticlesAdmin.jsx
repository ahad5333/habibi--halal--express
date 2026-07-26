import React, { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Eye, EyeOff, ExternalLink } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { adminAPI } from '../services/api';
import './ArticlesAdmin.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link'],
    [{ align: [] }],
    ['clean'],
  ],
};
const QUILL_FORMATS = ['header','bold','italic','underline','strike','list','blockquote','link','align'];

const EMPTY = { title: '', subtitle: '', body: '', category: 'General', is_published: true, sort_order: 0, media_url: '' };

export default function ArticlesAdmin() {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    fetch(`${BASE}/api/articles/admin/list`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setArticles(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setError('Failed to load articles'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY); setMediaFile(null); setMediaPreview(''); setModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, subtitle: a.subtitle || '', body: a.body || '', category: a.category || 'General', is_published: a.is_published, sort_order: a.sort_order || 0, media_url: a.media_url || '' });
    setMediaFile(null);
    setMediaPreview(a.media_url ? `${BASE}${a.media_url}` : '');
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.title.trim()) return setError('Title is required');
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title',       form.title);
      fd.append('subtitle',    form.subtitle);
      fd.append('body',        form.body);
      fd.append('category',    form.category);
      fd.append('is_published', form.is_published);
      fd.append('sort_order',  form.sort_order);
      if (mediaFile) fd.append('media', mediaFile);
      // Always send media_url (even empty) when no new file is picked, so
      // clicking the remove button actually clears it on save — the backend
      // treats an absent field as "unchanged", not "cleared".
      else fd.append('media_url', form.media_url || '');

      const url    = editing ? `${BASE}/api/articles/admin/${editing.id}` : `${BASE}/api/articles/admin`;
      const method = editing ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, body: fd, credentials: 'include' });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      load();
      closeModal();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this article?')) return;
    await fetch(`${BASE}/api/articles/admin/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <div className="art-admin-page">
      <div className="art-admin-header">
        <div>
          <h1 className="art-admin-title">Articles</h1>
          <p className="art-admin-sub">Manage blog articles and news that appear in the Articles section of the website.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Article</button>
      </div>

      {error && !modal && <div className="art-admin-error">{error}</div>}

      {loading ? (
        <div className="art-admin-loading">Loading articles...</div>
      ) : (
        <div className="art-admin-list">
          {articles.length === 0 && <p className="art-admin-empty">No articles yet. Click "New Article" to create one.</p>}
          {articles.map(a => (
            <div key={a.id} className={`art-admin-row${!a.is_published ? ' art-admin-row--draft' : ''}`}>
              {a.media_url && (
                <div className="art-admin-thumb">
                  <img src={`${BASE}${a.media_url}`} alt={a.title} />
                </div>
              )}
              <div className="art-admin-info">
                <div className="art-admin-row-top">
                  <span className="art-admin-cat-pill">{a.category}</span>
                  {!a.is_published && <span className="art-admin-draft-pill">Draft</span>}
                </div>
                <h3 className="art-admin-row-title">{a.title}</h3>
                {a.subtitle && <p className="art-admin-row-sub">{a.subtitle}</p>}
              </div>
              <div className="art-admin-row-actions">
                <a href={`/articles/${a.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon" title="Preview">
                  <ExternalLink size={14} />
                </a>
                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(a)} title="Edit">
                  <Pencil size={14} />
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => del(a.id)} title="Delete">
                  <Trash2 size={14} color="var(--color-error)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="art-modal-overlay" onClick={closeModal}>
          <div className="art-modal" onClick={e => e.stopPropagation()}>
            <div className="art-modal-hdr">
              <h2 className="art-modal-title">{editing ? 'Edit Article' : 'New Article'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="art-modal-body">
              {error && <div className="art-admin-error">{error}</div>}

              {/* Media upload */}
              <div className="field">
                <label className="label">Article Header Image</label>
                <div
                  className="art-media-drop"
                  onClick={() => fileRef.current?.click()}
                >
                  {mediaPreview ? (
                    <div className="art-media-preview">
                      <img src={mediaPreview} alt="Preview" />
                      <button type="button" className="art-media-remove" onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(''); set('media_url',''); }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} style={{ opacity: 0.4 }} />
                      <span>Click to upload header image</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>JPG, PNG, WebP — max 8 MB</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileRef} accept="image/*" style={{ display:'none' }} onChange={pickFile} />
              </div>

              {/* Title */}
              <div className="field">
                <label className="label">Title *</label>
                <input className="input" placeholder="e.g. Introducing Habibi Tacos" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>

              {/* Subtitle */}
              <div className="field">
                <label className="label">Subtitle</label>
                <input className="input" placeholder="A short tagline" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} />
              </div>

              {/* Category + sort */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:'0.75rem' }}>
                <div className="field">
                  <label className="label">Category</label>
                  <input className="input" placeholder="e.g. New on the Menu" value={form.category} onChange={e => set('category', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Sort Order</label>
                  <input className="input" type="number" min="0" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              {/* Published toggle */}
              <div className="art-published-row">
                <label>Published</label>
                <button type="button" className={`art-pub-toggle${form.is_published ? ' on' : ''}`}
                  onClick={() => set('is_published', !form.is_published)}>
                  {form.is_published ? <><Eye size={14} /> Live</> : <><EyeOff size={14} /> Draft</>}
                </button>
              </div>

              {/* Body — rich text editor */}
              <div className="field">
                <label className="label">Article Body</label>
                <div className="art-quill-wrap">
                  <ReactQuill
                    theme="snow"
                    value={form.body}
                    onChange={v => set('body', v)}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                    placeholder="Write your article here..."
                  />
                </div>
              </div>
            </div>
            <div className="art-modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Publish Article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
