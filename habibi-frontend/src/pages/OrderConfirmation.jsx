import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, ChevronRight, ShoppingBag, Star } from 'lucide-react';
import { io } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { trackPurchase } from '../utils/analytics';
import './OrderConfirmation.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const STATUS_TO_STEP = {
  pending: 0, received: 0,
  accepted: 0, confirmed: 0,
  preparing: 1, cooking: 1,
  on_the_way: 2, in_transit: 2, 'in-transit': 2,
  nearby: 2,
  delivered: 3, completed: 3,
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function ReviewWidget({ orderNum }) {
  const { t } = useTranslation();
  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus]   = useState('idle'); // idle | saving | done | error
  // The backend only fills in the real name from a logged-in session — a guest
  // checkout (most orders) has none, so without this every guest review posted
  // from this widget would literally show up as authored by "Customer".
  const [customerName, setCustomerName] = useState('Customer');

  useEffect(() => {
    if (!orderNum) return;
    fetch(`${API_BASE}/api/orders/track/${encodeURIComponent(orderNum)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.customer_name) setCustomerName(data.customer_name); })
      .catch(() => {});
  }, [orderNum]);

  const submit = async () => {
    if (!rating) return;
    setStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number:   orderNum,
          customer_name:  customerName,
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
        <p>{t('orderConfirmation.reviewThanks')}</p>
      </div>
    );
  }

  return (
    <div className="orc-review-card">
      <p className="orc-review-title">{t('orderConfirmation.howWasOrder')}</p>
      <div className="orc-stars">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            className={`orc-star-btn${n <= (hover || rating) ? ' lit' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={t('orderConfirmation.starLabel', { n })}
          >
            <Star size={24} fill={n <= (hover || rating) ? '#E5B64E' : 'none'} color="#E5B64E" />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <textarea
          className="orc-review-textarea"
          rows={3}
          placeholder={t('orderConfirmation.tellUsMore')}
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
        />
      )}
      {status === 'error' && <p className="orc-review-error">{t('orderConfirmation.couldNotSubmit')}</p>}
      <button
        className="orc-btn-review"
        onClick={submit}
        disabled={!rating || status === 'saving'}
      >
        {status === 'saving' ? t('orderConfirmation.submitting') : t('orderConfirmation.submitReview')}
      </button>
    </div>
  );
}

const STEP_IDS = ['confirmed', 'preparing', 'on_the_way', 'delivered'];
const STEP_ICONS = { confirmed: '✓', preparing: '👨‍🍳', on_the_way: '🛵', delivered: '🎉' };

