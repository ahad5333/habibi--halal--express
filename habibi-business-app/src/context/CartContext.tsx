import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: number;
  name: string;
  unit_price: number;
  quantity: number;
  image_url?: string;
  category?: string;
}

interface CartContextType {
  items:    CartItem[];
  addItem:  (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  updateQty:(id: number, qty: number) => void;
  remove:   (id: number) => void;
  clear:    () => void;
  subtotal: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    }
  };

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));
  const clear  = () => setItems([]);

  const subtotal   = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, remove, clear, subtotal, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
