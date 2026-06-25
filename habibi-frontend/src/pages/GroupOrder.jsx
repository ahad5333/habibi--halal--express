import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { menuAPI, cartAPI, groupOrderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
      <div className="go-hero">
        <div className="go-hero-icon">👥</div>
        <h1 className="go-hero-title">Group Order</h1>
        <p className="go-hero-sub">Everyone picks their own — one checkout, one delivery.</p>
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
function ItemPicker({ myItems, onUpdate, syncing }) {
  const [menu, setMenu] = useState([]);
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState({});
  const [menuLoading, setMenuLoading] = useState(true);

  useEffect(() => {
    menuAPI.getAll()
      .then(items => { setMenu(items); setMenuLoading(false); })
      .catch(() => setMenuLoading(false));
    // Seed quantities from existing items
    const init = {};
    (myItems || []).forEach(item => {
      if (item.menu_item_id) init[String(item.menu_item_id)] = item.qty;
    });
    setQuantities(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = search
    ? menu.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : menu;

  const setQty = (item, qty) => {
    const next = { ...quantities };
    if (qty <= 0) {
      delete next[String(item.id)];
    } else {
      next[String(item.id)] = qty;
    }
    setQuantities(next);
    const items = Object.entries(next).map(([id, q]) => {
      const m = menu.find(x => x.id === parseInt(id));
      return { menu_item_id: parseInt(id), name: m?.name || '', price: parseFloat(m?.price) || 0, qty: q };
    });
    onUpdate(items);
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
      <div className="go-picker-list">
        {filtered.map(item => {
          const qty = quantities[String(item.id)] || 0;
          return (
            <div key={item.id} className="go-picker-row">
              <div className="go-picker-info">
                <span className="go-picker-name">{item.name}</span>
                <span className="go-picker-price">${parseFloat(item.price).toFixed(2)}</span>
              </div>
              <div className="go-picker-ctrl">
                {qty > 0 ? (
                  <>
                    <button className="go-qty-btn" onClick={() => setQty(item, qty - 1)}>−</button>
                    <span className="go-qty-num">{qty}</span>
                    <button className="go-qty-btn" onClick={() => setQty(item, qty + 1)}>+</button>
                  </>
                ) : (
                  <button className="go-add-btn" onClick={() => setQty(item, 1)}>+ Add</button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="go-picker-empty">No items match "{search}"</p>}
      </div>
    </div>
  );
}

// ─── Session ──────────────────────────────────────────────────────────────────
function GroupSession({ sessionId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const socketRef = useRef(null);

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
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('join_group', sessionId);
    socket.on('group_update', data => setSession(data));
    socket.on('group_closed', () => setErr('The host has closed this group order.'));
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
      await groupOrderAPI.closeSession(sessionId);
      await cartAPI.clear();
      for (const item of allItems) {
        if (item.menu_item_id) {
          await cartAPI.add(item.menu_item_id, item.qty, {});
        }
      }
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
                  <li key={i} className="go-item-row">
                    <span className="go-item-name">{item.name}</span>
                    <span className="go-item-qty">×{item.qty}</span>
                    <span className="go-item-price">${(parseFloat(item.price) * item.qty).toFixed(2)}</span>
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
