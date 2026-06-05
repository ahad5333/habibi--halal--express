import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Star, AlertTriangle, Phone, Handshake,
  Tv, Mail, HelpCircle, CheckCircle, MapPin, ChevronRight
} from 'lucide-react';
import { contactAPI } from '../services/api';
import SEO from '../components/SEO';
import './Contact.css';

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact Habibi Halal Express",
  "description": "Get in touch with Habibi Halal Express. Suggestions, feedback, active order issue reporting, manager callbacks, partnership, and media inquiries.",
  "mainEntity": {
    "@type": "Organization",
    "name": "Habibi Halal Express",
    "telephone": "+1-718-400-0443",
    "email": "habibi@habibihe.com"
  }
};

const FORM_TYPES = [
  {
    id: 'suggestion',
    label: 'Suggestion',
    icon: <HelpCircle size={18} />,
    title: 'Share a Suggestion',
    desc: 'Help us improve. Your ideas shape the Habibi experience.',
    fields: ['name', 'email', 'subject', 'message'],
    placeholder: 'I think it would be great if...',
  },
  {
    id: 'comment',
    label: 'Comment',
    icon: <MessageSquare size={18} />,
    title: 'Leave a Comment',
    desc: 'Tell us about your dining or ordering experience.',
    fields: ['name', 'email', 'location', 'message'],
    placeholder: 'My experience at Habibi was...',
  },
  {
    id: 'review',
    label: 'Review',
    icon: <Star size={18} />,
    title: 'Write a Review',
    desc: 'Rate your experience and help future customers discover us.',
    fields: ['name', 'email', 'rating', 'location', 'message'],
    placeholder: 'What did you love (or not love) about your visit?',
  },
  {
    id: 'complaint',
    label: 'Complaint',
    icon: <AlertTriangle size={18} />,
    title: 'File a Complaint',
    desc: 'We\'re sorry something went wrong. Let us make it right.',
    fields: ['name', 'email', 'phone', 'orderNum', 'location', 'message'],
    placeholder: 'Please describe the issue in detail so we can resolve it quickly...',
    urgent: true,
  },
  {
    id: 'manager',
    label: 'Manager Call',
    icon: <Phone size={18} />,
    title: 'Request Manager Callback',
    desc: 'Need to speak with someone directly? We\'ll call you back within 2 hours.',
    fields: ['name', 'phone', 'email', 'orderNum', 'bestTime', 'message'],
    placeholder: 'Please briefly describe the reason for your call request...',
    urgent: true,
  },
  {
    id: 'partner',
    label: 'Become a Partner',
    icon: <Handshake size={18} />,
    title: 'Become a Partner',
    desc: 'Interested in partnering with Habibi? Tell us about your business.',
    fields: ['name', 'businessName', 'email', 'phone', 'partnerType', 'message'],
    placeholder: 'Tell us about your business and how you\'d like to partner with Habibi...',
  },
  {
    id: 'media',
    label: 'Media Contact',
    icon: <Tv size={18} />,
    title: 'Media & Press Inquiry',
    desc: 'Press kits, interviews, and brand assets — reach our communications office.',
    fields: ['name', 'outlet', 'email', 'phone', 'message'],
    placeholder: 'Please describe your media inquiry or request...',
  },
  {
    id: 'email',
    label: 'Email Us',
    icon: <Mail size={18} />,
    title: 'Send Us an Email',
    desc: 'General inquiries, questions, or anything else — we\'re here.',
    fields: ['name', 'email', 'subject', 'message'],
    placeholder: 'Write your message here...',
  },
];

const LOCATIONS = [
  'Bedford Park Blvd', 'Lehman College Area', 'Bronx Science Area', 'All Locations',
];

const PARTNER_TYPES = [
  'Food Supplier', 'Delivery Partner', 'Catering Client',
  'Wholesale Buyer', 'Tech / Integration', 'Media / Sponsorship', 'Other',
];

const BEST_TIMES = [
  '8 AM – 10 AM', '10 AM – 12 PM', '12 PM – 2 PM',
  '2 PM – 4 PM', '4 PM – 6 PM', '6 PM – 8 PM',
];

const StarRating = ({ value, onChange }) => (
  <div className="star-rating">
    {[1,2,3,4,5].map(n => (
      <button
        key={n}
        type="button"
        className={`star-btn ${n <= value ? 'filled' : ''}`}
        onClick={() => onChange(n)}
        aria-label={`${n} star`}
      >★</button>
    ))}
    {value > 0 && <span className="star-label">{['','Poor','Fair','Good','Great','Excellent'][value]}</span>}
  </div>
);

