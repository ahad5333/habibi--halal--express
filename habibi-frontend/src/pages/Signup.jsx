import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Lock, Eye, EyeOff, Check } from 'lucide-react';
import LegalModal from '../components/LegalModal';
import { authAPI } from '../services/api';
import './Signup.css';

const Signup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : '/';
  const { register } = useAuth();
  const location = useLocation();

  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyEmail, setVerifyEmail]       = useState('');
  const [accountCreated, setAccountCreated] = useState(null); // { name, identifier }
  const [showPass, setShowPass]             = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [signupMethod, setSignupMethod]     = useState('phone'); // 'email' | 'phone'

  // Phone OTP verification state
  const [phoneOtpPending, setPhoneOtpPending] = useState(null); // { phone, name }
  const [otp, setOtp]                         = useState('');
  const [otpLoading, setOtpLoading]           = useState(false);
  const [otpError, setOtpError]               = useState('');

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

  useEffect(() => { resetForm(); }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => { if (e.persisted) resetForm(); };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, [resetForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError(t('auth.errFirstLastNameRequired')); return;
    }

    if (signupMethod === 'email') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError(t('auth.errValidEmail')); return;
      }
    } else {
      if (!phone.trim()) {
        setError(t('auth.errEnterPhone')); return;
      }
    }

    if (!password || password.length < 8) {
      setError(t('auth.errPasswordTooShort')); return;
    }
    if (!/[0-9]/.test(password)) {
      setError(t('auth.errPasswordNoNumber')); return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errPasswordsDontMatch')); return;
    }
    if (!agreeTerms) {
      setError(t('auth.errAgreeToContinue')); return;
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
          sms_consent: agreeSms,
        }
      );

      if (result?.requiresVerification) {
        setVerifyEmail(submittedEmail);
        resetForm();
        setVerificationSent(true);
      } else if (result?.requiresPhoneVerification) {
        const name = `${firstName} ${lastName}`.trim();
        setPhoneOtpPending({ phone: result.phone || phone.trim(), name });
        resetForm();
      } else {
        // Show confirmation screen immediately, then redirect after 3s
        const name = `${firstName} ${lastName}`.trim();
        const identifier = signupMethod === 'phone' ? phone.trim() : email.trim();
        resetForm();
        setAccountCreated({ name, identifier, method: signupMethod });
        setTimeout(() => navigate(redirectTo !== '/' ? redirectTo : '/'), 3500);
      }
    } catch (err) {
      setError(err.message || t('auth.errRegistrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { setOtpError(t('auth.errEnter6DigitCode')); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const data = await authAPI.verifyPhoneOtp(phoneOtpPending.phone, otp);
      if (data.user) localStorage.setItem('habibi_user', JSON.stringify({ id: data.user.id, name: data.user.name }));
      setPhoneOtpPending(null);
      setOtp('');
      setAccountCreated({ name: phoneOtpPending.name, identifier: phoneOtpPending.phone, method: 'phone' });
      setTimeout(() => navigate(redirectTo !== '/' ? redirectTo : '/'), 3500);
    } catch (err) {
      setOtpError(err.message || t('auth.errIncorrectCode'));
    } finally {
      setOtpLoading(false);
    }
  };

  if (phoneOtpPending) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 440, width: '100%', padding: '2.5rem', background: '#141414', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
          <h2 style={{ color: '#F97316', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('auth.verifyYourNumber')}</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
            {t('auth.weSentCodeTo')}
          </p>
          <p style={{ color: '#fff', fontWeight: 700, marginBottom: '1.5rem' }}>{phoneOtpPending.phone}</p>
          <form onSubmit={handleOtpSubmit}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={{
                width: '100%', textAlign: 'center', letterSpacing: '0.4em',
                fontSize: '1.8rem', fontWeight: 700, padding: '0.75rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, color: '#fff', outline: 'none', marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            {otpError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{otpError}</p>}
            <button
              type="submit"
              disabled={otpLoading || otp.length < 6}
              style={{ width: '100%', background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '0.85rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: otpLoading || otp.length < 6 ? 0.6 : 1 }}
            >
              {otpLoading ? t('auth.verifying') : t('auth.confirmCode')}
            </button>
          </form>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: '1.25rem' }}>
            {t('auth.didntGetItCheckNumber')}{' '}
            <button onClick={() => setPhoneOtpPending(null)} style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}>
              {t('auth.goBack')}
            </button>.
          </p>
        </div>
      </div>
    );
  }

  if (accountCreated) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, padding: '2.5rem', background: '#141414', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#F97316', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('auth.welcomeToHabibi')}</h2>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem' }}>{accountCreated.name}</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {accountCreated.method === 'phone' ? '📱 ' : '📧 '}{accountCreated.identifier}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: '1.75rem', fontSize: '0.92rem' }}>
            {t('auth.accountCreatedLoggedIn')}
          </p>
          <button
            onClick={() => navigate(redirectTo !== '/' ? redirectTo : '/')}
            style={{ background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}
          >
            {t('auth.startOrdering')}
          </button>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', marginTop: '1rem' }}>{t('auth.redirectingAutomatically')}</p>
        </div>
      </div>
    );
  }

  if (verificationSent) {
    return (
      <div className="signup-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, padding: '2.5rem', background: '#141414', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#F97316', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.6rem' }}>{t('auth.accountCreatedCheckEmailTitle')}</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
            {t('auth.weSentVerificationLinkTo')}
          </p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>{verifyEmail}</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {t('auth.clickLinkToActivate')}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
            {t('auth.didntReceiveCheckSpam')}{' '}
            <button onClick={() => setVerificationSent(false)} style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
              {t('auth.tryAgain')}
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
          <p className="sp-eyebrow">{t('auth.joinTheFamily')}</p>
          <h2 className="sp-headline">{t('auth.becomeAMember')}<br /><span className="text-primary">{t('auth.habibiMember')}</span></h2>
          <p className="sp-sub">{t('auth.signupPanelDesc')}</p>

          <ul className="sp-benefits">
            <li><span className="sp-check"><Check size={13} /></span> {t('auth.benefitDeals')}</li>
            <li><span className="sp-check"><Check size={13} /></span> {t('auth.benefitAddresses')}</li>
            <li><span className="sp-check"><Check size={13} /></span> {t('auth.benefitTracking')}</li>
            <li><span className="sp-check"><Check size={13} /></span> {t('auth.benefitEarlyAccess')}</li>
          </ul>

          <div className="sp-halal-badge">
            <img src="/images/logos/halal-certified-premium.webp" alt="Halal Certified" className="sp-halal-img" />
            <div>
              <p className="sp-halal-title">{t('auth.zabihaCertifiedTitle')}</p>
              <p className="sp-halal-sub">{t('auth.verifiedSince2002')}</p>
            </div>
          </div>
        </div>

        <p className="sp-panel-footer">{t('auth.signupFooterCopyright', { year: new Date().getFullYear() })}</p>
      </div>

      {/* Right form */}
      <div className="signup-form-side">
        <div className="signup-form-wrap">

          <h2 className="sp-form-title">{t('auth.createAnAccount')}</h2>
          <p className="sp-form-sub">{t('auth.alreadyHaveOne')} <Link to={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-primary">{t('auth.signIn2')}</Link></p>

          {/* Method toggle */}
          <div className="signup-method-toggle">
            <button
              type="button"
              className={`signup-method-btn${signupMethod === 'phone' ? ' active' : ''}`}
              onClick={() => { setSignupMethod('phone'); setError(''); }}
            >
              <Phone size={14} /> {t('auth.phoneNumberTab')}
            </button>
            <button
              type="button"
              className={`signup-method-btn${signupMethod === 'email' ? ' active' : ''}`}
              onClick={() => { setSignupMethod('email'); setError(''); }}
            >
              <Mail size={14} /> {t('auth.emailAddressTab')}
            </button>
          </div>

          {error && <div className="signup-error">⚠ {error}</div>}

          <form onSubmit={handleSubmit} noValidate>

            {/* Name row */}
            <div className="form-row two-col">
              <div className="form-group">
                <label className="form-label">{t('auth.firstName')} <span className="req">*</span></label>
                <input
                  className="form-input"
                  placeholder="Ahmad"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.lastName')} <span className="req">*</span></label>
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
                <label className="form-label">{t('auth.phoneNumberLabel')} <span className="req">*</span></label>
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
                <label className="form-label">{t('auth.emailAddress')} <span className="req">*</span></label>
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
                <label className="form-label">{t('auth.phoneNumberLabel')} <span className="opt">{t('auth.optionalForOrderUpdates')}</span></label>
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
              <label className="form-label">{t('auth.password')} <span className="req">*</span></label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input with-icon with-eye"
                  placeholder={t('auth.min8CharsWithNumberFull')}
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
                  <span className="pw-label">{password.length < 8 ? t('auth.tooShort') : password.length < 12 ? t('auth.fair') : t('auth.strong')}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <label className="form-label">{t('auth.confirmPasswordLabel')} <span className="req">*</span></label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input with-icon with-eye"
                  placeholder={t('auth.repeatYourPassword')}
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
                  {password === confirmPassword ? t('auth.passwordsMatch') : t('auth.passwordsDoNotMatchX')}
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
                  {t('auth.agreeToTermsPrefix')}{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('terms')}>{t('auth.termsOfServiceLink')}</button>,{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('privacy')}>{t('auth.privacyPolicyLink')}</button>, {t('auth.andLink')}{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('accessibility')}>{t('auth.accessibilityStatement')}</button>.
                </span>
              </label>
              <label className="consent-check-row">
                <input
                  type="checkbox"
                  checked={agreeSms}
                  onChange={e => setAgreeSms(e.target.checked)}
                />
                <span>
                  {t('auth.smsConsentPrefixShort')} <strong>{t('auth.smsConsentStop')}</strong> {t('auth.smsConsentSuffix')}{' '}
                  <button type="button" className="terms-link" onClick={() => setLegalModal('sms')}>{t('auth.smsTermsLink')}</button>.
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary signup-next-btn" disabled={loading}>
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>

          </form>
        </div>
      </div>

      {legalModal && <LegalModal docId={legalModal} onClose={() => setLegalModal(null)} />}
    </div>
  );
};

export default Signup;
