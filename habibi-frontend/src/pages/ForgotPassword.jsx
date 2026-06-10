import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab,      setTab]     = useState('email'); // 'email' | 'phone'

  // Email recovery state
  const [email,    setEmail]   = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Phone recovery state
  const [phone,    setPhone]   = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code,     setCode]    = useState('');
  const [verified, setVerified] = useState(false);

  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword(email);
      setEmailSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true); setError('');
    try {
      await authAPI.sendSmsCode(phone);
      setCodeSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send code. Please try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.length !== 5) { setError('Enter the 5-digit code from your SMS.'); return; }
    setLoading(true); setError('');
    try {
      const data = await authAPI.verifySmsCode(phone, code);
      // Log the user in directly with the short-lived token
      login(data.token, data.user);
      setVerified(true);
      setTimeout(() => navigate('/account'), 2000);
    } catch (err) {
      setError(err.message || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">
        <Link to="/login" className="fp-back"><ArrowLeft size={15} /> Back to Login</Link>

        <div className="fp-logo">
          <img src="/images/logos/logo.png" alt="Habibi" onError={e => e.target.style.display='none'} />
        </div>

        {/* Tab switcher */}
        {!emailSent && !verified && (
          <div className="fp-tabs">
            <button className={`fp-tab${tab === 'email' ? ' active' : ''}`} onClick={() => { setTab('email'); setError(''); }}>
              <Mail size={13} /> Email
            </button>
            <button className={`fp-tab${tab === 'phone' ? ' active' : ''}`} onClick={() => { setTab('phone'); setError(''); }}>
              <Phone size={13} /> Phone / SMS
            </button>
          </div>
        )}

        {/* ── Email flow ── */}
        {tab === 'email' && (
          emailSent ? (
            <div className="fp-success">
              <CheckCircle size={48} className="fp-success-icon" />
              <h2>Check your inbox</h2>
              <p>We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
              <Link to="/login" className="fp-btn-primary">Back to Login</Link>
            </div>
          ) : (
            <>
              <h1 className="fp-title">Forgot Password?</h1>
              <p className="fp-sub">Enter your email and we&apos;ll send you a reset link.</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleEmailSubmit} className="fp-form">
                <div className="fp-field">
                  <label>Email Address</label>
                  <div className="fp-input-wrap">
                    <Mail size={15} className="fp-input-icon" />
                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                  </div>
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )
        )}

        {/* ── Phone / SMS flow ── */}
        {tab === 'phone' && (
          verified ? (
            <div className="fp-success">
              <CheckCircle size={48} className="fp-success-icon" />
              <h2>Identity Verified!</h2>
              <p>Redirecting you to your account…</p>
            </div>
          ) : !codeSent ? (
            <>
              <h1 className="fp-title">Recover via Phone</h1>
              <p className="fp-sub">We&apos;ll text you a 5-digit code to verify your identity.</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleSendCode} className="fp-form">
                <div className="fp-field">
                  <label>Phone Number</label>
                  <div className="fp-input-wrap">
                    <Phone size={15} className="fp-input-icon" />
                    <input type="tel" placeholder="+1 (718) 555-0000" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus />
                  </div>
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? 'Sending…' : 'Send 5-Digit Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="fp-title">Enter Your Code</h1>
              <p className="fp-sub">A 5-digit code was sent to <strong>{phone}</strong>. It expires in 10 minutes.</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleVerifyCode} className="fp-form">
                <div className="fp-field">
                  <label>5-Digit Code</label>
                  <input
                    className="fp-code-input"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{5}"
                    maxLength={5}
                    placeholder="12345"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading || code.length !== 5}>
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button type="button" className="fp-btn-secondary" onClick={() => { setCodeSent(false); setCode(''); setError(''); }}>
                  Try a different number
                </button>
              </form>
            </>
          )
        )}
      </div>
    </div>
  );
}
