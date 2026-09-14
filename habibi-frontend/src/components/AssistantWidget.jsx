import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, Mic, Square, Phone, Mail } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { assistantAPI, cateringAPI } from '../services/api';
import { setPendingCoupon } from '../utils/pendingCoupon';
import './AssistantWidget.css';

// Habibi's cartoon character, cropped to head and shoulders so the face still
// reads at the launcher's 56px (full-body, it shrank to a few pixels). Served
// as a 192px WebP -- 3x the largest display size, ~12KB against the 113KB
// source PNG. Transparent background: the orange circles come from CSS.
const ASSISTANT_AVATAR = '/images/assistant/habibi-assistant-face.webp';

// Greeting bubble beside the launcher, so a visitor knows the button is an AI
// assistant they can order through. Shown once per visit (browser session), a
// few seconds after the page settles, on every visit until the person has
// opened the chat once -- after that they know it's there. Closing the bubble
// only hides it for the current visit. Storage can throw (private mode,
// blocked site data) -- then it simply shows.
const TEASER_DELAY_MS = 3000;
const TEASER_VISIBLE_MS = 20000;
const TEASER_SEEN_KEY = 'habibi_asw_teaser_seen'; // sessionStorage: shown this visit
const ASSISTANT_USED_KEY = 'habibi_asw_used';     // localStorage: has opened the chat

// Keeps the conversation when the widget is remounted: a reload, or leaving the
// pages it appears on (checkout, account) and coming back. Between Home, Menu,
// Locations and Offers it stays mounted, so walking between those keeps the chat
// in memory anyway. Kept in sessionStorage: it should survive moving around the
// site, not come back days later as a stale conversation. Only role/text/items
// are stored, never actions -- runAction only runs on a fresh reply, so a
// restored "added to your cart" message can't add the item a second time.
// Capped so a long chat can't fill the quota.
const CHAT_KEY = 'habibi_asw_chat';
const CHAT_MAX = 20;

const loadChat = () => {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Array.isArray(v?.messages) || !v.messages.length) return null;
    return { messages: v.messages, lastItems: Array.isArray(v.lastItems) ? v.lastItems : [] };
  } catch { return null; }
};

const saveChat = (messages, lastItems) => {
  try {
    if (!messages.length) { sessionStorage.removeItem(CHAT_KEY); return; }
    const trimmed = messages.slice(-CHAT_MAX).map(m => ({
      role: m.role, text: m.text, items: Array.isArray(m.items) ? m.items.slice(0, 6) : [],
    }));
    sessionStorage.setItem(CHAT_KEY, JSON.stringify({ messages: trimmed, lastItems: (lastItems || []).slice(0, 6) }));
  } catch { /* private mode or quota — the chat just won't persist */ }
};

const teaserAllowed = () => {
  try {
    if (sessionStorage.getItem(TEASER_SEEN_KEY)) return false;
    return !localStorage.getItem(ASSISTANT_USED_KEY);
  } catch { return true; }
};
const markAssistantUsed = () => {
  try { localStorage.setItem(ASSISTANT_USED_KEY, '1'); } catch { /* ignore */ }
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
  { key: 'quickReplyTrack', text: 'Track my order' },
  { key: 'quickReplyMeal', text: 'Feed 4 under $50' },
  { key: 'quickReplyHours', text: 'Are you open now?' },
  { key: 'quickReplyCatering', text: 'Catering for my event' },
  { key: 'quickReplyContact', text: 'Talk to a person' },
];

// Shown on the greeting bubble itself. The quick replies above only appeared
// once the chat was already open, which asked people to think of a question
// before they knew what could be asked. These three send straight through, so
// one tap gets an actual answer rather than an empty chat box.
const TEASER_CHIPS = [
  { key: 'teaserChipDeals', text: 'Any deals today?' },
  { key: 'teaserChipHours', text: 'Are you open now?' },
  { key: 'teaserChipMeal',  text: 'Feed 4 under $50' },
];

// Keeps the bubble from reading identically on every visit.
const teaserHiKey = () => {
  const h = new Date().getHours();
  if (h < 11) return 'assistant.teaserHiMorning';
  if (h < 17) return 'assistant.teaserHiAfternoon';
  if (h < 22) return 'assistant.teaserHiEvening';
  return 'assistant.teaserHiLate';
};

