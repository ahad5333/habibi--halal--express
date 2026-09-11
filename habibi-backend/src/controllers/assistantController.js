const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { getPublicOffers } = require('../utils/publicOffers');
const skills = require('../services/assistantSkills');

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
const TRACK_RE     = /\btrack\b|order status|where.?s my (?:order|food|delivery)|where is my (?:order|food|delivery)|when will my (?:order|food) (?:arrive|come|be ready)|how long (?:for|until|till) my (?:order|food)/i;
const HOURS_RE      = /\bhours?\b|\bopen\b|what time|\bclos(?:e|es|ed|ing)\b/i;
const CATERING_RE   = /catering|\bcater\b|\bevent\b|\bparty\b|\bbulk\b|\bwedding\b|\bcorporate\b/i;
const HUMAN_RE      = /\b(?:talk|speak|chat) (?:to|with) (?:a |an |the )?(?:person|human|someone|somebody|real person|manager|staff|agent|team|owner)\b|\breal person\b|\bcustomer (?:service|support)\b|\bcall (?:you|the store|the restaurant|someone)\b|\bphone number\b|\bcontact (?:you|number|info|details)\b|\bhow (?:do|can) i (?:contact|reach|call)\b|\bcomplaints?\b|\bmanager\b/i;
const DELIVERY_RE   = /\bdeliver(?:y|ies|ing|s)?\b|\bdo you (?:come|go) to\b/i;
// A question about a dish ("what comes with the chicken over rice?", "how much
// is the beef burger?") shows the dish instead of silently adding it -- unless
// the message also says to add it.
const DETAILS_RE    = /\bwhat(?: s|s| is| are)? in\b|\bcomes? with\b|\btell me (?:more )?about\b|\bdescribe\b|\bingredients?\b|\bhow (?:much|big) (?:is|are)\b|\bhow much (?:does|do|for)\b|\bprice (?:of|for|on)\b|\bcost of\b|\bdo you (?:have|sell|make|serve|guys have)\b|\bis there (?:a|an|any)\b|\bwhat(?: s|s| is) (?:the|a|an)\b|\bhow is the\b/i;
const STRONG_ADD_RE = /\badd\b|get me|give me|i.?ll (?:have|take)|\bput\b/i;
const HALAL_RE      = /\bhalal\b/i;
const BEST_RE        = /\bbest\b|recommend|popular/i;
const VEGAN_RE       = /vegan|vegetarian|meatless/i;
const BURGER_RE      = /burger/i;
const SPICY_RE       = /spicy|\bheat\b|\bhot\b/i;
const ADD_CUE_RE     = /\badd\b|\border\b|\bwant\b|get me|i.?ll have|give me|i want/i;
// "any deals?", "got a promo code", "discounts today" -- but not "do you offer
// catering?": the verb "offer" only counts after any/an/special/current.
const DEALS_RE = /\bdeals?\b|\boffers\b|\b(?:any|an|special|current) offer\b|\bdiscounts?\b|\bcoupons?\b|\bpromos?\b|\bpromotions?\b|\bspecials\b|\bon sale\b|\bsavings\b/;
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

// A dish card for "what comes with ...": the menu's own description, never an
// allergen or dietary claim (those still go to the restaurant).
function toDetailPayload(m) {
  return { ...toItemPayload(m), description: (m.description || '').trim(), category: m.category || null };
}

const fmtBudget = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
const fmtMoney = (n) => `$${Number(n).toFixed(2)}`;

function cateringForm(lower, guests) {
  return {
    text: "We'd love to cater your event! 🎉 We cater for 10 to 500+ guests. Fill this in and our team will email you a quote within 24–48 hours:",
    form: {
      type: 'catering',
      guests: guests || skills.parseGuests(lower),
      date: skills.parseEventDate(lower),
    },
  };
}

// ── Deals ─────────────────────────────────────────────────────────────────────
// Same list the public Offers page shows (utils/publicOffers), so the assistant
// can never read out a code the page wouldn't -- personal coupons included.
const DEALS_SHOWN = 5;
const OFFERS_CTA = { label: 'See all offers', to: '/offers' };

function offerTerms(o) {
  const parts = [];
  if (o.min_order > 0) parts.push(`Min. order $${Number(o.min_order).toFixed(2)}`);
  if (o.first_order_only) parts.push('First order only');
  if (o.expires_at) {
    parts.push(`Ends ${new Date(o.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`);
  }
  return parts.join(' · ');
}

