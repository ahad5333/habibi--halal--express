const safeError = require('../utils/safeError');
const pool = require('../config/db');

// ── Habibi Assistant ──────────────────────────────────────────────────────────
// Rule-based conversational ordering — no external AI API. Every menu match is
// grounded against live `menus` rows; the bot never fabricates an item or
// price. Allergy/dietary-safety language never gets a safety claim from here —
// it always gets redirected to the restaurant instead (see project directive).

const NUMBER_WORDS = {
  a: 1, an: 1, single: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, couple: 2, few: 3, dozen: 12,
};

const STOPWORDS = new Set(['the', 'and', 'with', 'a', 'an', 'of', 'in', 'on', 'for', 'to']);

const ALLERGY_RE   = /\ballerg|\bgluten|\bceliac|\bcoeliac|\bnut\b|peanut|tree nut|shellfish|dairy.?free|\blactose|anaphyla|intoleran/i;
const GREETING_RE  = /^(hi|hey|hello|yo|sup)\b|\bhelp\b|what can you do/i;
const VIEW_CART_RE = /what.?s in my cart|show (my )?(cart|order)|my cart/i;
const CLEAR_CART_RE = /clear (my )?cart|empty (my )?cart|start over|remove everything/i;
const CHECKOUT_RE  = /\bcheckout\b|place (my )?order|that.?s all|i.?m done|ready to (pay|order|checkout)/i;
const REMOVE_RE    = /\bremove\b|take off|no more|\bdelete\b/i;
const TRACK_RE     = /\btrack\b|order status|where.?s my order/i;
const HOURS_RE      = /\bhours?\b|\bopen\b|what time/i;
const CATERING_RE   = /catering|\bevent\b|\bparty\b|\bbulk\b/i;
const HALAL_RE      = /\bhalal\b/i;
const BEST_RE        = /\bbest\b|recommend|popular/i;
const VEGAN_RE       = /vegan|vegetarian|meatless/i;
const BURGER_RE      = /burger/i;
const SPICY_RE       = /spicy|\bheat\b|\bhot\b/i;
const ADD_CUE_RE     = /\badd\b|\border\b|\bwant\b|get me|i.?ll have|give me|i want/i;

const ALLERGY_DISCLAIMER =
  "For allergy or dietary-safety questions, please contact the restaurant directly so our kitchen team can confirm — I can't make that call myself.";

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function singularize(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && (w.endsWith('shes') || w.endsWith('ches') || w.endsWith('xes'))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function singularizePhrase(norm) {
  return norm.split(' ').map(singularize).join(' ');
}

// Longest/most-specific menu names are tried first so e.g. "Chicken Shawarma
// Platter" is matched whole rather than a shorter unrelated name stealing part
// of the phrase.
function buildCandidates(menu) {
  return menu
    .map(m => {
      const norm = normalize(m.name);
      const words = norm.split(' ').filter(w => w && !STOPWORDS.has(w));
      return { item: m, norm, singular: singularizePhrase(norm), words };
    })
    .filter(c => c.norm.length > 0)
    .sort((a, b) => b.norm.length - a.norm.length);
}

// Last quantity token found in a text window; defaults to 1.
function extractQuantity(windowText) {
  const digitMatch = windowText.match(/(\d{1,2})(?!.*\d)/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n > 0 && n <= 50) return n;
  }
  const words = windowText.trim().split(' ');
  for (let i = words.length - 1; i >= 0; i--) {
    if (NUMBER_WORDS[words[i]] != null) return NUMBER_WORDS[words[i]];
  }
  return 1;
}

