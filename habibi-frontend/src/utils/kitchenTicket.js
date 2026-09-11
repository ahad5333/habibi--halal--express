// Kitchen ticket printing for the order-queue screens (/staff and /kitchen).
//
// Plain browser printing, so it works with whatever printer the kitchen
// computer already has: set the receipt printer as the default and turn on
// auto-print on that one device. Tickets are laid out for 80mm receipt paper
// (72mm printable) and still read fine on Letter/A4.
//
// Chrome opens a print dialog for every ticket unless it was started with
// --kiosk-printing, which sends each ticket straight to the default printer.
// The printer panel on the screen explains the one-time setup.

const AUTO_KEY = 'habibi_autoprint';          // '1' when THIS device prints new orders
const PRINTED_KEY = 'habibi_printed_orders';  // order ids this device has printed
const KEEP = 400;

// Unpaid Zelle/Cash App orders print once the counter confirms the payment;
// cancelled ones never.
const SKIP_STATUSES = new Set(['pending_verification', 'cancelled', 'refunded']);
export const isPrintable = (o) => !SKIP_STATUSES.has(o.order_status);

export function isAutoPrintOn() {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}

function readPrinted() {
  try { return JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]'); } catch { return []; }
}
function markPrinted(ids) {
  const list = [...new Set([...readPrinted(), ...ids.map(String)])].slice(-KEEP);
  try { localStorage.setItem(PRINTED_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// Turning auto-print on doesn't print the backlog already on screen -- only
// orders that arrive from now on.
export function setAutoPrint(on, currentOrders = []) {
  try {
    if (on) {
      markPrinted(currentOrders.filter(isPrintable).map(o => o.id));
      localStorage.setItem(AUTO_KEY, '1');
    } else {
      localStorage.removeItem(AUTO_KEY);
    }
  } catch { /* ignore */ }
}

// Called with every refreshed order list. Prints each order once per device,
// the first time it's seen in a printable state.
export function printNewOrders(list, opts) {
  if (!isAutoPrintOn()) return;
  const printed = new Set(readPrinted());
  const due = list.filter(o => isPrintable(o) && !printed.has(String(o.id)));
  if (due.length === 0) return;
  markPrinted(due.map(o => o.id));
  due.forEach(o => printTicket(o, opts));
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const PAYMENT_LABEL = {
  card: 'Card', paypal: 'PayPal', googlepay: 'Google Pay', applepay: 'Apple Pay',
  zelle: 'Zelle', cashapp: 'Cash App', gift_card: 'Gift card',
};

// Everything customer-typed (name, notes, instructions) is escaped: the ticket
// is written into a same-origin frame.
export function ticketHtml(order, { heading = 'Habibi Halal Express' } = {}) {
  const num = String(order.order_number || order.id || '');
  const short = num.split('-').pop();
  const method = order.table_number ? `TABLE ${order.table_number}` : (order.delivery_method || 'order').toUpperCase();
  const items = (order.items || []).map(i => `
    <div class="item">
      <span class="qty">${esc(i.quantity || i.qty || 1)}×</span>
      <span class="name">${esc(i.name || 'Item')}</span>
    </div>
    ${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}`).join('');
  const paid = order.payment_method === 'cash'
    ? '<strong>CASH — collect payment</strong>'
    : `Paid · ${esc(PAYMENT_LABEL[order.payment_method] || order.payment_method || '—')}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(short)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0; width: 72mm; font: 13px/1.35 "Courier New", ui-monospace, monospace; color: #000; }
  .c { text-align: center; }
  .head { font-weight: 700; font-size: 13px; }
  .method { font-size: 22px; font-weight: 800; letter-spacing: .06em; margin: 4px 0 0; }
  .num { font-size: 26px; font-weight: 800; margin: 2px 0; }
  .full, .small { font-size: 11px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .item { display: flex; gap: 6px; font-size: 15px; font-weight: 700; margin-top: 4px; }
  .qty { min-width: 2.2em; }
  .note { margin: 1px 0 0 2.6em; font-size: 12px; }
  .instr { font-weight: 700; }
  .row { display: flex; justify-content: space-between; }
</style></head><body>
  <div class="c head">${esc(heading)}</div>
  <div class="c method">${esc(method)}</div>
  <div class="c num">#${esc(short)}</div>
  <div class="c full">${esc(num)}</div>
  <hr>
  <div class="row small"><span>Placed</span><span>${esc(time(order.placed_at))}</span></div>
  ${order.customer_name ? `<div class="row small"><span>Customer</span><span>${esc(order.customer_name)}</span></div>` : ''}
  <hr>
  ${items || '<div class="small">No items</div>'}
  ${order.special_instructions ? `<hr><div class="instr">Note: ${esc(order.special_instructions)}</div>` : ''}
  <hr>
  <div class="row"><span>Total</span><strong>$${Number(order.total || 0).toFixed(2)}</strong></div>
  <div class="small">${paid}</div>
  <div class="c small" style="margin-top:6px">Printed ${esc(time(Date.now()))}</div>
</body></html>`;
}

// One ticket at a time: two orders arriving together print as two tickets
// rather than the second print call cancelling the first.
let queue = Promise.resolve();

export function printTicket(order, opts) {
  queue = queue.then(() => new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(ticketHtml(order, opts));
    doc.close();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => { frame.remove(); resolve(); }, 300);
    };
    frame.contentWindow.onafterprint = finish;
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* blocked: nothing to print */ }
      setTimeout(finish, 2000);
    }, 200);
  }));
  return queue;
}

export const TEST_ORDER = {
  id: 'test',
  order_number: 'HBB-TEST-PRINT1',
  delivery_method: 'pickup',
  customer_name: 'Test ticket',
  placed_at: new Date().toISOString(),
  items: [
    { qty: 2, name: 'Chicken over Rice', note: 'White sauce, extra hot sauce' },
    { qty: 1, name: 'Canned Soda' },
  ],
  special_instructions: 'This is a test print from the order screen.',
  total: 21.47,
  payment_method: 'card',
};
