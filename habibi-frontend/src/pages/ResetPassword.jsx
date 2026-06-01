import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import './ForgotPassword.css';

export default function ResetPassword() {
  const [params]          = useSearchParams();
  const token             = params.get('token') || '';
  const navigate          = useNavigate();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Invalid or expired link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="fp-page">
        <div className="fp-card">
          <div className="fp-error">No reset token found. Please use the link from your email.</div>
          <Link to="/forgot-password" className="fp-btn-primary" style={{ marginTop: '1rem' }}>Request New Link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page">
      <div className="fp-card">
        {done ? (
          <div className="fp-success">
            <CheckCircle size={48} className="fp-success-icon" />
            <h2>Password Updated!</h2>
            <p>Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h1 className="fp-title">Set New Password</h1>
            <p className="fp-sub">Choose a strong password for your account.</p>

            {error && <div className="fp-error">⚠ {error}</div>}

            <form onSubmit={handleSubmit} className="fp-form">
              <div className="fp-field">
                <label>New Password</label>
                <div className="fp-input-wrap">
                  <Lock size={15} className="fp-input-icon" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required autoFocus
                  />
                  <button type="button" className="fp-eye" onClick={() => setShowPw(s => !s)}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="fp-strength">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`fp-strength-bar ${password.length > i * 3 ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>

              <div className="fp-field">
                <label>Confirm Password</label>
                <div className="fp-input-wrap">
                  <Lock size={15} className="fp-input-icon" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {confirm && password !== confirm && (
                  <p className="fp-match-err">Passwords don&apos;t match</p>
                )}
              </div>

              <button type="submit" className="fp-btn-primary" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
