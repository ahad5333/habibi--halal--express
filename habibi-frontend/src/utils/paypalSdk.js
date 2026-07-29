const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
const SDK_SCRIPT_ID = 'paypal-sdk-js';

export function paypalConfigured() {
  return !!CLIENT_ID && CLIENT_ID !== 'REPLACE_ME';
}

// Single canonical SDK URL, shared by PayPalButton and GooglePayButton --
// whichever one mounts first injects this exact script, so window.paypal
// always ends up with every component (buttons, googlepay) and funding
// source (venmo, paylater) either one might need, regardless of which
// payment method the customer picks first. Two components loading two
// differently-configured script tags would leave whichever loads second
// stuck with an incomplete SDK, since the PayPal loader only ever applies
// the first tag's config.
export function loadPayPalSdk() {
  return new Promise((resolve, reject) => {
    if (window.paypal) { resolve(window.paypal); return; }
    const existing = document.getElementById(SDK_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.paypal));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&components=buttons,googlepay&enable-funding=venmo,paylater`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(script);
  });
}
