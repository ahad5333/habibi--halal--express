// One loader for Square's Web Payments SDK. Uses the same script id as
// SquareCardForm, so whichever runs first adds the tag and the other reuses it.
const SQUARE_JS = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox:    'https://sandbox.web.squarecdn.com/v1/square.js',
};
const SCRIPT_ID = 'square-web-payments-js';

export function loadSquareSdk(environment) {
  return new Promise((resolve, reject) => {
    if (window.Square) { resolve(window.Square); return; }
    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SQUARE_JS[environment] || SQUARE_JS.production;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => (
      window.Square ? resolve(window.Square) : reject(new Error('Square SDK loaded but did not initialise'))
    ));
    script.addEventListener('error', () => reject(new Error('Square SDK failed to load')));
  });
}
