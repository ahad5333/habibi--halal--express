import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { menuAPI, groupOrderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import MenuItemModal from '../components/MenuItemModal';
import SEO from '../components/SEO';
import './GroupOrder.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getOrCreateParticipantId(sessionId) {
  const key = `grp_pid_${sessionId}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ─── Landing ──────────────────────────────────────────────────────────────────
function GroupLanding({ prefillCode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState(prefillCode || '');
  const [guestName, setGuestName] = useState(user?.name || '');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState('');

  const handleCreate = async () => {
    if (!user) { navigate('/login?redirect=/group-order'); return; }
    setCreating(true); setErr('');
    try {
      const res = await groupOrderAPI.create(user.name || 'Host');
      const pid = getOrCreateParticipantId(res.session_id);
      await groupOrderAPI.registerParticipant(res.session_id, pid, user.name || 'Host');
      navigate(`/group-order/${res.session_id}`);
    } catch (e) {
      setErr(e.message || 'Failed to create session.');
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { setErr('Enter the 6-character code.'); return; }
    if (!guestName.trim()) { setErr('Enter your name.'); return; }
    setJoining(true); setErr('');
    try {
      const pid = crypto.randomUUID();
      const res = await groupOrderAPI.join(joinCode.trim().toUpperCase(), pid, guestName.trim());
      sessionStorage.setItem(`grp_pid_${res.session_id}`, pid);
      navigate(`/group-order/${res.session_id}`);
    } catch (e) {
      setErr(e.message || 'Invalid or expired code.');
      setJoining(false);
    }
  };

  return (
    <div className="go-landing">
      <SEO
        title="Group Order | Habibi Halal Express"
        description="Start or join a group order at Habibi Halal Express. Everyone picks their own items, one checkout."
        keywords="halal group order bronx, share food order, habibi group"
      />
      <div className="go-hero">
        <div className="go-hero-icon">👥</div>
        <h1 className="go-hero-title">Group Order</h1>
        <p className="go-hero-sub">Everyone picks their own, one checkout, one delivery.</p>
      </div>

      <div className="go-landing-grid">
        <div className="go-card">
          <div className="go-card-icon">🚀</div>
          <h2>Start a Group Order</h2>
          <p>Create a session and share the code with your friends. You control when to checkout.</p>
          <button className="go-btn go-btn-gold" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Start Group Order'}
          </button>
          {!user && <p className="go-note">Requires an account — <Link to="/login?redirect=/group-order">Log in</Link></p>}
        </div>

        <div className="go-divider-wrap"><div className="go-divider">OR</div></div>

        <div className="go-card">
          <div className="go-card-icon">🔗</div>
          <h2>Join a Group Order</h2>
          <p>Got a 6-character code from a friend? Enter it below to add your items.</p>
          <input
            className="go-input go-code-input"
            placeholder="Code (e.g. A3F9C2)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <input
            className="go-input"
            placeholder="Your name"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            maxLength={50}
          />
          <button className="go-btn go-btn-gold" onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining…' : 'Join Group Order'}
          </button>
        </div>
      </div>

      {err && <p className="go-err">{err}</p>}
    </div>
  );
}

// ─── Item Picker ──────────────────────────────────────────────────────────────
// Reuses the same MenuItemModal as the main Menu page so group-order participants get the
// full protein/sauce/extras customization every item normally has, instead of a bare quantity
// stepper. Each "Add" click can produce multiple lines (e.g. a "Make it a Meal!" side becomes
// its own line) — onAddOverride hands us the whole batch instead of writing to the shopping cart.
function ItemPicker({ myItems, onUpdate, syncing }) {
  const [menu, setMenu] = useState([]);
  const [search, setSearch] = useState('');
  const [menuLoading, setMenuLoading] = useState(true);
  const [modalItemId, setModalItemId] = useState(null);
  const [localItems, setLocalItems] = useState(
    () => (myItems || []).map(i => ({ ...i, uid: i.uid || `srv-${i.id}` }))
  );

  useEffect(() => {
    menuAPI.getAll()
      .then(items => { setMenu(items); setMenuLoading(false); })
      .catch(() => setMenuLoading(false));
  }, []);

  const filtered = search
    ? menu.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : menu;

  const handleModalAdd = (lines) => {
    const converted = lines.map(li => ({
      uid: crypto.randomUUID(),
      menu_item_id: li.id,
      name: li.name,
      price: parseFloat(li.price) || 0,
      qty: li.qty || 1,
      note: [
        ...(li.choiceLabels || []),
        ...(li.addons || []).map(a => `${a.qty > 1 ? a.qty + 'x ' : ''}${a.name}`),
        li.note,
      ].filter(Boolean).join(' · '),
      details: { addons: li.addons || [], choiceLabels: li.choiceLabels || [], userNote: li.note || '', img: li.img, tag: li.tag },
    }));
    const next = [...localItems, ...converted];
    setLocalItems(next);
    onUpdate(next);
  };

  const removeLine = (uid) => {
    const next = localItems.filter(i => i.uid !== uid);
    setLocalItems(next);
    onUpdate(next);
  };

  if (menuLoading) return <div className="go-picker-loading">Loading menu…</div>;

  return (
    <div className="go-picker">
      <div className="go-picker-top">
        <input
          className="go-input go-search"
          placeholder="Search menu…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {syncing && <span className="go-syncing">Saving…</span>}
      </div>

      {localItems.length > 0 && (
        <div className="go-picker-mine">
          <h4 className="go-picker-mine-title">Your items</h4>
          {localItems.map(li => (
            <div key={li.uid} className="go-picker-mine-row">
              <div className="go-picker-mine-info">
                <span className="go-picker-mine-name">{li.qty}× {li.name}</span>
                {li.note && <span className="go-picker-mine-note">{li.note}</span>}
              </div>
              <div className="go-picker-mine-right">
                <span className="go-picker-mine-price">${(li.price * li.qty).toFixed(2)}</span>
                <button className="go-picker-mine-remove" onClick={() => removeLine(li.uid)} aria-label="Remove item">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="go-picker-list">
        {filtered.map(item => (
          <div key={item.id} className="go-picker-row">
            <div className="go-picker-info">
              <span className="go-picker-name">{item.name}</span>
              <span className="go-picker-price">${parseFloat(item.price).toFixed(2)}</span>
            </div>
            <button className="go-add-btn" onClick={() => setModalItemId(item.id)}>+ Add</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="go-picker-empty">No items match "{search}"</p>}
      </div>

      {modalItemId && (
        <MenuItemModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
          onAddOverride={handleModalAdd}
          addLabel="Add to Group Order"
        />
      )}
    </div>
  );
}

// ─── Session ──────────────────────────────────────────────────────────────────
function GroupSession({ sessionId }) {
  const { user } = useAuth();
  const { addItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const socketRef = useRef(null);
  // Suppresses the "host closed this session" message on the host's own screen —
  // their socket is in the same room they just closed, so the broadcast echoes back to them too.
  const justClosedRef = useRef(false);

  const participantId = getOrCreateParticipantId(sessionId);

  const me = session?.participants?.find(p => p.participant_id === participantId);
  const isHost = me?.is_host === true;

  const load = useCallback(async () => {
    try {
      const data = await groupOrderAPI.getSession(sessionId);
      setSession(data);
    } catch (e) {
      setErr(e.message || 'Session not found or expired.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_group', sessionId);
    socket.on('group_update', data => setSession(data));
    socket.on('group_closed', () => { if (!justClosedRef.current) setErr('The host has closed this group order.'); });
    return () => socket.disconnect();
  }, [sessionId, load]);

  const handleCopy = () => {
    const url = `${window.location.origin}/group-order?join=${session.join_code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleItemsUpdate = async (items) => {
    setSyncing(true);
    try {
      const data = await groupOrderAPI.syncItems(sessionId, participantId, items);
      setSession(data);
    } catch (_) {
      // socket will reconcile
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckout = async () => {
    if (!isHost) return;
    const allItems = session?.items || [];
    if (allItems.length === 0) { setErr('No items in the group order yet.'); return; }
    setCheckingOut(true); setErr('');
    try {
      // Build the real cart locally first (synchronous, can't partially fail) — closing the
      // session is the only network call, and it happens last so a failure here never leaves
      // the group order closed with an empty/broken cart.
      clearCart();
      allItems.forEach(item => {
        if (!item.menu_item_id) return;
        const participant = (session?.participants || []).find(p => p.participant_id === item.participant_id);
        const forWhom = participant?.name || '';
        addItem({
          id:            item.menu_item_id,
          cartKey:       `grp-${item.participant_id}-${item.id}`,
          name:          item.name,
          price:         parseFloat(item.price) || 0,
          baseItemPrice: parseFloat(item.price) || 0,
          addons:        item.details?.addons || [],
          img:           item.details?.img,
          tag:           item.details?.tag || 'Item',
          note:          forWhom ? `For ${forWhom}${item.details?.userNote ? ': ' + item.details.userNote : ''}` : (item.details?.userNote || ''),
          choiceLabels:  item.details?.choiceLabels || [],
          qty:           item.qty,
          selectedChoices: {},
          selectedAddons:  {},
        });
      });

      justClosedRef.current = true;
      await groupOrderAPI.closeSession(sessionId);
      navigate('/checkout');
    } catch (e) {
      setErr(e.message || 'Checkout failed. Please try again.');
      setCheckingOut(false);
    }
  };

  const myItems = session?.items?.filter(i => i.participant_id === participantId) || [];

  const byParticipant = (session?.participants || []).map(p => ({
    ...p,
    items: (session?.items || []).filter(i => i.participant_id === p.participant_id),
    subtotal: (session?.items || [])
      .filter(i => i.participant_id === p.participant_id)
      .reduce((s, i) => s + parseFloat(i.price) * i.qty, 0),
  }));

  const grandTotal = (session?.items || []).reduce((s, i) => s + parseFloat(i.price) * i.qty, 0);
  const totalItems = session?.items?.length || 0;

  const expiresIn = session
    ? Math.max(0, Math.floor((new Date(session.expires_at) - Date.now()) / 60000))
    : 0;

  if (loading) {
    return (
      <div className="go-loading">
        <div className="go-spinner" />
      </div>
    );
  }

  if (err && !session) {
    return (
      <div className="go-error">
        <p className="go-err">{err}</p>
        <Link to="/group-order" className="go-btn go-btn-gold">Back to Group Orders</Link>
      </div>
    );
  }

  return (
    <div className="go-session">
      <div className="go-session-hdr">
        <div>
          <h1 className="go-session-title">Group Order</h1>
          <span className={`go-status-badge ${session?.status === 'open' ? 'open' : 'closed'}`}>
            {session?.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="go-expiry">
          <span className="go-expiry-icon">⏱</span>
          {expiresIn > 0 ? `Expires in ${expiresIn}m` : 'Expired'}
        </div>
      </div>

      {/* Join code */}
      <div className="go-code-card">
        <div className="go-code-label">Share this code with your group</div>
        <div className="go-code-display">{session?.join_code}</div>
        <button className="go-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Link copied!' : '📋 Copy invite link'}
        </button>
      </div>

      {/* Participants */}
      <div className="go-participants">
        <h2 className="go-section-title">
          Participants ({byParticipant.length})
        </h2>
        {byParticipant.map(p => (
          <div
            key={p.participant_id}
            className={`go-participant${p.participant_id === participantId ? ' go-me' : ''}`}
          >
            <div className="go-participant-hdr">
              <span className="go-participant-name">
                {p.name}
                {p.is_host && <span className="go-badge go-badge-host">Host</span>}
                {p.participant_id === participantId && <span className="go-badge go-badge-you">You</span>}
              </span>
              <span className="go-participant-sub">
                {p.items.length > 0
                  ? `${p.items.length} item${p.items.length !== 1 ? 's' : ''} · $${p.subtotal.toFixed(2)}`
                  : 'No items yet'}
              </span>
            </div>
            {p.items.length > 0 && (
              <ul className="go-items-list">
                {p.items.map((item, i) => (
                  <li key={i}>
                    <div className="go-item-row">
                      <span className="go-item-name">{item.name}</span>
                      <span className="go-item-qty">×{item.qty}</span>
                      <span className="go-item-price">${(parseFloat(item.price) * item.qty).toFixed(2)}</span>
                    </div>
                    {item.note && <div className="go-item-note">{item.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="go-total-bar">
        <span>Group Total</span>
        <span className="go-total-amount">${grandTotal.toFixed(2)}</span>
      </div>

      {/* Actions */}
      {session?.status === 'open' && (
        <div className="go-actions">
          <button
            className={`go-btn ${showPicker ? 'go-btn-outline' : 'go-btn-ghost'}`}
            onClick={() => setShowPicker(v => !v)}
          >
            {showPicker ? '✕ Close menu' : myItems.length > 0 ? '✏️ Edit my items' : '+ Add my items'}
          </button>
          {isHost && (
            <button
              className="go-btn go-btn-gold"
              onClick={handleCheckout}
              disabled={checkingOut || totalItems === 0}
            >
              {checkingOut ? 'Processing…' : `Checkout (${totalItems} item${totalItems !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      )}

      {/* Item picker */}
      {showPicker && session?.status === 'open' && (
        <div className="go-picker-wrap">
          <h3 className="go-picker-title">
            {myItems.length > 0 ? 'Edit Your Items' : 'Add Your Items'}
          </h3>
          <ItemPicker myItems={myItems} onUpdate={handleItemsUpdate} syncing={syncing} />
        </div>
      )}

      {err && <p className="go-err go-err-session">{err}</p>}

      {!isHost && session?.status === 'open' && (
        <p className="go-host-note">
          Waiting for the host to place the order. Add your items above when you're ready.
        </p>
      )}
    </div>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────
export default function GroupOrder() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get('join') || '';

  if (sessionId) return <GroupSession sessionId={sessionId} />;
  return <GroupLanding prefillCode={joinCode} />;
}
