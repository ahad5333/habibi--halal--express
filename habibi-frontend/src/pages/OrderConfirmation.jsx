import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, ChevronRight, ShoppingBag, Star } from 'lucide-react';
import { trackPurchase } from '../utils/analytics';
import './OrderConfirmation.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function ReviewWidget({ orderNum }) {
  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus]   = useState('idle'); // idle | saving | done | error

  const submit = async () => {
    if (!rating) return;
    setStatus('saving');
    try {
      const token = localStorage.getItem('habibi_token');
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_number:   orderNum,
          customer_name:  'Customer',
          rating,
          comment: comment.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review.');
      setStatus('done');
    } catch (e) {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="orc-review-card orc-review-done">
        <CheckCircle size={22} color="#34d399" />
        <p>Thanks for your review! It'll appear on the site after moderation.</p>
      </div>
    );
  }

  return (
    <div className="orc-review-card">
      <p className="orc-review-title">How was your order? ⭐</p>
      <div className="orc-stars">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            className={`orc-star-btn${n <= (hover || rating) ? ' lit' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >
            <Star size={24} fill={n <= (hover || rating) ? '#E5B64E' : 'none'} color="#E5B64E" />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <textarea
          className="orc-review-textarea"
          rows={3}
          placeholder="Tell us more (optional)…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
        />
      )}
      {status === 'error' && <p className="orc-review-error">Couldn't submit — please try again.</p>}
      <button
        className="orc-btn-review"
        onClick={submit}
        disabled={!rating || status === 'saving'}
      >
        {status === 'saving' ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  );
}

const STEPS = [
  { id: 'confirmed', label: 'Order Confirmed', icon: '✓', desc: 'We got your order!' },
  { id: 'preparing', label: 'Preparing',        icon: '👨‍🍳', desc: 'Kitchen is on it'  },
  { id: 'on_the_way', label: 'On the Way',      icon: '🛵', desc: 'Driver en route'  },
  { id: 'delivered', label: 'Delivered',         icon: '🎉', desc: 'Enjoy your meal!' },
];

export default function OrderConfirmation() {
  const [params]  = useSearchParams();
  const orderNum  = params.get('order') || localStorage.getItem('last_order_number') || 'HHE-' + Math.floor(Math.random() * 90000 + 10000);
  const method    = params.get('method') || 'delivery';
  const [elapsed, setElapsed] = useState(0);
  const ETA_MIN = 25, ETA_MAX = 40;

  useEffect(() => {
    // Fire purchase event once — read snapshot saved by Checkout before cart was cleared
    try {
      const raw = localStorage.getItem('last_order_track');
      if (raw) {
        const { items: ordItems, total: ordTotal } = JSON.parse(raw);
        trackPurchase(orderNum, ordItems || [], parseFloat(ordTotal) || 0);
        localStorage.removeItem('last_order_track');
      }
    } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const etaMin = Math.max(0, ETA_MIN - elapsed);
  const etaMax = Math.max(0, ETA_MAX - elapsed);

  return (
    <div className="orc-page">
      <div className="orc-container">

        {/* Success header */}
        <div className="orc-hero">
          <div className="orc-check-ring">
            <CheckCircle size={52} strokeWidth={1.5} />
          </div>
          <h1 className="orc-title">Order Placed!</h1>
          <p className="orc-subtitle">
            Thank you for your order. We&apos;re getting it ready right now.
          </p>
        </div>

        {/* Order number + ETA */}
        <div className="orc-info-row">
          <div className="orc-info-card">
            <ShoppingBag size={18} />
            <div>
              <p className="orc-info-label">Order Number</p>
              <p className="orc-info-val">{orderNum}</p>
            </div>
          </div>
          <div className="orc-info-card">
            <Clock size={18} />
            <div>
              <p className="orc-info-label">Estimated {method === 'pickup' ? 'Pickup' : 'Delivery'}</p>
              <p className="orc-info-val">
                {etaMin === 0 ? 'Any moment now!' : `${etaMin}–${etaMax} min`}
              </p>
            </div>
          </div>
          {method === 'delivery' && (
            <div className="orc-info-card">
              <MapPin size={18} />
              <div>
                <p className="orc-info-label">Delivery to</p>
                <p className="orc-info-val">{params.get('address') || 'Your address'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status tracker */}
        <div className="orc-tracker">
          <h3 className="orc-tracker-title">Live Order Status</h3>
          <div className="orc-steps">
            {STEPS.map((step, i) => (
              <div key={step.id} className={`orc-step ${i === 0 ? 'active' : 'pending'}`}>
                <div className="orc-step-dot">
                  <span>{step.icon}</span>
                </div>
                {i < STEPS.length - 1 && <div className="orc-step-line" />}
                <p className="orc-step-label">{step.label}</p>
                <p className="orc-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Halal badge */}
        <div className="orc-halal">
          <img src="/images/logos/halal.png" alt="Halal Certified" />
          <div>
            <p className="orc-halal-title">100% Halal Certified</p>
            <p className="orc-halal-sub">Every ingredient — hand-slaughtered Zabiha Halal</p>
          </div>
        </div>

        {/* Review */}
        <ReviewWidget orderNum={orderNum} />

        {/* CTAs */}
        <div className="orc-actions">
          <Link to="/order-tracking" className="orc-btn-primary">
            Track Your Order <ChevronRight size={16} />
          </Link>
          <Link to="/menu" className="orc-btn-secondary">
            Order Again
          </Link>
        </div>

      </div>
    </div>
  );
}