// Catering quote request inside the chat. Posts to the same endpoint as the
// Catering page, so it lands in CPanel → Catering Quotes with the same
// validation, confirmation email and rough estimate.
function CateringForm({ prefill }) {
  const [f, setF] = useState({
    date: prefill?.date || '',
    guests: prefill?.guests ? String(prefill.guests) : '',
    service: 'delivery',
    address: '',
    name: '',
    phone: '',
    email: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const today = new Date().toLocaleDateString('en-CA');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const guests = parseInt(f.guests, 10);
    if (!f.date) return setErr('Pick the date of your event.');
    if (!guests || guests < 10) return setErr('Catering starts at 10 guests.');
    if (f.service === 'delivery' && !f.address.trim()) return setErr('Add the event address, or choose pickup.');
    if (!f.name.trim()) return setErr('Add your name.');
    if (f.phone.replace(/\D/g, '').length < 10) return setErr('Add a phone number we can call you on.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Add a valid email — the quote is sent there.');
    setBusy(true);
    try {
      const res = await cateringAPI.requestQuote({
        full_name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        event_type: 'Other',
        event_date: `${f.date}T12:00:00`,
        guest_count: guests,
        service_type: f.service,
        event_address: f.service === 'delivery' ? f.address.trim() : '',
        notes: 'Sent from the website assistant.',
      });
      setDone({ id: res?.data?.id, estimate: Number(res?.estimated_total) || 0, email: f.email.trim(), guests });
    } catch (e2) {
      setErr(e2.message || 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="asw-cater-done">
        <strong>✓ Request sent{done.id ? ` — reference #CAT-${String(done.id).padStart(4, '0')}` : ''}.</strong>{' '}
        We'll email a quote to {done.email} within 24–48 hours.
        {done.estimate > 0 && (
          <> Rough estimate for {done.guests} guests: ~${done.estimate.toLocaleString('en-US')} (your final quote may vary).</>
        )}
      </div>
    );
  }

  return (
    <form className="asw-cater" onSubmit={submit} noValidate>
      <div className="asw-cater-row">
        <label>Event date<input type="date" min={today} value={f.date} onChange={set('date')} /></label>
        <label>Guests<input type="number" min="10" inputMode="numeric" placeholder="10+" value={f.guests} onChange={set('guests')} /></label>
      </div>
      <div className="asw-cater-toggle" role="radiogroup" aria-label="Delivery or pickup">
        {['delivery', 'pickup'].map(s => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={f.service === s}
            className={f.service === s ? 'on' : ''}
            onClick={() => setF(p => ({ ...p, service: s }))}
          >
            {s === 'delivery' ? 'Delivery' : 'Pickup'}
          </button>
        ))}
      </div>
      {f.service === 'delivery' && (
        <label>Event address<input type="text" autoComplete="street-address" value={f.address} onChange={set('address')} /></label>
      )}
      <label>Your name<input type="text" autoComplete="name" value={f.name} onChange={set('name')} /></label>
      <div className="asw-cater-row">
        <label>Phone<input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></label>
        <label>Email<input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
      </div>
      {err && <p className="asw-cater-err" role="alert">{err}</p>}
      <button type="submit" className="asw-cater-submit" disabled={busy}>
        {busy ? 'Sending…' : 'Request a quote'}
      </button>
    </form>
  );
}

export default function AssistantWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const onMenu = /^\/menu(\/|$)/.test(routeLocation.pathname);
  const rootRef = useRef(null);
  const { items: cartItems, addItem, removeItem, updateQty, clearCart } = useCart();

  const [open, setOpen] = useState(false);
  // Restored synchronously so the panel never flashes empty before the effect runs.
  const restored = loadChat();
  const [messages, setMessages] = useState(restored ? restored.messages : []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [listening, setListening] = useState(false);
  const [chosenCode, setChosenCode] = useState(null);
  const bodyRef = useRef(null);
  // What was added on the previous turn, so "make that 3" knows its target.
  const lastItemsRef = useRef(restored ? restored.lastItems : []);
  const recognitionRef = useRef(null);
  // Latest send(), for the speech callback: it fires after the render that
  // started listening, and must not send with that render's stale state.
  const sendRef = useRef(null);
  const [pendingAsk, setPendingAsk] = useState(null);

  // The greeting bubble stays off the Menu: there it covered the category strip
  // and the search box, and anyone on the Menu has already found the food. The
  // launcher still shows, raised clear of the page's bottom bars (lift effect
  // below). Keyed on the route because the widget stays mounted between Home and
  // Menu -- a bubble armed on Home must not pop up after arriving on the Menu,
  // and one never shown there must still be able to appear back on Home.
  useEffect(() => {
    if (onMenu) { setTeaser(false); return undefined; }
    if (!teaserAllowed()) return undefined;
    let hideTimer;
    const showTimer = setTimeout(() => {
      try { sessionStorage.setItem(TEASER_SEEN_KEY, '1'); } catch { /* ignore */ }
      setTeaser(true);
      hideTimer = setTimeout(() => setTeaser(false), TEASER_VISIBLE_MS);
    }, TEASER_DELAY_MS);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [onMenu]);

  // Pages mark their fixed bottom bars with data-bottom-bar and the widget rises
  // clear of them. On the Menu the launcher otherwise sat on the cart strip: the
  // browser reported the widget as the topmost element across the entire View
  // Cart button, on phone and on desktop. Measured, not hardcoded, because the
  // cart strip mounts and unmounts as the cart fills and empties, and the
  // category strip only exists below 900px. A childList observer catches bars
  // appearing; resize catches breakpoints. Only bars in the lower half of the
  // screen count, so a stray marker near the top can't fling the widget upward.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      let lift = 0;
      document.querySelectorAll('[data-bottom-bar]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.height < 1 || r.top < vh / 2 || r.top >= vh) return;
        lift = Math.max(lift, Math.ceil(vh - r.top));
      });
      root.style.setProperty('--asw-lift', `${lift}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [routeLocation.pathname]);

  const openChat = () => {
    setTeaser(false);
    markAssistantUsed();
    setOpen(true);
  };

  // A chip on the greeting bubble opens the chat AND asks its question. The
  // question is queued rather than sent inline: the greeting message is added
  // by an effect once `open` flips, so sending immediately would race it and
  // the user's question could be wiped by that first setMessages.
  const askFromTeaser = (text) => { setPendingAsk(text); openChat(); };

  // Hidden for this visit only; it's already marked as seen for the session.
  const dismissTeaser = () => setTeaser(false);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: t('assistant.greeting'), items: [], actions: [] }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire a question queued by a greeting-bubble chip, but only once the
  // greeting above has actually been added — otherwise that setMessages would
  // land second and wipe the question out.
  useEffect(() => {
    if (!open || !pendingAsk || messages.length === 0 || sending) return;
    const q = pendingAsk;
    setPendingAsk(null);
    sendRef.current?.(q);
  }, [open, pendingAsk, messages.length, sending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist after every exchange so the conversation survives navigating
  // between the pages the widget now appears on.
  useEffect(() => { saveChat(messages, lastItemsRef.current); }, [messages]);

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

  // One tap on a deal: checkout applies it automatically (and validates it
  // like a typed code). Also copied, for anyone who'd rather paste it.
  // Checkout takes one code, so tapping another replaces the first.
  const pickDeal = (code) => {
    setPendingCoupon(code);
    setChosenCode(code);
    navigator.clipboard?.writeText(code).catch(() => {});
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
        details: res.details || [], meal: res.meal || null, contact: res.contact || null, form: res.form || null,
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
    // Mark it added wherever it's shown -- product cards, dish cards, and the
    // "customers usually add" chips (which previously never showed their ✓).
    const shows = (m) => [m.items, m.details, m.suggestions].some(list => list?.some(i => i.id === item.id));
    setMessages(prev => prev.map(m =>
      shows(m) ? { ...m, addedIds: [...(m.addedIds || []), item.id] } : m
    ));
  };

  const addMeal = (msgIdx, meal) => {
    meal.lines.forEach(l => addItem({
      id: l.id,
      name: l.name,
      price: parseFloat(l.price || 0),
      img: l.image_url || getFallbackImg(l.id),
      tag: 'Assistant',
      note: '',
      qty: l.qty,
    }));
    setMessages(prev => prev.map((m, i) => (i === msgIdx ? { ...m, mealAdded: true } : m)));
  };

  const handleConfirmClear = (msgIdx, confirmed) => {
    if (confirmed) clearCart();
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, confirmed: true } : m));
    if (confirmed) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Cleared your cart.', items: [], actions: [] }]);
    }
  };

  return (
    <div className="asw-root" ref={rootRef}>
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
                          className={`asw-offer-code ${chosenCode === o.code ? 'chosen' : ''}`}
                          onClick={() => pickDeal(o.code)}
                          aria-pressed={chosenCode === o.code}
                          aria-label={`${t('assistant.useDeal')} ${o.code}`}
                        >
                          {chosenCode === o.code ? `✓ ${t('assistant.dealChosen')}` : o.code}
                        </button>
                      </div>
                    ))}
                    <p className="asw-offer-hint">{t('assistant.dealHint')}</p>
                  </div>
                )}

                {m.details && m.details.length > 0 && (
                  <div className="asw-details">
                    {m.details.map(d => (
                      <div key={d.id} className="asw-detail">
                        <img
                          src={d.image_url || getFallbackImg(d.id)}
                          alt={d.name}
                          className="asw-detail-img"
                          loading="lazy"
                          onError={e => { e.target.src = getFallbackImg(d.id); }}
                        />
                        <div className="asw-detail-body">
                          <div className="asw-detail-head">
                            <p className="asw-detail-name">{d.name}</p>
                            <p className="asw-detail-price">${parseFloat(d.price || 0).toFixed(2)}</p>
                          </div>
                          <p className="asw-detail-desc">{d.description || t('assistant.noDescription')}</p>
                          <button
                            className={`asw-card-add ${m.addedIds?.includes(d.id) ? 'added' : ''}`}
                            onClick={() => handleAddCard(d)}
                          >
                            {m.addedIds?.includes(d.id) ? `✓ ${t('assistant.added')}` : t('assistant.addToCart')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {m.meal && (
                  <div className="asw-meal">
                    <ul className="asw-meal-lines">
                      {m.meal.lines.map(l => (
                        <li key={l.id}>
                          <span className="asw-meal-qty">{l.qty}×</span>
                          <span className="asw-meal-name">{l.name}</span>
                          <span className="asw-meal-price">${(parseFloat(l.price) * l.qty).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="asw-meal-total">
                      <span>{t('assistant.mealTotal')}</span>
                      <strong>${Number(m.meal.total).toFixed(2)}</strong>
                    </div>
                    <button
                      type="button"
                      className={`asw-meal-add ${m.mealAdded ? 'added' : ''}`}
                      onClick={() => addMeal(idx, m.meal)}
                      disabled={m.mealAdded}
                    >
                      {m.mealAdded ? `✓ ${t('assistant.mealAdded')}` : t('assistant.mealAddAll')}
                    </button>
                  </div>
                )}

                {m.contact && (
                  <div className="asw-contact">
                    {m.contact.phone && (
                      <a className="asw-contact-call" href={`tel:${m.contact.phone.replace(/[^\d+]/g, '')}`}>
                        <Phone size={15} /> {t('assistant.callUs')} {m.contact.phone}
                      </a>
                    )}
                    {m.contact.email && (
                      <a className="asw-contact-link" href={`mailto:${m.contact.email}`}>
                        <Mail size={13} /> {m.contact.email}
                      </a>
                    )}
                    {m.contact.locations?.length > 0 && (
                      <ul className="asw-contact-locs">
                        {m.contact.locations.map(l => (
                          <li key={l.title}>
                            <strong>{l.title}</strong>
                            <span>{l.address}</span>
                            {l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}>{l.phone}</a>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {m.form?.type === 'catering' && <CateringForm prefill={m.form} />}

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
            <span className="asw-teaser-hi">{t(teaserHiKey())}</span>
            <span className="asw-teaser-text">{t('assistant.teaserText')}</span>
          </button>
          {/* Separate buttons, not nested inside the one above — a button
              inside a button is invalid and the inner one stops being
              clickable in some browsers. */}
          <div className="asw-teaser-chips">
            {TEASER_CHIPS.map(c => (
              <button
                key={c.key}
                type="button"
                className="asw-teaser-chip"
                onClick={() => askFromTeaser(c.text)}
              >
                {t(`assistant.${c.key}`)}
              </button>
            ))}
          </div>
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
