import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';
import './ForgotPassword.css';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params]          = useSearchParams();
  const token             = params.get('token') || '';
  const isPartner         = params.get('type') === 'partner';
  const navigate          = useNavigate();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('auth.errPasswordTooShort')); return; }
    if (!/[0-9]/.test(password)) { setError(t('auth.errPasswordNoNumber')); return; }
    if (password !== confirm) { setError(t('auth.errPasswordsDontMatch')); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate(isPartner ? '/partner/login' : '/login'), 2500);
    } catch (err) {
      setError(err.message || t('auth.errInvalidResetLink'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="fp-page">
        <div className="fp-card">
          <div className="fp-error">{t('auth.noResetToken')}</div>
          <Link to="/forgot-password" className="fp-btn-primary" style={{ marginTop: '1rem' }}>{t('auth.requestNewLink')}</Link>
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
            <h2>{t('auth.passwordUpdated')}</h2>
            <p>{t('auth.redirectingToLogin')}</p>
          </div>
        ) : (
          <>
            <h1 className="fp-title">{t('auth.setNewPassword')}</h1>
            <p className="fp-sub">{t('auth.chooseStrongPassword')}</p>

            {error && <div className="fp-error">⚠ {error}</div>}

            <form onSubmit={handleSubmit} className="fp-form">
              <div className="fp-field">
                <label>{t('auth.newPassword')}</label>
                <div className="fp-input-wrap">
                  <Lock size={15} className="fp-input-icon" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('auth.min8CharsWithNumber')}
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
                <label>{t('auth.confirmPassword')}</label>
                <div className="fp-input-wrap">
                  <Lock size={15} className="fp-input-icon" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('auth.repeatPassword')}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {confirm && password !== confirm && (
                  <p className="fp-match-err">{t('auth.passwordsDontMatchShort')}</p>
                )}
              </div>

              <button type="submit" className="fp-btn-primary" disabled={loading}>
                {loading ? t('auth.updating') : t('auth.updatePassword')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
