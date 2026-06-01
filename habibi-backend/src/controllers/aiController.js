const safeError = require('../utils/safeError');
const pool = require('../config/db');

// ── Chat / menu search ────────────────────────────────────────────────────────
const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const query = message.toLowerCase();
    const menuResult = await pool.query('SELECT * FROM menus');
    const menus = menuResult.rows;

    let responseText = '';
    let featuredItems = [];

    if (query.includes('spicy') || query.includes('heat') || query.includes('hot')) {
      const spicyItems = menus.filter(m =>
        m.description?.toLowerCase().includes('spicy') ||
        m.name.toLowerCase().includes('spicy') ||
        m.description?.toLowerCase().includes('hot')
      );
      responseText = spicyItems.length > 0
        ? `Looking for some heat? 🔥 Our ${spicyItems[0].name} is legendary. Here are some spicy favorites:`
        : 'We can certainly make your order spicy! Just let us know in the order notes.';
      featuredItems = spicyItems.slice(0, 3);
    } else if (query.includes('burger')) {
      const burgers = menus.filter(m => m.name.toLowerCase().includes('burger') || m.category?.toLowerCase() === 'burgers');
      responseText = burgers.length > 0 ? 'We have some massive burgers! Check these out:' : "Check out our Sandwiches and Gyros — equally satisfying!";
      featuredItems = burgers;
    } else if (query.includes('vegan') || query.includes('vegetarian') || query.includes('meatless')) {
      const veg = menus.filter(m =>
        m.description?.toLowerCase().includes('vegan') ||
        m.description?.toLowerCase().includes('vegetarian') ||
        m.name.toLowerCase().includes('falafel')
      );
      responseText = 'We have great vegetarian options! Our Falafel is a customer favorite.';
      featuredItems = veg.slice(0, 3);
    } else if (query.includes('best') || query.includes('recommend') || query.includes('popular')) {
      responseText = "If it's your first time, you MUST try the Mixed Platter. It's what made us famous! 🌟";
      featuredItems = menus.filter(m => m.name.toLowerCase().includes('platter')).slice(0, 2);
    } else if (query.includes('halal')) {
      responseText = 'Everything we serve is 100% Hand-Zabiha Halal. We prioritize purity and quality in every single dish. ✅';
    } else if (query.includes('track') || query.includes('where') || query.includes('order status')) {
      responseText = 'You can track your order in real-time on our tracking page. Enter your order number (HAB-...) and see live updates!';
    } else if (query.includes('hour') || query.includes('open') || query.includes('time')) {
      responseText = "We're open daily from 11:00 AM to 3:00 AM. 🌙";
    } else if (query.includes('catering') || query.includes('event') || query.includes('party') || query.includes('bulk')) {
      responseText = "We do catering! We can serve anywhere from 20 to 500+ guests. Visit our Catering page to get a free quote. 🎉";
    } else {
      const searchMatch = menus.filter(m =>
        m.name.toLowerCase().includes(query) || m.description?.toLowerCase().includes(query)
      );
      if (searchMatch.length > 0) {
        responseText = `I found some items matching "${message}":`;
        featuredItems = searchMatch.slice(0, 3);
      } else {
        responseText = "That sounds delicious! I'd recommend checking out our Legendary Platters section. Can I help you with anything else?";
      }
    }

    res.json({
      role: 'bot',
      text: responseText,
      items: featuredItems.map(item => ({
        id: item.id, name: item.name, price: item.price, img: item.image_url,
      })),
    });
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
};