async function dealsReply() {
  const offers = await getPublicOffers(DEALS_SHOWN + 1);
  if (offers.length === 0) {
    return { text: "There aren't any deals running right now. New ones show up on our Offers page first.", offers: [] };
  }
  const shown = offers.slice(0, DEALS_SHOWN);
  let text;
  if (offers.length > DEALS_SHOWN) text = 'Here are some of the deals running right now 🎉 Enter a code at checkout:';
  else if (shown.length === 1) text = "Here's the deal running right now 🎉 Enter the code at checkout:";
  else text = 'Here are the deals running right now 🎉 Enter a code at checkout:';
  return {
    text,
    offers: shown.map(o => ({ code: o.code, title: o.title, value: o.value_display, terms: offerTerms(o) })),
  };
}

// ── Question log (CPanel → AI Assistant) ─────────────────────────────────────
// What customers ask, so the owner can see what the assistant couldn't answer.
// Anonymous by design: no account, IP or session is stored, and emails and
// phone-length digit runs are masked before the text is saved. Kept 180 days
// (cleanup cron in app.js). A failed insert never affects the reply.
const LOG_RETENTION_DAYS = 180;

function redactForLog(s) {
  return String(s || '')
    .slice(0, 500)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, m => (m.replace(/\D/g, '').length >= 7 ? '[number]' : m))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function logQuery({ message, intent, outcome, inputMode, itemNames }) {
  const text = redactForLog(message);
  if (!text) return;
  pool.query(
    `INSERT INTO assistant_queries (message, intent, outcome, input_mode, item_names)
     VALUES ($1, $2, $3, $4, $5)`,
    [text, intent, outcome, inputMode, (itemNames || []).slice(0, 5)]
  ).catch(err => console.error('[Assistant] Question log failed:', err.message));
}

