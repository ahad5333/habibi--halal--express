import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { trackAddToCart } from '../utils/analytics';

const CartContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

async function serverSync(items) {
  try {
    await fetch(`${API_BASE}/api/cart/sync`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
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

  // On mount: try to pull server cart — uses httpOnly cookie, 401 if not logged in is handled gracefully
  useEffect(() => {
    fetch(`${API_BASE}/api/cart`, {
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const local = (() => {
          try { return JSON.parse(localStorage.getItem('habibi_cart') || '[]'); } catch (_) { return []; }
        })();
        if (!data || !data.items || data.items.length === 0) {
          // Server cart is empty — keep local (guest) items as-is
          return;
        }
        // Merge: local items are the base; server quantity wins on overlap; server-only items appended
        const merged = [...local];
        for (const si of data.items) {
          const idx = merged.findIndex(l => l.id === si.menu_id);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], qty: si.quantity };
          } else {
            merged.push({ id: si.menu_id, name: si.name, price: parseFloat(si.price), qty: si.quantity, img: null, tag: '', note: '' });
          }
        }
        setItems(merged);
        localStorage.setItem('habibi_cart', JSON.stringify(merged));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync to server after every items change (outside state updater — safe for React Strict Mode)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; } // skip initial mount
    scheduleSyncToServer(items);
  }, [items, scheduleSyncToServer]);

  const persist = (newItems) => {
    setItems(newItems);
    localStorage.setItem('habibi_cart', JSON.stringify(newItems));
  };

  const addItem = useCallback((item) => {
    trackAddToCart(item);
    setItems(prev => {
      // cartKey distinguishes same item with different choices; falls back to id for simple items
      const key = item.cartKey ?? item.id;
      const existing = prev.find(i => (i.cartKey ?? i.id) === key);
      const updated = existing
        ? prev.map(i => (i.cartKey ?? i.id) === key ? { ...i, qty: i.qty + (item.qty || 1) } : i)
        : [...prev, { ...item, qty: item.qty || 1 }];
      localStorage.setItem('habibi_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = (key) => {
    const updated = items.filter(i => (i.cartKey ?? i.id) !== key);
    persist(updated);
  };

  const removeAddon = useCallback((key, addonIdx) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if ((item.cartKey ?? item.id) !== key) return item;
        const addons = [...(item.addons || [])];
        const [removed] = addons.splice(addonIdx, 1);
        const reduction = removed ? (parseFloat(removed.price) || 0) * (removed.qty || 1) : 0;
        return { ...item, addons, price: Math.max(0, item.price - reduction) };
      });
      localStorage.setItem('habibi_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQty = (key, qty) => {
    if (qty < 1) { removeItem(key); return; }
    const updated = items.map(i => (i.cartKey ?? i.id) === key ? { ...i, qty } : i);
    persist(updated);
  };

  const clearCart = () => {
    persist([]);
  };

  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, removeAddon, updateQty, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
