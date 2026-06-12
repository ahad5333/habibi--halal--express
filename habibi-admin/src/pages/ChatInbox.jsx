import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, RefreshCw, Search, Circle } from 'lucide-react';
import { io } from 'socket.io-client';
import { chatAPI } from '../services/api';
import './ChatInbox.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ChatInbox() {
  const [conversations, setConversations] = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [reply,         setReply]         = useState('');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const bottomRef   = useRef(null);
  const socketRef   = useRef(null);
  const inputRef    = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatAPI.getConversations();
      setConversations(data);
    } catch (_) {}
    setLoading(false);
  }, []);

  const openConversation = useCallback(async (conv) => {
    setSelected(conv);
    setMessages([]);
    try {
      const data = await chatAPI.getMessages(conv.order_number);
      setMessages(data);
      setConversations(prev =>
        prev.map(c => c.order_number === conv.order_number ? { ...c, unread_count: 0 } : c)
      );
    } catch (_) {}
    inputRef.current?.focus();
  }, []);

  // Socket.IO — join order room to receive live messages
  useEffect(() => {
    const token = localStorage.getItem('habibi_admin_token');
    const socket = io(BASE, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('receive_message', (msg) => {
      // Update messages if this order is open
      setSelected(prev => {
        if (prev && prev.order_number === msg.order_id) {
          setMessages(m => [...m, msg]);
        }
        return prev;
      });
      // Bump unread count in conversations list
      setConversations(prev =>
        prev.map(c => {
          if (c.order_number !== msg.order_id) return c;
          const isOpen = selected?.order_number === msg.order_id;
          return {
            ...c,
            last_message: msg.text,
            last_sender: msg.sender,
            last_message_at: msg.timestamp || new Date().toISOString(),
            unread_count: (msg.sender === 'customer' && !isOpen) ? (c.unread_count || 0) + 1 : c.unread_count,
          };
        })
      );
    });

    return () => socket.disconnect();
  }, []);

  // Join the selected order's room
  useEffect(() => {
    if (selected && socketRef.current) {
      socketRef.current.emit('join_order', selected.order_number);
    }
  }, [selected]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const sendMessage = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      await chatAPI.sendMessage(selected.order_number, reply.trim());
      setReply('');
    } catch (_) {}
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const filtered = conversations.filter(c =>
    !search ||
    (c.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.order_number  || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div className="chat-shell">
      {/* ── Conversation list ── */}
      <div className="chat-list">
        <div className="chat-list-header">
          <div className="chat-list-title">
            <MessageSquare size={18} />
            <span>Customer Chat</span>
            {totalUnread > 0 && <span className="chat-unread-badge">{totalUnread}</span>}
          </div>
          <button className="chat-refresh" onClick={loadConversations} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="chat-search-wrap">
          <Search size={14} className="chat-search-icon" />
          <input
            className="chat-search"
            placeholder="Search customer or order…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-conv-list">
          {loading && <p className="chat-empty">Loading…</p>}
          {!loading && filtered.length === 0 && <p className="chat-empty">No conversations yet.</p>}
          {filtered.map(conv => (
            <button
              key={conv.order_number}
              className={`chat-conv-item ${selected?.order_number === conv.order_number ? 'active' : ''}`}
              onClick={() => openConversation(conv)}
            >
              <div className="chat-conv-top">
                <span className="chat-conv-name">{conv.customer_name || 'Guest'}</span>
                <span className="chat-conv-time">{timeAgo(conv.last_message_at)}</span>
              </div>
              <div className="chat-conv-bottom">
                <span className="chat-conv-preview">
                  {conv.last_sender === 'admin' ? '↳ You: ' : ''}{conv.last_message || '—'}
                </span>
                {conv.unread_count > 0 && (
                  <span className="chat-unread-dot">{conv.unread_count}</span>
                )}
              </div>
              <span className="chat-conv-order">{conv.order_number}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Message thread ── */}
      <div className="chat-thread">
        {!selected ? (
          <div className="chat-empty-state">
            <MessageSquare size={40} />
            <p>Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="chat-thread-header">
              <div>
                <p className="chat-thread-name">{selected.customer_name || 'Guest'}</p>
                <p className="chat-thread-meta">{selected.order_number} · {selected.order_status}</p>
              </div>
              {selected.customer_phone && (
                <a className="chat-thread-phone" href={`tel:${selected.customer_phone}`}>
                  {selected.customer_phone}
                </a>
              )}
            </div>

            <div className="chat-messages">
              {messages.length === 0 && <p className="chat-no-msgs">No messages yet.</p>}
              {messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  className={`chat-msg ${msg.sender === 'admin' ? 'chat-msg-admin' : 'chat-msg-customer'}`}
                >
                  <div className="chat-msg-bubble">{msg.text}</div>
                  <span className="chat-msg-time">
                    {msg.sender === 'admin' ? 'You' : (selected.customer_name || 'Customer')} · {timeAgo(msg.created_at || msg.timestamp)}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="chat-reply-bar">
              <textarea
                ref={inputRef}
                className="chat-reply-input"
                placeholder="Type a reply… (Enter to send)"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
              />
              <button
                className="chat-reply-send"
                onClick={sendMessage}
                disabled={!reply.trim() || sending}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
