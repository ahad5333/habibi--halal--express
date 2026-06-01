import React, { useState } from 'react';
import { AlertTriangle, Phone, Utensils, PackageX, Stethoscope, ShieldAlert, Clock, CheckCircle } from 'lucide-react';
import { contactAPI } from '../services/api';
import './Urgent.css';

const URGENT_TYPES = [
  {
    id: 'active_order',
    label: 'Active Order Issue',
    icon: <PackageX size={22} />,
    color: '#f59e0b',
    sla: '10 min',
    title: 'Active Order Problem',
    desc: 'Wrong item delivered, missing food, or order not arriving.',
    placeholder: 'Describe your active order issue. Include your order number and what went wrong...',
  },
  {
    id: 'food_safety',
    label: 'Food Safety',
    icon: <Utensils size={22} />,
    color: '#ef4444',
    sla: '5 min',
    title: 'Food Safety Concern',
    desc: 'Foreign object found, packaging compromised, or quality issue.',
    placeholder: 'Describe the food safety issue. DO NOT consume the item. Our team will respond immediately...',
    critical: true,
  },
  {
    id: 'wrong_item',
    label: 'Wrong / Missing Item',
    icon: <AlertTriangle size={22} />,
    color: '#f59e0b',
    sla: '15 min',
    title: 'Wrong or Missing Item',
    desc: 'Received wrong item or something is missing from your order.',
    placeholder: 'Tell us your order number and what was wrong or missing...',
  },
  {
    id: 'injury',
    label: 'Injury / Accident',
    icon: <ShieldAlert size={22} />,
    color: '#ef4444',
    sla: '5 min',
    title: 'Injury or Accident Report',
    desc: 'Customer or staff injury on premises or during delivery.',
    placeholder: 'Describe the incident. If this is a medical emergency, call 911 first...',
    critical: true,
  },
  {
    id: 'medical',
    label: 'Medical Emergency',
    icon: <Stethoscope size={22} />,
    color: '#dc2626',
    sla: 'CALL 911',
    title: 'Medical Emergency',
    desc: 'Allergic reaction, illness, or medical emergency related to food.',
    placeholder: 'If someone is in immediate danger, CALL 911 FIRST. Then describe what happened...',
    critical: true,
    callFirst: true,
  },
];

