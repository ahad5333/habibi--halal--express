import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { trackAddToCart } from '../utils/analytics';

const CartContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getToken() {
  return localStorage.getItem('habibi_token');
}

async function serverSync(items) {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/api/cart/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: items.map(i => ({ menu_id: i.id, quantity: i.qty })) }),
    });
  } catch (_) {}
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem('habibi_cart');
      return stored ? JSON.parse(stored) : [];
    } catch (_) { return []; }
  });

  const syncTimerRef = useRef(null);

  // Debounced server sync — fires 1 second after the last cart change
  const scheduleSyncToServer = useCallback((newItems) => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => serverSync(newItems), 1000);
  }, []);

  // On mount: if logged in, pull server cart and use it
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_BASE}/api/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.items || data.items.length === 0) return;
        // Server returns { id (cart_item_id), menu_id, quantity, name, price }
        // Map to frontend shape; keep img/tag from localStorage match if available
        const local = (() => {
          try { return JSON.parse(localStorage.getItem('habibi_cart') || '[]'); } catch (_) { return []; }
        })();
        const merged = data.items.map(si => {
          const local_match = local.find(l => l.id === si.menu_id);
          return {
            id: si.menu_id,
            name: si.name,
            price: parseFloat(si.price),
            qty: si.quantity,
            img: local_match?.img || null,
            tag: local_match?.tag || '',
            note: local_match?.note || '',
          };
        });
        setItems(merged);
        localStorage.setItem('habibi_cart', JSON.stringify(merged));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (newItems) => {
    setItems(newItems);
    localStorage.setItem('habibi_cart', JSON.stringify(newItems));
    scheduleSyncToServer(newItems);
  };

  const addItem = (item) => {
    trackAddToCart(item);
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      const updated = existing
        ? prev.map(i => i.id === item.id ? { ...i, qty: i.qty + (item.qty || 1) } : i)
        : [...prev, { ...item, qty: item.qty || 1 }];
      localStorage.setItem('habibi_cart', JSON.stringify(updated));
      scheduleSyncToServer(updated);
      return updated;
    });
  };

  const removeItem = (id) => {
    const updated = items.filter(i => i.id !== id);
    persist(updated);
  };

  const updateQty = (id, qty) => {
    if (qty < 1) { removeItem(id); return; }
    const updated = items.map(i => i.id === id ? { ...i, qty } : i);
    persist(updated);
  };

  const clearCart = () => {
    persist([]);
  };

  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
