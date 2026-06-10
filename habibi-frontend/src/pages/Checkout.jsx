import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, MapPin, CreditCard, ShoppingBag, Tag, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersAPI, couponsAPI, paymentsAPI, menuAPI, userAPI, locationsAPI } from '../services/api';
import { trackBeginCheckout } from '../utils/analytics';
import { useDineIn } from '../context/DineInContext';
import StripeCardForm from '../components/StripeCardForm';
import PayPalButton from '../components/PayPalButton';
import OfflinePayModal from '../components/OfflinePayModal';
import './Checkout.css';

const TIP_OPTIONS = ['None', '5%', '10%', '15%', '20%', 'Custom'];
const TIP_PCTS    = [0, 0.05, 0.1, 0.15, 0.2, 'custom'];

const ALT_PAYMENTS = [
  { id: 'apple',   label: 'Apple Pay',        img: '/images/partners/apple-pay.png' },
  { id: 'google',  label: 'Google Pay',       img: '/images/partners/google-pay.png' },
  { id: 'paypal',  label: 'PayPal',           img: '/images/partners/paypal.png' },
  { id: 'zelle',   label: 'Zelle',            emoji: '💙' },
  { id: 'cashapp', label: 'Cash App',         emoji: '💚' },
  { id: 'cash',    label: 'Cash on Delivery', emoji: '💵' },
];

// Methods that skip Stripe and go through an offline/modal flow
const OFFLINE_METHODS = new Set(['cash', 'zelle', 'cashapp']);
// Methods served by PayPal SDK
const PAYPAL_METHODS = new Set(['paypal']);
// Apple/Google Pay are served by Stripe Payment Request Button (inside StripeCardForm)
const DIGITAL_WALLET_METHODS = new Set(['apple', 'google']);

const getFoodPhoto = (itemId) => {
  const n = ((itemId || 1) % 70) + 1;
  return `/images/menu/${n}.jpg`;
};

