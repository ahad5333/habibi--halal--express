import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">
        <Link to="/login" className="fp-back"><ArrowLeft size={15} /> Back to Login</Link>

        <div className="fp-logo">
          <img src="/images/logos/habibi-logo.png" alt="Habibi" onError={e => e.target.style.display='none'} />
        </div>

        {sent ? (
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

            <form onSubmit={handleSubmit} className="fp-form">
              <div className="fp-field">
                <label>Email Address</label>
                <div className="fp-input-wrap">
                  <Mail size={15} className="fp-input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="fp-btn-primary" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
