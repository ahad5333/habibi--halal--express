import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';
import { ordersAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import './Reorder.css';

// Landing page for the SMS "text ORDER" reorder link (contactController.js's
// handleInboundSms). Reuses the exact same public order-lookup call
// OrderTracking.jsx already makes and the exact same items->cart mapping
// Account.jsx's own Reorder button already uses -- this page is just a new
// entry point into both, not a new mechanism.
export default function Reorder() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  const navigate = useNavigate();
  const { items: cartItems, addItem, clearCart } = useCart();
  const [status, setStatus] = useState('loading'); // loading | confirm | error
  const [pendingOrder, setPendingOrder] = useState(null);

  const applyOrder = (order) => {
    (order.items || []).forEach(item =>
      addItem({
        id: item.id || item.menuItemId || item.menu_item_id,
        name: item.name,
        price: parseFloat(item.price || item.unit_price) || 0,
        qty: item.qty || item.quantity || 1,
        img: item.img || null,
        tag: item.tag || '',
      })
    );
    navigate('/checkout');
  };

  useEffect(() => {
    if (!orderNumber) { setStatus('error'); return; }
    ordersAPI.track(orderNumber)
      .then(order => {
        if (!order || !Array.isArray(order.items) || !order.items.length) {
          setStatus('error');
          return;
        }
        if (cartItems.length > 0) {
          setPendingOrder(order);
          setStatus('confirm');
        } else {
          applyOrder(order);
        }
      })
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  const confirmReplace = () => {
    clearCart();
    applyOrder(pendingOrder);
  };

  return (
    <div className="reorder-page">
      {status === 'loading' && (
        <div className="reorder-box">
          <Loader2 className="reorder-spinner" size={32} />
          <p>Adding your last order to your cart…</p>
        </div>
      )}
      {status === 'confirm' && (
        <div className="reorder-box">
          <p>Your cart already has items in it — replace it with your last order?</p>
          <div className="reorder-actions">
            <button className="btn btn-outline" onClick={() => navigate('/checkout')}>Keep my cart</button>
            <button className="btn btn-primary" onClick={confirmReplace}>Replace with last order</button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="reorder-box">
          <XCircle size={32} color="#f87171" />
          <p>We couldn't find that order. Head to the menu to place a new one.</p>
          <Link to="/menu" className="btn btn-primary">Browse Menu</Link>
        </div>
      )}
    </div>
  );
}
