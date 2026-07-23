import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, Trash2, MessageSquare, X, CheckCircle, XCircle, Award, ShieldCheck } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Reviews.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const TABS = [
  { key: '',         label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'featured', label: 'Featured' },
];

const RATING_OPTIONS = [5, 4, 3, 2, 1];

function StarDisplay({ rating }) {
  return (
    <span className="rev-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={13}
          className={n <= rating ? 'rev-star-filled' : 'rev-star-empty'}
          fill={n <= rating ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}


export default function Reviews() {
  const [tab, setTab]             = useState('pending');
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [replyModal, setReplyModal] = useState(null); // review object
  const [replyText, setReplyText]   = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [deleteId, setDeleteId]   = useState(null);
  const [search, setSearch]       = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminAPI.getReviews(tab);
      setReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function toggle(id, field, current) {
    try {
      const updated = await adminAPI.updateReview(id, { [field]: !current });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    } catch (e) {
      alert(e.message);
    }
  }

  async function saveReply() {
    if (!replyModal) return;
    setReplySaving(true);
    try {
      const updated = await adminAPI.updateReview(replyModal.id, { reply: replyText.trim() || null });
      setReviews(prev => prev.map(r => r.id === replyModal.id ? { ...r, ...updated } : r));
      setReplyModal(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setReplySaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await adminAPI.deleteReview(deleteId);
      setReviews(prev => prev.filter(r => r.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      alert(e.message);
    }
  }

  function openReply(review) {
    setReplyText(review.reply || '');
    setReplyModal(review);
  }

  const pendingCount = reviews.filter(r => !r.is_approved).length;

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter(r => {
      if (ratingFilter && r.rating !== parseInt(ratingFilter, 10)) return false;
      if (!q) return true;
      return (r.customer_name || '').toLowerCase().includes(q) ||
             (r.customer_email || '').toLowerCase().includes(q) ||
             (r.comment || '').toLowerCase().includes(q);
    });
  }, [reviews, search, ratingFilter]);

  return (
    <div className="reviews-admin">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Reviews</h1>
          <p className="page-sub">Moderate, approve, and reply to customer feedback</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rev-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`rev-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && tab !== 'pending' && (
              <span className="rev-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + rating filter */}
      <div className="rev-toolbar">
        <input
          className="rev-search"
          placeholder="Search name, email, comment…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="rev-rating-select" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
          <option value="">All ratings</option>
          {RATING_OPTIONS.map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading && <div className="rev-empty">Loading…</div>}
      {error   && <div className="rev-empty rev-error">{error}</div>}
      {!loading && !error && reviews.length === 0 && (
        <div className="rev-empty">No reviews in this category.</div>
      )}
      {!loading && !error && reviews.length > 0 && filteredReviews.length === 0 && (
        <div className="rev-empty">No reviews match your search/filter.</div>
      )}

      {!loading && !error && filteredReviews.length > 0 && (
        <div className="rev-list">
          {filteredReviews.map(r => (
            <div key={r.id} className={`rev-card${r.is_featured ? ' rev-card-featured' : ''}${!r.is_approved ? ' rev-card-pending' : ''}`}>
              <div className="rev-card-top">
                <div className="rev-meta">
                  <div className="rev-author-row">
                    <span className="rev-author">{r.customer_name}</span>
                    {r.verified_order && (
                      <span className="rev-chip rev-chip-verified" title="order_number matches a real order">
                        <ShieldCheck size={11} /> Verified Purchase
                      </span>
                    )}
                    {r.is_featured && (
                      <span className="rev-chip rev-chip-featured">
                        <Award size={11} /> Featured
                      </span>
                    )}
                    {!r.is_approved && (
                      <span className="rev-chip rev-chip-pending">Pending</span>
                    )}
                  </div>
                  {r.customer_email && <div className="rev-email">{r.customer_email}</div>}
                  <div className="rev-sub-row">
                    <StarDisplay rating={r.rating} />
                    <span className="rev-date">{fmtDate(r.created_at)}</span>
                    {r.order_number && <span className="rev-order">#{r.order_number}</span>}
                  </div>
                </div>

                <div className="rev-actions">
                  <button
                    className={`rev-action-btn${r.is_approved ? ' active-green' : ''}`}
                    title={r.is_approved ? 'Revoke approval' : 'Approve'}
                    onClick={() => toggle(r.id, 'is_approved', r.is_approved)}
                  >
                    {r.is_approved ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {r.is_approved ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    className={`rev-action-btn${r.is_featured ? ' active-gold' : ''}`}
                    title={r.is_featured ? 'Unfeature' : 'Feature on site'}
                    onClick={() => toggle(r.id, 'is_featured', r.is_featured)}
                  >
                    <Award size={16} />
                    {r.is_featured ? 'Featured' : 'Feature'}
                  </button>
                  <button
                    className="rev-action-btn"
                    title="Reply"
                    onClick={() => openReply(r)}
                  >
                    <MessageSquare size={16} />
                    Reply
                  </button>
                  <button
                    className="rev-action-btn rev-action-delete"
                    title="Delete"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {r.comment && <p className="rev-comment">{r.comment}</p>}

              {r.reply && (
                <div className="rev-reply-block">
                  <span className="rev-reply-label">Our reply:</span>
                  <p className="rev-reply-text">{r.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {replyModal && (
        <div className="rev-modal-overlay" onClick={() => setReplyModal(null)}>
          <div className="rev-modal" onClick={e => e.stopPropagation()}>
            <div className="rev-modal-header">
              <h3>Reply to {replyModal.customer_name}</h3>
              <button className="rev-modal-close" onClick={() => setReplyModal(null)}>
                <X size={18} />
              </button>
            </div>
            {replyModal.comment && (
              <blockquote className="rev-modal-quote">"{replyModal.comment}"</blockquote>
            )}
            <textarea
              className="rev-textarea"
              rows={5}
              placeholder="Write your reply…"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <div className="rev-modal-footer">
              <button className="btn-admin btn-admin-ghost" onClick={() => setReplyModal(null)}>
                Cancel
              </button>
              <button
                className="btn-admin btn-admin-primary"
                onClick={saveReply}
                disabled={replySaving}
              >
                {replySaving ? 'Saving…' : 'Save Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="rev-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="rev-modal rev-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="rev-modal-header">
              <h3>Delete Review</h3>
              <button className="rev-modal-close" onClick={() => setDeleteId(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="rev-modal-body">This action cannot be undone. Are you sure?</p>
            <div className="rev-modal-footer">
              <button className="btn-admin btn-admin-ghost" onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button className="btn-admin btn-admin-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
