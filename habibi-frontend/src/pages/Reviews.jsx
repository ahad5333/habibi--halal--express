import React, { useState, useEffect, useCallback } from 'react';
import { Star, StarOff, Send, CheckCircle, ChevronDown, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reviewsAPI } from '../services/api';
import SEO from '../components/SEO';
import './Reviews.css';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarRating({ value, onChange, size = 28 }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  return (
    <div className="rv-star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`rv-star-btn${display >= n ? ' filled' : ''}`}
          style={{ width: size, height: size }}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange && onChange(n)}
          aria-label={`${n} star`}
        >
          <Star size={size} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  return (
    <div className={`rv-card${review.is_featured ? ' rv-card--featured' : ''}`}>
      {review.is_featured && (
        <div className="rv-featured-badge"><Award size={12} /> Featured</div>
      )}
      <div className="rv-card-header">
        <div className="rv-avatar">{review.customer_name.charAt(0).toUpperCase()}</div>
        <div className="rv-card-meta">
          <span className="rv-card-name">{review.customer_name}</span>
          <span className="rv-card-date">{date}</span>
        </div>
        <div className="rv-card-stars">
          {[1, 2, 3, 4, 5].map(n => (
            <Star key={n} size={14} className={n <= review.rating ? 'rv-star-filled' : 'rv-star-empty'} />
          ))}
        </div>
      </div>
      {review.comment && <p className="rv-card-comment">{review.comment}</p>}
      {review.reply && (
        <div className="rv-reply">
          <span className="rv-reply-label">Habibi's response</span>
          <p className="rv-reply-text">{review.reply}</p>
        </div>
      )}
    </div>
  );
}

