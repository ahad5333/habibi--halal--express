import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Lock, Eye, EyeOff, Check } from 'lucide-react';
import LegalModal from '../components/LegalModal';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : '/';
  const { register } = useAuth();

  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyEmail, setVerifyEmail]       = useState('');
  const [accountCreated, setAccountCreated] = useState(null); // { name, identifier }
  const [showPass, setShowPass]             = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [signupMethod, setSignupMethod]     = useState('phone'); // 'email' | 'phone'

  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [email, setEmail]                   = useState('');
  const [phone, setPhone]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms]         = useState(false);
  const [agreeSms, setAgreeSms]             = useState(false);
  const [legalModal, setLegalModal]         = useState(null);

  const resetForm = useCallback(() => {
    setError(''); setLoading(false); setVerificationSent(false); setVerifyEmail('');
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setPassword(''); setConfirmPassword('');
    setAgreeTerms(false); setAgreeSms(false);
  }, []);

  useEffect(() => { resetForm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => { if (e.persisted) resetForm(); };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, [resetForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.'); return;
    }

    if (signupMethod === 'email') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.'); return;
      }
    } else {
      if (!phone.trim()) {
        setError('Please enter your phone number.'); return;
      }
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.'); return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms of Service to continue.'); return;
    }

    const submittedEmail = email;
    setLoading(true);
    try {
      const result = await register(
        `${firstName} ${lastName}`.trim(),
        signupMethod === 'email' ? email : '',
        password,
        {
          first_name: firstName,
          last_name: lastName,
          phone: phone.trim() || null,
        }
      );

      if (result?.requiresVerification || !result?.user) {
        setVerifyEmail(submittedEmail);
        resetForm();
        setVerificationSent(true);
      } else {
        // Show confirmation screen immediately, then redirect after 3s
        const name = `${firstName} ${lastName}`.trim();
        const identifier = signupMethod === 'phone' ? phone.trim() : email.trim();
        resetForm();
        setAccountCreated({ name, identifier, method: signupMethod });
        setTimeout(() => navigate(redirectTo !== '/' ? redirectTo : '/'), 3500);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (accountCreated) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, padding: '2.5rem', background: '#141414', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#F97316', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>Welcome to Habibi!</h2>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem' }}>{accountCreated.name}</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {accountCreated.method === 'phone' ? '📱 ' : '📧 '}{accountCreated.identifier}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: '1.75rem', fontSize: '0.92rem' }}>
            Your account has been created. You're now logged in and ready to order!
          </p>
          <button
            onClick={() => navigate(redirectTo !== '/' ? redirectTo : '/')}
            style={{ background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}
          >
            Start Ordering →
          </button>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', marginTop: '1rem' }}>Redirecting automatically…</p>
        </div>
      </div>
    );
  }

  if (verificationSent) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, padding: '2.5rem', background: '#141414', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#F97316', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.6rem' }}>Account Created — Check Your Email</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
            We sent a verification link to
          </p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>{verifyEmail}</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Click the link in that email to activate your account. Once verified, you can log in and start ordering.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
            Didn't receive it? Check your spam folder, or{' '}
            <button onClick={() => setVerificationSent(false)} style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
              try again
            </button>.
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
          <img src="/images/logos/logo-brand.jpg" alt="Habibi Halal Express" className="sp-logo-img" />
        </Link>

        <div className="signup-panel-content">
          <p className="sp-eyebrow">JOIN THE FAMILY</p>
          <h2 className="sp-headline">Become a<br /><span className="text-primary">Habibi Member</span></h2>
          <p className="sp-sub">Get exclusive access to member-only deals, order history, saved addresses, and priority service at all our New York City locations.</p>

          <ul className="sp-benefits">
            <li><span className="sp-check"><Check size={13} /></span> Member-only deals and discounts</li>
            <li><span className="sp-check"><Check size={13} /></span> Save delivery addresses</li>
            <li><span className="sp-check"><Check size={13} /></span> Real-time order tracking</li>
            <li><span className="sp-check"><Check size={13} /></span> Early access to new menu items</li>
          </ul>

          <div className="sp-halal-badge">
            <img src="/images/logos/halal-certified-premium.png" alt="Halal Certified" className="sp-halal-img" />
            <div>
              <p className="sp-halal-title">Zabiha Halal Certified</p>
              <p className="sp-halal-sub">All items verified since 2002</p>
            </div>
          </div>
        </div>

        <p className="sp-panel-footer">© {new Date().getFullYear()} Habibi Halal Express, INC</p>
      </div>

      {/* Right form */}
      <div className="signup-form-side">
        <div className="signup-form-wrap">

          <h2 className="sp-form-title">Create an Account</h2>
          <p className="sp-form-sub">Already have one? <Link to={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-primary">Sign in</Link></p>

          {/* Method toggle */}
          <div className="signup-method-toggle">
            <button
              type="button"
              className={`signup-method-btn${signupMethod === 'phone' ? ' active' : ''}`}
              onClick={() => { setSignupMethod('phone'); setError(''); }}
            >
              <Phone size={14} /> Phone Number
            </button>
            <button
              type="button"
              className={`signup-method-btn${signupMethod === 'email' ? ' active' : ''}`}
              onClick={() => { setSignupMethod('email'); setError(''); }}
            >
              <Mail size={14} /> Email Address
            </button>
          </div>

          {error && <div className="signup-error">⚠ {error}</div>}

          <form onSubmit={handleSubmit} noValidate>

            {/* Name row */}
            <div className="form-row two-col">
              <div className="form-group">
                <label className="form-label">FIRST NAME <span className="req">*</span></label>
                <input
                  className="form-input"
                  placeholder="Ahmad"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">LAST NAME <span className="req">*</span></label>
                <input
                  className="form-input"
                  placeholder="Al-Rashid"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Phone (primary — phone mode) */}
            {signupMethod === 'phone' && (
              <div className="form-group">
                <label className="form-label">PHONE NUMBER <span className="req">*</span></label>
                <div className="input-icon-wrap">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input with-icon"
                    placeholder="+1 (718) 555-0100"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            {/* Email (primary — email mode) */}
            {signupMethod === 'email' && (
              <div className="form-group">
                <label className="form-label">EMAIL ADDRESS <span className="req">*</span></label>
                <div className="input-icon-wrap">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    className="form-input with-icon"
                    placeholder="ahmad@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            {/* Phone (secondary — email mode, optional) */}
            {signupMethod === 'email' && (
              <div className="form-group">
                <label className="form-label">PHONE NUMBER <span className="opt">(Optional — for order updates)</span></label>
                <div className="input-icon-wrap">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input with-icon"
                    placeholder="+1 (718) 555-0100"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="form-group">
              <label className="form-label">PASSWORD <span className="req">*</span></label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input with-icon with-eye"
                  placeholder="Min. 8 characters, include a number"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            {/* Confirm password */}
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
                  autoComplete="new-password"
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

            {/* Consent checkboxes */}
            <div className="consent-checks">
              <label className="consent-check-row">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                />
                <span>
                  I agree to the{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('terms')}>Terms of Service</button>,{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('privacy')}>Privacy Policy</button>, and{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('accessibility')}>Accessibility Statement</button>.
                </span>
              </label>
              <label className="consent-check-row">
                <input
                  type="checkbox"
                  checked={agreeSms}
                  onChange={e => setAgreeSms(e.target.checked)}
                />
                <span>
                  I consent to receive SMS order updates from Habibi Halal Express. Reply <strong>STOP</strong> to opt out.{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('sms')}>SMS Terms</button>.
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary signup-next-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

          </form>
        </div>
      </div>

      {legalModal && <LegalModal docId={legalModal} onClose={() => setLegalModal(null)} />}
    </div>
  );
};

export default Signup;