const Urgent = () => {
  const [activeType, setActiveType] = useState('active_order');
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [orderNum, setOrderNum] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const type = URGENT_TYPES.find(t => t.id === activeType);

  const resetForm = () => {
    setName(''); setPhone(''); setOrderNum(''); setMessage(''); setError('');
  };

  const handleTypeChange = (id) => {
    setActiveType(id);
    setSuccess(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await contactAPI.submitFeedback({
        name,
        phone,
        subject:  `URGENT: ${type.title}`,
        message:  `Phone: ${phone}\nOrder #: ${orderNum || 'N/A'}\n\n${message}`,
        order_number: orderNum || '',
        urgency:  type.critical ? 'High' : 'Normal',
        type:     type.id,
        is_urgent: true,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send. Please call us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="urgent-page">

      {/* ── Alert banner ── */}
      <div className="urg-banner">
        <Phone size={14} />
        <span>Life-threatening emergency? <strong>Call 911 immediately.</strong></span>
        <span className="urg-banner-sep">|</span>
        <span>Habibi Emergency Line:</span>
        <a href="tel:+17185550000" className="urg-banner-phone">(718) 555-0000</a>
      </div>

      {/* ── Hero ── */}
      <section className="urg-hero">
        <div className="urg-hero-overlay" />
        <div className="container urg-hero-content">
          <div className="urg-hero-badge">
            <AlertTriangle size={14} /> URGENT SUPPORT
          </div>
          <h1 className="urg-hero-title">
            Get <span className="text-primary">Immediate</span> Help
          </h1>
          <p className="urg-hero-sub">
            Our emergency concierge team monitors this line 24/7. Average response time under 10 minutes.
          </p>
          <div className="urg-hero-pills">
            <span className="urg-pill"><Clock size={12} /> 24 / 7 Monitoring</span>
            <span className="urg-pill"><Phone size={12} /> SMS Alert to Manager</span>
            <span className="urg-pill"><CheckCircle size={12} /> Response &lt; 10 min</span>
          </div>
        </div>
      </section>

      {/* ── Main layout ── */}
      <section className="section">
        <div className="container urg-layout">

          {/* Type selector */}
          <div className="urg-type-col">
            <p className="urg-col-label">SELECT ISSUE TYPE</p>
            <div className="urg-type-list">
              {URGENT_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`urg-type-btn ${activeType === t.id ? 'active' : ''} ${t.critical ? 'critical' : ''}`}
                  onClick={() => handleTypeChange(t.id)}
                  style={{ '--urg-color': t.color }}
                >
                  <span className="urg-type-icon" style={{ color: t.color }}>{t.icon}</span>
                  <div className="urg-type-info">
                    <span className="urg-type-label">{t.label}</span>
                    <span className="urg-type-sla" style={{ color: t.color }}>
                      <Clock size={10} /> Response: {t.sla}
                    </span>
                  </div>
                  {t.critical && <span className="urg-critical-dot" />}
                </button>
              ))}
            </div>

            {/* Direct call card */}
            <div className="urg-call-card">
              <p className="urg-call-label">PREFER TO CALL?</p>
              <p className="urg-call-text">Reach a manager directly, any time.</p>
              <a href="tel:+17185550000" className="urg-call-number">
                <Phone size={14} /> (718) 555-0000
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="urg-form-col">
            {type.callFirst && (
              <div className="urg-911-banner">
                <ShieldAlert size={18} />
                <div>
                  <strong>Medical Emergency?</strong>
                  <p>Call <strong>911 immediately</strong> before filling this form. This form notifies our team but is not a substitute for emergency services.</p>
                </div>
              </div>
            )}

            {success ? (
              <div className="urg-success">
                <div className="urg-success-icon"><CheckCircle size={44} /></div>
                <h3>Alert Dispatched</h3>
                <p>Our team has been notified via SMS. A manager will contact you at <strong>{phone}</strong> within {type.sla}.</p>
                <p className="urg-success-ref">Reference: URG-{Date.now().toString().slice(-6)}</p>
                <button className="btn btn-outline" onClick={() => { setSuccess(false); resetForm(); }}>
                  Submit Another
                </button>
              </div>
            ) : (
              <form className="urg-form" onSubmit={handleSubmit}>

                {/* Form header */}
                <div className="urg-form-hdr" style={{ borderColor: type.color + '33' }}>
                  <div className="urg-form-icon" style={{ color: type.color, borderColor: type.color + '55' }}>
                    {type.icon}
                  </div>
                  <div>
                    <h3 className="urg-form-title">{type.title}</h3>
                    <p className="urg-form-desc">{type.desc}</p>
                  </div>
                  <span className="urg-sla-tag" style={{ color: type.color, borderColor: type.color + '44', background: type.color + '15' }}>
                    <Clock size={10} /> {type.sla}
                  </span>
                </div>

                {error && <div className="urg-error">⚠ {error}</div>}

                <div className="urg-fields">
                  <div className="urg-row two-col">
                    <div className="urg-group">
                      <label>YOUR NAME <span className="req">*</span></label>
                      <input className="urg-input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="urg-group">
                      <label>PHONE NUMBER <span className="req">*</span></label>
                      <input type="tel" className="urg-input" placeholder="+1 (718) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                  </div>

                  <div className="urg-group">
                    <label>ORDER NUMBER <span className="urg-optional">(if applicable)</span></label>
                    <input className="urg-input" placeholder="HAB-XXXX-X" value={orderNum} onChange={e => setOrderNum(e.target.value)} />
                  </div>

                  <div className="urg-group">
                    <label>DESCRIBE THE ISSUE <span className="req">*</span></label>
                    <textarea
                      className="urg-input urg-textarea"
                      rows={6}
                      placeholder={type.placeholder}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="urg-submit-row">
                  <button type="submit" className="btn urg-submit-btn" disabled={loading}
                    style={{ background: type.color, color: type.color === '#f59e0b' ? '#000' : '#fff' }}
                  >
                    {loading ? 'Sending Alert...' : `Send Urgent Alert — ${type.label}`}
                  </button>
                  <p className="urg-submit-note">
                    <Clock size={11} /> Our team will call you at the number provided within {type.sla}.
                  </p>
                </div>

              </form>
            )}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Urgent;
