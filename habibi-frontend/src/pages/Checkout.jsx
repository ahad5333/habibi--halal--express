import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2, MapPin, CreditCard, ShoppingBag, Tag, Plus, ChevronLeft, ChevronRight, Clock, ChevronDown, Pencil } from 'lucide-react';
import MenuItemModal from '../components/MenuItemModal';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersAPI, couponsAPI, menuAPI, userAPI, locationsAPI, settingsAPI } from '../services/api';
import { trackBeginCheckout } from '../utils/analytics';
import { getStoredUtm } from '../utils/utm';
import { useDineIn } from '../context/DineInContext';
import AuthNetForm from '../components/AuthNetForm';
import '../components/AuthNetForm.css';
import PayPalButton from '../components/PayPalButton';
import OfflinePayModal from '../components/OfflinePayModal';
import './Checkout.css';

const TIP_OPTIONS = ['None', '5%', '10%', '15%', '20%', 'Custom'];
const TIP_PCTS    = [0, 0.05, 0.1, 0.15, 0.2, 'custom'];

const ALT_PAYMENTS = [
  { id: 'paypal',  label: 'PayPal',           img: '/images/partners/paypal.png' },
  { id: 'zelle',   label: 'Zelle',            emoji: '💙' },
  { id: 'cashapp', label: 'Cash App',         emoji: '💚' },
  { id: 'cash',    label: 'Cash on Delivery', emoji: '💵' },
];

// Methods that go through an offline/modal flow
const OFFLINE_METHODS = new Set(['cash', 'zelle', 'cashapp']);