const Contact = () => {
  const [activeType, setActiveType] = useState('suggestion');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  /* Form fields */
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [subject, setSubject]         = useState('');
  const [message, setMessage]         = useState('');
  const [orderNum, setOrderNum]       = useState('');
  const [location, setLocation]       = useState('');
  const [rating, setRating]           = useState(0);
  const [bestTime, setBestTime]       = useState('');
  const [partnerType, setPartnerType] = useState('');
  const [businessName, setBusiness]   = useState('');
  const [outlet, setOutlet]           = useState('');

  const form = FORM_TYPES.find(f => f.id === activeType);
  const has = (field) => form.fields.includes(field);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setSubject('');
    setMessage(''); setOrderNum(''); setLocation('');
    setRating(0); setBestTime(''); setPartnerType('');
    setBusiness(''); setOutlet(''); setError('');
  };

  const handleTypeChange = (id) => {
    setActiveType(id);
    setSuccess(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name,
        email,
        nature: form.title,
        message,
        urgent: form.urgent || false,
        ...(has('phone')       && { phone }),
        ...(has('subject')     && { subject }),
        ...(has('orderNum')    && { order_number: orderNum }),
        ...(has('location')    && { location }),
        ...(has('rating')      && { rating }),
        ...(has('bestTime')    && { best_time: bestTime }),
        ...(has('partnerType') && { partner_type: partnerType }),
        ...(has('businessName')&& { business_name: businessName }),
        ...(has('outlet')      && { media_outlet: outlet }),
      };
      await contactAPI.submitFeedback(payload);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page page-watermark">
      <SEO
        title="Contact Us & Feedback | Concierge Support"
        description="Reach out to the Habibi Halal Express support team. Submit suggestions, feedback, order complaints, or partner/media inquiry requests."
        keywords="contact habibi halal, customer support, feedback form, manager callback, halal catering bronx"
        schema={contactSchema}
      />

      {/* ── Hero ── */}
      <section className="ct-hero">
        <div className="ct-hero-overlay" />
        <div className="container ct-hero-content">
          <p className="ct-eyebrow" style={{ color: '#FF3B30' }}>GET IN TOUCH</p>
          <h1 className="ct-hero-title" style={{ color: '#ffffff' }}>
            Concierge <span style={{ color: '#FF3B30' }}>&amp; Contact</span>
          </h1>
          <p className="ct-hero-sub" style={{ color: '#dddddd' }}>
            Whether it's a compliment, a complaint, a partnership opportunity, or a media inquiry — our team is available 24 hours a day.
          </p>
          <div className="ct-hero-pills">
            <span className="ct-pill" style={{ color: '#ffb300' }}><Phone size={12} /> 24 / 7 Support</span>
            <span className="ct-pill" style={{ color: '#ffb300' }}><CheckCircle size={12} /> Response in &lt;2 Hours</span>
            <span className="ct-pill" style={{ color: '#ffb300' }}><MapPin size={12} /> 5 Bronx Locations</span>
          </div>
        </div>
      </section>

      {/* ── Form section ── */}
      <section className="section">
        <div className="container ct-layout">

          {/* ── Left: form type tabs ── */}
          <div className="ct-type-nav">
            <p className="ct-type-nav-label">SELECT INQUIRY TYPE</p>
            {FORM_TYPES.map(ft => (
              <button
                key={ft.id}
                className={`ct-type-btn ${activeType === ft.id ? 'active' : ''} ${ft.urgent ? 'urgent' : ''}`}
                onClick={() => handleTypeChange(ft.id)}
              >
                <span className="ct-type-icon">{ft.icon}</span>
                <span className="ct-type-label">{ft.label}</span>
                {activeType === ft.id && <ChevronRight size={14} className="ct-type-arrow" />}
              </button>
            ))}

            {/* Info cards */}
            <div className="ct-sidebar-cards">
              <div className="ct-info-card urgent-info">
                <p className="ct-info-badge">URGENT LINE</p>
                <p className="ct-info-text">Active order issues? Call directly.</p>
                <a href="tel:+17184000443" className="ct-info-phone">
                  <Phone size={13} /> (718) 400-0443
                </a>
              </div>
              <div className="ct-info-card">
                <p className="ct-info-badge">CUSTOMER SERVICE</p>
                <a href="mailto:habibi@habibihe.com" className="ct-info-link">
                  <Mail size={13} /> habibi@habibihe.com
                </a>
              </div>
              <div className="ct-info-card">
                <p className="ct-info-badge">URGENT MATTERS</p>
                <a href="mailto:urgent@habibihe.com" className="ct-info-link">
                  <Mail size={13} /> urgent@habibihe.com
                </a>
              </div>
              <div className="ct-info-card">
                <p className="ct-info-badge">ADDRESS</p>
                <p className="ct-info-text" style={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'inherit' }}>
                  2974 Jerome Ave<br />Bronx, NY 10468
                </p>
              </div>
            </div>
          </div>

          {/* ── Right: form card ── */}
          <div className="ct-form-area">
            {success ? (
              <div className="ct-success">
                <div className="ct-success-icon"><CheckCircle size={40} /></div>
                <h3 className="ct-success-title">Inquiry Dispatched!</h3>
                <p className="ct-success-sub">
                  Our concierge team will respond within{' '}
                  {form.urgent ? '2 hours' : '24 hours'}.
                </p>
                <button className="btn btn-outline" onClick={() => { setSuccess(false); resetForm(); }}>
                  Send Another
                </button>
              </div>
            ) : (
              <form className="ct-form" onSubmit={handleSubmit}>

                {/* Form header */}
                <div className="ct-form-hdr">
                  <div className="ct-form-icon-ring">{form.icon}</div>
                  <div>
                    <h3 className="ct-form-title">{form.title}</h3>
                    <p className="ct-form-desc">{form.desc}</p>
                  </div>
                  {form.urgent && <span className="ct-urgent-badge">Urgent</span>}
                </div>

                {error && <div className="ct-error">⚠ {error}</div>}

                {/* ── Dynamic fields ── */}
                <div className="ct-fields">

                  {/* Name + Email row */}
                  {(has('name') || has('email')) && (
                    <div className="form-row two-col">
                      {has('name') && (
                        <div className="form-group">
                          <label className="form-label">FULL NAME <span className="req">*</span></label>
                          <input className="form-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                      )}
                      {has('email') && (
                        <div className="form-group">
                          <label className="form-label">EMAIL <span className="req">*</span></label>
                          <input type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Business name */}
                  {has('businessName') && (
                    <div className="form-group">
                      <label className="form-label">BUSINESS / ORGANIZATION</label>
                      <input className="form-input" placeholder="Company name" value={businessName} onChange={e => setBusiness(e.target.value)} />
                    </div>
                  )}

                  {/* Media outlet */}
                  {has('outlet') && (
                    <div className="form-group">
                      <label className="form-label">MEDIA OUTLET / PUBLICATION</label>
                      <input className="form-input" placeholder="e.g. NY Times, WNYC Radio" value={outlet} onChange={e => setOutlet(e.target.value)} />
                    </div>
                  )}

                  {/* Phone */}
                  {has('phone') && (
                    <div className="form-group">
                      <label className="form-label">PHONE NUMBER {form.id === 'manager' && <span className="req">*</span>}</label>
                      <input type="tel" className="form-input" placeholder="+1 (718) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} required={form.id === 'manager'} />
                    </div>
                  )}

                  {/* Order number */}
                  {has('orderNum') && (
                    <div className="form-group">
                      <label className="form-label">ORDER NUMBER</label>
                      <input className="form-input" placeholder="HAB-XXXX-X" value={orderNum} onChange={e => setOrderNum(e.target.value)} />
                    </div>
                  )}

                  {/* Location */}
                  {has('location') && (
                    <div className="form-group">
                      <label className="form-label">LOCATION</label>
                      <select className="form-input form-select" value={location} onChange={e => setLocation(e.target.value)}>
                        <option value="">Select a location...</option>
                        {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Best time for callback */}
                  {has('bestTime') && (
                    <div className="form-group">
                      <label className="form-label">BEST TIME TO CALL</label>
                      <select className="form-input form-select" value={bestTime} onChange={e => setBestTime(e.target.value)}>
                        <option value="">Select a time window...</option>
                        {BEST_TIMES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Partner type */}
                  {has('partnerType') && (
                    <div className="form-group">
                      <label className="form-label">PARTNERSHIP TYPE</label>
                      <select className="form-input form-select" value={partnerType} onChange={e => setPartnerType(e.target.value)}>
                        <option value="">Select partnership type...</option>
                        {PARTNER_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Subject */}
                  {has('subject') && (
                    <div className="form-group">
                      <label className="form-label">SUBJECT</label>
                      <input className="form-input" placeholder="Brief subject line" value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                  )}

                  {/* Rating */}
                  {has('rating') && (
                    <div className="form-group">
                      <label className="form-label">YOUR RATING</label>
                      <StarRating value={rating} onChange={setRating} />
                    </div>
                  )}

                  {/* Message */}
                  {has('message') && (
                    <div className="form-group">
                      <label className="form-label">MESSAGE <span className="req">*</span></label>
                      <textarea
                        className="form-input form-textarea"
                        rows={5}
                        placeholder={form.placeholder}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary ct-submit-btn" disabled={loading}>
                  {loading ? 'Sending...' : `Send ${form.label} →`}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Collaboration strip ── */}
      <section className="section ct-collab border-t border-border">
        <div className="container">
          <div className="ct-collab-grid">
            {[
              { icon: '🍴', title: 'Restaurant Partnerships', text: 'Join our curated network of Halal excellence.' },
              { icon: '🚚', title: 'Supply Integrity', text: 'Premium ethically sourced Halal ingredient suppliers.' },
              { icon: '👥', title: 'Corporate Catering', text: 'White-glove catering for business events at scale.' },
              { icon: '📱', title: 'Tech Integrations', text: 'API or platform integrations — let\'s build together.' },
            ].map(card => (
              <div key={card.title} className="ct-collab-card">
                <span className="ct-collab-icon">{card.icon}</span>
                <h4 className="ct-collab-title">{card.title}</h4>
                <p className="ct-collab-text">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Contact;
