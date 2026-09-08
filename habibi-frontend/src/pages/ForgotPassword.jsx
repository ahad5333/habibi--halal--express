import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socialLogin } = useAuth();
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
      setError(err.message || t('auth.errSomethingWentWrong'));
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
      setError(err.message || t('auth.errFailedToSendCode'));
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.length !== 5) { setError(t('auth.errEnterFiveDigitCode')); return; }
    setLoading(true); setError('');
    try {
      const data = await authAPI.verifySmsCode(phone, code);
      // The server already set the auth cookie on this same response (short-lived
      // recovery token) — just sync React's user state to match, same as social
      // login. The old code called login(email, password) with (token, user) as
      // the args, which fired a bogus second /api/auth/login call (never awaited,
      // so its failure was silently swallowed) and never actually updated
      // isLoggedIn — the user got redirected to /account still logged out.
      socialLogin(data);
      setVerified(true);
      setTimeout(() => navigate('/account'), 2000);
    } catch (err) {
      setError(err.message || t('auth.errInvalidOrExpiredCode'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">
        <Link to="/login" className="fp-back"><ArrowLeft size={15} /> {t('auth.backToLogin')}</Link>

        <div className="fp-logo">
          <img src="/images/logos/logo.png" alt="Habibi" onError={e => e.target.style.display='none'} />
        </div>

        {/* Tab switcher */}
        {!emailSent && !verified && (
          <div className="fp-tabs">
            <button className={`fp-tab${tab === 'email' ? ' active' : ''}`} onClick={() => { setTab('email'); setError(''); }}>
              <Mail size={13} /> {t('auth.email')}
            </button>
            <button className={`fp-tab${tab === 'phone' ? ' active' : ''}`} onClick={() => { setTab('phone'); setError(''); }}>
              <Phone size={13} /> {t('auth.phoneSms')}
            </button>
          </div>
        )}

        {/* ── Email flow ── */}
        {tab === 'email' && (
          emailSent ? (
            <div className="fp-success">
              <CheckCircle size={48} className="fp-success-icon" />
              <h2>{t('auth.checkYourInbox')}</h2>
              <p>{t('auth.resetLinkSent', { email })}</p>
              <Link to="/login" className="fp-btn-primary">{t('auth.backToLogin')}</Link>
            </div>
          ) : (
            <>
              <h1 className="fp-title">{t('auth.forgotPasswordTitle')}</h1>
              <p className="fp-sub">{t('auth.forgotPasswordSub')}</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleEmailSubmit} className="fp-form">
                <div className="fp-field">
                  <label>{t('auth.emailAddress')}</label>
                  <div className="fp-input-wrap">
                    <Mail size={15} className="fp-input-icon" />
                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                  </div>
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? t('auth.sending') : t('auth.sendResetLink')}
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
              <h2>{t('auth.identityVerified')}</h2>
              <p>{t('auth.redirectingToAccount')}</p>
            </div>
          ) : !codeSent ? (
            <>
              <h1 className="fp-title">{t('auth.recoverViaPhone')}</h1>
              <p className="fp-sub">{t('auth.recoverViaPhoneSub')}</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleSendCode} className="fp-form">
                <div className="fp-field">
                  <label>{t('auth.phoneNumber')}</label>
                  <div className="fp-input-wrap">
                    <Phone size={15} className="fp-input-icon" />
                    <input type="tel" placeholder="+1 (718) 555-0000" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus />
                  </div>
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? t('auth.sending') : t('auth.send5DigitCode')}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="fp-title">{t('auth.enterYourCode')}</h1>
              <p className="fp-sub">{t('auth.codeSentTo', { phone })}</p>
              {error && <div className="fp-error">⚠ {error}</div>}
              <form onSubmit={handleVerifyCode} className="fp-form">
                <div className="fp-field">
                  <label>{t('auth.fiveDigitCode')}</label>
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
                  {loading ? t('auth.verifying') : t('auth.verifyCode')}
                </button>
                <button type="button" className="fp-btn-secondary" onClick={() => { setCodeSent(false); setCode(''); setError(''); }}>
                  {t('auth.tryDifferentNumber')}
                </button>
              </form>
            </>
          )
        )}
      </div>
    </div>
  );
}
