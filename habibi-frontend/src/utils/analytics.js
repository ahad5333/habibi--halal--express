// Google Analytics 4 & Facebook Pixel Utilities

export const initGA = (measurementId) => {
  if (!measurementId || measurementId === 'G-MOCKTRACKER') {
    console.log('%c[GA4 Simulator] Initialized with Mock ID: G-MOCKTRACKER', 'color: #0ea5e9; font-weight: bold; padding: 4px;');
    return;
  }
  
  if (window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  console.log(`%c[GA4] Loaded and Initialized with ID: ${measurementId}`, 'color: #10b981; font-weight: bold; padding: 4px;');
};

export const initPixel = (pixelId) => {
  if (!pixelId || pixelId === '123456789012345') {
    console.log('%c[FB Pixel Simulator] Initialized with Mock ID: 123456789012345', 'color: #3b82f6; font-weight: bold; padding: 4px;');
    return;
  }

  if (window.fbq) return;

  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  console.log(`%c[FB Pixel] Loaded and Initialized with ID: ${pixelId}`, 'color: #10b981; font-weight: bold; padding: 4px;');
};

export const trackPageView = (path) => {
  const isMockGA = !import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_MEASUREMENT_ID === 'G-MOCKTRACKER';
  const isMockPixel = !import.meta.env.VITE_FB_PIXEL_ID || import.meta.env.VITE_FB_PIXEL_ID === '123456789012345';

  if (isMockGA) {
    console.log(`%c[GA4 Simulator] Page View tracked: ${path}`, 'color: #0ea5e9; font-style: italic;');
  } else if (window.gtag) {
    window.gtag('event', 'page_view', { page_path: path });
  }

  if (isMockPixel) {
    console.log(`%c[FB Pixel Simulator] Page View tracked: ${path}`, 'color: #3b82f6; font-style: italic;');
  } else if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

// ── Ecommerce conversion events ──────────────────────────────────────────────

const _mockGA  = () => !import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_MEASUREMENT_ID === 'G-MOCKTRACKER';
const _mockPx  = () => !import.meta.env.VITE_FB_PIXEL_ID || import.meta.env.VITE_FB_PIXEL_ID === '123456789012345';

export const trackAddToCart = (item) => {
  const value = parseFloat(item.price || 0);
  const qty   = item.qty || 1;
  if (_mockGA()) {
    console.log(`%c[GA4 Simulator] add_to_cart: ${item.name} ×${qty} $${(value * qty).toFixed(2)}`, 'color:#0ea5e9;');
  } else if (window.gtag) {
    window.gtag('event', 'add_to_cart', {
      currency: 'USD',
      value: value * qty,
      items: [{ item_id: String(item.id), item_name: item.name, price: value, quantity: qty }],
    });
  }
  if (_mockPx()) {
    console.log(`%c[FB Pixel Simulator] AddToCart: ${item.name} $${(value * qty).toFixed(2)}`, 'color:#3b82f6;');
  } else if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_ids: [String(item.id)],
      content_name: item.name,
      content_type: 'product',
      value: value * qty,
      currency: 'USD',
    });
  }
};

export const trackBeginCheckout = (cartItems, total) => {
  if (_mockGA()) {
    console.log(`%c[GA4 Simulator] begin_checkout: $${total.toFixed(2)} (${cartItems.length} items)`, 'color:#0ea5e9;');
  } else if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency: 'USD',
      value: total,
      items: cartItems.map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })),
    });
  }
  if (_mockPx()) {
    console.log(`%c[FB Pixel Simulator] InitiateCheckout: $${total.toFixed(2)}`, 'color:#3b82f6;');
  } else if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', { value: total, currency: 'USD', num_items: cartItems.length });
  }
};

export const trackPurchase = (orderNumber, cartItems, total) => {
  if (_mockGA()) {
    console.log(`%c[GA4 Simulator] purchase: #${orderNumber} $${total.toFixed(2)}`, 'color:#0ea5e9;');
  } else if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: orderNumber,
      currency: 'USD',
      value: total,
      items: (cartItems || []).map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })),
    });
  }
  if (_mockPx()) {
    console.log(`%c[FB Pixel Simulator] Purchase: #${orderNumber} $${total.toFixed(2)}`, 'color:#3b82f6;');
  } else if (window.fbq) {
    window.fbq('track', 'Purchase', { value: total, currency: 'USD', content_type: 'product' });
  }
};

// ── Generic event (legacy) ────────────────────────────────────────────────────

export const trackEvent = (action, category, label, value) => {
  const isMockGA = !import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_MEASUREMENT_ID === 'G-MOCKTRACKER';
  const isMockPixel = !import.meta.env.VITE_FB_PIXEL_ID || import.meta.env.VITE_FB_PIXEL_ID === '123456789012345';

  if (isMockGA) {
    console.log(`%c[GA4 Simulator] Custom Event -> Action: ${action}, Category: ${category}, Label: ${label || 'N/A'}${value ? `, Value: ${value}` : ''}`, 'color: #0ea5e9; font-weight: 500;');
  } else if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }

  if (isMockPixel) {
    console.log(`%c[FB Pixel Simulator] Custom Event -> Action: ${action}${value ? `, Value: ${value}` : ''}`, 'color: #3b82f6; font-weight: 500;');
  } else if (window.fbq) {
    window.fbq('track', action, { content_category: category, content_name: label, value: value });
  }
};
