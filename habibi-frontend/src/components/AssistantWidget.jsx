import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { assistantAPI } from '../services/api';
import './AssistantWidget.css';

const getFallbackImg = (id) => `/images/menu/${((id || 1) % 70) + 1}.jpg`;

const QUICK_REPLIES = [
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
  const bodyRef = useRef(null);
  // What was added on the previous turn, so "make that 3" knows its target.
  const lastItemsRef = useRef([]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: t('assistant.greeting'), items: [], actions: [] }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

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

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setSending(true);
    try {
      // History lets the assistant resolve follow-ups ("make that 3"), and
      // lastItems tells it which items such a follow-up refers to.
      const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
      const res = await assistantAPI.chat(message, cartSnapshot(), history, lastItemsRef.current);
      const actions = res.actions || [];
      actions.filter(a => a.type !== 'confirm_clear_cart').forEach(runAction);
      // Items already added via an action shouldn't offer a second "Add" —
      // that would silently double the quantity if tapped.
      const addedIds = actions.filter(a => a.type === 'add_to_cart').map(a => a.item.id);
      const justAdded = actions.filter(a => a.type === 'add_to_cart').map(a => a.item);
      if (justAdded.length) lastItemsRef.current = justAdded;
      setMessages(prev => [...prev, {
        role: 'bot', text: res.text, items: res.items || [],
        suggestions: res.suggestions || [], actions, addedIds,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't process that — please try again.", items: [], actions: [] }]);
    } finally {
      setSending(false);
    }
  };

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
            <span className="asw-header-title">{t('assistant.title')}</span>
            <button className="asw-close" onClick={() => setOpen(false)} aria-label={t('assistant.close')}>
              <X size={18} />
            </button>
          </div>

          <div className="asw-body" ref={bodyRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`asw-msg asw-msg-${m.role}`}>
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
              placeholder={t('assistant.placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className="asw-send" aria-label={t('assistant.send')} disabled={sending || !input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button className="asw-fab" onClick={() => setOpen(true)} aria-label={t('assistant.open')}>
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