function SubmitForm({ user, onSuccess, onCancel }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState(user?.name || '');
  const [comment, setComment] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Please select a star rating.'); return; }
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setLoading(true);
    try {
      await reviewsAPI.submit({
        customer_name: name.trim(),
        rating,
        comment: comment.trim() || undefined,
        order_number: orderNumber.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="rv-submit-form" onSubmit={handleSubmit}>
      <h3 className="rv-form-title">Write a Review</h3>

      <div className="rv-form-row rv-form-row--center">
        <StarRating value={rating} onChange={setRating} size={36} />
        {rating > 0 && <span className="rv-sentiment">{STAR_LABELS[rating]}</span>}
      </div>

      <div className="rv-form-row">
        <label className="rv-label">Your Name <span className="rv-required">*</span></label>
        <input
          className="rv-input"
          type="text"
          value={name}
          maxLength={100}
          placeholder="e.g. Ahmed S."
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="rv-form-row">
        <label className="rv-label">Your Review <span className="rv-optional">(optional)</span></label>
        <textarea
          className="rv-textarea"
          value={comment}
          maxLength={1000}
          rows={4}
          placeholder="Tell us about your experience..."
          onChange={e => setComment(e.target.value)}
        />
        <span className="rv-char-count">{comment.length}/1000</span>
      </div>

      <div className="rv-form-row">
        <label className="rv-label">Order Number <span className="rv-optional">(optional)</span></label>
        <input
          className="rv-input"
          type="text"
          value={orderNumber}
          maxLength={50}
          placeholder="e.g. HAB-123456"
          onChange={e => setOrderNumber(e.target.value)}
        />
      </div>

      {error && <p className="rv-form-error">{error}</p>}

      <p className="rv-moderation-note">
        Reviews are moderated and will appear after approval — usually within 24 hours.
      </p>

      <div className="rv-form-actions">
        <button type="button" className="rv-btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="rv-btn-submit" disabled={loading || !rating}>
          {loading ? 'Submitting…' : <><Send size={14} /> Submit Review</>}
        </button>
      </div>
    </form>
  );
}

function SuccessMessage({ onDone }) {
  return (
    <div className="rv-success">
      <CheckCircle size={48} className="rv-success-icon" />
      <h3>Thank You!</h3>
      <p>Your review has been submitted and will appear after moderation.</p>
      <button className="rv-btn-submit" onClick={onDone}>Back to Reviews</button>
    </div>
  );
}

export default function Reviews() {
  const { user } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formState, setFormState] = useState('idle'); // idle | form | success

  const PAGE_SIZE = 12;

  const fetchReviews = useCallback(async (pageNum = 1, reset = false) => {
    const params = { limit: PAGE_SIZE, sort };
    if (filter !== 'all') params.rating = filter;
    if (pageNum > 1) params.offset = (pageNum - 1) * PAGE_SIZE;

    try {
      const data = await reviewsAPI.getApproved(params);
      const newReviews = data.reviews || [];
      setReviews(prev => reset ? newReviews : [...prev, ...newReviews]);
      if (pageNum === 1 && data.stats) setStats(data.stats);
      setHasMore(newReviews.length === PAGE_SIZE);
    } catch (_) {}
  }, [filter, sort]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchReviews(1, true).finally(() => setLoading(false));
  }, [fetchReviews]);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    await fetchReviews(next, false);
    setPage(next);
    setLoadingMore(false);
  };

  const starBreakdown = stats
    ? [
        { label: '5★', count: stats.five_star, key: '5' },
        { label: '4★', count: stats.four_star, key: '4' },
        { label: '3★', count: stats.three_star, key: '3' },
        { label: '2★', count: stats.two_star, key: '2' },
        { label: '1★', count: stats.one_star, key: '1' },
      ]
    : [];

  const maxBar = starBreakdown.length ? Math.max(...starBreakdown.map(b => b.count), 1) : 1;

  return (
    <>
      <SEO
        title="Customer Reviews — Habibi Halal Express"
        description="Read what our customers are saying about Habibi Halal Express. Authentic halal food, real reviews."
        url="/reviews"
      />

      <div className="rv-page">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="rv-hero">
          <div className="rv-hero-inner">
            <p className="rv-hero-label">What People Are Saying</p>
            <h1 className="rv-hero-title">Customer Reviews</h1>
            <p className="rv-hero-sub">Real experiences from real customers. Honest feedback, every time.</p>
          </div>
        </div>

        <div className="rv-body">

          {/* ── Stats + Write CTA ────────────────────────────────── */}
          {stats && (
            <div className="rv-stats-row">
              <div className="rv-stats-score">
                <span className="rv-big-rating">{parseFloat(stats.avg_rating || 0).toFixed(1)}</span>
                <div className="rv-stats-stars">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={18} className={n <= Math.round(stats.avg_rating) ? 'rv-star-filled' : 'rv-star-empty'} />
                  ))}
                </div>
                <span className="rv-stats-total">{stats.total} {stats.total === 1 ? 'review' : 'reviews'}</span>
              </div>

              <div className="rv-stats-bars">
                {starBreakdown.map(b => (
                  <button
                    key={b.key}
                    className={`rv-bar-row${filter === b.key ? ' active' : ''}`}
                    onClick={() => setFilter(filter === b.key ? 'all' : b.key)}
                    title={`Filter by ${b.label}`}
                  >
                    <span className="rv-bar-label">{b.label}</span>
                    <div className="rv-bar-track">
                      <div
                        className="rv-bar-fill"
                        style={{ width: `${Math.round((b.count / maxBar) * 100)}%` }}
                      />
                    </div>
                    <span className="rv-bar-count">{b.count}</span>
                  </button>
                ))}
              </div>

              <div className="rv-cta-col">
                {formState === 'idle' && (
                  <button className="rv-write-btn" onClick={() => setFormState('form')}>
                    <Star size={16} /> Write a Review
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Submission form / success ────────────────────────── */}
          {formState === 'form' && (
            <SubmitForm
              user={user}
              onSuccess={() => setFormState('success')}
              onCancel={() => setFormState('idle')}
            />
          )}
          {formState === 'success' && (
            <SuccessMessage onDone={() => setFormState('idle')} />
          )}

          {/* ── Filter & Sort bar ────────────────────────────────── */}
          <div className="rv-controls">
            <div className="rv-filters">
              {['all','5','4','3','2','1'].map(v => (
                <button
                  key={v}
                  className={`rv-filter-pill${filter === v ? ' active' : ''}`}
                  onClick={() => setFilter(v)}
                >
                  {v === 'all' ? 'All' : `${v}★`}
                </button>
              ))}
            </div>
            <div className="rv-sort">
              <button
                className={`rv-sort-btn${sort === 'newest' ? ' active' : ''}`}
                onClick={() => setSort('newest')}
              >Newest</button>
              <button
                className={`rv-sort-btn${sort === 'rating' ? ' active' : ''}`}
                onClick={() => setSort('rating')}
              >Top Rated</button>
            </div>
          </div>

          {/* ── Review grid ─────────────────────────────────────── */}
          {loading ? (
            <div className="rv-loading">
              <div className="rv-spinner" />
              <p>Loading reviews…</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rv-empty">
              <StarOff size={40} />
              <p>{filter !== 'all' ? `No ${filter}-star reviews yet.` : 'No reviews yet. Be the first!'}</p>
              {formState === 'idle' && (
                <button className="rv-write-btn" onClick={() => setFormState('form')}>
                  Write the First Review
                </button>
              )}
            </div>
          ) : (
            <div className="rv-grid">
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}

          {/* ── Load more ───────────────────────────────────────── */}
          {!loading && hasMore && (
            <div className="rv-load-more">
              <button className="rv-load-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : <><ChevronDown size={16} /> Load More Reviews</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
