import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, Mic, Square } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { assistantAPI } from '../services/api';
import './AssistantWidget.css';

// Habibi's cartoon character, cropped to head and shoulders so the face still
// reads at the launcher's 56px (full-body, it shrank to a few pixels). Served
// as a 192px WebP -- 3x the largest display size, ~12KB against the 113KB
// source PNG. Transparent background: the orange circles come from CSS.
const ASSISTANT_AVATAR = '/images/assistant/habibi-assistant-face.webp';

// Greeting bubble beside the launcher, so a first-time visitor knows the
// button is an AI assistant they can order through. Shown once per browser
// session, a few seconds after the page settles; closing it or opening the
// chat hides it for a week. Storage can throw (private mode, blocked site
// data) -- then it simply shows.
const TEASER_DELAY_MS = 3000;
const TEASER_VISIBLE_MS = 20000;
const TEASER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const TEASER_SEEN_KEY = 'habibi_asw_teaser_seen';
const TEASER_SNOOZE_KEY = 'habibi_asw_teaser_snoozed_at';

const teaserAllowed = () => {
  try {
    if (sessionStorage.getItem(TEASER_SEEN_KEY)) return false;
    const snoozedAt = Number(localStorage.getItem(TEASER_SNOOZE_KEY) || 0);
    return !(snoozedAt && Date.now() - snoozedAt < TEASER_SNOOZE_MS);
  } catch { return true; }
};
const snoozeTeaser = () => {
  try { localStorage.setItem(TEASER_SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ }
};

// Browser speech-to-text: Chrome, Edge, Safari (iPhone too). Firefox has none,
// so the mic button isn't rendered there. Audio goes to the browser's own
// speech service (Google or Apple), never to our server -- only the text does.
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

const VOICE_ERRORS = {
  'not-allowed': "I can't hear you — microphone access is blocked. Allow the microphone for this site in your browser settings, or type instead.",
  'service-not-allowed': "Voice input isn't available in this browser. On an iPhone, turn on Dictation (Settings → General → Keyboard), or just type.",
  'no-speech': "I didn't catch that — tap the mic and try again.",
  'audio-capture': "I couldn't find a microphone on this device.",
  'network': "Voice input couldn't reach your browser's speech service — try again, or type instead.",
};
const VOICE_ERROR_DEFAULT = "Voice input isn't working right now — try typing instead.";

const getFallbackImg = (id) => `/images/menu/${((id || 1) % 70) + 1}.jpg`;

const QUICK_REPLIES = [
  { key: 'quickReplyDeals', text: 'Any deals today?' },
  { key: 'quickReplySpicy', text: "What's spicy?" },
  { key: 'quickReplyVegetarian', text: 'Vegetarian options?' },
  { key: 'quickReplyHours', text: 'What are your hours?' },
  { key: 'quickReplyCatering', text: 'Do you do catering?' },
];

export default function AssistantWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items: cartItems, addItem, removeItem, updateQty, clearCart } = useCart();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [listening, setListening] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const bodyRef = useRef(null);
  // What was added on the previous turn, so "make that 3" knows its target.
  const lastItemsRef = useRef([]);
  const recognitionRef = useRef(null);
  // Latest send(), for the speech callback: it fires after the render that
  // started listening, and must not send with that render's stale state.
  const sendRef = useRef(null);

  useEffect(() => {
    if (!teaserAllowed()) return undefined;
    let hideTimer;
    const showTimer = setTimeout(() => {
      try { sessionStorage.setItem(TEASER_SEEN_KEY, '1'); } catch { /* ignore */ }
      setTeaser(true);
      hideTimer = setTimeout(() => setTeaser(false), TEASER_VISIBLE_MS);
    }, TEASER_DELAY_MS);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  const openChat = () => {
    setTeaser(false);
    snoozeTeaser();
    setOpen(true);
  };

  const dismissTeaser = () => {
    setTeaser(false);
    snoozeTeaser();
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: t('assistant.greeting'), items: [], actions: [] }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

  // Closing the panel (or leaving the page) switches the mic off without
  // sending whatever was half-said.
  const cancelVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.cancelled = true;
    rec.abort();
  };
  useEffect(() => { if (!open) cancelVoice(); }, [open]);
  useEffect(() => cancelVoice, []);

  const botSay = (text) =>
    setMessages(prev => [...prev, { role: 'bot', text, items: [], actions: [] }]);

  // Tap the mic, speak, and the words appear in the box as you talk; when you
  // stop (or tap again) the order is sent as if typed.
  const startVoice = () => {
    if (!SpeechRecognition || sending || recognitionRef.current) return;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let failed = false;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      failed = true;
      botSay(VOICE_ERRORS[e.error] || VOICE_ERROR_DEFAULT);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      const said = finalText.trim();
      if (said && !failed && !rec.cancelled) sendRef.current?.(said, 'voice');
    };

    recognitionRef.current = rec;
    setInput('');
    setListening(true);
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      botSay(VOICE_ERROR_DEFAULT);
    }
  };

  const stopVoice = () => recognitionRef.current?.stop();

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(c => (c === code ? null : c)), 2000);
    } catch {
      // Clipboard blocked: the code is on the button to type in by hand.
    }
  };

  const cartSnapshot = () =>
    cartItems.map(i => ({ id: i.id, cartKey: i.cartKey ?? i.id, name: i.name, qty: i.qty }));

  const runAction = (action) => {
    if (action.type === 'add_to_cart') {
      addItem({
        id: action.item.id,
        name: action.item.name,
        price: parseFloat(action.item.price || 0),
        img: action.item.image_url || getFallbackImg(action.item.id),
        tag: 'Assistant',
        note: '',
        qty: action.qty || 1,
      });
    } else if (action.type === 'remove_from_cart') {
      removeItem(action.cartKey);
    } else if (action.type === 'set_cart_qty') {
      // "make that 3" — retarget whatever was added last turn. If it somehow
      // isn't in the cart any more, add it at the requested quantity instead of
      // silently doing nothing.
      const key = action.item.cartKey ?? action.item.id;
      const inCart = cartItems.some(i => (i.cartKey ?? i.id) === key);
      if (inCart) updateQty(key, action.qty);
      else addItem({
        id: action.item.id,
        name: action.item.name,
        price: parseFloat(action.item.price || 0),
        img: action.item.image_url || getFallbackImg(action.item.id),
        tag: 'Assistant',
        note: '',
        qty: action.qty || 1,
      });
    } else if (action.type === 'navigate') {
      setOpen(false);
      navigate(action.to);
    }
    // 'confirm_clear_cart' is rendered as inline Yes/No buttons, not auto-run.
  };

  const send = async (text, inputMode = 'text') => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setSending(true);
    try {
      // History lets the assistant resolve follow-ups ("make that 3"), and
      // lastItems tells it which items such a follow-up refers to.
      const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
      const res = await assistantAPI.chat(message, cartSnapshot(), history, lastItemsRef.current, inputMode);
      const actions = res.actions || [];
      actions.filter(a => a.type !== 'confirm_clear_cart').forEach(runAction);
      // Items already added via an action shouldn't offer a second "Add" —
      // that would silently double the quantity if tapped.
      const addedIds = actions.filter(a => a.type === 'add_to_cart').map(a => a.item.id);
      const justAdded = actions.filter(a => a.type === 'add_to_cart').map(a => a.item);
      if (justAdded.length) lastItemsRef.current = justAdded;
      setMessages(prev => [...prev, {
        role: 'bot', text: res.text, items: res.items || [],
        suggestions: res.suggestions || [], offers: res.offers || [], cta: res.cta || null,
        actions, addedIds,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't process that — please try again.", items: [], actions: [] }]);
    } finally {
      setSending(false);
    }
  };
  sendRef.current = send;

  const handleAddCard = (item) => {
    addItem({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price || 0),
      img: item.image_url || getFallbackImg(item.id),
      tag: 'Assistant',
      note: '',
      qty: 1,
    });
    setMessages(prev => prev.map(m =>
      m.items?.some(i => i.id === item.id) ? { ...m, addedIds: [...(m.addedIds || []), item.id] } : m
    ));
  };

  const handleConfirmClear = (msgIdx, confirmed) => {
    if (confirmed) clearCart();
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, confirmed: true } : m));
    if (confirmed) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Cleared your cart.', items: [], actions: [] }]);
    }
  };

  return (
    <div className="asw-root">
      {open && (
        <div className="asw-panel">
          <div className="asw-header">
            <span className="asw-header-id">
              <img src={ASSISTANT_AVATAR} alt="" className="asw-avatar asw-avatar-header" />
              <span className="asw-header-text">
                <span className="asw-header-title">{t('assistant.title')}</span>
                <span className="asw-header-sub">{t('assistant.subtitle')}</span>
              </span>
            </span>
            <button className="asw-close" onClick={() => setOpen(false)} aria-label={t('assistant.close')}>
              <X size={18} />
            </button>
          </div>

          <div className="asw-body" ref={bodyRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`asw-msg asw-msg-${m.role}`}>
                {m.role === 'bot' && <img src={ASSISTANT_AVATAR} alt="" className="asw-avatar asw-avatar-msg" />}
                <div className="asw-bubble">{m.text}</div>

                {m.items && m.items.length > 0 && (
                  <div className="asw-cards">
                    {m.items.map(item => (
                      <div key={item.id} className="asw-card">
                        <img
                          src={item.image_url || getFallbackImg(item.id)}
                          alt={item.name}
                          className="asw-card-img"
                          loading="lazy"
                          onError={e => { e.target.src = getFallbackImg(item.id); }}
                        />
                        <div className="asw-card-body">
                          <p className="asw-card-name">{item.name}</p>
                          <p className="asw-card-price">${parseFloat(item.price || 0).toFixed(2)}</p>
                        </div>
                        <button
                          className={`asw-card-add ${m.addedIds?.includes(item.id) ? 'added' : ''}`}
                          onClick={() => handleAddCard(item)}
                        >
                          {m.addedIds?.includes(item.id) ? `✓ ${t('assistant.added')}` : t('assistant.add')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="asw-suggests">
                    {m.suggestions.map(s => (
                      <button
                        key={s.id}
                        className={`asw-suggest ${m.addedIds?.includes(s.id) ? 'added' : ''}`}
                        onClick={() => handleAddCard(s)}
                      >
                        {m.addedIds?.includes(s.id) ? '✓ ' : '+ '}{s.name}
                        <span className="asw-suggest-price">${parseFloat(s.price || 0).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {m.offers && m.offers.length > 0 && (
                  <div className="asw-offers">
                    {m.offers.map(o => (
                      <div key={o.code} className="asw-offer">
                        <div className="asw-offer-body">
                          <p className="asw-offer-title">
                            <span className="asw-offer-value">{o.value}</span>
                            {o.title}
                          </p>
                          {o.terms && <p className="asw-offer-terms">{o.terms}</p>}
                        </div>
                        <button
                          type="button"
                          className={`asw-offer-code ${copiedCode === o.code ? 'copied' : ''}`}
                          onClick={() => copyCode(o.code)}
                          aria-label={`${t('assistant.copyCode')} ${o.code}`}
                        >
                          {copiedCode === o.code ? `✓ ${t('assistant.copied')}` : o.code}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {m.cta && (
                  <button
                    type="button"
                    className="asw-cta"
                    onClick={() => { setOpen(false); navigate(m.cta.to); }}
                  >
                    {m.cta.label} →
                  </button>
                )}

                {m.actions?.some(a => a.type === 'confirm_clear_cart') && !m.confirmed && (
                  <div className="asw-confirm-row">
                    <button className="asw-confirm-yes" onClick={() => handleConfirmClear(idx, true)}>{t('assistant.confirmYes')}</button>
                    <button className="asw-confirm-no" onClick={() => handleConfirmClear(idx, false)}>{t('assistant.confirmNo')}</button>
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="asw-msg asw-msg-bot">
                <img src={ASSISTANT_AVATAR} alt="" className="asw-avatar asw-avatar-msg" />
                <div className="asw-bubble asw-typing"><span /><span /><span /></div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="asw-quick-replies">
              {QUICK_REPLIES.map(q => (
                <button key={q.key} className="asw-quick-reply" onClick={() => send(q.text)}>
                  {t(`assistant.${q.key}`)}
                </button>
              ))}
            </div>
          )}

          <form
            className="asw-input-row"
            onSubmit={e => { e.preventDefault(); send(); }}
          >
            <input
              type="text"
              className="asw-input"
              placeholder={listening ? t('assistant.listening') : t('assistant.placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            {SpeechRecognition && (
              <button
                type="button"
                className={`asw-mic ${listening ? 'listening' : ''}`}
                onClick={listening ? stopVoice : startVoice}
                disabled={sending && !listening}
                aria-pressed={listening}
                aria-label={listening ? t('assistant.voiceStop') : t('assistant.voiceStart')}
                title={listening ? t('assistant.voiceStop') : t('assistant.voiceStart')}
              >
                {listening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
              </button>
            )}
            <button type="submit" className="asw-send" aria-label={t('assistant.send')} disabled={sending || !input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {!open && teaser && (
        <div className="asw-teaser">
          <button type="button" className="asw-teaser-body" onClick={openChat}>
            <span className="asw-teaser-hi">{t('assistant.teaserHi')}</span>
            <span className="asw-teaser-text">{t('assistant.teaserText')}</span>
          </button>
          <button type="button" className="asw-teaser-close" onClick={dismissTeaser} aria-label={t('assistant.dismiss')}>
            <X size={14} />
          </button>
        </div>
      )}

      {!open && (
        <button className="asw-fab" onClick={openChat} aria-label={t('assistant.open')}>
          <img src={ASSISTANT_AVATAR} alt="" className="asw-fab-avatar" />
          <span className="asw-fab-badge" aria-hidden="true">{t('assistant.aiBadge')}</span>
        </button>
      )}
    </div>
  );
}