// Finds menu-item mentions in a message. Candidates are tried longest-name
// first and claim their character span so a shorter/generic name can't
// re-match text already attributed to a more specific item.
function matchMenuItems(message, candidates) {
  const norm = normalize(message);
  const singularMsg = singularizePhrase(norm);
  const claimed = new Array(norm.length).fill(false);
  const matches = [];

  const claim = (start, len) => { for (let i = start; i < start + len; i++) claimed[i] = true; };
  const isFree = (start, len) => {
    for (let i = start; i < start + len; i++) if (claimed[i]) return false;
    return true;
  };

  for (const c of candidates) {
    let idx = norm.indexOf(c.norm);
    let matchedLen = c.norm.length;
    if (idx === -1 || !isFree(idx, matchedLen)) {
      const singIdx = singularMsg.indexOf(c.singular);
      if (singIdx !== -1 && isFree(singIdx, c.singular.length)) {
        idx = singIdx;
        matchedLen = c.singular.length;
      } else {
        idx = -1;
      }
    }
    if (idx === -1 && c.words.length > 0 && c.words.length <= 4) {
      const positions = c.words.map(w => {
        let p = norm.indexOf(w);
        while (p !== -1 && claimed[p]) p = norm.indexOf(w, p + 1);
        return p;
      });
      if (positions.every(p => p !== -1)) {
        positions.forEach((p, i) => claim(p, c.words[i].length));
        matches.push({ item: c.item, start: Math.min(...positions) });
        continue;
      }
    }
    if (idx !== -1) {
      claim(idx, matchedLen);
      matches.push({ item: c.item, start: idx });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  let cursor = 0;
  return matches.map(m => {
    const qty = extractQuantity(norm.slice(cursor, m.start));
    cursor = m.start;
    return { item: m.item, qty };
  });
}

// Matches against the customer's own cart snapshot (sent by the frontend each
// turn) — used for "remove the coke", never against the full menu.
function matchCartItem(message, cart) {
  const norm = normalize(message);
  for (const c of cart || []) {
    const name = normalize(c.name || '');
    if (!name) continue;
    if (norm.includes(name) || name.includes(norm)) return c;
    const words = name.split(' ').filter(w => w.length > 2);
    if (words.length && words.every(w => norm.includes(w))) return c;
  }
  return null;
}

function toItemPayload(m) {
  return { id: m.id, name: m.name, price: parseFloat(m.price || 0), image_url: m.image_url || null };
}

const assistantChat = async (req, res) => {
  try {
    const { message, cart } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const norm = normalize(message);

    const menuRes = await pool.query(
      `SELECT id, name, price, image_url, description FROM menus WHERE is_available = TRUE AND is_active = TRUE`
    );
    const menu = menuRes.rows;
    const candidates = buildCandidates(menu);

    let text = '';
    let items = [];
    let actions = [];

    if (GREETING_RE.test(norm)) {
      text = "Hi! I'm the Habibi Assistant 👋 Ask me about the menu, or tell me what you'd like and I'll add it to your cart — try \"add two lamb platters\".";

    } else if (VIEW_CART_RE.test(norm)) {
      text = (!cart || cart.length === 0)
        ? "Your cart is empty right now — tell me what you'd like and I'll add it!"
        : `Here's what's in your cart: ${cart.map(c => `${c.qty}x ${c.name}`).join(', ')}.`;

    } else if (CLEAR_CART_RE.test(norm)) {
      if (!cart || cart.length === 0) {
        text = 'Your cart is already empty.';
      } else {
        text = 'Are you sure you want to clear your whole cart?';
        actions.push({ type: 'confirm_clear_cart' });
      }

    } else if (CHECKOUT_RE.test(norm)) {
      if (!cart || cart.length === 0) {
        text = "Your cart's empty — add something first and I'll take you to checkout!";
      } else {
        text = 'Heading to checkout now!';
        actions.push({ type: 'navigate', to: '/checkout' });
      }

    } else if (REMOVE_RE.test(norm)) {
      const found = matchCartItem(message, cart);
      if (found) {
        text = `Removed ${found.name} from your cart.`;
        actions.push({ type: 'remove_from_cart', cartKey: found.cartKey ?? found.id });
      } else {
        text = "I couldn't find that in your cart — want to tell me exactly what to remove?";
      }

    } else {
      const found = matchMenuItems(message, candidates);
      if (found.length > 0) {
        text = found.length === 1
          ? `Added ${found[0].qty}x ${found[0].item.name} to your cart!`
          : `Added to your cart: ${found.map(f => `${f.qty}x ${f.item.name}`).join(', ')}.`;
        items = found.map(f => toItemPayload(f.item));
        actions = found.map(f => ({ type: 'add_to_cart', item: toItemPayload(f.item), qty: f.qty }));

      } else if (TRACK_RE.test(norm)) {
        text = 'You can track your order in real-time on our tracking page — enter your order number (HAB-...) to see live updates!';

      } else if (HOURS_RE.test(norm)) {
        text = "We're open daily from 11:00 AM to 3:00 AM. 🌙";

      } else if (CATERING_RE.test(norm)) {
        text = 'We do catering! We can serve anywhere from 20 to 500+ guests. Visit our Catering page to get a free quote. 🎉';

      } else if (HALAL_RE.test(norm)) {
        text = 'Everything we serve is 100% Hand-Zabiha Halal. We prioritize purity and quality in every single dish. ✅';

      } else if (BEST_RE.test(norm)) {
        const plat = menu.filter(m => m.name.toLowerCase().includes('platter'));
        text = "If it's your first time, you MUST try the Mixed Platter. It's what made us famous! 🌟";
        items = plat.slice(0, 5).map(toItemPayload);

      } else if (VEGAN_RE.test(norm)) {
        const veg = menu.filter(m =>
          (m.description || '').toLowerCase().includes('vegan') ||
          (m.description || '').toLowerCase().includes('vegetarian') ||
          m.name.toLowerCase().includes('falafel')
        );
        text = 'We have great vegetarian options! Our Falafel is a customer favorite.';
        items = veg.slice(0, 5).map(toItemPayload);

      } else if (BURGER_RE.test(norm)) {
        const burgers = menu.filter(m => m.name.toLowerCase().includes('burger'));
        text = burgers.length ? 'We have some massive burgers! Check these out:' : 'Check out our Sandwiches and Gyros — equally satisfying!';
        items = burgers.slice(0, 5).map(toItemPayload);

      } else if (SPICY_RE.test(norm)) {
        const spicy = menu.filter(m =>
          (m.description || '').toLowerCase().includes('spicy') ||
          m.name.toLowerCase().includes('spicy') ||
          (m.description || '').toLowerCase().includes('hot')
        );
        text = spicy.length ? 'Looking for some heat? 🔥 Here are some spicy favorites:' : 'We can make your order spicy! Just add a note at checkout.';
        items = spicy.slice(0, 5).map(toItemPayload);

      } else if (ADD_CUE_RE.test(norm)) {
        const guess = menu.filter(m => normalize(m.name).split(' ').some(w => w.length > 3 && norm.includes(w)));
        text = guess.length
          ? "I couldn't quite match that to a menu item — did you mean one of these?"
          : "I couldn't find that on our menu — want to check out the full menu page?";
        items = guess.slice(0, 5).map(toItemPayload);

      } else {
        const searchMatch = menu.filter(m =>
          m.name.toLowerCase().includes(norm) || (m.description || '').toLowerCase().includes(norm)
        );
        if (searchMatch.length > 0) {
          text = `I found some items matching "${message}":`;
          items = searchMatch.slice(0, 5).map(toItemPayload);
        } else {
          text = "That sounds delicious! I'd recommend checking out our Legendary Platters. Can I help you with anything else?";
        }
      }
    }

    if (ALLERGY_RE.test(message)) {
      text = `${text} ${ALLERGY_DISCLAIMER}`.trim();
    }

    res.json({ role: 'bot', text, items, actions });
  } catch (error) {
    console.error('[Assistant] Error:', error);
    res.status(500).json(safeError(error));
  }
};

module.exports = { assistantChat };
