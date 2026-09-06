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
// Follow-ups that only make sense against whatever was just added, e.g.
// "make that 3", "actually two", "no, 4 of those".
const FOLLOWUP_QTY_RE = /^(?:no,?\s*)?(?:make (?:that|it)|actually|change (?:that|it) to|just)\s+(\w+)/i;

const ALLERGY_DISCLAIMER =
  "For allergy or dietary-safety questions, please contact the restaurant directly so our kitchen team can confirm — I can't make that call myself.";

// ── Typo tolerance ────────────────────────────────────────────────────────────
// Customers type "shwarma", "burgur", "falafal". Bounded Levenshtein against
// menu words only -- never against arbitrary text -- so a near-miss still lands
// on a real menu item rather than falling through to "I couldn't find that".
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Allowed edit distance scales with word length: short words must match almost
// exactly (so "rice" never becomes "nice"), longer ones get more slack.
function tolerance(word) {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

// Rewrites message words that are near-misses for a distinctive menu word into
// the correct spelling, so the existing exact matcher can do its job.
function correctTypos(norm, candidates) {
  const menuWords = new Set();
  candidates.forEach(c => c.words.forEach(w => { if (w.length > 3) menuWords.add(w); }));
  if (menuWords.size === 0) return norm;

  return norm.split(' ').map(word => {
    if (word.length < 4 || menuWords.has(word)) return word;
    let best = null, bestDist = Infinity;
    for (const mw of menuWords) {
      if (Math.abs(mw.length - word.length) > 2) continue;
      const d = levenshtein(word, mw);
      if (d < bestDist) { bestDist = d; best = mw; }
    }
    return best && bestDist <= tolerance(word) ? best : word;
  }).join(' ');
}

// ── Upsell, grounded in real order history ───────────────────────────────────
// "Goes well with" is computed from what customers actually ordered alongside
// these items, never a hardcoded pairing. Returns [] when there isn't enough
// real history to say anything honest.
async function getPairings(itemNames, menu, excludeNames) {
  if (!itemNames.length) return [];
  try {
    const res = await pool.query(
      `SELECT other->>'name' AS name, COUNT(*)::int AS freq
         FROM guest_orders o,
              jsonb_array_elements(o.items) AS anchor,
              jsonb_array_elements(o.items) AS other
        WHERE o.placed_at > NOW() - INTERVAL '180 days'
          AND o.order_status NOT IN ('cancelled', 'refunded')
          AND lower(anchor->>'name') = ANY($1)
          AND lower(other->>'name') <> lower(anchor->>'name')
        GROUP BY name
        ORDER BY freq DESC
        LIMIT 4`,
      [itemNames.map(n => n.toLowerCase())]
    );
    const exclude = new Set((excludeNames || []).map(n => n.toLowerCase()));
    const wanted = res.rows
      .map(r => (r.name || '').toLowerCase())
      .filter(n => n && !exclude.has(n));
    return menu.filter(m => wanted.includes(m.name.toLowerCase())).slice(0, 3);
  } catch (_) {
    return [];
  }
}

// ── AI fallback ───────────────────────────────────────────────────────────────
// Only reached when the rule engine has nothing useful. The model is given the
// real menu and is required to answer with exact menu names; anything it names
// that isn't on the menu is dropped before it reaches the customer, so it can
// never invent a dish or a price. No key configured = feature simply stays off.
const AI_SYSTEM = `You are the Habibi Halal Express ordering assistant on a Bronx halal restaurant's website.
Be warm, brief (1-2 sentences), and never use markdown.
You may ONLY reference dishes from the menu provided. Never invent a dish, price, or claim.
Never give allergy, dietary-safety or medical advice - tell the customer to contact the restaurant instead.
Reply as JSON only: {"reply":"your text","item_names":["Exact Menu Name"]}
Put a dish in item_names only when showing or suggesting it. Use [] when none apply.`;

async function aiFallback(message, history, menu) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const menuList = menu.map(m => `${m.name} ($${parseFloat(m.price || 0).toFixed(2)})`).join('\n');
  const turns = (history || [])
    .slice(-6)
    .filter(h => h && h.text)
    .map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.text).slice(0, 500) }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ASSISTANT_AI_MODEL || 'claude-sonnet-5',
        max_tokens: 400,
        system: `${AI_SYSTEM}\n\nTODAY'S MENU:\n${menuList}`,
        messages: [...turns, { role: 'user', content: String(message).slice(0, 500) }],
      }),
    });
    clearTimeout(timeout);
    if (!r.ok) {
      console.error('[Assistant] AI fallback HTTP', r.status);
      return null;
    }
    const data = await r.json();
    const raw = (data.content || []).map(c => c.text || '').join('').trim();
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) return null;
    const parsed = JSON.parse(raw.slice(jsonStart, raw.lastIndexOf('}') + 1));
    if (!parsed || typeof parsed.reply !== 'string') return null;

    // Ground every named dish against the real menu; silently drop the rest.
    const byName = new Map(menu.map(m => [m.name.toLowerCase(), m]));
    const items = (Array.isArray(parsed.item_names) ? parsed.item_names : [])
      .map(n => byName.get(String(n).toLowerCase()))
      .filter(Boolean)
      .slice(0, 5);
    return { text: parsed.reply.slice(0, 600), items };
  } catch (err) {
    console.error('[Assistant] AI fallback failed:', err.message);
    return null;
  }
}

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
  let best = null;
  let bestScore = 0;
  for (const c of cart || []) {
    const name = normalize(c.name || '');
    if (!name) continue;
    if (norm.includes(name) || name.includes(norm)) return c;
    const words = name.split(' ').filter(w => w.length > 2);
    const score = words.filter(w => norm.includes(w)).length;
    if (score > 0 && score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function toItemPayload(m) {
  return { id: m.id, name: m.name, price: parseFloat(m.price || 0), image_url: m.image_url || null };
}

const assistantChat = async (req, res) => {
  try {
    const { message, cart, history, lastItems } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const menuRes = await pool.query(
      `SELECT id, name, price, image_url, description FROM menus WHERE is_available = TRUE AND is_active = TRUE`
    );
    const menu = menuRes.rows;
    const candidates = buildCandidates(menu);

    // Typo-corrected text is used for intent/menu matching only; the original
    // message is still what allergy detection and cart matching see.
    const norm = correctTypos(normalize(message), candidates);

    let text = '';
    let items = [];
    let actions = [];
    let suggestions = [];

    // "make that 3" -- only meaningful against whatever was just added, so it's
    // checked before anything else and skipped entirely when there's no prior
    // turn to attach it to.
    const followup = message.match(FOLLOWUP_QTY_RE);
    const followupQty = followup
      ? (NUMBER_WORDS[followup[1].toLowerCase()] ?? (/^\d{1,2}$/.test(followup[1]) ? parseInt(followup[1], 10) : null))
      : null;

    if (followupQty != null && followupQty > 0 && followupQty <= 50 && Array.isArray(lastItems) && lastItems.length > 0) {
      const target = lastItems[lastItems.length - 1];
      text = `Updated — ${followupQty}x ${target.name}.`;
      actions.push({ type: 'set_cart_qty', item: target, qty: followupQty });

    } else if (GREETING_RE.test(norm)) {
      text = "Hi! I'm the Habibi Assistant 👋 Ask me about the menu, or tell me what you'd like and I'll add it to your cart — try \"add two beef burgers\".";

    } else if (CLEAR_CART_RE.test(norm)) {
      // Checked before VIEW_CART_RE — "clear my cart" contains the substring
      // "my cart", which would otherwise match the view-cart intent instead.
      if (!cart || cart.length === 0) {
        text = 'Your cart is already empty.';
      } else {
        text = 'Are you sure you want to clear your whole cart?';
        actions.push({ type: 'confirm_clear_cart' });
      }

    } else if (VIEW_CART_RE.test(norm)) {
      text = (!cart || cart.length === 0)
        ? "Your cart is empty right now — tell me what you'd like and I'll add it!"
        : `Here's what's in your cart: ${cart.map(c => `${c.qty}x ${c.name}`).join(', ')}.`;

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
      const found = matchMenuItems(norm, candidates);
      if (found.length > 0) {
        text = found.length === 1
          ? `Added ${found[0].qty}x ${found[0].item.name} to your cart!`
          : `Added to your cart: ${found.map(f => `${f.qty}x ${f.item.name}`).join(', ')}.`;
        items = found.map(f => toItemPayload(f.item));
        actions = found.map(f => ({ type: 'add_to_cart', item: toItemPayload(f.item), qty: f.qty }));

        // What customers actually order alongside this, from real history.
        const inCart = (cart || []).map(c => c.name).concat(found.map(f => f.item.name));
        const pairs = await getPairings(found.map(f => f.item.name), menu, inCart);
        if (pairs.length) {
          suggestions = pairs.map(toItemPayload);
          text += ` Customers usually add ${pairs.map(p => p.name).join(' or ')} with that — want one?`;
        }

      } else if (TRACK_RE.test(norm)) {
        text = 'You can track your order in real-time on our tracking page — enter your order number (HAB-...) to see live updates!';

      } else if (HOURS_RE.test(norm)) {
        text = "We're open daily from 11:00 AM to 3:00 AM. 🌙";

      } else if (CATERING_RE.test(norm)) {
        text = 'We do catering! We can serve anywhere from 20 to 500+ guests. Visit our Catering page to get a free quote. 🎉';

      } else if (HALAL_RE.test(norm)) {
        text = 'Everything we serve is 100% Hand-Zabiha Halal. We prioritize purity and quality in every single dish. ✅';

      } else if (BEST_RE.test(norm)) {
        // Data-driven, not a hardcoded dish name — never claim a "best seller"
        // that isn't actually backed by real order history.
        const popRes = await pool.query(
          `SELECT item->>'name' AS item_name, COUNT(*) AS freq
           FROM guest_orders, jsonb_array_elements(items) AS item
           WHERE placed_at > NOW() - INTERVAL '90 days'
           GROUP BY item_name
           ORDER BY freq DESC
           LIMIT 8`
        );
        const popNames = new Set(popRes.rows.map(r => (r.item_name || '').toLowerCase()));
        const popular = menu.filter(m => popNames.has(m.name.toLowerCase()));
        const shown = popular.length ? popular : menu;
        text = popular.length
          ? "Here's what customers are ordering most right now: 🌟"
          : 'Here are a few customer favorites:';
        items = shown.slice(0, 5).map(toItemPayload);

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
          // Last resort: hand the open-ended question to the AI, which knows the
          // real menu and whose dish names are re-validated against it. Falls
          // back to the old canned line whenever AI isn't configured or errors,
          // so the assistant never gets worse than it was.
          const ai = ALLERGY_RE.test(message) ? null : await aiFallback(message, history, menu);
          if (ai) {
            text = ai.text;
            items = ai.items.map(toItemPayload);
          } else {
            text = "That sounds delicious! Ask me what's popular, or tell me what you'd like and I'll try to find it on our menu.";
          }
        }
      }
    }

    if (ALLERGY_RE.test(message)) {
      text = `${text} ${ALLERGY_DISCLAIMER}`.trim();
    }

    res.json({ role: 'bot', text, items, actions, suggestions });
  } catch (error) {
    console.error('[Assistant] Error:', error);
    res.status(500).json(safeError(error));
  }
};

module.exports = { assistantChat };
