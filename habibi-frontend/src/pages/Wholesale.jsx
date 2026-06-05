import React, { useState, useRef } from 'react';
import { partnersAPI } from '../services/api';
import './Wholesale.css';

const steps = ['Business Details', 'Operations', 'Logistics'];

const Wholesale = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [bizName, setBizName] = useState('');
  const [repName, setRepName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [bizType, setBizType] = useState('Restaurant / Café');
  const [volume, setVolume] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('businessName', bizName);
      fd.append('representativeName', repName);
      fd.append('businessAddress', bizAddress);
      fd.append('businessType', bizType);
      fd.append('estimatedVolume', volume);
      fd.append('deliveryFrequency', frequency);
      fd.append('deliveryAddress', deliveryAddr);
      fd.append('logisticsNotes', logisticsNotes);
      if (certFile) fd.append('certificate', certFile);
      await partnersAPI.apply(fd);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wholesale-page page-watermark">
      {/* Hero */}
      <section className="wholesale-hero text-center">
        <div className="container">
          <p className="uppercase text-xs tracking-widest mb-4" style={{ color: '#FF3B30' }}>WHOLESALE PARTNERSHIPS</p>
          <h1 className="wholesale-title" style={{ color: '#ffffff' }}>Elevate Your Business with Artisanal<br />Halal Flavors</h1>
          <p className="max-w-2xl mx-auto mt-4" style={{ color: '#dddddd' }}>
            Join our exclusive network of retail and hospitality partners. Provide your clients with the premium quality and authentic taste of Habibi Halal Express.
          </p>
        </div>
      </section>

      {/* Step Indicator */}
      <div className="steps-bar">
        <div className="container steps-inner">
          {steps.map((step, i) => (
            <React.Fragment key={step}>
              <button
                className={`step-btn ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}
                onClick={() => !success && setCurrentStep(i)}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{step}</span>
              </button>
              {i < steps.length - 1 && <div className={`step-connector ${i < currentStep ? 'filled' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <section className="section">
        <div className="container wholesale-layout">

          {/* Left Sidebar */}
          <div className="wholesale-sidebar">
            <div className="why-partner-box">
              <h3 className="why-title">Why Partner With Us?</h3>
              <div className="partner-reasons">
                <div className="reason-item">
                  <span className="reason-icon text-primary">✦</span>
                  <div>
                    <h5 className="reason-title">Certified Halal Excellence</h5>
                    <p className="text-xs text-muted mt-1">Strict adherence to artisanal Halal standards.</p>
                  </div>
                </div>
                <div className="reason-item">
                  <span className="reason-icon">🚚</span>
                  <div>
                    <h5 className="reason-title">Reliable Distribution</h5>
                    <p className="text-xs text-muted mt-1">Dedicated fleet ensuring fresh delivery daily.</p>
                  </div>
                </div>
                <div className="reason-item">
                  <span className="reason-icon">📈</span>
                  <div>
                    <h5 className="reason-title">Volume Scalability</h5>
                    <p className="text-xs text-muted mt-1">From boutique cafes to large-scale events.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="wholesale-sidebar-img">
              <div className="sidebar-img-caption">
                <h4 className="font-serif text-xl" style={{ color: '#FF3B30' }}>Kitchen to Counter</h4>
                <p className="text-xs mt-1" style={{ color: '#ffffff' }}>Our craft, your business success.</p>
              </div>
            </div>

            <div style={{marginTop:'1rem',padding:'1rem',background:'rgba(229,182,78,0.06)',border:'1px solid rgba(229,182,78,0.15)',borderRadius:'10px',textAlign:'center'}}>
              <p style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.45)',marginBottom:'0.625rem'}}>Already an approved partner?</p>
              <a href="/partner/login" style={{display:'inline-flex',alignItems:'center',gap:'0.3rem',padding:'0.5rem 1.125rem',background:'rgba(229,182,78,0.12)',border:'1px solid rgba(229,182,78,0.3)',borderRadius:'8px',color:'#E5B64E',fontSize:'0.8rem',fontWeight:700,textDecoration:'none',transition:'background 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(229,182,78,0.2)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(229,182,78,0.12)'}>
                Sign in to Partner Portal →
              </a>
            </div>
          </div>

          {/* Right – Form */}
          <div className="wholesale-form-card">
            {success ? (
              <div className="wholesale-success">
                <div className="success-icon">✦</div>
                <h3 className="font-serif text-2xl mt-4 text-primary">Application Submitted!</h3>
                <p className="text-muted mt-3">Our partnerships team will review your application and reach out within 3 business days.</p>
                <p className="text-sm text-muted mt-2">📧 partners@habibihalal.com</p>
              </div>
            ) : (
              <>
                {currentStep === 0 && (
                  <div className="form-step">
                    {error && <div className="wholesale-error">⚠ {error}</div>}
                    <div className="form-row two-col">
                      <div className="form-group">
                        <label className="form-label">Business Name</label>
                        <input type="text" className="form-input" placeholder="e.g. Gourmet Markets LLC" value={bizName} onChange={e => setBizName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Representative Name</label>
                        <input type="text" className="form-input" placeholder="John Doe" value={repName} onChange={e => setRepName(e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Business Address</label>
                      <input type="text" className="form-input" placeholder="Street address, Suite, City, State, ZIP" value={bizAddress} onChange={e => setBizAddress(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">EIN / Certificate of Authority</label>
                      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}} onChange={e => setCertFile(e.target.files[0])} />
                        <div className="upload-icon">{certFile ? '✓' : '⬆'}</div>
                        <p className="text-sm text-muted mt-2">
                          {certFile ? certFile.name : 'Click to upload or drag & drop PDF/JPG'}
                        </p>
                      </div>
                    </div>

                    <button className="btn btn-primary step-next-btn" onClick={() => setCurrentStep(1)} disabled={!bizName || !repName}>
                      Continue to Operations
                    </button>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="form-step">
                    <div className="form-group">
                      <label className="form-label">Type of Business</label>
                      <select className="form-input form-select" value={bizType} onChange={e => setBizType(e.target.value)}>
                        <option>Restaurant / Café</option>
                        <option>Retail / Grocery</option>
                        <option>Event Catering</option>
                        <option>Corporate Office</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Estimated Weekly Volume (Meals)</label>
                      <input type="number" className="form-input" placeholder="e.g. 500" value={volume} onChange={e => setVolume(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Operating Hours</label>
                      <div className="form-row two-col">
                        <input type="time" className="form-input" defaultValue="09:00" />
                        <input type="time" className="form-input" defaultValue="22:00" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button className="btn btn-outline" onClick={() => setCurrentStep(0)}>Back</button>
                      <button className="btn btn-primary flex-1" onClick={() => setCurrentStep(2)}>Continue to Logistics</button>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <form className="form-step" onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label className="form-label">Preferred Delivery Frequency</label>
                      <select className="form-input form-select" value={frequency} onChange={e => setFrequency(e.target.value)}>
                        <option>Daily</option>
                        <option>3x per week</option>
                        <option>Weekly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Delivery Address</label>
                      <input type="text" className="form-input" placeholder="If different from business address" value={deliveryAddr} onChange={e => setDeliveryAddr(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Special Logistics Requirements</label>
                      <textarea className="form-input form-textarea" placeholder="Temperature control, loading dock access, etc." rows={4} value={logisticsNotes} onChange={e => setLogisticsNotes(e.target.value)} />
                    </div>
                    {error && <div className="wholesale-error">⚠ {error}</div>}
                    <div className="flex gap-4">
                      <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(1)}>Back</button>
                      <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Partnership Application'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Wholesale;