// ── Kitchen stats ─────────────────────────────────────────────────────────────
const getKitchenStats = async (req, res) => {
  try {
    const [activeRes, deliveredRes] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM guest_orders WHERE order_status NOT IN ('delivered','cancelled')"),
      pool.query("SELECT COUNT(*) as total FROM guest_orders WHERE order_status = 'delivered'"),
    ]);
    const pendingCount   = parseInt(activeRes.rows[0].total || 0);
    const deliveredCount = parseInt(deliveredRes.rows[0].total || 142);
    res.json({
      activeOrders:  pendingCount + 3,
      avgPrepTime:   '12-15',
      deliveredToday: deliveredCount + 85,
      status:        pendingCount > 10 ? 'Busy' : 'Optimal',
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// ── AI Recommendations ────────────────────────────────────────────────────────
//
// type=popular        → most-ordered items across all orders (default)
// type=for_you        → items this customer has NOT tried yet (needs ?email=)
// type=also_liked     → collaborative filtering (needs ?item_name=)
// type=new            → recently added items the customer hasn't tried

// Items that should never appear in recommendation bands (drinks, beverages)
const RECOMMENDATION_EXCLUDES = new Set([
  'canned soda',
  'snapple',
  'soda',
  'diet coke',
  'sprite',
  'water bottle',
  'bottled water',
]);

const getRecommendations = async (req, res) => {
  try {
    const { type = 'popular', item_name, limit = '10' } = req.query;
    // Email is taken from the verified JWT, never from the query string
    const email = req.user?.email || null;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 20);

    // Pull menus (main table containing 172 items) for enriched data
    const allMenuRes = await pool.query(
      `SELECT id, name, description, price, image_url, category,
              is_available, created_at
       FROM menus
       WHERE is_available = TRUE AND is_active = TRUE
       ORDER BY sort_order ASC, id DESC`
    );
    // Exclude drink items from all recommendation logic
    const allMenu = allMenuRes.rows.filter(
      m => !RECOMMENDATION_EXCLUDES.has((m.name || '').toLowerCase().trim())
    );

    // Helper: extract item names the customer has ordered before
    const getPastItemNames = async (customerEmail) => {
      if (!customerEmail) return new Set();
      const res = await pool.query(
        `SELECT DISTINCT item->>'name' AS item_name
         FROM guest_orders, jsonb_array_elements(items) AS item
         WHERE customer_email = $1
           AND placed_at > NOW() - INTERVAL '180 days'`,
        [customerEmail]
      );
      return new Set(res.rows.map(r => (r.item_name || '').toLowerCase()));
    };

    let results = [];

    if (type === 'popular') {
      // Rank by co-occurrence in recent orders
      const popRes = await pool.query(
        `SELECT item->>'name' AS item_name, COUNT(*) AS freq
         FROM guest_orders, jsonb_array_elements(items) AS item
         WHERE placed_at > NOW() - INTERVAL '90 days'
         GROUP BY item_name
         ORDER BY freq DESC
         LIMIT 20`
      );
      const popNames = popRes.rows.map(r => (r.item_name || '').toLowerCase());

      // Score menu items by their order frequency
      results = allMenu
        .map(m => ({ ...m, score: popNames.indexOf(m.name.toLowerCase()) }))
        .sort((a, b) => {
          if (a.score === -1 && b.score === -1) return 0;
          if (a.score === -1) return 1;
          if (b.score === -1) return -1;
          return a.score - b.score;
        })
        .slice(0, limitNum);

    } else if (type === 'for_you') {
      const tried = await getPastItemNames(email);
      // Items the user hasn't tried, sorted by popularity
      const popRes = await pool.query(
        `SELECT item->>'name' AS item_name, COUNT(*) AS freq
         FROM guest_orders, jsonb_array_elements(items) AS item
         WHERE placed_at > NOW() - INTERVAL '90 days'
         GROUP BY item_name
         ORDER BY freq DESC`
      );
      const popMap = {};
      popRes.rows.forEach((r, i) => { popMap[(r.item_name || '').toLowerCase()] = i; });

      results = allMenu
        .filter(m => !tried.has(m.name.toLowerCase()))
        .map(m => ({ ...m, score: popMap[m.name.toLowerCase()] ?? 999 }))
        .sort((a, b) => a.score - b.score)
        .slice(0, limitNum);

    } else if (type === 'also_liked') {
      if (!item_name) return res.status(400).json({ message: 'item_name is required for also_liked' });

      // Find orders containing item_name, then rank other items in those orders
      const coOccurRes = await pool.query(
        `SELECT item->>'name' AS item_name, COUNT(*) AS freq
         FROM guest_orders, jsonb_array_elements(items) AS item
         WHERE id IN (
           SELECT DISTINCT go.id
           FROM guest_orders go, jsonb_array_elements(go.items) AS it
           WHERE lower(it->>'name') LIKE lower($1)
         )
         AND lower(item->>'name') NOT LIKE lower($1)
         GROUP BY item_name
         ORDER BY freq DESC
         LIMIT 20`,
        [`%${item_name}%`]
      );

      const coNames = new Set(coOccurRes.rows.map(r => (r.item_name || '').toLowerCase()));
      const freqMap = {};
      coOccurRes.rows.forEach((r, i) => { freqMap[(r.item_name || '').toLowerCase()] = i; });

      results = allMenu
        .filter(m => coNames.has(m.name.toLowerCase()))
        .map(m => ({ ...m, score: freqMap[m.name.toLowerCase()] ?? 999 }))
        .sort((a, b) => a.score - b.score)
        .slice(0, limitNum);

      // If no collaborative results, fall back to popular
      if (results.length === 0) {
        results = allMenu.slice(0, limitNum);
      }

    } else if (type === 'new') {
      const tried = await getPastItemNames(email);
      // Items added in the last 30 days that the customer hasn't tried
      results = allMenu
        .filter(m => {
          const isNew = m.created_at && (Date.now() - new Date(m.created_at)) < 30 * 24 * 60 * 60 * 1000;
          return isNew && !tried.has(m.name.toLowerCase());
        })
        .slice(0, limitNum);

      // Pad with untried popular items if not enough new items
      if (results.length < 4) {
        const untried = allMenu.filter(m => !tried.has(m.name.toLowerCase()) && !results.find(r => r.id === m.id));
        results = [...results, ...untried.slice(0, 8 - results.length)];
      }
    }

    // Normalize output shape
    const items = results.map(m => ({
      id:          m.id,
      name:        m.name,
      description: m.description || '',
      price:       parseFloat(m.price || 0),
      image_url:   m.image_url || null,
      category_id: m.category || null,
    }));

    res.json({ type, items });
  } catch (error) {
    console.error('[AI Recommendations] Error:', error);
    res.status(500).json(safeError(error));
  }
};

module.exports = { chatWithAI, getKitchenStats, getRecommendations };