const Checkout = () => {
  const [deliveryMode, setDeliveryMode]   = useState('delivery');
  const [timing, setTiming]               = useState('asap');
  const [scheduleDate, setScheduleDate]   = useState('today');
  const [scheduleTime, setScheduleTime]   = useState('19:30');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [tipIndex, setTipIndex]           = useState(2);
  const [customTip, setCustomTip]         = useState('');
  const [address, setAddress]             = useState('');
  const [receiverName, setReceiverName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [driverNote, setDriverNote]       = useState('');
  const [couponCode, setCouponCode]         = useState('');
  const [couponApplied, setCouponApplied]   = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg]           = useState('');
  const [couponErr, setCouponErr]           = useState('');
  const [couponLoading, setCouponLoading]   = useState(false);
  const [placing, setPlacing]               = useState(false);
  const [orderError, setOrderError]         = useState('');
  const [clientSecret, setClientSecret]     = useState('');
  const [intentReady, setIntentReady]       = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [pendingOrderNum, setPendingOrderNum]   = useState('');
  const [deliveryFee, setDeliveryFee]           = useState(0);
  const [feeLoading, setFeeLoading]             = useState(false);
  const [feeMsg, setFeeMsg]                     = useState('');
  const [upsellItems, setUpsellItems]           = useState([]);
  const [loyaltyPoints, setLoyaltyPoints]       = useState(0);
  const [useRewards, setUseRewards]             = useState(false);
  const [locations, setLocations]               = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const feeTimerRef = useRef(null);
  const addressInputRef = useRef(null);

  const { items, addItem, updateQty, removeItem, clearCart, subtotal } = useCart();
  const { isLoggedIn, user } = useAuth();
  const { isDineIn, table: dineInTable } = useDineIn();
  const navigate = useNavigate();

  const TAX_RATE         = 0.08875;
  const SERVICE_FEE_RATE = 0.04273;
  const tax       = subtotal * TAX_RATE;
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const tip        = TIP_PCTS[tipIndex] === 'custom' ? (parseFloat(customTip) || 0) : subtotal * TIP_PCTS[tipIndex];

  // Loyalty: 100 pts = $1; only redeem in full-dollar increments
  const redeemablePts   = Math.floor(loyaltyPoints / 100) * 100; // e.g. 350 pts → 300 redeemable
  const loyaltyDiscount = useRewards && redeemablePts > 0 ? redeemablePts / 100 : 0;
  const total           = Math.max(0, subtotal + tax + serviceFee + deliveryFee + tip - couponDiscount - loyaltyDiscount);

  // Pre-fill contact details + loyalty points for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;
    userAPI.getProfile()
      .then(p => {
        setLoyaltyPoints(p.loyalty_points || 0);
        // Only pre-fill if the field is still blank (don't overwrite what the user typed)
        if (!receiverName   && (p.name  || user?.name))  setReceiverName(p.name  || user?.name  || '');
        if (!customerEmail && (p.email || user?.email)) setCustomerEmail(p.email || user?.email || '');
        if (!customerPhone && p.phone_number)           setCustomerPhone(p.phone_number);
      })
      .catch(() => {
        // Fallback to JWT payload if profile call fails
        if (!receiverName   && user?.name)  setReceiverName(user.name);
        if (!customerEmail && user?.email) setCustomerEmail(user.email);
      });
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch upsell items once on mount
  useEffect(() => {
    menuAPI.getAll()
      .then(data => {
        const all = Array.isArray(data) ? data : (data.menus || data.items || []);
        const addons = all.filter(i => {
          const cat = (i.category || '').toLowerCase();
          return cat.includes('drink') || cat.includes('extras') || cat.includes('extra');
        });
        setUpsellItems(addons.slice(0, 4));
      })
      .catch(() => {});
  }, []);
  // Fetch locations once on mount
  useEffect(() => {
    locationsAPI.getAll()
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setLocations(list);
        const stored = localStorage.getItem('habibi_service_location');
        const storedLoc = stored ? list.find(l => l.id === JSON.parse(stored).id) : null;
        const first = storedLoc || (list.length > 0 ? list[0] : null);
        if (first) { setSelectedLocation(first); localStorage.setItem('habibi_service_location', JSON.stringify({ id: first.id, title: first.title })); }
      })
      .catch(() => {});
  }, []);
  // Fetch delivery fee when address changes (debounced 800 ms)
  useEffect(() => {
    if (deliveryMode !== 'delivery' || !address.trim()) {
      setDeliveryFee(0);
      setFeeMsg('');
      return;
    }
    clearTimeout(feeTimerRef.current);
    feeTimerRef.current = setTimeout(async () => {
      setFeeLoading(true);
      setFeeMsg('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/dispatch/calculate-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_address: address }),
        });
        const data = await res.json();
        if (data.out_of_range) {
          setDeliveryFee(0);
          setFeeMsg('⚠ Address may be outside delivery range — fee calculated at checkout.');
        } else if (data.fee != null) {
          setDeliveryFee(parseFloat(data.fee));
          setFeeMsg(`📍 ${data.distance_text || ''} — delivery fee applied`);
        } else {
          setDeliveryFee(0);
          setFeeMsg('');
        }
      } catch (_) {
        setDeliveryFee(0);
      } finally {
        setFeeLoading(false);
      }
    }, 800);
    return () => clearTimeout(feeTimerRef.current);
  }, [address, deliveryMode]);

  // Google Maps Places Autocomplete (gracefully no-ops if key not configured)
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key || !addressInputRef.current || deliveryMode !== 'delivery') return;
    const scriptId = 'gm-places-script';
    const initAC = () => {
      if (!window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place?.formatted_address) setAddress(place.formatted_address);
      });
    };
    if (window.google?.maps?.places) {
      initAC();
    } else if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.onload = initAC;
      document.head.appendChild(script);
    }
  }, [deliveryMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coupon ────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponErr(''); setCouponMsg('');
    try {
      const res = await couponsAPI.validate(couponCode, subtotal, items);
      setCouponApplied(true);
      setCouponDiscount(res.discount || 0);
      setCouponMsg(res.message || 'Coupon applied!');
    } catch (err) {
      setCouponErr(err.message || 'Invalid coupon code.');
      setCouponApplied(false);
      setCouponDiscount(0);
    } finally {
      setCouponLoading(false);
    }
  };

  // ── Build order payload ────────────────────────────────────────────────────
  const buildPayload = (orderNumber) => ({
    order_number: orderNumber,
    customer_name:         receiverName || 'Guest',
    customer_phone:        customerPhone,
    customer_email:        customerEmail,
    delivery_method:       isDineIn ? 'dine_in' : deliveryMode,
    delivery_address:      isDineIn
      ? ''
      : deliveryMode === 'pickup'
      ? (selectedLocation ? `${selectedLocation.title} - ${selectedLocation.brief_address}` : 'Store Pickup')
      : address,
    delivery_city:         '',
    delivery_zip:          '',
    delivery_state:        'NY',
    delivery_instructions: driverNote,
    table_number:          isDineIn ? (dineInTable?.table_name || '') : undefined,
    payment_method:        paymentMethod,
    sub_total:    parseFloat(subtotal.toFixed(2)),
    tax:          parseFloat(tax.toFixed(2)),
    service_fee:  parseFloat(serviceFee.toFixed(2)),
    delivery_fee: isDineIn ? 0 : parseFloat(deliveryFee.toFixed(2)),
    tip:          parseFloat(tip.toFixed(2)),
    discount:     parseFloat((couponDiscount + loyaltyDiscount).toFixed(2)),
    total:        parseFloat(total.toFixed(2)),
    coupon_code:  couponApplied ? couponCode : null,
    loyalty_points_redeemed: useRewards ? redeemablePts : 0,
    expected_time: timing === 'asap'
      ? 'ASAP'
      : `${scheduleDate === 'today' ? 'Today' : 'Tomorrow'} at ${scheduleTime}`,
    items: items.map(i => ({
      menuItemId:      i.id,
      menu_item_id:    i.id,
      id:              i.id,
      name:            i.name,
      quantity:        i.qty,
      qty:             i.qty,
      unit_price:      i.price,
      price:           i.price,
      note:            i.note || '',
      selectedChoices: i.selectedChoices || {},
      selectedAddons:  i.selectedAddons  || {},
    })),
  });

  const finishOrder = async (orderNumber) => {
    // Snapshot cart before clearing so OrderConfirmation can fire the purchase event
    localStorage.setItem('last_order_track', JSON.stringify({ items, total }));
    clearCart();
    localStorage.setItem('last_order_number', orderNumber);
    const methodParam = isDineIn ? 'dine_in' : deliveryMode;
    const extraParam  = isDineIn
      ? `&table=${encodeURIComponent(dineInTable?.table_name || 'Your Table')}`
      : (address ? `&address=${encodeURIComponent(address)}` : '');
    navigate(`/order-confirmation?order=${orderNumber}&method=${methodParam}${extraParam}`);
  };

  // ── Card / Digital Wallet: prepare intent then show Stripe form ───────────
  const handlePrepareCardPayment = async () => {
    if (items.length === 0) return;
    trackBeginCheckout(items, total);
    setPlacing(true); setOrderError('');
    try {
      const orderNumber = `HAB-${Date.now()}`;
      setPendingOrderNum(orderNumber);
      const res = await paymentsAPI.createIntent(total, orderNumber, ['card']);
      setClientSecret(res.clientSecret || '');
      setIntentReady(true);
    } catch (err) {
      setOrderError(err.message || 'Failed to initiate payment.');
    } finally {
      setPlacing(false);
    }
  };

  // Called by StripeCardForm on success
  const handleStripeSuccess = async (paymentIntent) => {
    setPlacing(true); setOrderError('');
    try {
      await ordersAPI.createGuest(buildPayload(pendingOrderNum));
      await finishOrder(pendingOrderNum);
    } catch (err) {
      setOrderError(err.message || 'Order could not be saved. Contact support with: ' + (paymentIntent?.id || ''));
    } finally {
      setPlacing(false);
    }
  };

  const handleStripeError = (msg) => setOrderError(msg || 'Payment failed. Please try again.');

  // ── PayPal success ─────────────────────────────────────────────────────────
  const handlePayPalSuccess = async (details) => {
    setPlacing(true); setOrderError('');
    try {
      const orderNumber = `HAB-${Date.now()}`;
      await ordersAPI.createGuest(buildPayload(orderNumber));
      await finishOrder(orderNumber);
    } catch (err) {
      setOrderError(err.message || 'Order save failed after PayPal payment.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Offline / Cash / Zelle / CashApp ──────────────────────────────────────
  const handleOfflineClick = () => {
    if (items.length === 0) return;
    trackBeginCheckout(items, total);
    const orderNumber = `HAB-${Date.now()}`;
    setPendingOrderNum(orderNumber);
    setShowOfflineModal(true);
  };

  const handleOfflineConfirm = async () => {
    setShowOfflineModal(false);
    setPlacing(true); setOrderError('');
    try {
      await ordersAPI.createGuest(buildPayload(pendingOrderNum));
      await finishOrder(pendingOrderNum);
    } catch (err) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Main CTA logic ─────────────────────────────────────────────────────────
  const handlePlaceOrder = () => {
    if (OFFLINE_METHODS.has(paymentMethod)) { handleOfflineClick(); return; }
    // PayPal is rendered inline — "Place Order" shouldn't fire for it
    if (PAYPAL_METHODS.has(paymentMethod)) return;
    // card / apple / google
    if (!intentReady) { handlePrepareCardPayment(); return; }
    // intent already ready — Stripe form handles the rest
  };

  const showCardForm = (paymentMethod === 'card' || DIGITAL_WALLET_METHODS.has(paymentMethod)) && intentReady;
  const showPayPal   = PAYPAL_METHODS.has(paymentMethod);
  const showCTABtn   = !PAYPAL_METHODS.has(paymentMethod);

  const ctaLabel = () => {
    if (placing) return 'Please wait…';
    if (OFFLINE_METHODS.has(paymentMethod)) return 'PLACE YOUR ORDER';
    if (!intentReady) return 'CONTINUE TO PAYMENT';
    return null; // Stripe form has its own button
  };

  return (
    <div className="checkout-page">
      <div className="container checkout-container py-12">

        {/* Dine-in mode banner */}
        {isDineIn && (
          <div className="dine-in-banner">
            <span className="dine-in-banner-icon">🍽️</span>
            <div>
              <p className="dine-in-banner-title">Dine-In Order — {dineInTable?.table_name || 'Your Table'}</p>
              <p className="dine-in-banner-sub">Food will be brought to your table · No delivery fee</p>
            </div>
          </div>
        )}

        {/* Breadcrumbs */}
        <div className="checkout-breadcrumbs">
          <span className="crumb active">① Details</span>
          <span className="crumb-arrow">›</span>
          <span className={`crumb ${intentReady ? 'active' : ''}`}>② Payment</span>
          <span className="crumb-arrow">›</span>
          <span className="crumb">③ Confirmation</span>
        </div>

        <div className="checkout-layout">

          {/* ── Left ── */}
          <div className="checkout-main">

            {/* Cart Items */}
            <div className="checkout-section">
              <div className="flex justify-between items-center mb-6">
                <h2 className="checkout-section-title">Your Selection</h2>
                <span className="text-muted text-sm">{items.length} items</span>
              </div>
              {items.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingBag size={40} className="text-muted mb-4" />
                  <p className="text-muted">Your cart is empty.</p>
                  <Link to="/menu" className="btn btn-outline mt-4">Browse Menu</Link>
                </div>
              ) : (
                <div className="cart-items">
                  {items.map(item => (
                    <div key={item.id} className="cart-item">
                      <img src={item.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=200'} alt={item.name} className="cart-item-img" />
                      <div className="cart-item-info">
                        <h4 className="cart-item-name">{item.name}</h4>
                        <span className="cart-item-tag">{item.tag}</span>
                        {item.note && <p className="cart-item-modifiers">{item.note}</p>}
                      </div>
                      <div className="cart-item-controls">
                        <div className="qty-control">
                          <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                          <span>{item.qty}</span>
                          <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                        </div>
                        <span className="cart-item-price text-primary font-bold">${(item.price * item.qty).toFixed(2)}</span>
                        <button className="cart-delete-btn" onClick={() => removeItem(item.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upsell — "Add to your order" */}
            {upsellItems.length > 0 && items.length > 0 && (
              <div className="checkout-section">
                <h2 className="checkout-section-title mb-4" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add to Your Order</h2>
                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {upsellItems.filter(u => !items.find(i => i.id === u.id)).slice(0, 4).map(u => {
                    const imgSrc = u.image || u.image_url || getFoodPhoto(u.id);
                    return (
                      <div key={u.id} style={{ minWidth: 150, background: 'var(--color-surface-2, #f9fafb)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 10, padding: '0.75rem', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ width: '100%', height: 80, borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem', background: '#eaeaea' }}>
                            <img
                              src={imgSrc}
                              alt={u.name || u.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.src = getFoodPhoto(u.id + 7); }}
                            />
                          </div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main, #111827)', lineHeight: 1.3 }}>{u.name || u.title}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-gold, #b45309)', fontWeight: 700, marginBottom: '0.5rem' }}>${parseFloat(u.price || 0).toFixed(2)}</p>
                          <button
                            style={{ width: '100%', padding: '0.375rem', background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #d1d5db)', borderRadius: 6, color: 'var(--color-text-main, #374151)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            onClick={() => addItem({ id: u.id, name: u.name || u.title, price: parseFloat(u.price || 0), img: imgSrc, tag: u.category || 'Add-on', note: '', qty: 1 })}
                          >
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery Details */}
            <div className="checkout-section">
              <h2 className="checkout-section-title mb-6">{isDineIn ? 'Your Details' : 'Delivery Details'}</h2>

              {/* Auth gate — must be logged in to enter address / place order */}
              {!isLoggedIn && (
                <div className="checkout-auth-gate">
                  <div className="checkout-auth-gate-icon">🔐</div>
                  <h3 className="checkout-auth-gate-title">Sign in to continue</h3>
                  <p className="checkout-auth-gate-sub">
                    Create a free account or log in to place your order and track it in real time.
                  </p>
                  <div className="checkout-auth-gate-btns">
                    <Link to={`/login?redirect=/checkout`} className="btn btn-primary checkout-auth-btn">
                      Log In
                    </Link>
                    <Link to={`/signup?redirect=/checkout`} className="btn btn-outline checkout-auth-btn">
                      Sign Up Free
                    </Link>
                  </div>
                </div>
              )}

              {/* Show form only when logged in */}
              {isLoggedIn && (isDineIn ? (
                <div className="form-row two-col mb-6">
                  <div className="form-group">
                    <label className="form-label">YOUR NAME (for the kitchen)</label>
                    <input type="text" className="form-input" placeholder="e.g. Ahmed" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PHONE (optional)</label>
                    <input type="tel" className="form-input" placeholder="(718) 555-0100" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="delivery-toggle mb-6">
                    <button className={`delivery-tab ${deliveryMode === 'delivery' ? 'active' : ''}`} onClick={() => setDeliveryMode('delivery')}>Delivery</button>
                    <button className={`delivery-tab ${deliveryMode === 'pickup' ? 'active' : ''}`} onClick={() => setDeliveryMode('pickup')}>Pickup</button>
                  </div>
                  {deliveryMode === 'delivery' && (
                    <>
                      <div className="form-group mb-4">
                        <label className="form-label">DELIVERY ADDRESS</label>
                        {/* Pre-selected addresses quick-pick */}
                        {selectedLocation && Array.isArray(selectedLocation.delivery_addresses) && selectedLocation.delivery_addresses.length > 0 && (
                          <div className="preset-addr-list">
                            <p className="preset-addr-hint">Quick-select a nearby address:</p>
                            <div className="preset-addr-chips">
                              {selectedLocation.delivery_addresses.map((a, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className={`preset-addr-chip${address === a ? ' active' : ''}`}
                                  onClick={() => setAddress(a)}
                                >
                                  <MapPin size={11} /> {a}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="address-input-wrapper">
                          <MapPin size={14} className="address-icon text-muted" />
                          <input ref={addressInputRef} type="text" className="form-input address-input" placeholder="Enter your full delivery address" value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" />
                        </div>
                        {!import.meta.env.VITE_GOOGLE_MAPS_KEY && (
                          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem' }}>
                            💡 Tip: Add <code>VITE_GOOGLE_MAPS_KEY</code> to .env for address autocomplete
                          </p>
                        )}
                      </div>
                      <div className="address-map-placeholder mb-4">
                        <div className="map-pin-center"><MapPin size={24} className="text-primary" fill="currentColor" /></div>
                        <p className="text-xs text-muted absolute bottom-2 left-2">DELIVERY MAP</p>
                      </div>
                      <div className="form-row two-col mb-4">
                        <div className="form-group">
                          <label className="form-label">RECEIVER NAME</label>
                          <input type="text" className="form-input" placeholder="John Doe" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">PHONE NUMBER</label>
                          <input type="tel" className="form-input" placeholder="(718) 555-0100" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-row two-col mb-6">
                        <div className="form-group">
                          <label className="form-label">EMAIL ADDRESS</label>
                          <input type="email" className="form-input" placeholder="you@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">DRIVER INSTRUCTIONS</label>
                          <input type="text" className="form-input" placeholder="Gate code, floor, etc." value={driverNote} onChange={e => setDriverNote(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                  {deliveryMode === 'pickup' && (
                    <>
                      <div className="form-group mb-6">
                        <label className="form-label">SELECT PICKUP LOCATION</label>
                        {locations.length === 0 ? (
                          <p className="text-muted text-sm" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>Loading pickup locations...</p>
                        ) : (
                          <div className="pickup-locations-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {locations.map(loc => {
                              const active = selectedLocation?.id === loc.id;
                              return (
                                <button
                                  key={loc.id}
                                  type="button"
                                  className={`timing-card ${active ? 'active' : ''}`}
                                  onClick={() => { setSelectedLocation(loc); localStorage.setItem('habibi_service_location', JSON.stringify({ id: loc.id, title: loc.title })); }}
                                  style={{ width: '100%', margin: 0 }}
                                >
                                  <span className="timing-icon">📍</span>
                                  <div>
                                    <p className="font-bold text-sm" style={{ color: active ? 'var(--color-primary)' : 'inherit' }}>{loc.title}</p>
                                    <p className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>{loc.brief_address}</p>
                                    {loc.phone_number && <p className="text-xs text-muted" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>📞 {loc.phone_number}</p>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="form-row two-col mb-6">
                        <div className="form-group">
                          <label className="form-label">YOUR NAME</label>
                          <input type="text" className="form-input" placeholder="e.g. John Doe" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">PHONE NUMBER (for notification)</label>
                          <input type="tel" className="form-input" placeholder="(718) 555-0100" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              ))}

              {isLoggedIn && <>
                <h4 className="font-bold mb-4">Order Timing</h4>
                <div className="timing-options flex gap-4 mb-6">
                  <button className={`timing-card ${timing === 'asap' ? 'active' : ''}`} onClick={() => setTiming('asap')}>
                    <span className="timing-icon">⚡</span>
                    <div><p className="font-bold text-sm">As Soon As Possible</p><p className="text-xs text-muted">Est. 25-35 min</p></div>
                  </button>
                  <button className={`timing-card ${timing === 'later' ? 'active' : ''}`} onClick={() => setTiming('later')}>
                    <span className="timing-icon">🕐</span>
                    <div><p className="font-bold text-sm">For Later</p><p className="text-xs text-muted">Select date and time</p></div>
                  </button>
                </div>
                {timing === 'later' && (
                  <div className="form-row two-col mb-6">
                    <div className="form-group">
                      <label className="form-label">DATE</label>
                      <select
                        className="form-input form-select"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                      >
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">TIME (EST)</label>
                      <select
                        className="form-input form-select"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                      >
                        {(() => {
                          const slots = [];
                          const minLead = 45;
                          const now = new Date();
                          const earliest = new Date(now.getTime() + minLead * 60000);
                          // Round up to next 30-min boundary
                          const m = earliest.getMinutes();
                          if (m > 0 && m <= 30) earliest.setMinutes(30, 0, 0);
                          else if (m > 30) { earliest.setHours(earliest.getHours() + 1, 0, 0, 0); }
                          for (let h = scheduleDate === 'today' ? earliest.getHours() : 11; h < 23; h++) {
                            for (const min of [0, 30]) {
                              if (scheduleDate === 'today' && h === earliest.getHours() && min < earliest.getMinutes()) continue;
                              const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
                              const ampm = h >= 12 ? 'PM' : 'AM';
                              const val = `${String(h).padStart(2,'0')}:${min === 0 ? '00' : '30'}`;
                              const label = `${hh}:${min === 0 ? '00' : '30'} ${ampm}`;
                              slots.push(<option key={val} value={val}>{label}</option>);
                            }
                          }
                          return slots;
                        })()}
                      </select>
                    </div>
                  </div>
                )}
              </>}
            </div>

            {/* Payment — only visible when logged in */}
            {isLoggedIn && <div className="checkout-section">
              <h2 className="checkout-section-title mb-6">Secure Payment</h2>
              <div className="payment-options">

                {/* Card option */}
                <div className={`payment-option ${paymentMethod === 'card' ? 'active' : ''}`} onClick={() => { setPaymentMethod('card'); setIntentReady(false); }}>
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-primary" />
                    <div><p className="font-bold text-sm">Credit or Debit Card</p><p className="text-xs text-muted">Stripe secure encryption</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="/images/partners/visa.png" alt="Visa" className="pay-brand-icon" />
                    {paymentMethod === 'card' && <span className="check-badge">✓</span>}
                  </div>
                </div>

                {/* Alt payment buttons */}
                <div className="payment-alt-grid">
                  {ALT_PAYMENTS.map(m => (
                    <button
                      key={m.id}
                      className={`alt-pay-btn ${paymentMethod === m.id ? 'active' : ''}`}
                      onClick={() => { setPaymentMethod(m.id); setIntentReady(false); }}
                    >
                      {m.img
                        ? <img src={m.img} alt={m.label} className="alt-pay-icon" onError={e => e.target.style.display='none'} />
                        : <span className="alt-pay-emoji">{m.emoji}</span>
                      }
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Stripe card / Apple Pay / Google Pay form */}
                {showCardForm && (
                  <StripeCardForm
                    clientSecret={clientSecret}
                    onSuccess={handleStripeSuccess}
                    onError={handleStripeError}
                    disabled={placing}
                  />
                )}

                {/* PayPal inline buttons */}
                {showPayPal && (
                  <PayPalButton
                    amount={total}
                    orderNumber={`HAB-${Date.now()}`}
                    onSuccess={handlePayPalSuccess}
                    onError={(msg) => setOrderError(msg)}
                  />
                )}

                {/* Offline method note */}
                {OFFLINE_METHODS.has(paymentMethod) && (
                  <div className="offline-pay-note">
                    {paymentMethod === 'cash' && <p>💵 Have exact change ready upon delivery. Your order will be confirmed immediately.</p>}
                    {paymentMethod === 'zelle' && <p>📲 You'll be shown Zelle payment instructions before your order is placed.</p>}
                    {paymentMethod === 'cashapp' && <p>💸 You'll be shown Cash App payment instructions before your order is placed.</p>}
                  </div>
                )}

              </div>
            </div>}

          </div>

          {/* ── Right — Order Summary ── */}
          <div className="order-summary-card">
            <h3 className="summary-title">Order Summary</h3>
            <div className="summary-lines">
              <div className="summary-line"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="summary-line"><span>Tax (8.875%)</span><span>${tax.toFixed(2)}</span></div>
              <div className="summary-line"><span>Service Fee (4.273%)</span><span>${serviceFee.toFixed(2)}</span></div>
              <div className="summary-line">
                <span>{isDineIn ? 'Delivery Fee (Dine-In)' : `Delivery Fee${deliveryMode === 'pickup' ? ' (Pickup)' : ''}`}</span>
                {isDineIn || deliveryMode === 'pickup' ? (
                  <span className="text-primary font-bold">FREE</span>
                ) : feeLoading ? (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Calculating…</span>
                ) : deliveryFee > 0 ? (
                  <span className="text-primary font-bold">${deliveryFee.toFixed(2)}</span>
                ) : (
                  <span className="text-primary font-bold">FREE</span>
                )}
              </div>
              {feeMsg && <p style={{ fontSize: '0.72rem', color: feeMsg.startsWith('⚠') ? '#f59e0b' : 'rgba(255,255,255,0.4)', margin: '-0.25rem 0 0.25rem', lineHeight: 1.4 }}>{feeMsg}</p>}
              {couponDiscount > 0 && (
                <div className="summary-line" style={{ color: '#34d399' }}>
                  <span>Coupon ({couponCode})</span><span>−${couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="summary-line" style={{ color: '#E5B64E' }}>
                  <span>🏅 Rewards ({redeemablePts} pts)</span><span>−${loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Coupon */}
            <div className="coupon-row">
              <div className="coupon-input-wrap">
                <Tag size={13} className="coupon-icon" />
                <input
                  type="text" className="coupon-input" placeholder="Coupon code"
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(false); setCouponDiscount(0); setCouponMsg(''); setCouponErr(''); }}
                  disabled={couponApplied}
                />
              </div>
              <button
                className={`coupon-apply-btn${couponApplied ? ' applied' : ''}`}
                onClick={handleApplyCoupon}
                disabled={couponApplied || !couponCode.trim() || couponLoading}
              >
                {couponLoading ? '…' : couponApplied ? '✓' : 'Apply'}
              </button>
            </div>
            {couponMsg && <p style={{ fontSize: '0.75rem', color: '#34d399', margin: '-0.25rem 0 0.25rem' }}>✓ {couponMsg}</p>}
            {couponErr && <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '-0.25rem 0 0.25rem' }}>⚠ {couponErr}</p>}

            {/* Loyalty rewards redemption */}
            {isLoggedIn && redeemablePts > 0 && (
              <div className="loyalty-redeem-row">
                <div className="loyalty-redeem-info">
                  <span className="loyalty-redeem-icon">🏅</span>
                  <div>
                    <p className="loyalty-redeem-label">Habibi Rewards</p>
                    <p className="loyalty-redeem-sub">
                      {loyaltyPoints.toLocaleString()} pts available · Redeem {redeemablePts} pts for <strong>${loyaltyDiscount > 0 ? loyaltyDiscount.toFixed(2) : (redeemablePts / 100).toFixed(2)} off</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`loyalty-redeem-btn${useRewards ? ' active' : ''}`}
                  onClick={() => setUseRewards(v => !v)}
                >
                  {useRewards ? '✓ Applied' : 'Redeem'}
                </button>
              </div>
            )}

            {/* Tip */}
            <div className="tip-section">
              <p className="text-xs text-muted uppercase tracking-wider mb-3">ADD A TIP</p>
              <div className="tip-options flex gap-2">
                {TIP_OPTIONS.map((t, i) => (
                  <button key={t} className={`tip-btn ${tipIndex === i ? 'active' : ''}`} onClick={() => setTipIndex(i)}>{t}</button>
                ))}
              </div>
              {TIP_PCTS[tipIndex] === 'custom' && (
                <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter tip amount"
                    value={customTip}
                    onChange={e => setCustomTip(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '0.4rem 0.65rem', color: '#fff', fontSize: '0.9rem', flex: 1, minWidth: 0 }}
                  />
                </div>
              )}
            </div>

            <div className="summary-total">
              <span className="text-muted text-sm">Total</span>
              <span className="total-amount text-primary">${total.toFixed(2)}</span>
            </div>

            {orderError && <div className="order-error">⚠ {orderError}</div>}

            {!isLoggedIn && items.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/login?redirect=/checkout" className="btn btn-primary place-order-btn" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                  Log In to Place Order
                </Link>
                <Link to="/signup?redirect=/checkout" className="btn btn-outline place-order-btn" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                  Sign Up Free
                </Link>
              </div>
            )}
            {isLoggedIn && showCTABtn && ctaLabel() && (
              <button
                className="btn btn-primary place-order-btn"
                onClick={handlePlaceOrder}
                disabled={placing || items.length === 0}
              >
                {ctaLabel()}
              </button>
            )}

            <p className="text-center text-xs text-muted mt-4">
              By placing this order you agree to our{' '}
              <Link to="#" className="text-primary">Privacy Service</Link>{' '}
              &amp; all applicable order <Link to="#" className="text-primary">charges</Link>.
            </p>

            <div className="halal-seal">
              <img src="/images/logos/halal.png" alt="Halal Certified" className="halal-seal-img" />
              <div>
                <p className="halal-seal-title">HALAL CERTIFIED</p>
                <p className="halal-seal-sub">Premium by 1000+ Halal endorsements.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offline payment modal */}
      {showOfflineModal && (
        <OfflinePayModal
          method={paymentMethod}
          amount={total}
          orderNumber={pendingOrderNum}
          onConfirm={handleOfflineConfirm}
          onClose={() => setShowOfflineModal(false)}
        />
      )}
    </div>
  );
};

export default Checkout;
