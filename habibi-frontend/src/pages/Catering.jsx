import React, { useState } from 'react';
import { CalendarDays, Users, Truck, MapPin, CheckCircle, ChevronRight, ChevronLeft, UtensilsCrossed } from 'lucide-react';
import SEO from '../components/SEO';
import './Catering.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const EVENT_TYPES = [
  { value: 'Wedding',         emoji: '💍' },
  { value: 'Corporate Event', emoji: '🏢' },
  { value: 'Birthday Party',  emoji: '🎂' },
  { value: 'Graduation',      emoji: '🎓' },
  { value: 'Religious Event', emoji: '🕌' },
  { value: 'School / College',emoji: '🏫' },
  { value: 'Fundraiser',      emoji: '🤝' },
  { value: 'Other',           emoji: '🎉' },
];

const SERVICE_TYPES = [
  { value: 'delivery',  label: 'Delivery',     icon: <Truck size={18} />,         desc: 'We bring it to your venue' },
  { value: 'pickup',    label: 'Pickup',        icon: <MapPin size={18} />,        desc: 'Pick up from our kitchen' },
  { value: 'on-site',   label: 'On-Site Setup', icon: <UtensilsCrossed size={18}/>, desc: 'Full setup at your location' },
];

const PRICE_PER_HEAD = (n) => {
  if (n >= 100) return 12;
  if (n >= 51)  return 14;
  if (n >= 31)  return 16;
  return 18;
};

const estimateTotal = (guests) => Math.max(200, guests * PRICE_PER_HEAD(guests));

const formatCurrency = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const STEPS = ['Event Details', 'Your Details', 'Confirmation'];

const initialForm = {
  event_type:   '',
  event_date:   '',
  event_time:   '',
  guest_count:  20,
  service_type: 'delivery',
  name:         '',
  email:        '',
  phone:        '',
  notes:        '',
};

