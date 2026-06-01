import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Lock, Mail, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './PartnerLogin.css';

export default function PartnerLogin() {
  const { login, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // If already logged in as partner, go straight to dashboard
  useEffect(() => {
    if (isLoggedIn && user?.is_partner) navigate('/partner', { replace: true });
    else if (isLoggedIn && !user?.is_partner) setError('Your account is not approved as a partner yet. Apply at the Wholesale page.');
  }, [isLoggedIn, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await login(email, password);
      if (!data.user?.is_partner) {
        setError('This account is not an approved partner. If you applied, please wait for approval.');
        return;
      }
      navigate('/partner', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pln-shell">
      <div className="pln-left">
        <div className="pln-brand">
          <div className="pln-brand-icon"><Briefcase size={22} /></div>
          <div>
            <p className="pln-brand-name">Habibi Business</p>
            <p className="pln-brand-sub">Partner Portal</p>
          </div>
        </div>
        <div className="pln-hero">
          <h1 className="pln-hero-title">Welcome Back,<br/>Partner</h1>
          <p className="pln-hero-sub">
            Access your wholesale catalog, manage bulk orders,<br/>and view invoices in one place.
          </p>
          <ul className="pln-features">
            {['Partner pricing on all items', 'Bulk order management', 'Monthly invoicing', 'Priority support'].map(f => (
              <li key={f}><ChevronRight size={14} /> {f}</li>
            ))}
          </ul>
        </div>
        <p className="pln-footer-note">
          Not a partner yet?{' '}
          <Link to="/wholesale" className="pln-apply-link">Apply for wholesale access →</Link>
        </p>
      </div>

      <div className="pln-right">
        <div className="pln-card">
          <h2 className="pln-card-title">Sign in to your account</h2>
          <p className="pln-card-sub">Use your approved partner credentials</p>

          {error && <div className="pln-error">{error}</div>}

          <form onSubmit={handleSubmit} className="pln-form">
            <div className="pln-field">
              <label>Business Email</label>
              <div className="pln-input-wrap">
                <Mail size={15} className="pln-input-icon" />
                <input
                  type="email"
                  className="pln-input"
                  placeholder="contact@yourbusiness.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="pln-field">
              <label>Password</label>
              <div className="pln-input-wrap">
                <Lock size={15} className="pln-input-icon" />
                <input
                  type="password"
                  className="pln-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="pln-forgot-row">
              <Link to="/forgot-password" className="pln-forgot">Forgot password?</Link>
            </div>

            <button type="submit" className="pln-submit" disabled={loading}>
              {loading ? <span className="pln-spinner" /> : <><ArrowRight size={16} /> Sign In</>}
            </button>
          </form>

          <div className="pln-divider">
            <span>or</span>
          </div>

          <div className="pln-alts">
            <Link to="/login" className="pln-alt-link">Sign in as a regular customer</Link>
            <Link to="/wholesale" className="pln-alt-link">Apply for a partner account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