const assistantChat = async (req, res) => {
  try {
    const { message, cart, history, lastItems } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const inputMode = req.body.inputMode === 'voice' ? 'voice' : 'text';

    const menuRes = await pool.query(
      `SELECT id, name, price, image_url, description, category, is_featured, sort_order
         FROM menus WHERE is_available = TRUE AND is_active = TRUE`
    );
    const menu = menuRes.rows;
    const candidates = buildCandidates(menu);

    // Typo-corrected text is used for intent/menu matching only; the original
    // message is still what allergy detection and cart matching see.
    const norm = correctTypos(normalize(message), candidates);
    // Topic words are checked on the uncorrected text: the typo corrector only
    // knows menu words, so it could "fix" deals -> meals if a dish had that word.
    const rawNorm = normalize(message);
    const lower = message.toLowerCase(); // keeps "$" for budgets
    const asksDeals = DEALS_RE.test(rawNorm);
    const asksHuman = HUMAN_RE.test(rawNorm);
    const orderNo = (message.match(skills.ORDER_NO_RE) || [])[0] || null;
    const people = skills.parsePeople(lower);
    const budget = skills.parseBudget(lower);
    const mealCue = skills.MEAL_CUE_RE.test(lower);
    // "party of 4" is dinner; "birthday party for 40" is catering.
    const asksCatering = CATERING_RE.test(rawNorm) && !(people && people < 10);
    // Answering "send me your street address": the next message is the address
    // even without "deliver" in it.
    const lastBot = [...(Array.isArray(history) ? history : [])].reverse().find(h => h && h.role === 'bot');
    const awaitingAddress = String(lastBot?.text || '').toLowerCase().includes(skills.DELIVERY_ASK_MARK);
    const address = skills.extractAddress(message)
      || (awaitingAddress && /\d/.test(message) && message.length < 150 ? message.trim() : null);
    const asksDelivery = DELIVERY_RE.test(rawNorm);

    let text = '';
    let items = [];
    let actions = [];
    let suggestions = [];
    let offers = null;
    let details = null;
    let meal = null;
    let contact = null;
    let form = null;
    let cta = null;
    // For the CPanel question log: what was asked, and whether it got an answer.
    let intent = 'unanswered';
    let outcome = 'answered';
    let logText = message;

    // A greeting only when there's nothing else in the message: "hi, do you
    // deliver to 123 Main St?" is a delivery question with a hello in front.
    const isJustGreeting = GREETING_RE.test(norm) && !(asksDeals || asksHuman || orderNo || mealCue || budget
      || asksCatering || asksDelivery || address || TRACK_RE.test(norm) || HOURS_RE.test(norm) || ADD_CUE_RE.test(norm));

    // "make that 3" -- only meaningful against whatever was just added, so it's
    // checked before anything else and skipped entirely when there's no prior
    // turn to attach it to.
    const followup = message.match(FOLLOWUP_QTY_RE);
    const followupQty = followup
      ? (NUMBER_WORDS[followup[1].toLowerCase()] ?? (/^\d{1,2}$/.test(followup[1]) ? parseInt(followup[1], 10) : null))
      : null;

    if (followupQty != null && followupQty > 0 && followupQty <= 50 && Array.isArray(lastItems) && lastItems.length > 0) {
      const target = lastItems[lastItems.length - 1];
      intent = 'change_quantity';
      text = `Updated — ${followupQty}x ${target.name}.`;
      actions.push({ type: 'set_cart_qty', item: target, qty: followupQty });

    } else if (orderNo) {
      // An order number anywhere in the message is a tracking question.
      intent = 'track_order';
      const t = await skills.trackReply(orderNo);
      text = t.text;
      cta = t.cta || null;
      if (!t.found) outcome = 'unanswered';

    } else if (isJustGreeting) {
      intent = 'greeting';
      text = "Hi! I'm Habibi, your AI ordering assistant 👋 I can find dishes and add them to your cart, show today's deals, check delivery to your address, track your order, or build a meal for your group — try \"feed 4 under $50\".";

    } else if (CLEAR_CART_RE.test(norm)) {
      intent = 'clear_cart';
      // Checked before VIEW_CART_RE — "clear my cart" contains the substring
      // "my cart", which would otherwise match the view-cart intent instead.
      if (!cart || cart.length === 0) {
        text = 'Your cart is already empty.';
      } else {
        text = 'Are you sure you want to clear your whole cart?';
        actions.push({ type: 'confirm_clear_cart' });
      }

    } else if (VIEW_CART_RE.test(norm)) {
      intent = 'view_cart';
      text = (!cart || cart.length === 0)
        ? "Your cart is empty right now — tell me what you'd like and I'll add it!"
        : `Here's what's in your cart: ${cart.map(c => `${c.qty}x ${c.name}`).join(', ')}.`;

    } else if (CHECKOUT_RE.test(norm)) {
      intent = 'checkout';
      if (!cart || cart.length === 0) {
        text = "Your cart's empty — add something first and I'll take you to checkout!";
      } else {
        text = 'Heading to checkout now!';
        actions.push({ type: 'navigate', to: '/checkout' });
      }

    } else if (REMOVE_RE.test(norm)) {
      intent = 'remove_item';
      const found = matchCartItem(message, cart);
      if (found) {
        text = `Removed ${found.name} from your cart.`;
        actions.push({ type: 'remove_from_cart', cartKey: found.cartKey ?? found.id });
      } else {
        outcome = 'unanswered';
        text = "I couldn't find that in your cart — want to tell me exactly what to remove?";
      }

    } else if (asksHuman) {
      intent = 'contact';
      ({ text, contact } = await skills.contactReply());

    } else if (asksDeals && !ADD_CUE_RE.test(norm)) {
      // Ahead of menu matching so "any deals on burgers?" answers the question
      // instead of adding a burger. With an order cue ("add the ... deal") the
      // menu gets first say, and the deals check runs again below if nothing
      // on the menu matched.
      intent = 'deals';
      ({ text, offers } = await dealsReply());

    } else if (asksCatering) {
      intent = 'catering';
      ({ text, form } = cateringForm(lower, people));

    } else if (mealCue) {
      intent = 'meal_builder';
      if (!people) {
        text = 'Happy to build a meal! How many people, and what budget? Try "feed 4 under $50".';
      } else if (people > skills.MEAL_MAX_PEOPLE) {
        // Past a dozen it's a catering order, which has its own pricing.
        intent = 'catering';
        ({ text, form } = cateringForm(lower, people));
      } else {
        const built = skills.buildMeal(menu, people, budget, skills.categoryFilter(lower));
        if (!built) {
          outcome = 'unanswered';
          text = "I couldn't put a meal together from the menu right now — have a look at the full menu page.";
        } else {
          const who = people === 1 ? 'one' : people;
          const total = fmtMoney(built.total);
          if (built.tight) text = `${fmtBudget(budget)} is a little tight for ${who} — the lowest I can do is ${total} before tax and delivery:`;
          else if (budget) text = `Here's a meal for ${who} under ${fmtBudget(budget)} — ${total} before tax and delivery:`;
          else text = `Here's a meal for ${who} — ${total} before tax and delivery:`;
          meal = { people, budget, total: built.total, lines: built.lines.map(l => ({ ...toItemPayload(l.item), qty: l.qty })) };
        }
      }

    } else if (budget && !STRONG_ADD_RE.test(norm)) {
      // "what can I get under $10?" -- dishes within the budget, best first.
      intent = 'budget_browse';
      const cat = skills.categoryFilter(lower);
      const within = skills.pickVariety(skills.rankedMains(menu, cat).filter(m => parseFloat(m.price) <= budget), 5);
      if (within.length) {
        text = `Here's what you can get for ${fmtBudget(budget)} or less:`;
        items = within.map(toItemPayload);
      } else {
        outcome = 'unanswered';
        text = `Nothing${cat ? ' like that' : ''} comes in under ${fmtBudget(budget)}, sorry! Try a slightly higher budget.`;
      }

    } else if (TRACK_RE.test(norm)) {
      intent = 'track_order';
      text = skills.TRACK_ASK;
      cta = { label: 'Open order tracking', to: '/order-tracking' };

    } else if (address && (asksDelivery || awaitingAddress || !ADD_CUE_RE.test(norm))) {
      intent = 'delivery_check';
      // The address itself stays out of the CPanel question log.
      logText = message.replace(address, '[address]');
      const d = await skills.deliveryReply(address);
      text = d.text;
      if (!d.ok) outcome = 'unanswered';

    } else if (asksDelivery) {
      intent = 'delivery_check';
      text = skills.DELIVERY_ASK;

    } else {
      const found = matchMenuItems(norm, candidates);
      if (found.length > 0 && DETAILS_RE.test(norm) && !STRONG_ADD_RE.test(norm)) {
        intent = 'dish_details';
        details = found.slice(0, 2).map(f => toDetailPayload(f.item));
        text = details.length === 1 ? `Here's the ${details[0].name}:` : "Here's what I found:";
      } else if (found.length > 0) {
        intent = 'add_to_cart';
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

      } else if (asksDeals) {
        // "I want a deal" -- had an order cue, but nothing on the menu matched.
        intent = 'deals';
        ({ text, offers } = await dealsReply());

      } else if (HOURS_RE.test(norm)) {
        intent = 'hours';
        text = await skills.hoursReply();

      } else if (HALAL_RE.test(norm)) {
        intent = 'halal';
        text = 'Everything we serve is 100% Hand-Zabiha Halal. We prioritize purity and quality in every single dish. ✅';

      } else if (BEST_RE.test(norm)) {
        intent = 'popular';
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
        intent = 'vegetarian';
        const veg = menu.filter(m =>
          (m.description || '').toLowerCase().includes('vegan') ||
          (m.description || '').toLowerCase().includes('vegetarian') ||
          m.name.toLowerCase().includes('falafel')
        );
        text = 'We have great vegetarian options! Our Falafel is a customer favorite.';
        items = veg.slice(0, 5).map(toItemPayload);

      } else if (BURGER_RE.test(norm)) {
        intent = 'burgers';
        const burgers = menu.filter(m => m.name.toLowerCase().includes('burger'));
        text = burgers.length ? 'We have some massive burgers! Check these out:' : 'Check out our Sandwiches and Gyros — equally satisfying!';
        items = burgers.slice(0, 5).map(toItemPayload);

      } else if (SPICY_RE.test(norm)) {
        intent = 'spicy';
        const spicy = menu.filter(m =>
          (m.description || '').toLowerCase().includes('spicy') ||
          m.name.toLowerCase().includes('spicy') ||
          (m.description || '').toLowerCase().includes('hot')
        );
        text = spicy.length ? 'Looking for some heat? 🔥 Here are some spicy favorites:' : 'We can make your order spicy! Just add a note at checkout.';
        items = spicy.slice(0, 5).map(toItemPayload);

      } else if (ADD_CUE_RE.test(norm)) {
        const guess = menu.filter(m => normalize(m.name).split(' ').some(w => w.length > 3 && norm.includes(w)));
        if (guess.length) {
          intent = 'did_you_mean';
          outcome = 'guessed';
          text = "I couldn't quite match that to a menu item — did you mean one of these?";
        } else {
          intent = 'not_on_menu';
          outcome = 'unanswered';
          text = "I couldn't find that on our menu — want to check out the full menu page?";
        }
        items = guess.slice(0, 5).map(toItemPayload);

      } else {
        const searchMatch = menu.filter(m =>
          m.name.toLowerCase().includes(norm) || (m.description || '').toLowerCase().includes(norm)
        );
        if (searchMatch.length > 0) {
          intent = 'menu_search';
          text = `I found some items matching "${message}":`;
          items = searchMatch.slice(0, 5).map(toItemPayload);
        } else {
          // Last resort: hand the open-ended question to the AI, which knows the
          // real menu and whose dish names are re-validated against it. Falls
          // back to the old canned line whenever AI isn't configured or errors,
          // so the assistant never gets worse than it was.
          const ai = ALLERGY_RE.test(message) ? null : await aiFallback(message, history, menu);
          if (ai) {
            intent = 'ai_reply';
            text = ai.text;
            items = ai.items.map(toItemPayload);
          } else {
            intent = 'unanswered';
            outcome = 'unanswered';
            text = "That sounds delicious! Ask me what's popular, or tell me what you'd like and I'll try to find it on our menu.";
          }
        }
      }
    }

    if (ALLERGY_RE.test(message)) {
      text = `${text} ${ALLERGY_DISCLAIMER}`.trim();
    }

    const shownNames = [...items, ...(details || []), ...(meal?.lines || [])].map(i => i.name);
    logQuery({ message: logText, intent, outcome, inputMode, itemNames: shownNames });

    const reply = { role: 'bot', text, items, actions, suggestions };
    if (offers) {
      reply.offers = offers;
      reply.cta = OFFERS_CTA;
    }
    if (cta) reply.cta = cta;
    if (details) reply.details = details;
    if (meal) reply.meal = meal;
    if (contact) reply.contact = contact;
    if (form) reply.form = form;
    res.json(reply);
  } catch (error) {
    console.error('[Assistant] Error:', error);
    res.status(500).json(safeError(error));
  }
};