export default function Catering() {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState(initialForm);
  const [submitting, setSub]  = useState(false);
  const [done, setDone]       = useState(null);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const estimated = estimateTotal(parseInt(form.guest_count) || 20);

  const canNext0 = form.event_type && form.event_date && form.guest_count >= 10;
  const canNext1 = form.name.trim() && form.email.trim().includes('@');

  const handleSubmit = async () => {
    setSub(true); setError('');
    try {
      const payload = {
        name:         form.name.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim(),
        event_type:   form.event_type,
        event_date:   `${form.event_date}T${form.event_time || '12:00'}:00`,
        guest_count:  parseInt(form.guest_count),
        service_type: form.service_type,
        notes:        form.notes.trim(),
      };
      const res = await fetch(`${API_BASE}/api/reservations/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setDone(data);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSub(false);
    }
  };

  /* ─── Success screen ─── */
  if (step === 3 && done) {
    return (
      <div className="cat-page page-watermark">
        <SEO title="Catering Request Sent | Habibi Halal Express" description="Your catering quote request has been received." />
        <div className="cat-success">
          <div className="cat-success-icon"><CheckCircle size={56} strokeWidth={1.5} /></div>
          <h1>Quote Request Sent!</h1>
          <p>Thank you, <strong>{form.name}</strong>. We've received your inquiry for <strong>{form.guest_count} guests</strong> and will send you a custom quote within 24–48 hours.</p>
          <div className="cat-success-ref">
            Quote reference: <strong>#CAT-{String(done.data?.id || '—').padStart(4,'0')}</strong>
          </div>
          <p className="cat-success-sub">Check your inbox at <strong>{form.email}</strong> for a confirmation. For urgent bookings call us at (347) 703-3731.</p>
          <a href="/menu" className="cat-back-btn">Browse Our Menu</a>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-page page-watermark">
      <SEO
        title="Catering | Habibi Halal Express — Events & Group Orders"
        description="Book Habibi Halal Express for your next event. Weddings, corporate events, parties — 20 to 500+ guests. Get a free custom quote."
        keywords="halal catering bronx, halal event catering ny, halal wedding food, corporate halal catering"
      />

      {/* Hero */}
      <div className="cat-hero">
        <div className="cat-hero-overlay" />
        <div className="cat-hero-content">
          <span className="cat-hero-tag">🍽️ Habibi Catering</span>
          <h1>Feed Your Whole Crew</h1>
          <p>Authentic Halal catering for weddings, corporate events, and everything in between. 20 to 500+ guests.</p>
        </div>
      </div>

      {/* Pricing bar */}
      <div className="cat-pricing-bar">
        <div className="cat-pricing-inner">
          <div className="cat-price-tier"><span className="cat-tier-guests">20–30 guests</span><span className="cat-tier-price">$18/person</span></div>
          <div className="cat-price-divider" />
          <div className="cat-price-tier"><span className="cat-tier-guests">31–50 guests</span><span className="cat-tier-price">$16/person</span></div>
          <div className="cat-price-divider" />
          <div className="cat-price-tier"><span className="cat-tier-guests">51–100 guests</span><span className="cat-tier-price">$14/person</span></div>
          <div className="cat-price-divider" />
          <div className="cat-price-tier"><span className="cat-tier-guests">100+ guests</span><span className="cat-tier-price">$12/person</span></div>
        </div>
      </div>

      {/* Form container */}
      <div className="cat-form-wrap">

        {/* Step indicator */}
        <div className="cat-stepper">
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <div className={`cat-step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="cat-step-circle">
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className="cat-step-label">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`cat-step-line ${i < step ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Live estimate pill */}
        {step < 2 && (
          <div className="cat-estimate-pill">
            <Users size={14} />
            <span>{form.guest_count} guests</span>
            <span className="cat-est-sep">·</span>
            <span className="cat-est-price">Est. {formatCurrency(estimated)}+</span>
          </div>
        )}

        {/* ── Step 0: Event Details ── */}
        {step === 0 && (
          <div className="cat-panel">
            <h2 className="cat-panel-title">
              <CalendarDays size={20} /> Event Details
            </h2>

            <label className="cat-label">Event Type</label>
            <div className="cat-event-grid">
              {EVENT_TYPES.map(e => (
                <button
                  key={e.value}
                  className={`cat-event-btn ${form.event_type === e.value ? 'selected' : ''}`}
                  onClick={() => set('event_type', e.value)}
                >
                  <span className="cat-event-emoji">{e.emoji}</span>
                  <span>{e.value}</span>
                </button>
              ))}
            </div>

            <div className="cat-row">
              <div className="cat-field">
                <label className="cat-label">Event Date</label>
                <input
                  type="date"
                  className="cat-input"
                  value={form.event_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('event_date', e.target.value)}
                />
              </div>
              <div className="cat-field">
                <label className="cat-label">Preferred Time</label>
                <input
                  type="time"
                  className="cat-input"
                  value={form.event_time}
                  onChange={e => set('event_time', e.target.value)}
                />
              </div>
            </div>

            <label className="cat-label">Guest Count: <strong>{form.guest_count}</strong></label>
            <div className="cat-guest-row">
              <input
                type="range"
                min={10} max={500} step={5}
                value={form.guest_count}
                onChange={e => set('guest_count', parseInt(e.target.value))}
                className="cat-slider"
              />
              <input
                type="number"
                className="cat-input cat-guest-num"
                min={10} max={500}
                value={form.guest_count}
                onChange={e => set('guest_count', Math.max(10, parseInt(e.target.value) || 10))}
              />
            </div>

            <label className="cat-label">Service Type</label>
            <div className="cat-service-grid">
              {SERVICE_TYPES.map(s => (
                <button
                  key={s.value}
                  className={`cat-service-btn ${form.service_type === s.value ? 'selected' : ''}`}
                  onClick={() => set('service_type', s.value)}
                >
                  <span className="cat-service-icon">{s.icon}</span>
                  <span className="cat-service-label">{s.label}</span>
                  <span className="cat-service-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Your Details ── */}
        {step === 1 && (
          <div className="cat-panel">
            <h2 className="cat-panel-title">
              <Users size={20} /> Your Details
            </h2>
            <div className="cat-row">
              <div className="cat-field">
                <label className="cat-label">Full Name *</label>
                <input type="text" className="cat-input" placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="cat-field">
                <label className="cat-label">Phone</label>
                <input type="tel" className="cat-input" placeholder="(718) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
            <div className="cat-field">
              <label className="cat-label">Email Address *</label>
              <input type="email" className="cat-input" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="cat-field">
              <label className="cat-label">Special Requirements / Notes</label>
              <textarea
                className="cat-input cat-textarea"
                placeholder="Dietary restrictions, venue address, specific menu requests, setup instructions..."
                rows={4}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Review & Submit ── */}
        {step === 2 && (
          <div className="cat-panel">
            <h2 className="cat-panel-title">
              <CheckCircle size={20} /> Review & Confirm
            </h2>
            <div className="cat-review-grid">
              <div className="cat-review-row"><span>Event Type</span><strong>{form.event_type}</strong></div>
              <div className="cat-review-row"><span>Date & Time</span><strong>{form.event_date} {form.event_time && `at ${form.event_time}`}</strong></div>
              <div className="cat-review-row"><span>Guest Count</span><strong>{form.guest_count} guests</strong></div>
              <div className="cat-review-row"><span>Service</span><strong style={{ textTransform: 'capitalize' }}>{form.service_type}</strong></div>
              <div className="cat-review-row"><span>Name</span><strong>{form.name}</strong></div>
              <div className="cat-review-row"><span>Email</span><strong>{form.email}</strong></div>
              {form.phone && <div className="cat-review-row"><span>Phone</span><strong>{form.phone}</strong></div>}
              {form.notes && <div className="cat-review-row"><span>Notes</span><strong>{form.notes}</strong></div>}
            </div>
            <div className="cat-estimate-block">
              <p className="cat-est-label">Starting Estimate</p>
              <p className="cat-est-total">{formatCurrency(estimated)}</p>
              <p className="cat-est-note">Final price confirmed after admin review. No payment required now.</p>
            </div>
            {error && <div className="cat-error">⚠ {error}</div>}
          </div>
        )}

        {/* Navigation */}
        <div className="cat-nav">
          {step > 0 && (
            <button className="cat-btn-back" onClick={() => { setStep(s => s - 1); setError(''); }}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {step < 2 && (
            <button
              className="cat-btn-next"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 ? !canNext0 : !canNext1}
            >
              Continue <ChevronRight size={16} />
            </button>
          )}
          {step === 2 && (
            <button className="cat-btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Sending…' : 'Request Your Quote'}
            </button>
          )}
        </div>
      </div>

      {/* Trust section */}
      <div className="cat-trust">
        <div className="cat-trust-inner">
          <div className="cat-trust-item"><span>🥩</span><p>100% Zabiha Halal</p></div>
          <div className="cat-trust-item"><span>⏱</span><p>24-hr Quote Turnaround</p></div>
          <div className="cat-trust-item"><span>🚚</span><p>Delivery, Pickup & On-Site</p></div>
          <div className="cat-trust-item"><span>👥</span><p>20–500+ Guests</p></div>
          <div className="cat-trust-item"><span>📞</span><p>(347) 703-3731</p></div>
        </div>
      </div>
    </div>
  );
}