const PROMO_DEALS = [
  { code: 'HABIBI10', emoji: '🎉', label: '10% off your order', desc: 'Min order $20', minOrder: 20 },
  { code: 'WELCOME5', emoji: '👋', label: '$5 off — welcome deal', desc: 'New customers', minOrder: 0 },
  { code: 'FREESHIP', emoji: '🚚', label: 'Free delivery', desc: 'Min order $30', minOrder: 30 },
];
// Methods served by PayPal SDK
const PAYPAL_METHODS  = new Set(['paypal']);

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
  const [aptUnit, setAptUnit]             = useState('');
  const [couponCode, setCouponCode]         = useState('');
  const [couponApplied, setCouponApplied]   = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg]           = useState('');
  const [couponErr, setCouponErr]           = useState('');
  const [couponLoading, setCouponLoading]   = useState(false);
  const [placing, setPlacing]               = useState(false);
  const [orderError, setOrderError]         = useState('');
  const [authNetConfig, setAuthNetConfig]   = useState(null);
  const [intentReady, setIntentReady]       = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [editingItem,  setEditingItem]          = useState(null); // { item, itemKey } for re-edit modal
  const [showCouponPanel, setShowCouponPanel]   = useState(false);
  const [pendingOrderNum, setPendingOrderNum]   = useState('');
  const [isGift, setIsGift]                     = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientPhone, setGiftRecipientPhone] = useState('');
  const [giftMessage, setGiftMessage]           = useState('');
  const [deliveryFee, setDeliveryFee]           = useState(0);
  const [deliveryDuration, setDeliveryDuration] = useState('');
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressLatLng, setAddressLatLng]       = useState(null);
  const [locating, setLocating]                 = useState(false);
  const [locationError, setLocationError]       = useState('');
  const [feeLoading, setFeeLoading]             = useState(false);
  const [feeMsg, setFeeMsg]                     = useState('');
  const [upsellItems, setUpsellItems]           = useState([]);
  const upsellRef                               = useRef(null);
  const [loyaltyPoints, setLoyaltyPoints]       = useState(0);
  const [useRewards, setUseRewards]             = useState(false);
  const [loyaltyRedeemRate, setLoyaltyRedeemRate] = useState(100); // pts per $1 — overwritten from the admin-configured rate below
  const [taxRate, setTaxRate]                     = useState(0.08875); // overwritten from Settings below
  const [serviceFeeRate, setServiceFeeRate]       = useState(0.04273); // overwritten from Settings below
  const [activePaymentProviders, setActivePaymentProviders] = useState(null); // null = not loaded yet, show everything
  const [locations, setLocations]               = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [storeOpen, setStoreOpen]               = useState(true);
  const feeTimerRef     = useRef(null);
  const addressInputRef = useRef(null);
  const mapContainerRef    = useRef(null);
  const mapInstanceRef     = useRef(null);
  const mapMarkerRef       = useRef(null);
  const addressConfirmedRef = useRef(false); // true when address set via autocomplete or geolocation
  const prevAddressRef = useRef(''); // last address this effect actually saw, to tell a real edit from a mode toggle

  const { items, addItem, updateQty, removeItem, removeAddon, clearCart, subtotal } = useCart();
  const { isLoggedIn, user } = useAuth();
  const { isDineIn, table: dineInTable } = useDineIn();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tax       = subtotal * taxRate;
  const serviceFee = subtotal * serviceFeeRate;
  const tip        = TIP_PCTS[tipIndex] === 'custom' ? (parseFloat(customTip) || 0) : subtotal * TIP_PCTS[tipIndex];

  // Loyalty: pts per $1 comes from the admin-configured redeem rate; only
  // redeem in full-dollar increments (e.g. rate 100 + 350 pts → 300 redeemable)
  const redeemablePts   = Math.floor(loyaltyPoints / loyaltyRedeemRate) * loyaltyRedeemRate;
  const loyaltyDiscount = useRewards && redeemablePts > 0 ? redeemablePts / loyaltyRedeemRate : 0;
  const total           = Math.max(0, subtotal + tax + serviceFee + deliveryFee + tip - couponDiscount - loyaltyDiscount);

  // Check if store is currently open
  useEffect(() => {
    locationsAPI.getStatus()
      .then(s => setStoreOpen(s.open !== false))
      .catch(() => {}); // fail open — don't block checkout on a network error
  }, []);

  // Auto-enable gift mode when navigating from the Gift Order nav link
  useEffect(() => {
    if (searchParams.get('gift') === 'true') setIsGift(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Loyalty redeem rate, tax rate, and service fee rate were all previously
  // hardcoded here regardless of what the Settings/Loyalty admin pages
  // actually had configured. The backend now enforces the same values
  // server-side too, so keeping this in sync also avoids "amount is
  // incorrect" rejections for real customers the moment an admin changes one.
  useEffect(() => {
    settingsAPI.getCheckout()
      .then(s => {
        if (s?.loyalty_redeem_rate > 0) setLoyaltyRedeemRate(s.loyalty_redeem_rate);
        if (s?.tax_rate >= 0)           setTaxRate(s.tax_rate);
        if (s?.service_fee_rate >= 0)   setServiceFeeRate(s.service_fee_rate);
      })
      .catch(() => {}); // fail open — keep the hardcoded defaults
  }, []);

  // The Settings admin page's "Payment Methods" enable/disable toggles had
  // zero real effect — this page always showed all 5 options regardless.
  // Card is matched via 'authorize.net' (the real processor) since that's
  // the provider value stored for it, distinct from its checkout id 'card'.
  useEffect(() => {
    settingsAPI.getPayments()
      .then(list => {
        if (!Array.isArray(list) || list.length === 0) return; // fail open — keep showing everything
        const providers = new Set(list.map(p => p.provider));
        setActivePaymentProviders(providers);
        // Default selection is 'card' — if it turns out to be disabled,
        // fall back to the first method that actually is, so a customer
        // never ends up with a hidden selection that can't be submitted.
        const isActive = (id) => providers.has(id === 'card' ? 'authorize.net' : id);
        if (!isActive(paymentMethod)) {
          const fallback = ['card', ...ALT_PAYMENTS.map(m => m.id)].find(isActive);
          if (fallback) setPaymentMethod(fallback);
        }
      })
      .catch(() => {}); // fail open
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const isPaymentActive = (id) =>
    activePaymentProviders === null || activePaymentProviders.has(id === 'card' ? 'authorize.net' : id);

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

  // Fetch upsell items once on mount — drinks, juices, sides, salads (up to 12)
  useEffect(() => {
    menuAPI.getAll()
      .then(data => {
        const all = Array.isArray(data) ? data : (data.menus || data.items || []);
        const getName = i => (i.name || i.title || '').toLowerCase();
        const getCat  = i => (i.category || '').toLowerCase();

        const drinks = all
          .filter(i => getCat(i).includes('drink') && !getName(i).includes('juice'))
          .slice(0, 4);
        const juices = all
          .filter(i => getCat(i).includes('drink') && getName(i).includes('juice'))
          .slice(0, 3);
        const sides = all
          .filter(i => getCat(i).includes('side') || getCat(i).includes('appetizer') || getCat(i).includes('snack'))
          .slice(0, 3);
        const salads = all
          .filter(i => getCat(i).includes('platter') && getName(i).includes('salad'))
          .slice(0, 2);

        // Deduplicate by id and cap at 12
        const seen = new Set();
        const merged = [...drinks, ...juices, ...sides, ...salads].filter(i => {
          if (seen.has(i.id)) return false;
          seen.add(i.id); return true;
        }).slice(0, 12);

        setUpsellItems(merged);
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
      setDeliveryDuration('');
      setFeeMsg('');
      // Don't touch addressValidated here — switching to Pickup doesn't
      // invalidate a delivery address the user already confirmed, it's
      // just not relevant to show a fee for while Pickup is selected.
      return;
    }

    // Toggling deliveryMode back to 'delivery' re-runs this effect even
    // though address didn't actually change — only run the "was this a
    // real edit" validation check below when it did, so switching tabs
    // back and forth doesn't force the user to re-pick their address from
    // the dropdown again.
    const addressChanged = address !== prevAddressRef.current;
    prevAddressRef.current = address;

    if (addressChanged) {
      // Only reset validation if the address change came from manual typing (not autocomplete/geolocation)
      if (addressConfirmedRef.current) {
        addressConfirmedRef.current = false;
      } else {
        setAddressValidated(false);
      }
    }
    setDeliveryDuration('');
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
          setFeeMsg('⚠ This address is outside our delivery area. Please enter a Bronx/NYC address.');
        } else if (data.fee != null) {
          setDeliveryFee(parseFloat(data.fee));
          if (data.estimated_delivery_text) setDeliveryDuration(data.estimated_delivery_text);
          // When no Maps key (dev), allow fee API to validate; on prod autocomplete handles it
          if (!import.meta.env.VITE_GOOGLE_MAPS_KEY) setAddressValidated(true);
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
  // Depends on isLoggedIn/isDineIn too: the address <input> this attaches to only
  // mounts once the auth gate clears, so addressInputRef.current is null on the
  // effect's first run for any user whose login check resolves after mount —
  // without these deps the effect never re-runs once the input actually exists.
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key || !addressInputRef.current || deliveryMode !== 'delivery') return;
    const scriptId = 'gm-places-script';
    const initAC = () => {
      if (!window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place?.formatted_address) {
          addressConfirmedRef.current = true;
          setAddress(place.formatted_address);
          setAddressValidated(true);
          if (place.geometry?.location) {
            setAddressLatLng({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        }
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
  }, [deliveryMode, isLoggedIn, isDineIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize real Google Maps when a valid address lat/lng is available
  useEffect(() => {
    if (deliveryMode !== 'delivery') {
      // The map's container <div> lives inside the delivery-mode-only block
      // above and unmounts when switching to Pickup. The Google Maps
      // instance itself (held in a ref, so it survives that unmount) stays
      // bound to that now-detached node — dropping the refs here means the
      // check below correctly creates a fresh map on the new container the
      // next time delivery mode (and this effect) comes back, instead of
      // panning/zooming an orphaned map nothing can see.
      mapInstanceRef.current = null;
      mapMarkerRef.current = null;
      return;
    }
    if (!addressLatLng || !mapContainerRef.current) return;
    const init = () => {
      if (!window.google?.maps) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
          center: addressLatLng,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });
      } else {
        mapInstanceRef.current.panTo(addressLatLng);
        mapInstanceRef.current.setZoom(16);
      }
      if (mapMarkerRef.current) mapMarkerRef.current.setMap(null);
      mapMarkerRef.current = new window.google.maps.Marker({
        position: addressLatLng,
        map: mapInstanceRef.current,
        title: 'Delivery location',
        animation: window.google.maps.Animation.DROP,
      });
    };
    if (window.google?.maps) init();
  }, [addressLatLng, deliveryMode]);

  // ── Coupon ────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async (codeOverride) => {
    const code = (codeOverride || couponCode).trim().toUpperCase();
    if (!code) return;
    if (codeOverride) setCouponCode(codeOverride);
    setCouponLoading(true); setCouponErr(''); setCouponMsg(''); setCouponApplied(false); setCouponDiscount(0);
    try {
      const res = await couponsAPI.validate(code, subtotal, items);
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
      : (aptUnit.trim() ? `${address}, ${aptUnit.trim()}` : address),
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
    is_gift:             isGift,
    gift_recipient_name: isGift ? giftRecipientName : null,
    gift_recipient_phone: isGift ? giftRecipientPhone : null,
    gift_message:        isGift ? giftMessage : null,
    expected_time: timing === 'asap'
      ? 'ASAP'
      : `${scheduleDate === 'today' ? 'Today' : 'Tomorrow'} at ${scheduleTime}`,
    items: items.map(i => {
      const choiceNote = (i.choiceLabels || []).join(' | ');
      const addonsNote = (i.addons || [])
        .map(a => `${a.name}${a.qty > 1 ? ` x${a.qty}` : ''}`)
        .join(', ');
      const fullNote = [choiceNote, addonsNote, i.note].filter(Boolean).join(' | ');
      return {
        menuItemId:      i.id,
        menu_item_id:    i.id,
        id:              i.id,
        name:            i.name,
        quantity:        i.qty,
        qty:             i.qty,
        unit_price:      i.price,
        price:           i.price,
        note:            fullNote,
        selectedChoices: i.selectedChoices || {},
        selectedAddons:  i.selectedAddons  || {},
      };
    }),
    ...(getStoredUtm() || {}),
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

  // Use browser geolocation → reverse geocode → fill address
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latlng = { lat: latitude, lng: longitude };
        const geocode = () => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: latlng }, (results, status) => {
            setLocating(false);
            if (status === 'OK' && results[0]) {
              addressConfirmedRef.current = true;
              setAddress(results[0].formatted_address);
              setAddressLatLng(latlng);
              setAddressValidated(true);
              setLocationError('');
            } else {
              setLocationError('Could not resolve your address. Please type it manually.');
            }
          });
        };
        if (window.google?.maps) {
          geocode();
        } else {
          const script = document.getElementById('gm-places-script');
          if (script) { script.addEventListener('load', geocode); }
          else { setLocating(false); setLocationError('Maps not loaded. Please type your address.'); }
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) setLocationError('Location access denied. Please type your address or allow location in browser settings.');
        else setLocationError('Could not get your location. Please type your address.');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // Auto-detect location if Chrome already has permission granted (like Zepto/Blinkit)
  // Gated on isLoggedIn/isDineIn — firing before the delivery form (and the Maps
  // script effect above) has mounted would hit the "Maps not loaded" fallback in
  // handleUseMyLocation even though Maps was simply never given the chance to load yet.
  useEffect(() => {
    if (!isLoggedIn || isDineIn || deliveryMode !== 'delivery' || address || !navigator.geolocation || !navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') handleUseMyLocation();
    }).catch(() => {});
  }, [deliveryMode, isLoggedIn, isDineIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared pre-flight validation — run before any payment path fires
  const validateOrder = () => {
    if (!receiverName.trim()) { setOrderError('Please enter your name.'); return false; }
    if (!customerPhone.trim()) { setOrderError('Please enter a US phone number.'); return false; }
    const digits = (customerPhone.match(/\d/g) || []).join('');
    const usDigits = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
    if (usDigits.length !== 10) { setOrderError('Please enter a valid 10-digit US phone number, e.g. (718) 555-0100.'); return false; }
    if (!isDineIn && deliveryMode === 'delivery') {
      if (!address.trim()) { setOrderError('Please enter your delivery address.'); return false; }
      if (feeLoading) { setOrderError('Please wait while we calculate the delivery fee.'); return false; }
      if (!addressValidated) { setOrderError('Please enter a complete delivery address so we can calculate your fee.'); return false; }
    }
    setOrderError('');
    return true;
  };

  // ── Card: fetch Authorize.net config then show card form ─────────────────
  const handlePrepareCardPayment = async () => {
    if (items.length === 0) return;
    if (!validateOrder()) return;
    trackBeginCheckout(items, total);
    setPlacing(true); setOrderError('');
    try {
      const orderNumber = `HAB-${Date.now()}`;
      setPendingOrderNum(orderNumber);
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res  = await fetch(`${BASE}/api/payments/authnet/config`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment setup failed.');
      setAuthNetConfig(data);
      setIntentReady(true);
    } catch (err) {
      setOrderError(err.message || 'Failed to initiate payment.');
    } finally {
      setPlacing(false);
    }
  };

  // Called by AuthNetForm on successful charge
  const handleAuthNetSuccess = async (transactionId) => {
    setPlacing(true); setOrderError('');
    try {
      const result = await ordersAPI.createGuest(buildPayload(pendingOrderNum));
      await finishOrder(result?.order_number || pendingOrderNum);
    } catch (err) {
      setOrderError(err.message || 'Order could not be saved. Contact support.');
    } finally {
      setPlacing(false);
    }
  };

  const handleCardError = (msg) => setOrderError(msg || 'Payment failed. Please try again.');

  // ── PayPal success ─────────────────────────────────────────────────────────
  const handlePayPalSuccess = async (details) => {
    setPlacing(true); setOrderError('');
    try {
      const result = await ordersAPI.createGuest(buildPayload(pendingOrderNum));
      await finishOrder(result?.order_number || pendingOrderNum);
    } catch (err) {
      setOrderError(err.message || 'Order save failed after PayPal payment.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Offline / Cash / Zelle / CashApp ──────────────────────────────────────
  const handleOfflineClick = () => {
    if (items.length === 0) return;
    if (!validateOrder()) return;
    trackBeginCheckout(items, total);
    const orderNumber = `HAB-${Date.now()}`;
    setPendingOrderNum(orderNumber);
    setShowOfflineModal(true);
  };

  const handleOfflineConfirm = async () => {
    setShowOfflineModal(false);
    setPlacing(true); setOrderError('');
    try {
      const result = await ordersAPI.createGuest(buildPayload(pendingOrderNum));
      await finishOrder(result?.order_number || pendingOrderNum);
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
    // card
    if (!intentReady) { handlePrepareCardPayment(); return; }
    // AuthNetForm has its own submit button
  };

  const showCardForm = paymentMethod === 'card' && intentReady;
  const showPayPal   = PAYPAL_METHODS.has(paymentMethod);
  const showCTABtn   = !PAYPAL_METHODS.has(paymentMethod);

  const ctaLabel = () => {
    if (placing) return 'Please wait…';
    if (OFFLINE_METHODS.has(paymentMethod)) return 'PLACE YOUR ORDER';
    if (!intentReady) return 'CONTINUE TO PAYMENT';
    return null; // AuthNetForm has its own submit button
  };

  return (
    <>
    <div className="checkout-page">
      <div className="container checkout-container py-12">

        {/* Closed banner */}
        {!storeOpen && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🔒</span>
            <div>
              <p style={{ color: '#f87171', fontWeight: 700, margin: '0 0 0.2rem', fontSize: '0.95rem' }}>We're currently closed</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.85rem' }}>
                We are not accepting orders right now. Please check our <a href="/locations" style={{ color: '#E5B64E' }}>hours</a> and try again when we open.
              </p>
            </div>
          </div>
        )}

        {/* Dine-in mode banner */}
        {isDineIn && (
          <div className="dine-in-banner">
            <span className="dine-in-banner-icon">🍽️</span>
            <div>
              <p className="dine-in-banner-title">Dine-In Order, {dineInTable?.table_name || 'Your Table'}</p>
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
                  {items.map(item => {
                    const mainPrice = item.baseItemPrice ?? item.price;
                    const addons = item.addons || [];
                    const itemKey = item.cartKey ?? item.id;
                    return (
                      <React.Fragment key={itemKey}>
                        <div className="cart-item">
                          {item.bowlLayers?.length ? (
                            <div className="cart-item-bowl-preview">
                              {item.bowlLayers.map((src, li) => (
                                <img key={li} src={src} alt="" className="cart-item-bowl-layer" style={{ zIndex: li + 1 }} />
                              ))}
                            </div>
                          ) : item.customLayers?.length ? (
                            <div className="cart-item-custom-preview">
                              {item.customLayers.map((src, li) => (
                                <img key={li} src={src} alt="" className="cart-item-custom-layer" style={{ zIndex: li + 1 }} />
                              ))}
                            </div>
                          ) : (
                            <img
                              src={item.img || getFoodPhoto(item.id)}
                              alt={item.name}
                              className="cart-item-img"
                              onError={e => { e.target.onerror = null; e.target.src = getFoodPhoto(item.id); }}
                            />
                          )}
                          <div className="cart-item-info">
                            <h4 className="cart-item-name">{item.name}</h4>
                            {item.choiceLabels?.length > 0 && (
                              <p className="cart-item-options">{item.choiceLabels.join(' · ')}</p>
                            )}
                            {item.note && <p className="cart-item-modifiers">📝 {item.note}</p>}
                          </div>
                          <div className="cart-item-controls">
                            <div className="qty-control">
                              <button onClick={() => updateQty(itemKey, item.qty - 1)}>−</button>
                              <span>{item.qty}</span>
                              <button onClick={() => updateQty(itemKey, item.qty + 1)}>+</button>
                            </div>
                            <span className="cart-item-price text-primary font-bold">${(mainPrice * item.qty).toFixed(2)}</span>
                            {/* Edit button */}
                            {!item.parentCartKey && (
                              item.bowlLayers && item.bowlConfig ? (
                                <button
                                  className="cart-edit-btn"
                                  onClick={() => navigate('/menu/byo', { state: { editBowl: { config: item.bowlConfig, cartKey: itemKey } } })}
                                  title="Edit bowl"
                                >
                                  <Pencil size={13} />
                                </button>
                              ) : item.customLayers && item.customCfg ? (
                                <button
                                  className="cart-edit-btn"
                                  onClick={() => navigate('/customize', { state: { editCustom: { cfg: item.customCfg, cartKey: itemKey } } })}
                                  title="Edit custom order"
                                >
                                  <Pencil size={13} />
                                </button>
                              ) : !item.bowlLayers && !item.customLayers ? (
                                <button
                                  className="cart-edit-btn"
                                  onClick={() => setEditingItem({ item, itemKey })}
                                  title="Edit item"
                                >
                                  <Pencil size={13} />
                                </button>
                              ) : null
                            )}
                            <button
                              className="cart-delete-btn"
                              onClick={() => removeItem(itemKey)}
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {addons.map((addon, idx) => (
                          <div key={`${itemKey}-addon-${idx}`} className="cart-addon-row">
                            <span className="cart-addon-name">+ {addon.name}{addon.qty > 1 ? ` ×${addon.qty}` : ''}</span>
                            <span className="cart-addon-price">
                              {parseFloat(addon.price) > 0
                                ? `$${(addon.price * (addon.qty || 1) * item.qty).toFixed(2)}`
                                : 'Free'}
                            </span>
                            {parseFloat(addon.price) > 0 && (
                              <button
                                className="cart-addon-remove"
                                onClick={() => removeAddon(itemKey, idx)}
                                title="Remove add-on"
                              >×</button>
                            )}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upsell — "Complete Your Meal" */}
            {upsellItems.length > 0 && items.length > 0 && (
              <div className="checkout-section upsell-section">
                <div className="upsell-header">
                  <div className="upsell-header-left">
                    <span className="upsell-fire">🔥</span>
                    <h2 className="checkout-section-title upsell-title">Complete Your Meal</h2>
                  </div>
                  <div className="upsell-arrows">
                    <button className="upsell-arrow" aria-label="Scroll left" onClick={() => { const el = upsellRef.current; if (el) el.scrollBy({ left: -200, behavior: 'smooth' }); }}><ChevronLeft size={16} /></button>
                    <button className="upsell-arrow" aria-label="Scroll right" onClick={() => { const el = upsellRef.current; if (el) el.scrollBy({ left: 200, behavior: 'smooth' }); }}><ChevronRight size={16} /></button>
                  </div>
                </div>
                <div className="upsell-clip">
                  <div className="upsell-track" ref={upsellRef}>
                    {upsellItems.map(u => {
                      const imgSrc = u.image || u.image_url || getFoodPhoto(u.id);
                      const alreadyIn = !!items.find(i => i.id === u.id);
                      const cat = (u.category || 'Add-on');
                      return (
                        <div key={u.id} className={`upsell-card${alreadyIn ? ' upsell-card--added' : ''}`}>
                          <div className="upsell-cat-chip">{cat}</div>
                          <div className="upsell-img-wrap">
                            <img
                              src={imgSrc}
                              alt={u.name || u.title}
                              className="upsell-img"
                              onError={e => { e.target.src = getFoodPhoto(u.id + 7); }}
                            />
                          </div>
                          <p className="upsell-name">{u.name || u.title}</p>
                          <p className="upsell-price">${parseFloat(u.price || 0).toFixed(2)}</p>
                          <button
                            className={`upsell-add-btn${alreadyIn ? ' upsell-add-btn--added' : ''}`}
                            disabled={alreadyIn}
                            onClick={() => !alreadyIn && addItem({ id: u.id, name: u.name || u.title, price: parseFloat(u.price || 0), img: imgSrc, tag: cat, note: '', qty: 1 })}
                          >
                            {alreadyIn ? '✓ Added' : <><Plus size={12} /> Add</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Details */}
            <div className="checkout-section">
              <h2 className="checkout-section-title mb-6">{isDineIn ? 'Your Details' : 'Delivery Details'}</h2>

              {/* Optional, non-blocking nudge — guests can still order without an account */}
              {!isLoggedIn && (
                <div className="checkout-guest-nudge">
                  <span>Already have an account?</span>
                  <Link to="/login?redirect=/checkout">Log in for faster checkout</Link>
                </div>
              )}

              {(isDineIn ? (
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label className="form-label" style={{ margin: 0 }}>DELIVERY ADDRESS</label>
                          {'geolocation' in navigator && (
                            <button
                              type="button"
                              onClick={handleUseMyLocation}
                              disabled={locating}
                              style={{
                                background: 'none', border: 'none', cursor: locating ? 'default' : 'pointer',
                                color: locating ? 'rgba(255,255,255,0.4)' : 'var(--color-primary)',
                                fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem',
                                padding: 0, letterSpacing: '0.02em',
                              }}
                            >
                              <MapPin size={12} />
                              {locating ? 'Locating…' : 'Use my location'}
                            </button>
                          )}
                        </div>
                        {locationError && (
                          <p style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: '0.4rem' }}>{locationError}</p>
                        )}
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
                          <input ref={addressInputRef} type="text" className="form-input address-input" placeholder="Start typing your address…" value={address} onChange={e => { setAddress(e.target.value); setAddressValidated(false); setAddressLatLng(null); if (mapInstanceRef.current) { mapInstanceRef.current = null; } }} autoComplete="off" />
                        </div>
                        {address.trim() && !addressValidated && !feeLoading && import.meta.env.VITE_GOOGLE_MAPS_KEY && (
                          <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.35rem' }}>
                            Select your address from the dropdown to confirm it
                          </p>
                        )}
                        {!import.meta.env.VITE_GOOGLE_MAPS_KEY && import.meta.env.DEV && (
                          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem' }}>
                            💡 Tip: Add <code>VITE_GOOGLE_MAPS_KEY</code> to .env for address autocomplete
                          </p>
                        )}
                      </div>

                      {/* Real Google Maps — slides in after address is selected */}
                      <div
                        ref={mapContainerRef}
                        style={{
                          height: addressLatLng ? '190px' : '0',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          marginBottom: addressLatLng ? '1rem' : '0',
                          transition: 'height 0.35s ease',
                          border: addressLatLng ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        }}
                      />
                      {!addressLatLng && (
                        <div className="address-map-placeholder mb-4">
                          <div className="map-pin-center"><MapPin size={24} className="text-primary" fill="currentColor" /></div>
                          <p className="text-xs text-muted absolute bottom-2 left-2">SELECT ADDRESS FROM SUGGESTIONS</p>
                        </div>
                      )}

                      {/* Apt / Suite / Gate / Floor */}
                      <div className="form-group mb-4">
                        <label className="form-label">APT / SUITE / FLOOR / GATE #</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Apt 4B, Floor 3, Gate 12"
                          value={aptUnit}
                          onChange={e => setAptUnit(e.target.value)}
                          autoComplete="address-line2"
                        />
                        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem' }}>
                          Helps your driver find you faster
                        </p>
                      </div>

                      {/* Estimated delivery time badge */}
                      <div className={`eta-badge eta-badge--delivery${feeLoading ? ' eta-badge--loading' : ''}`}>
                        <div className="eta-badge-icon">
                          <Clock size={15} />
                        </div>
                        <div className="eta-badge-text">
                          {feeLoading ? (
                            <span className="eta-badge-time">Calculating…</span>
                          ) : addressValidated && deliveryDuration ? (
                            <>
                              <span className="eta-badge-time">{deliveryDuration}</span>
                              <span className="eta-badge-label">estimated delivery</span>
                            </>
                          ) : (
                            <>
                              <span className="eta-badge-time">—</span>
                              <span className="eta-badge-label">enter your address to see ETA</span>
                            </>
                          )}
                        </div>
                        {addressValidated && deliveryDuration && !feeLoading && (
                          <span className="eta-badge-live">LIVE</span>
                        )}
                      </div>

                      <div className="form-row two-col mb-4">
                        <div className="form-group">
                          <label className="form-label">RECEIVER NAME</label>
                          <input type="text" className="form-input" placeholder="John Doe" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">US PHONE NUMBER</label>
                          <input type="tel" className="form-input" placeholder="(718) 555-0100" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} maxLength={15} />
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

                      {/* Gift Order toggle */}
                      <div className="gift-order-toggle mb-4" onClick={() => setIsGift(g => !g)}>
                        <div className="gift-toggle-left">
                          <span className="gift-toggle-icon">🎀</span>
                          <div>
                            <p className="gift-toggle-title">This is a Gift Order</p>
                            <p className="gift-toggle-sub">Send this order as a gift to someone else</p>
                          </div>
                        </div>
                        <div className={`gift-toggle-switch ${isGift ? 'on' : ''}`}>
                          <div className="gift-toggle-knob" />
                        </div>
                      </div>

                      {isGift && (
                        <div className="gift-order-section mb-6">
                          <div className="gift-section-header">
                            <span>🎁</span>
                            <span>Gift Recipient Details</span>
                          </div>
                          <div className="form-row two-col mb-4">
                            <div className="form-group">
                              <label className="form-label">RECIPIENT NAME</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Who are you gifting this to?"
                                value={giftRecipientName}
                                onChange={e => setGiftRecipientName(e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">RECIPIENT PHONE</label>
                              <input
                                type="tel"
                                className="form-input"
                                placeholder="(718) 555-0100"
                                value={giftRecipientPhone}
                                onChange={e => setGiftRecipientPhone(e.target.value)}
                                maxLength={15}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">GIFT MESSAGE <span className="form-label-optional">(optional)</span></label>
                            <textarea
                              className="form-input gift-message-input"
                              placeholder="Write a personal message for the recipient…"
                              value={giftMessage}
                              onChange={e => setGiftMessage(e.target.value)}
                              rows={3}
                              maxLength={300}
                            />
                            <p className="gift-char-count">{giftMessage.length}/300</p>
                          </div>
                        </div>
                      )}
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

                      {/* Pickup ETA badge */}
                      <div className="eta-badge eta-badge--pickup">
                        <div className="eta-badge-icon eta-badge-icon--green">
                          <Clock size={15} />
                        </div>
                        <div className="eta-badge-text">
                          <span className="eta-badge-time">10–20 min</span>
                          <span className="eta-badge-label">ready for pickup</span>
                        </div>
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

                      {/* Gift Order toggle (pickup) */}
                      <div className="gift-order-toggle mb-4" onClick={() => setIsGift(g => !g)}>
                        <div className="gift-toggle-left">
                          <span className="gift-toggle-icon">🎀</span>
                          <div>
                            <p className="gift-toggle-title">This is a Gift Order</p>
                            <p className="gift-toggle-sub">Send this order as a gift to someone else</p>
                          </div>
                        </div>
                        <div className={`gift-toggle-switch ${isGift ? 'on' : ''}`}>
                          <div className="gift-toggle-knob" />
                        </div>
                      </div>

                      {isGift && (
                        <div className="gift-order-section mb-6">
                          <div className="gift-section-header">
                            <span>🎁</span>
                            <span>Gift Recipient Details</span>
                          </div>
                          <div className="form-row two-col mb-4">
                            <div className="form-group">
                              <label className="form-label">RECIPIENT NAME</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Who are you gifting this to?"
                                value={giftRecipientName}
                                onChange={e => setGiftRecipientName(e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">RECIPIENT PHONE</label>
                              <input
                                type="tel"
                                className="form-input"
                                placeholder="(718) 555-0100"
                                value={giftRecipientPhone}
                                onChange={e => setGiftRecipientPhone(e.target.value)}
                                maxLength={15}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">GIFT MESSAGE <span className="form-label-optional">(optional)</span></label>
                            <textarea
                              className="form-input gift-message-input"
                              placeholder="Write a personal message for the recipient…"
                              value={giftMessage}
                              onChange={e => setGiftMessage(e.target.value)}
                              rows={3}
                              maxLength={300}
                            />
                            <p className="gift-char-count">{giftMessage.length}/300</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ))}

              {<>
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

            {/* Payment */}
            {<div className="checkout-section">
              <h2 className="checkout-section-title mb-6">Secure Payment</h2>
              <div className="payment-options">

                {/* Card option */}
                {isPaymentActive('card') && (
                  <div className={`payment-option ${paymentMethod === 'card' ? 'active' : ''}`} onClick={() => { setPaymentMethod('card'); setIntentReady(false); }}>
                    <div className="flex items-center gap-3">
                      <CreditCard size={18} className="text-primary" />
                      <div><p className="font-bold text-sm">Credit or Debit Card</p><p className="text-xs text-muted">Secured by Authorize.net</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src="/images/partners/visa.png" alt="Visa" className="pay-brand-icon" />
                      {paymentMethod === 'card' && <span className="check-badge">✓</span>}
                    </div>
                  </div>
                )}

                {/* Alt payment buttons */}
                <div className="payment-alt-grid">
                  {ALT_PAYMENTS.filter(m => isPaymentActive(m.id)).map(m => (
                    <button
                      key={m.id}
                      className={`alt-pay-btn ${paymentMethod === m.id ? 'active' : ''}`}
                      onClick={() => {
                        setPaymentMethod(m.id);
                        setIntentReady(false);
                        if (PAYPAL_METHODS.has(m.id)) setPendingOrderNum(`HAB-${Date.now()}`);
                      }}
                    >
                      {m.img
                        ? <img src={m.img} alt={m.label} className="alt-pay-icon" onError={e => e.target.style.display='none'} />
                        : <span className="alt-pay-emoji">{m.emoji}</span>
                      }
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Authorize.net card form */}
                {showCardForm && (
                  <AuthNetForm
                    config={authNetConfig}
                    amount={total}
                    orderNumber={pendingOrderNum}
                    onSuccess={handleAuthNetSuccess}
                    onError={handleCardError}
                  />
                )}

                {/* PayPal inline buttons */}
                {showPayPal && (
                  <PayPalButton
                    amount={total}
                    orderNumber={pendingOrderNum || `HAB-${Date.now()}`}
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

            {(() => {
              const needsAddress = !isDineIn && deliveryMode === 'delivery' && !addressValidated;
              return (
                <>
                  <div className="summary-lines">
                    <div className="summary-line"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                    <div className="summary-line"><span>Tax (8.875%)</span><span>${tax.toFixed(2)}</span></div>
                    <div className="summary-line"><span>Service Fee (4.273%)</span><span>${serviceFee.toFixed(2)}</span></div>
                    <div className="summary-line">
                      <span>{isDineIn ? 'Delivery Fee (Dine-In)' : `Delivery Fee${deliveryMode === 'pickup' ? ' (Pickup)' : ''}`}</span>
                      {isDineIn || deliveryMode === 'pickup' ? (
                        <span className="text-primary font-bold">FREE</span>
                      ) : needsAddress ? (
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Enter address above</span>
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

                  {/* Coupon — collapsible offers panel */}
                  <div className={`coupon-panel${showCouponPanel ? ' coupon-panel--open' : ''}${couponApplied ? ' coupon-panel--applied' : ''}`}>
                    <button className="coupon-panel-hdr" onClick={() => setShowCouponPanel(v => !v)}>
                      <div className="coupon-panel-hdr-left">
                        <Tag size={15} className="coupon-panel-tag-icon" />
                        <span className="coupon-panel-title">Offers &amp; Coupons</span>
                        {couponApplied && (
                          <span className="coupon-panel-saved">−${couponDiscount.toFixed(2)} saved</span>
                        )}
                      </div>
                      <ChevronDown size={16} className={`coupon-panel-chevron${showCouponPanel ? ' open' : ''}`} />
                    </button>

                    {showCouponPanel && (
                      <div className="coupon-panel-body">
                        {/* Quick-apply deals */}
                        <div className="coupon-deals">
                          {PROMO_DEALS.map(deal => {
                            const eligible = subtotal >= deal.minOrder;
                            const thisApplied = couponApplied && couponCode === deal.code;
                            return (
                              <div key={deal.code} className={`coupon-deal-card${!eligible ? ' coupon-deal-card--locked' : ''}${thisApplied ? ' coupon-deal-card--applied' : ''}`}>
                                <span className="coupon-deal-emoji">{deal.emoji}</span>
                                <div className="coupon-deal-info">
                                  <p className="coupon-deal-label">{deal.label}</p>
                                  <p className="coupon-deal-desc">
                                    {deal.desc}
                                    {!eligible && deal.minOrder > 0 && ` · add $${(deal.minOrder - subtotal).toFixed(2)} more`}
                                  </p>
                                </div>
                                <button
                                  className={`coupon-deal-apply${thisApplied ? ' applied' : ''}`}
                                  disabled={!eligible || thisApplied || couponLoading}
                                  onClick={() => handleApplyCoupon(deal.code)}
                                >
                                  {couponLoading && couponCode === deal.code ? '…' : thisApplied ? '✓' : 'Apply'}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Manual code divider */}
                        <div className="coupon-or-divider"><span>or enter a code</span></div>

                        {/* Manual code input */}
                        <div className="coupon-row">
                          <div className="coupon-input-wrap">
                            <Tag size={13} className="coupon-icon" />
                            <input
                              type="text" className="coupon-input" placeholder="Enter coupon code"
                              value={couponCode}
                              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(false); setCouponDiscount(0); setCouponMsg(''); setCouponErr(''); }}
                              disabled={couponApplied}
                            />
                          </div>
                          <button
                            className={`coupon-apply-btn${couponApplied ? ' applied' : ''}`}
                            onClick={() => handleApplyCoupon()}
                            disabled={couponApplied || !couponCode.trim() || couponLoading}
                          >
                            {couponLoading ? '…' : couponApplied ? '✓' : 'Apply'}
                          </button>
                        </div>
                        {couponMsg && <p className="coupon-feedback coupon-feedback--ok">✓ {couponMsg}</p>}
                        {couponErr && <p className="coupon-feedback coupon-feedback--err">⚠ {couponErr}</p>}
                      </div>
                    )}
                  </div>

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

                  {/* ── Price breakdown table ── */}
                  <div className="price-breakdown">
                    <div className="pb-row">
                      <span className="pb-label">Item Total</span>
                      <span className="pb-value">${subtotal.toFixed(2)}</span>
                    </div>
                    {deliveryMode === 'delivery' && (
                      <div className="pb-row">
                        <span className="pb-label">
                          Delivery Fee
                          {feeLoading && <span className="pb-note"> calculating…</span>}
                        </span>
                        <span className="pb-value">
                          {feeLoading ? '—' : deliveryFee === 0 ? <span className="pb-free">Free</span> : `$${deliveryFee.toFixed(2)}`}
                        </span>
                      </div>
                    )}
                    <div className="pb-row">
                      <span className="pb-label">Service Fee</span>
                      <span className="pb-value">${serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="pb-row">
                      <span className="pb-label">Tax (8.875%)</span>
                      <span className="pb-value">${tax.toFixed(2)}</span>
                    </div>
                    {tip > 0 && (
                      <div className="pb-row">
                        <span className="pb-label">Tip</span>
                        <span className="pb-value">${tip.toFixed(2)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="pb-row pb-row--discount">
                        <span className="pb-label">Coupon Discount</span>
                        <span className="pb-value pb-value--green">−${couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="pb-row pb-row--discount">
                        <span className="pb-label">🏅 Rewards</span>
                        <span className="pb-value pb-value--green">−${loyaltyDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="pb-divider" />
                    <div className="pb-total-row">
                      <span className="pb-total-label">Total</span>
                      <span className="pb-total-value">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {orderError && <div className="order-error">⚠ {orderError}</div>}

                  {/* ── Trust badges ── */}
                  <div className="trust-badges">
                    <div className="trust-badge">
                      <img src="/images/logos/halal-certified-premium.webp" alt="Halal Certified" className="trust-badge-img" />
                      <div className="trust-badge-text">
                        <span className="trust-badge-label">Halal Certified</span>
                        <span className="trust-badge-sub">1000+ endorsements</span>
                      </div>
                    </div>
                    <div className="trust-badge-sep" />
                    <div className="trust-badge">
                      <img src="/images/logos/grade-a-badge.png" alt="Grade A" className="trust-badge-img" />
                      <div className="trust-badge-text">
                        <span className="trust-badge-label">Grade A</span>
                        <span className="trust-badge-sub">NYC Health Dept.</span>
                      </div>
                    </div>
                    <div className="trust-badge-sep" />
                    <div className="trust-badge">
                      <span className="trust-badge-emoji">🔒</span>
                      <div className="trust-badge-text">
                        <span className="trust-badge-label">Secure Checkout</span>
                        <span className="trust-badge-sub">SSL encrypted</span>
                      </div>
                    </div>
                  </div>

                  {showCTABtn && ctaLabel() && (
                    <button
                      className="btn btn-primary place-order-btn"
                      onClick={handlePlaceOrder}
                      disabled={placing || items.length === 0 || !storeOpen || (!isDineIn && deliveryMode === 'delivery' && (!addressValidated || feeLoading))}
                      title={!storeOpen ? "We're currently closed" : (!isDineIn && deliveryMode === 'delivery' && !addressValidated) ? 'Enter a valid delivery address to continue' : undefined}
                    >
                      {!storeOpen ? "Currently Closed" : ctaLabel()}
                    </button>
                  )}
                </>
              );
            })()}

            <p className="text-center text-xs text-muted mt-4">
              By placing this order you agree to our{' '}
              <Link to="/terms" className="text-primary">Terms of Service</Link> and{' '}
              <Link to="/privacy-policy" className="text-primary">Privacy Policy</Link>.
            </p>

            <div className="halal-seal">
              <img src="/images/logos/halal-certified-premium.webp" alt="Halal Certified" className="halal-seal-img" />
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

      {/* ── Sticky mobile bottom bar ── */}
      {items.length > 0 && (
        <div className={`ck-sticky-bar${!storeOpen ? ' ck-sticky-bar--closed' : ''}`}>
          <div className="ck-sticky-info">
            <span className="ck-sticky-count">
              {items.reduce((s, i) => s + (i.qty || 1), 0)} item{items.reduce((s, i) => s + (i.qty || 1), 0) !== 1 ? 's' : ''}
            </span>
            <span className="ck-sticky-total">${total.toFixed(2)}</span>
          </div>
          {showCTABtn ? (
            <button
              className="ck-sticky-btn"
              onClick={handlePlaceOrder}
              disabled={placing || !storeOpen || (!isDineIn && deliveryMode === 'delivery' && (!addressValidated || feeLoading))}
            >
              {!storeOpen ? 'Currently Closed' : feeLoading ? 'Calculating fee…' : (!isDineIn && deliveryMode === 'delivery' && !addressValidated) ? 'Enter delivery address' : placing ? 'Please wait…' : 'Place Order →'}
            </button>
          ) : null}
        </div>
      )}
    </div>

    {/* Re-edit modal — opens when user clicks the pencil icon on a cart item */}
    {editingItem && (
      <MenuItemModal
        itemId={editingItem.item.id}
        editCartKey={editingItem.itemKey}
        initialChoiceSel={editingItem.item.selectedChoices   || {}}
        initialAddonSel={editingItem.item.selectedAddons     || {}}
        initialUniversalSel={editingItem.item.selectedUniversal || {}}
        initialNote={editingItem.item.note || ''}
        initialQty={editingItem.item.qty   || 1}
        onClose={() => setEditingItem(null)}
        onSelectItem={() => setEditingItem(null)}
      />
    )}
    </>
  );
};

export default Checkout;