// ── CPanel: GET /api/admin/assistant/insights?days=30 ─────────────────────────
// What customers ask the assistant, which topics come up, which dishes they ask
// for by name, and -- the point of the page -- what it couldn't answer, grouped
// so the same question typed ten ways shows up once with a count.
const INSIGHT_RANGES = [7, 30, 90];

const getAssistantInsights = async (req, res) => {
  try {
    const days = INSIGHT_RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const inRange = `created_at > NOW() - make_interval(days => $1::int)`;

    const [summary, topics, gaps, dishes, recent] = await Promise.all([
      pool.query(`
        SELECT count(*)::int                                          AS total,
               count(*) FILTER (WHERE outcome = 'answered')::int      AS answered,
               count(*) FILTER (WHERE outcome = 'guessed')::int       AS guessed,
               count(*) FILTER (WHERE outcome = 'unanswered')::int    AS unanswered,
               count(*) FILTER (WHERE input_mode = 'voice')::int      AS voice
          FROM assistant_queries WHERE ${inRange}`, [days]),
      pool.query(`
        SELECT intent, count(*)::int AS times
          FROM assistant_queries WHERE ${inRange}
         GROUP BY intent ORDER BY times DESC`, [days]),
      // Grouped on a punctuation- and case-free key; shown with the most recent
      // wording, and (for guesses) the dishes the assistant offered instead.
      pool.query(`
        WITH g AS (
          SELECT message, outcome, intent, item_names, created_at,
                 trim(regexp_replace(lower(message), '[^a-z0-9]+', ' ', 'g')) AS qkey
            FROM assistant_queries
           WHERE ${inRange} AND outcome <> 'answered'
        )
        SELECT l.message AS question, q.times, q.last_asked, l.outcome, l.intent, l.item_names
          FROM (SELECT qkey, count(*)::int AS times, max(created_at) AS last_asked
                  FROM g GROUP BY qkey) q
          CROSS JOIN LATERAL (
            SELECT message, outcome, intent, item_names
              FROM g WHERE g.qkey = q.qkey
             ORDER BY created_at DESC LIMIT 1
          ) l
         ORDER BY q.times DESC, q.last_asked DESC
         LIMIT 50`, [days]),
      // Only messages where the customer named the dish themselves: ordering it
      // or searching for it. Lists the assistant chose (popular, spicy...) would
      // just echo its own suggestions back.
      pool.query(`
        SELECT name, count(*)::int AS times
          FROM assistant_queries, unnest(item_names) AS name
         WHERE ${inRange} AND intent IN ('add_to_cart', 'menu_search', 'dish_details')
         GROUP BY name ORDER BY times DESC LIMIT 10`, [days]),
      pool.query(`
        SELECT id, message, intent, outcome, input_mode, created_at
          FROM assistant_queries WHERE ${inRange}
         ORDER BY created_at DESC LIMIT 50`, [days]),
    ]);

    res.json({
      days,
      retention_days: LOG_RETENTION_DAYS,
      summary: summary.rows[0],
      topics: topics.rows,
      needs_attention: gaps.rows,
      top_dishes: dishes.rows,
      recent: recent.rows,
    });
  } catch (error) {
    console.error('[Assistant] Insights error:', error);
    res.status(500).json(safeError(error));
  }
};

module.exports = { assistantChat, getAssistantInsights };
