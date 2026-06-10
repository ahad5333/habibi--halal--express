import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LegalModal from '../components/LegalModal';
import './Login.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.3-161-39.3c-74 0-101.4 40.7-162 40.7s-108.2-57.1-155.6-127.3C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.8-317.3 71 0 130.5 46.4 174.9 46.4 42.7 0 109.2-49.4 188.5-49.4 3.2 0 6.4.1 9.6.3zm-166.7-219.5c39.4-46.8 67.6-111.9 67.6-177 0-8.9-.7-18.1-2.1-25.7-64 2.3-139.7 42.6-185.3 91.7-35.2 38.7-69.2 103.8-69.2 169.9 0 9.8 1.7 19.6 2.4 22.8 3.9.7 10.2 1.5 16.4 1.5 57.9 0 130.2-38.8 170.2-83.2z"/>
    </svg>
  );
}

const Login = () => {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSms, setAgreeSms] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [socialToast, setSocialToast] = useState('');

  const handleSocialLogin = (provider) => {
    setSocialToast(`${provider} login is coming soon. Please use email & password for now.`);
    setTimeout(() => setSocialToast(''), 4000);
  };

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  // Validate redirect is a same-origin relative path (no // or protocol)
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : '/';

  // Show success banner when arriving from signup page
  const fromSignup = searchParams.get('registered') === '1';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data?.birthday_coupon) {
        localStorage.setItem('habibi_birthday_coupon', JSON.stringify(data.birthday_coupon));
      }
      navigate(redirectTo);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      // Switch to login tab with success message
      setTab('login');
      setEmail('');
      setPassword('');
      setName('');
      setSuccessMsg('Account created! Please log in below.');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background */}
      <div className="login-bg">
        <div className="login-bg-overlay" />
      </div>

      {/* Header */}
      <div className="login-header">
        <Link to="/" className="login-logo">
          <img src="/images/logos/logo.png" alt="Habibi Halal Express" className="login-logo-img" />
          <div className="login-logo-text">
            <span className="login-brand-name">HABIBI HALAL EXPRESS</span>
            <span className="login-brand-sub">Authentic · Fresh · Halal</span>
          </div>
        </Link>
      </div>

      {/* Card */}
      <div className="login-card-wrapper">
        <div className="login-card">
          {/* Tabs */}
          <div className="login-tabs">
            <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
              LOGIN
            </button>
            <button className={`tab-btn ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); setAgreeTerms(false); setAgreeSms(false); }}>
              SIGN UP
            </button>
          </div>
          <div className="login-divider-line" />

          {(fromSignup || successMsg) && (
            <div className="login-success">
              ✓ {successMsg || 'Account created! Please log in to continue.'}
            </div>
          )}

          {error && (
            <div className="login-error">
              ⚠ {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <h2 className="login-title">Welcome Back</h2>
              <p className="login-subtitle">Please enter your details to access your account.</p>

              <div className="form-group mt-8">
                <label className="form-label">EMAIL OR PHONE NUMBER</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="you@example.com or (718) 555-0100"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="form-label">PASSWORD</label>
                  <Link to="/forgot-password" className="text-primary text-xs hover-underline">FORGOT PASSWORD?</Link>
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary login-btn mt-8" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="or-divider">
                <span className="or-line" />
                <span className="or-text">OR CONTINUE WITH</span>
                <span className="or-line" />
              </div>

              <div className="social-logins">
                <button type="button" className="social-login-btn social-google-btn" onClick={() => handleSocialLogin('Google')}>
                  <GoogleIcon /> Continue with Google
                </button>
                <button type="button" className="social-login-btn social-apple-btn" onClick={() => handleSocialLogin('Apple')}>
                  <AppleIcon /> Continue with Apple
                </button>
              </div>
              {socialToast && <p className="social-coming-soon">{socialToast}</p>}
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h2 className="login-title">Create Account</h2>
              <p className="login-subtitle">Sign up to order, track your meals, and earn rewards.</p>

              <div className="form-group mt-8">
                <label className="form-label">FULL NAME</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mt-4">
                <label className="form-label">EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="chef@habibi.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mt-4">
                <label className="form-label">PASSWORD</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {/* Consent checkboxes */}
              <div className="login-consent-checks">
                <label className="login-consent-row">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{' '}
                    <button type="button" className="login-terms-link" onClick={() => setLegalModal('terms')}>Terms of Service</button>,{' '}
                    <button type="button" className="login-terms-link" onClick={() => setLegalModal('privacy')}>Privacy Policy</button>, and{' '}
                    <button type="button" className="login-terms-link" onClick={() => setLegalModal('accessibility')}>Accessibility Statement</button>. <span className="login-req">*</span>
                  </span>
                </label>
                <label className="login-consent-row">
                  <input
                    type="checkbox"
                    checked={agreeSms}
                    onChange={e => setAgreeSms(e.target.checked)}
                  />
                  <span>
                    I consent to receive recurring SMS order updates from Habibi Halal Express. Reply <strong>STOP</strong> to opt out.{' '}
                    <button type="button" className="login-terms-link" onClick={() => setLegalModal('sms')}>SMS Terms</button>.
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary login-btn" disabled={loading || !agreeTerms}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="or-divider">
                <span className="or-line" />
                <span className="or-text">OR CONTINUE WITH</span>
                <span className="or-line" />
              </div>

              <div className="social-logins">
                <button type="button" className="social-login-btn social-google-btn" onClick={() => handleSocialLogin('Google')}>
                  <GoogleIcon /> Continue with Google
                </button>
                <button type="button" className="social-login-btn social-apple-btn" onClick={() => handleSocialLogin('Apple')}>
                  <AppleIcon /> Continue with Apple
                </button>
              </div>
              {socialToast && <p className="social-coming-soon">{socialToast}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <span>© 2024 Habibi Halal Express. Artisanal Halal Dining.</span>
        <div className="flex gap-6">
          <Link to="/health-safety">HEALTH &amp; SAFETY</Link>
          <Link to="/privacy-policy">PRIVACY POLICY</Link>
          <Link to="/terms">TERMS OF SERVICE</Link>
        </div>
      </div>

      {legalModal && <LegalModal docId={legalModal} onClose={() => setLegalModal(null)} />}
    </div>
  );
};

export default Login;