export default function OrderConfirmation() {
  const { t } = useTranslation();
  const STEPS = STEP_IDS.map(id => ({
    id,
    icon: STEP_ICONS[id],
    label: t(`orderConfirmation.step${id === 'on_the_way' ? 'OnTheWay' : id[0].toUpperCase() + id.slice(1)}`),
    desc: t(`orderConfirmation.step${id === 'on_the_way' ? 'OnTheWay' : id[0].toUpperCase() + id.slice(1)}Desc`),
  }));
  const [params]  = useSearchParams();
  // No fabricated fallback number here — showing a fake "Order Placed!" success
  // page (with a made-up order number and a progress tracker) to someone who
  // didn't actually just order anything is actively misleading, not a harmless
  // default. See the no-order early return below for what happens instead.
  const orderNum  = params.get('order') || localStorage.getItem('last_order_number') || '';
  const method    = params.get('method') || 'delivery';
  const [elapsed, setElapsed]       = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const socketRef = useRef(null);
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

  // Live status via Socket.IO — advances the step tracker in real-time
  useEffect(() => {
    if (!orderNum) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_order', orderNum));
    socket.on('order_status_updated', ({ status }) => {
      const step = STATUS_TO_STEP[(status || '').toLowerCase()];
      if (step !== undefined) setCurrentStep(step);
    });
    return () => socket.disconnect();
  }, [orderNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const etaMin = Math.max(0, ETA_MIN - elapsed);
  const etaMax = Math.max(0, ETA_MAX - elapsed);

  if (!orderNum) {
    return (
      <div className="orc-page">
        <div className="orc-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <ShoppingBag size={40} style={{ opacity: 0.4, marginBottom: '1rem' }} />
          <h1 className="orc-title">{t('orderConfirmation.noOrderFound')}</h1>
          <p className="orc-subtitle">
            {t('orderConfirmation.noOrderFoundDesc')}
          </p>
          <div className="orc-actions">
            <Link to="/order-tracking" className="orc-btn-primary">{t('orderConfirmation.trackAnOrder')}</Link>
            <Link to="/menu" className="orc-btn-secondary">{t('orderConfirmation.orderNow')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orc-page">
      <div className="orc-container">

        {/* Success header */}
        <div className="orc-hero">
          <div className="orc-check-ring">
            <CheckCircle size={52} strokeWidth={1.5} />
          </div>
          <h1 className="orc-title">{t('orderConfirmation.orderPlaced')}</h1>
          <p className="orc-subtitle">
            {t('orderConfirmation.gettingItReady')}
          </p>
        </div>

        {/* Order number + ETA */}
        <div className="orc-info-row">
          <div className="orc-info-card">
            <ShoppingBag size={18} />
            <div>
              <p className="orc-info-label">{t('orderConfirmation.orderNumber')}</p>
              <p className="orc-info-val">{orderNum}</p>
            </div>
          </div>
          <div className="orc-info-card">
            <Clock size={18} />
            <div>
              <p className="orc-info-label">{t('orderConfirmation.estimated')} {method === 'pickup' ? t('orderConfirmation.pickup') : t('orderConfirmation.delivery')}</p>
              <p className="orc-info-val">
                {etaMin === 0 ? t('orderConfirmation.anyMomentNow') : t('orderConfirmation.minRange', { min: etaMin, max: etaMax })}
              </p>
            </div>
          </div>
          {method === 'delivery' && (
            <div className="orc-info-card">
              <MapPin size={18} />
              <div>
                <p className="orc-info-label">{t('orderConfirmation.deliveryTo')}</p>
                <p className="orc-info-val">{params.get('address') || t('orderConfirmation.yourAddress')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status tracker */}
        <div className="orc-tracker">
          <div className="orc-tracker-head">
            <h3 className="orc-tracker-title">{t('orderConfirmation.liveOrderStatus')}</h3>
            <span className="orc-live-badge"><span className="orc-live-dot" />{t('orderConfirmation.live')}</span>
          </div>
          <div
            className="orc-steps"
            style={{ '--orc-progress': `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          >
            <div className="orc-steps-track">
              <div className="orc-steps-fill" />
            </div>
            {STEPS.map((step, i) => {
              const done   = i < currentStep;
              const active = i === currentStep;
              const last   = i === STEPS.length - 1;
              return (
              <div
                key={step.id}
                className={`orc-step ${done ? 'done' : active ? 'active' : 'pending'}${done && last ? ' orc-step-celebrate' : ''}`}
                style={{ '--i': i }}
              >
                <div className="orc-step-dot">
                  {active && (
                    <>
                      <span className="orc-ping orc-ping-1" />
                      <span className="orc-ping orc-ping-2" />
                    </>
                  )}
                  <span className="orc-step-icon">{done ? '✓' : step.icon}</span>
                </div>
                <p className="orc-step-label">{step.label}</p>
                <p className="orc-step-desc">{step.desc}</p>
              </div>
              );
            })}
          </div>
        </div>

        {/* Halal badge */}
        <div className="orc-halal">
          <img src="/images/logos/halal-certified-premium.webp" alt="Halal Certified" />
          <div>
            <p className="orc-halal-title">{t('orderConfirmation.halalCertifiedTitle')}</p>
            <p className="orc-halal-sub">{t('orderConfirmation.halalCertifiedDesc')}</p>
          </div>
        </div>

        {/* Review */}
        <ReviewWidget orderNum={orderNum} />

        {/* CTAs */}
        <div className="orc-actions">
          <Link to={`/order-tracking?order=${orderNum}`} className="orc-btn-primary">
            {t('orderConfirmation.trackYourOrder')} <ChevronRight size={16} />
          </Link>
          <Link to="/menu" className="orc-btn-secondary">
            {t('orderConfirmation.orderAgain')}
          </Link>
        </div>

      </div>
    </div>
  );
}
