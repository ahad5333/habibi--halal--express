import React, { useState } from 'react';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAdminAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-icon"><Zap size={22} /></div>
        <div>
          <p className="login-brand-name">Habibi Admin</p>
          <p className="login-brand-sub">Staff Portal</p>
        </div>
      </div>

      <div className="login-card">
        <h1 className="login-title">Sign In</h1>
        <p className="login-sub">Administrator accounts only.</p>

        {error && <div className="login-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>Email Address</label>
            <input
              type="email" className="input"
              placeholder="admin@habibihe.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
            />
          </div>

          <div className="field">
            <label>Password</label>
            <div className="login-pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                className="input login-pw-input"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading ? <span className="spinner" style={{width:16,height:16}} /> : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="login-footer">Habibi Halal Express, INC &copy; {new Date().getFullYear()}</p>
    </div>
  );
}
