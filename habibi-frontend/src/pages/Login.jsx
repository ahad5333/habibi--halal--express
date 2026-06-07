import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LegalModal from '../components/LegalModal';
import './Login.css';

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
      await login(email, password);
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
                <button type="button" className="social-login-btn" style={{ width: '100%' }}>
                  <span className="social-icon google-icon">G</span> GOOGLE
                </button>
              </div>
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
                <button type="button" className="social-login-btn" style={{ width: '100%' }}>
                  <span className="social-icon google-icon">G</span> GOOGLE
                </button>
              </div>
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
