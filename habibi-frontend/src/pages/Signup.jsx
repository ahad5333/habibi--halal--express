import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Calendar, Building2, Lock, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import './Signup.css';

const US_STATES = ['NY','NJ','CT','PA','MA','FL','CA','TX','IL','OH','GA','NC','VA','WA','AZ','CO','MD','TN','MN','WI'];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { register } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* Personal */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');

  /* Phones */
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [phone3, setPhone3] = useState('');

  /* Billing address */
  const [billStreet, setBillStreet] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('NY');
  const [billZip, setBillZip] = useState('');

  /* Delivery address */
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [delStreet, setDelStreet] = useState('');
  const [delCity, setDelCity] = useState('');
  const [delState, setDelState] = useState('NY');
  const [delZip, setDelZip] = useState('');

  /* Preferences & security */
  const [deliveryPref, setDeliveryPref] = useState('delivery');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /* Consent checkboxes — pre-checked by default */
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [agreeSms, setAgreeSms] = useState(true);

  const STEPS = [
    { num: 1, label: 'Personal' },
    { num: 2, label: 'Contact' },
    { num: 3, label: 'Address' },
    { num: 4, label: 'Security' },
  ];

  const validateStep = () => {
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        setError('First name, last name, and email are required.');
        return false;
      }
    }
    if (step === 2) {
      if (!phone1.trim()) {
        setError('Primary phone number is required.');
        return false;
      }
    }
    if (step === 3) {
      if (!billStreet.trim() || !billCity.trim() || !billZip.trim()) {
        setError('Full billing address is required.');
        return false;
      }
    }
    if (step === 4) {
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    setError('');
    if (validateStep()) setStep(s => s + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateStep()) return;

    const billingAddr = `${billStreet}, ${billCity}, ${billState} ${billZip}`;
    const deliveryAddr = sameAsBilling ? billingAddr : `${delStreet}, ${delCity}, ${delState} ${delZip}`;

    setLoading(true);
    try {
      const result = await register(`${firstName} ${lastName}`.trim(), email, password, {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName || null,
        phone: phone1,
        phone2: phone2 || null,
        phone3: phone3 || null,
        dob: dob || null,
        billing_address: billingAddr,
        delivery_address: deliveryAddr,
        delivery_preference: deliveryPref,
      });
      if (result?.needs_verification) {
        setVerifyEmail(email);
        setVerificationSent(true);
        return;
      }
      // After signup always go to login so the user signs in explicitly
      const dest = redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}&registered=1` : '/login?registered=1';
      navigate(dest);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 460, padding: '2.5rem', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#E5B64E', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Check your inbox</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            We sent a verification link to <strong style={{ color: '#fff' }}>{verifyEmail}</strong>.<br />
            Click the link in that email to activate your account.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>Didn't get it? Check your spam folder, or{' '}
            <button onClick={() => setVerificationSent(false)} style={{ background: 'none', border: 'none', color: '#E5B64E', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>try again</button>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      {/* Left panel */}
      <div className="signup-panel">
        <Link to="/" className="signup-panel-logo">
          <img src="/images/logos/logo.png" alt="Habibi Halal Express" className="sp-logo-img" />
          <div>
            <p className="sp-brand">HABIBI HALAL EXPRESS</p>
            <p className="sp-brand-sub">Authentic · Fresh · Halal</p>
          </div>
        </Link>

        <div className="signup-panel-content">
          <p className="sp-eyebrow">JOIN THE FAMILY</p>
          <h2 className="sp-headline">Become a<br /><span className="text-primary">Habibi Member</span></h2>
          <p className="sp-sub">Get exclusive access to member-only deals, order history, saved addresses, and priority service at all 5 Bronx locations.</p>

          <ul className="sp-benefits">
            <li><span className="sp-check"><Check size={13} /></span> 10% off every order for members</li>
            <li><span className="sp-check"><Check size={13} /></span> Save up to 12 delivery addresses</li>
            <li><span className="sp-check"><Check size={13} /></span> Real-time order tracking</li>
            <li><span className="sp-check"><Check size={13} /></span> Early access to new menu items</li>
          </ul>

          <div className="sp-halal-badge">
            <img src="/images/logos/halal.png" alt="Halal Certified" className="sp-halal-img" />
            <div>
              <p className="sp-halal-title">Zabiha Halal Certified</p>
              <p className="sp-halal-sub">All items verified since 2002</p>
            </div>
          </div>
        </div>

        <p className="sp-panel-footer">© 2024 Habibi Halal Express, INC</p>
      </div>

      {/* Right form */}
      <div className="signup-form-side">
        <div className="signup-form-wrap">

          {/* Step indicators */}
          <div className="signup-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`ss-step ${step === s.num ? 'active' : ''} ${step > s.num ? 'done' : ''}`}>
                  <div className="ss-circle">
                    {step > s.num ? <Check size={12} /> : s.num}
                  </div>
                  <span className="ss-label">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`ss-line ${step > s.num ? 'done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>

          {error && <div className="signup-error">⚠ {error}</div>}

          <form onSubmit={step < 4 ? (e) => { e.preventDefault(); nextStep(); } : handleSubmit}>

            {/* ── Step 1: Personal ── */}
            {step === 1 && (
              <div className="signup-section">
                <div className="signup-section-hdr">
                  <div className="ss-icon-ring"><User size={18} /></div>
                  <div>
                    <h3 className="ss-title">Personal Information</h3>
                    <p className="ss-sub">Tell us who you are</p>
                  </div>
                </div>

                <div className="form-row two-col">
                  <div className="form-group">
                    <label className="form-label">FIRST NAME <span className="req">*</span></label>
                    <input className="form-input" placeholder="Ahmad" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">LAST NAME <span className="req">*</span></label>
                    <input className="form-input" placeholder="Al-Rashid" value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">BUSINESS NAME <span className="opt">(Optional)</span></label>
                  <div className="input-icon-wrap">
                    <Building2 size={15} className="input-icon" />
                    <input className="form-input with-icon" placeholder="Company or restaurant name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">EMAIL ADDRESS <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <Mail size={15} className="input-icon" />
                    <input type="email" className="form-input with-icon" placeholder="ahmad@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">DATE OF BIRTH <span className="opt">(Optional)</span></label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} className="input-icon" />
                    <input type="date" className="form-input with-icon" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Contact ── */}
            {step === 2 && (
              <div className="signup-section">
                <div className="signup-section-hdr">
                  <div className="ss-icon-ring"><Phone size={18} /></div>
                  <div>
                    <h3 className="ss-title">Phone Numbers</h3>
                    <p className="ss-sub">For order updates and delivery coordination</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">PRIMARY PHONE <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <Phone size={15} className="input-icon" />
                    <input type="tel" className="form-input with-icon" placeholder="+1 (718) 000-0000" value={phone1} onChange={e => setPhone1(e.target.value)} required />
                  </div>
                  <p className="input-hint">Used for order confirmations and delivery updates</p>
                </div>

                <div className="form-group">
                  <label className="form-label">SECONDARY PHONE <span className="opt">(Optional)</span></label>
                  <div className="input-icon-wrap">
                    <Phone size={15} className="input-icon" />
                    <input type="tel" className="form-input with-icon" placeholder="+1 (646) 000-0000" value={phone2} onChange={e => setPhone2(e.target.value)} />
                  </div>
                  <p className="input-hint">Home or work number</p>
                </div>

                <div className="form-group">
                  <label className="form-label">WHATSAPP / EMERGENCY <span className="opt">(Optional)</span></label>
                  <div className="input-icon-wrap">
                    <Phone size={15} className="input-icon" />
                    <input type="tel" className="form-input with-icon" placeholder="+1 (917) 000-0000" value={phone3} onChange={e => setPhone3(e.target.value)} />
                  </div>
                  <p className="input-hint">WhatsApp or emergency contact</p>
                </div>

                <div className="phone-note">
                  <span className="phone-note-icon">🔒</span>
                  Your phone numbers are encrypted and only used for order coordination. We never share your contact info.
                </div>
              </div>
            )}

            {/* ── Step 3: Address ── */}
            {step === 3 && (
              <div className="signup-section">
                <div className="signup-section-hdr">
                  <div className="ss-icon-ring"><MapPin size={18} /></div>
                  <div>
                    <h3 className="ss-title">Addresses</h3>
                    <p className="ss-sub">Billing and delivery locations</p>
                  </div>
                </div>

                <p className="addr-section-label">BILLING ADDRESS</p>
                <div className="form-group">
                  <label className="form-label">STREET ADDRESS <span className="req">*</span></label>
                  <input className="form-input" placeholder="123 Grand Concourse" value={billStreet} onChange={e => setBillStreet(e.target.value)} required />
                </div>
                <div className="form-row three-col">
                  <div className="form-group">
                    <label className="form-label">CITY <span className="req">*</span></label>
                    <input className="form-input" placeholder="Bronx" value={billCity} onChange={e => setBillCity(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">STATE</label>
                    <select className="form-input form-select" value={billState} onChange={e => setBillState(e.target.value)}>
                      {US_STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP <span className="req">*</span></label>
                    <input className="form-input" placeholder="10451" maxLength={10} value={billZip} onChange={e => setBillZip(e.target.value)} required />
                  </div>
                </div>

                <label className="same-billing-check">
                  <input type="checkbox" checked={sameAsBilling} onChange={e => setSameAsBilling(e.target.checked)} />
                  <span>My delivery address is the same as billing</span>
                </label>

                {!sameAsBilling && (
                  <>
                    <p className="addr-section-label" style={{ marginTop: '1.5rem' }}>PREFERRED DELIVERY ADDRESS</p>
                    <div className="form-group">
                      <label className="form-label">STREET ADDRESS</label>
                      <input className="form-input" placeholder="456 Fordham Road" value={delStreet} onChange={e => setDelStreet(e.target.value)} />
                    </div>
                    <div className="form-row three-col">
                      <div className="form-group">
                        <label className="form-label">CITY</label>
                        <input className="form-input" placeholder="Bronx" value={delCity} onChange={e => setDelCity(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">STATE</label>
                        <select className="form-input form-select" value={delState} onChange={e => setDelState(e.target.value)}>
                          {US_STATES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">ZIP</label>
                        <input className="form-input" placeholder="10458" maxLength={10} value={delZip} onChange={e => setDelZip(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label">PREFERRED ORDER METHOD</label>
                  <div className="pref-options">
                    {[
                      { val: 'delivery', label: 'Delivery', emoji: '🚗' },
                      { val: 'pickup', label: 'Pickup', emoji: '🏪' },
                      { val: 'both', label: 'Both', emoji: '✓' },
                    ].map(opt => (
                      <label key={opt.val} className={`pref-option ${deliveryPref === opt.val ? 'selected' : ''}`}>
                        <input type="radio" name="deliveryPref" value={opt.val} checked={deliveryPref === opt.val} onChange={() => setDeliveryPref(opt.val)} />
                        <span className="pref-emoji">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Security ── */}
            {step === 4 && (
              <div className="signup-section">
                <div className="signup-section-hdr">
                  <div className="ss-icon-ring"><Lock size={18} /></div>
                  <div>
                    <h3 className="ss-title">Security</h3>
                    <p className="ss-sub">Set a strong password for your account</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">PASSWORD <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="form-input with-icon with-eye"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required minLength={8}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password && (
                    <div className="pw-strength">
                      <div className={`pw-bar ${password.length >= 8 ? 'good' : 'weak'}`} />
                      <div className={`pw-bar ${password.length >= 12 ? 'good' : ''}`} />
                      <div className={`pw-bar ${/[A-Z]/.test(password) && /[0-9]/.test(password) ? 'good' : ''}`} />
                      <span className="pw-label">{password.length < 8 ? 'Too short' : password.length < 12 ? 'Fair' : 'Strong'}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">CONFIRM PASSWORD <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="form-input with-icon with-eye"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={`match-hint ${password === confirmPassword ? 'match' : 'no-match'}`}>
                      {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Summary */}
                <div className="account-summary">
                  <p className="as-title">Account Summary</p>
                  <div className="as-row"><span>Name</span><span>{firstName} {lastName}</span></div>
                  <div className="as-row"><span>Email</span><span>{email}</span></div>
                  <div className="as-row"><span>Primary Phone</span><span>{phone1 || '—'}</span></div>
                  <div className="as-row"><span>Billing City</span><span>{billCity || '—'}, {billState}</span></div>
                  <div className="as-row"><span>Order Method</span><span className="capitalize">{deliveryPref}</span></div>
                </div>

                {/* Consent checkboxes */}
                <div className="consent-checks">
                  <label className="consent-check-row">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={e => setAgreeTerms(e.target.checked)}
                      required
                    />
                    <span>
                      I agree to the{' '}
                      <Link to="/terms" className="terms-link" target="_blank">Terms of Service</Link>,{' '}
                      <Link to="/privacy-policy" className="terms-link" target="_blank">Privacy Policy</Link>, and{' '}
                      <Link to="/accessibility" className="terms-link" target="_blank">Accessibility Statement</Link>.
                    </span>
                  </label>
                  <label className="consent-check-row">
                    <input
                      type="checkbox"
                      checked={agreeSms}
                      onChange={e => setAgreeSms(e.target.checked)}
                    />
                    <span>
                      I consent to receive recurring automated and non-automated SMS messages from Habibi Halal Express.
                      Consent is not a condition of purchase. Message and data rates may apply.
                      Reply <strong>STOP</strong> to opt out and <strong>HELP</strong> for assistance.{' '}
                      <Link to="/sms-terms" className="terms-link" target="_blank">View SMS Terms &amp; Conditions</Link>.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="signup-nav">
              {step > 1 && (
                <button type="button" className="btn btn-outline" onClick={prevStep}>
                  Back
                </button>
              )}
              {step < 4 ? (
                <button type="submit" className="btn btn-primary signup-next-btn">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" className="btn btn-primary signup-next-btn" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create My Account ✓'}
                </button>
              )}
            </div>

            <p className="signup-login-link">
              Already have an account? <Link to="/login" className="text-primary">Sign in here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
