import React, { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, Heart, Star, Flame, Share2, Check } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './MenuItemModal.css';

/* ── Universal addon groups: Sauces / Make it a Meal! / Add a Drink / More Meat ──
   These 4 groups appear on every item (client spec). ── */
const UNIVERSAL_SAUCES = {
  id: '__sauces__',
  title: 'Sauces',
  options: [
    { id: '__s1__', title: 'White Sauce',         price: 0.50 },
    { id: '__s2__', title: 'Hot Sauce',            price: 0.50 },
    { id: '__s3__', title: 'Ketchup',              price: 0.50 },
    { id: '__s4__', title: 'Mustard',              price: 0.50 },
    { id: '__s5__', title: 'BBQ Sauce',            price: 0.50 },
    { id: '__s6__', title: 'Special Green Sauce',  price: 0.50 },
    { id: '__s7__', title: 'Mayonnaise',           price: 0.50 },
    { id: '__s8__', title: 'Blue Cheese',          price: 0.50 },
  ],
};

const UNIVERSAL_MORE_MEAT = {
  id: '__moremeat__',
  title: 'More Meat',
  options: [
    { id: '__mm1__',  title: 'Extra Grilled Chicken',   price: 3.00 },
    { id: '__mm2__',  title: 'Extra Lamb Gyro',         price: 3.00 },
    { id: '__mm3__',  title: 'Extra Beef',              price: 3.00 },
    { id: '__mm4__',  title: 'Extra Turkey',            price: 3.00 },
    { id: '__mm5__',  title: 'Extra Bacon',             price: 2.00 },
    { id: '__mm6__',  title: 'Extra Hot Dog',           price: 2.00 },
    { id: '__mm7__',  title: 'Extra Hot Sausage',       price: 3.00 },
    { id: '__mm8__',  title: 'Extra Italian Sausage',   price: 5.00 },
    { id: '__mm9__',  title: 'Extra Falafel',           price: 2.50 },
    { id: '__mm10__', title: 'Extra Shrimp',            price: 3.00 },
    { id: '__mm11__', title: 'Extra Fish Fillet',       price: 3.00 },
  ],
};

const CATEGORY_FALLBACKS = {
  platter:       '/images/food/food-4.jpg',
  burger:        '/images/habibi-burger.jpg',
  sandwich:      '/images/food/food-3.jpg',
  breakfast:     '/images/food/food-1.jpg',
  taco:          '/images/food/food-2.jpg',
  drink:         '/images/food/food-6.jpg',
  beverage:      '/images/food/food-6.jpg',
  extra:         '/images/halal-salad-v2.jpg',
  salad:         '/images/halal-salad-v2.jpg',
  'build your':  '/images/personalized-bowls.jpg',
  special:       '/images/art-of-the-feast.jpg',
};

const categoryFallback = (item) => {
  const cat  = (item?.category || '').toLowerCase();
  const name = (item?.name || item?.title || '').toLowerCase();
  const hay  = `${cat} ${name}`;
  for (const [key, img] of Object.entries(CATEGORY_FALLBACKS)) {
    if (hay.includes(key)) return img;
  }
  return '/images/food/food-7.jpg';
};

const fallbackImg = (id, idx = 0) => `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;
const toWebp = url =>
  url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

export default function MenuItemModal({
  itemId,
  onClose,
  onSelectItem,
  // Edit-mode props — when set, the modal pre-fills with existing selections and replaces the cart item
  editCartKey      = null,
  initialChoiceSel = null,
  initialAddonSel  = null,
  initialUniversalSel = null,
  initialNote      = '',
  initialQty       = 1,
  // When provided, the built cart-line item(s) are handed to this callback instead of going
  // straight into the shopping cart (used by Group Order, which stores its own item list).
  onAddOverride    = null,
  addLabel         = 'Add to Cart',
}) {
  const { addItem, removeItem } = useCart();
  const { isLoggedIn } = useAuth();

  const [item,           setItem]           = useState(null);
  const [modifiers,      setModifiers]      = useState({ choice_groups: [], addon_groups: [] });
  const [loading,        setLoading]        = useState(true);
  const [suggestions,    setSuggestions]    = useState([]);
  const [universalGroups, setUniversalGroups] = useState([]);
  const [universalSel,   setUniversalSel]  = useState({});
  const [extrasLookup,   setExtrasLookup]  = useState([]); // Extras-category items for modal Make it a Meal! section
  const [drinksLookup,   setDrinksLookup]  = useState([]); // Drinks-category items for modal Add a Drink section
  const [broadLookup,    setBroadLookup]   = useState([]); // All items — broader fallback for image resolution

  const [choiceSel, setChoiceSel] = useState(initialChoiceSel || {});
  const [addonSel,  setAddonSel]  = useState(initialAddonSel  || {});
  const [note,      setNote]      = useState(initialNote || '');
  const [qty,       setQty]       = useState(initialQty  || 1);
  const [isFav,     setIsFav]     = useState(false);
  const [added,     setAdded]     = useState(false);
  const [copied,    setCopied]    = useState(false);

  // Quota-item state (Dozen of Tacos, etc.)
  const [tacoItems,    setTacoItems]    = useState([]);
  const [quotaSel,     setQuotaSel]     = useState({});
  const [moreTacosSel, setMoreTacosSel] = useState({});
  const [quotaError,   setQuotaError]   = useState('');

  /* ── Load item + modifiers ── */
  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    // In edit mode pre-fill from saved state; for a fresh open reset to empty/defaults
    setChoiceSel(initialChoiceSel || {});
    setAddonSel(initialAddonSel   || {});
    setUniversalSel(initialUniversalSel || {});
    setNote(initialNote || '');
    setQty(initialQty   || 1);
    setAdded(false);
    setQuotaSel({}); setMoreTacosSel({}); setQuotaError('');

    Promise.all([menuAPI.getById(itemId), menuAPI.getModifiers(itemId), menuAPI.getAll()])
      .then(([itemData, mods, all]) => {
        setItem(itemData);
        const safeMods = mods || { choice_groups: [], addon_groups: [] };
        setModifiers(safeMods);
        const defaults = {};
        (safeMods.choice_groups || []).forEach(cg => {
          const def = cg.options?.find(o => o.is_default);
          defaults[cg.id] = def?.id ?? cg.options?.[0]?.id ?? null;
        });
        setChoiceSel(defaults);

        const available = (Array.isArray(all) ? all : []).filter(m => m.is_available !== false);
        const itemCat = (itemData?.category || '').toLowerCase();

        // Extract taco items for quota selector
        const tacos = available
          .filter(m => (m.category || '').toLowerCase() === 'tacos')
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setTacoItems(tacos);

        // Suggestions — same category
        const related = available
          .filter(m => m.category === itemData?.category && m.id !== itemData?.id)
          .slice(0, 6);
        setSuggestions(related);

        // Build extras/drinks lookup tables (for resolving DB global group selections to real menu items)
        const extras = available
          .filter(m => (m.category || '').toLowerCase().includes('extra') && m.id !== itemData?.id)
          .slice(0, 60);
        const drinks = available
          .filter(m =>
            ((m.category || '').toLowerCase().includes('drink') ||
             (m.category || '').toLowerCase().includes('beverage')) &&
            m.id !== itemData?.id
          )
          .slice(0, 60);

        setExtrasLookup(extras.map(m => ({ menuId: m.id, title: m.name || m.title, price: parseFloat(m.price || 0), img: m.image || m.image_url, category: m.category })));
        setDrinksLookup(drinks.map(m => ({ menuId: m.id, title: m.name || m.title, price: parseFloat(m.price || 0), img: m.image || m.image_url, category: m.category })));
        // Broad lookup — all items — used as fallback for image resolution when Extras/Drinks lookup misses
        setBroadLookup(available.slice(0, 400).map(m => ({ menuId: m.id, title: m.name || m.title, price: parseFloat(m.price || 0), img: m.image || m.image_url, category: m.category })));

        // Build universal groups — skip any whose title is already covered by a DB addon group
        // (DB groups are authoritative; universal groups fill gaps only)
        const dbAddonTitles = new Set((safeMods.addon_groups || []).map(ag => (ag.title || '').toLowerCase()));
        const uGroups = [];

        if (!dbAddonTitles.has('sauces')) uGroups.push(UNIVERSAL_SAUCES);

        if (!dbAddonTitles.has('make it a meal!') && extras.length > 0 && !itemCat.includes('extra')) {
          uGroups.push({
            id: '__meal__',
            title: 'Make it a Meal!',
            options: extras.map(m => ({
              id: `__meal_${m.id}__`,
              menuId: m.id,
              title: m.name || m.title,
              price: parseFloat(m.price || 0),
              img: m.image || m.image_url,
              category: m.category,
            })),
          });
        }

        if (!dbAddonTitles.has('add a drink') && drinks.length > 0 && !itemCat.includes('drink') && !itemCat.includes('beverage')) {
          uGroups.push({
            id: '__drink__',
            title: 'Add a Drink',
            options: drinks.map(m => ({
              id: `__drk_${m.id}__`,
              menuId: m.id,
              title: m.name || m.title,
              price: parseFloat(m.price || 0),
              img: m.image || m.image_url,
              category: m.category,
            })),
          });
        }

        uGroups.push(UNIVERSAL_MORE_MEAT);

        setUniversalGroups(itemData?.exclude_global_addons ? [] : uGroups);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      favoritesAPI.getAll()
        .then(data => {
          const ids = Array.isArray(data) ? data.map(f => f.menu_item_id) : [];
          setIsFav(ids.includes(parseInt(itemId)));
        })
        .catch(() => {});
    }
  }, [itemId, isLoggedIn]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ── Escape to close ── */
  const handleKey = useCallback(e => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  /* ── Price calculation ── */
  const basePrice  = parseFloat(item?.price || 0);
  const cleanName  = (item?.name || item?.title || '').replace(/\s*\(.*$/, '').trim();
  let choiceExtra = 0;
  (modifiers.choice_groups || []).forEach(cg => {
    const opt = cg.options?.find(o => o.id === choiceSel[cg.id]);
    if (opt) choiceExtra += parseFloat(opt.extra_price || 0);
  });
  const addonExtra = Object.entries(addonSel).reduce((sum, [optId, q]) => {
    let price = 0;
    (modifiers.addon_groups || []).forEach(ag => {
      const opt = ag.options?.find(o => o.id === parseInt(optId));
      if (opt) price = parseFloat(opt.price || 0);
    });
    return sum + price * q;
  }, 0);

  const universalExtra = Object.entries(universalSel).reduce((sum, [optId, q]) => {
    let price = 0;
    universalGroups.forEach(ug => {
      const opt = ug.options?.find(o => o.id === optId);
      if (opt) price = parseFloat(opt.price || 0);
    });
    return sum + price * q;
  }, 0);

  // Quota item: "More Tacos" extra cost
  const quotaRequired  = parseInt(item?.quota_required || 0);
  const quotaTotal     = Object.values(quotaSel).reduce((s, q) => s + q, 0);
  const quotaLeft      = quotaRequired - quotaTotal;
  const moreTacosExtra = Object.values(moreTacosSel).reduce((s, q) => s + q * 5.99, 0);

  const unitPrice = quotaRequired > 0
    ? basePrice + moreTacosExtra
    : basePrice + choiceExtra + addonExtra + universalExtra;
  const total = unitPrice * qty;

  /* ── Addon helpers (DB groups) ── */
  const toggleAddon = (optId, ag) => {
    setAddonSel(prev => {
      const next = { ...prev };
      if (prev[optId]) {
        delete next[optId];
      } else {
        const selectedOpt = (ag?.options || []).find(o => o.id === optId);
        if (selectedOpt?.title === 'No Sauce') {
          // Selecting "No Sauce" clears all other options in this group
          (ag.options || []).forEach(o => { delete next[o.id]; });
        } else {
          // Selecting any sauce clears "No Sauce" if it was active
          const noSauceOpt = (ag?.options || []).find(o => o.title === 'No Sauce');
          if (noSauceOpt && next[noSauceOpt.id]) delete next[noSauceOpt.id];
        }
        next[optId] = 1;
      }
      return next;
    });
  };
  const adjustAddonQty = (optId, delta) => {
    setAddonSel(prev => {
      const next = (prev[optId] || 0) + delta;
      if (next <= 0) { const n = { ...prev }; delete n[optId]; return n; }
      return { ...prev, [optId]: next };
    });
  };

  /* ── Universal addon helpers (string IDs) ── */
  const toggleUniversal = optId => {
    setUniversalSel(prev => {
      if (prev[optId]) { const n = { ...prev }; delete n[optId]; return n; }
      return { ...prev, [optId]: 1 };
    });
  };
  const adjustUniversalQty = (optId, delta) => {
    setUniversalSel(prev => {
      const next = (prev[optId] || 0) + delta;
      if (next <= 0) { const n = { ...prev }; delete n[optId]; return n; }
      return { ...prev, [optId]: next };
    });
  };

  const toggleFav = async () => {
    if (!isLoggedIn) return;
    const next = !isFav;
    setIsFav(next);
    try { next ? await favoritesAPI.add(item.id) : await favoritesAPI.remove(item.id); }
    catch { setIsFav(!next); }
  };

  // The host page (Menu.jsx) already keeps window.location synced to this
  // item's shareable /menu/item/:slug URL for as long as this modal is open,
  // so sharing/copying is just sharing the current URL — same pattern as
  // MenuItemPage's existing share button.
  const handleShare = async () => {
    const url = window.location.href;
    const name = cleanName || 'Menu Item';
    if (navigator.share) {
      try { await navigator.share({ title: `${name} — Habibi Halal Express`, url }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  /* ── Add to cart ── */
  const handleAdd = () => {
    // When onAddOverride is set, collect every cart-line this click would normally create
    // and hand them off as a batch instead of writing to the shopping cart.
    const itemsToEmit = [];
    const emit = (payload) => { if (onAddOverride) itemsToEmit.push(payload); else addItem(payload); };

    // Quota item (Dozen of Tacos, etc.)
    if (quotaRequired > 0) {
      if (quotaTotal !== quotaRequired) {
        const diff = quotaRequired - quotaTotal;
        setQuotaError(
          diff > 0
            ? `The required total is ${quotaRequired}. Please add ${diff} more taco${diff !== 1 ? 's' : ''}.`
            : `The required total is ${quotaRequired}. Please remove ${Math.abs(diff)} taco${Math.abs(diff) !== 1 ? 's' : ''}.`
        );
        return;
      }
      setQuotaError('');

      const quotaAddons = Object.entries(quotaSel)
        .filter(([, q]) => q > 0)
        .map(([name, qty]) => ({ name, price: 0, qty }));
      const moreTacosAddons = Object.entries(moreTacosSel)
        .filter(([, q]) => q > 0)
        .map(([name, qty]) => ({ name: `Extra ${name}`, price: 5.99, qty }));

      emit({
        id:            item.id,
        name:          cleanName,
        price:         unitPrice,
        baseItemPrice: basePrice,
        addons:        [...quotaAddons, ...moreTacosAddons],
        img:           item.image || item.image_url || categoryFallback(item),
        tag:           item.category || 'Item',
        note:          note.trim(),
        qty:           1,
        selectedChoices: {},
        selectedAddons:  {},
      });
      if (onAddOverride) onAddOverride(itemsToEmit);
      setAdded(true);
      setTimeout(() => { setAdded(false); onClose(); }, 1400);
      return;
    }

    // Normal item — build choice labels separately from user note
    // Filter out degenerate labels where the option title equals the item name
    const choiceLabels = (modifiers.choice_groups || [])
      .map(cg => {
        const opt = cg.options?.find(o => o.id === choiceSel[cg.id]);
        if (!opt || opt.title === cleanName) return null;
        return cg.title ? `${cg.title}: ${opt.title}` : opt.title;
      }).filter(Boolean);

    // Fuzzy title match: exact → substring → content-keyword overlap (ignoring stop words).
    // Shared by every "promote this add-on to its own cart line" path below (Make it a
    // Meal!/Add a Drink DB groups, and More Meat) so they all resolve a real product
    // photo the same way, falling back gracefully when no real product matches.
    const STOP = new Set(['add','extra','with','of','and','the','a','an','your','my','our','as','many','you','want','pieces','piece','same','plain']);
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const contentWords = s => norm(s).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    const fuzzyFind = (pool, n) => {
      const nNorm = norm(n);
      const nContent = new Set(contentWords(n));
      return pool.find(m => norm(m.title) === nNorm)
        || pool.find(m => nNorm.includes(norm(m.title)) && norm(m.title).length > 3)
        || pool.find(m => norm(m.title).includes(nNorm) && nNorm.length > 3)
        || (() => {
            let best = null, bestScore = 0;
            pool.forEach(m => {
              const score = contentWords(m.title).filter(w => nContent.has(w)).length;
              if (score > bestScore) { bestScore = score; best = m; }
            });
            return bestScore >= 1 ? best : null;
          })();
    };

    // Process DB addon selections — detect global Make it a Meal!(9002) / Add a Drink(9003)
    // groups and route them to separate cart items instead of sub-addon rows
    let addonMealCost = 0;
    const addonMealItems = [];
    const addonsList = [];

    Object.entries(addonSel).filter(([, q]) => q > 0).forEach(([optId, q]) => {
      let name = '', price = 0, agId = null;
      (modifiers.addon_groups || []).forEach(ag => {
        const opt = ag.options?.find(o => o.id === parseInt(optId));
        if (opt) { name = opt.title; price = parseFloat(opt.price || 0); agId = ag.id; }
      });
      if (!name) return;

      const lookup = agId === 9002 ? extrasLookup : agId === 9003 ? drinksLookup : null;
      if (lookup) {
        // Try Extras/Drinks lookup first; broaden to all items for image if not found
        let menuItem = fuzzyFind(lookup, name) || fuzzyFind(broadLookup, name);

        // Always create a separate cart item — use real menuId+img if found, synthetic fallback if not
        addonMealCost += price * q;
        addonMealItems.push({
          id:            menuItem?.menuId ?? (90000 + parseInt(optId)),
          cartKey:       `addon-${agId}-${optId}`,
          name:          menuItem?.title ?? name,
          price:         parseFloat(menuItem?.price ?? price),
          baseItemPrice: parseFloat(menuItem?.price ?? price),
          addons:        [],
          img:           menuItem?.img || fallbackImg(menuItem?.menuId ?? parseInt(optId)),
          tag:           menuItem?.category || 'Extras',
          note:          '',
          choiceLabels:  [],
          qty:           q,
          selectedChoices: {},
          selectedAddons:  {},
        });
      } else {
        addonsList.push({ name, price, qty: q });
      }
    });

    // Sauces stay as sub-row addons (a photo of "0.5oz white sauce" isn't a meaningful
    // "own picture" the way a protein portion is, and no delivery platform shows one).
    // More Meat, Make it a Meal!, and Add a Drink all become separate cart items --
    // More Meat used to stay a sub-row addon too, but its options (Extra Fish Fillet,
    // Extra Grilled Chicken, etc.) are real enough add-ons that the client wanted them
    // to read the same way Meal/Drink already do, with their own line and photo.
    const sauceAddons = [];
    const mealDrinkCartItems = [];
    const moreMeatCartItems = [];
    let mealDrinkCost = 0;
    let moreMeatCost = 0;

    Object.entries(universalSel).filter(([, q]) => q > 0).forEach(([optId, q]) => {
      let mealOpt = null;
      universalGroups
        .filter(ug => ug.id === '__meal__' || ug.id === '__drink__')
        .forEach(ug => { const f = ug.options?.find(o => o.id === optId); if (f) mealOpt = f; });

      if (mealOpt) {
        mealDrinkCost += parseFloat(mealOpt.price || 0) * q;
        mealDrinkCartItems.push({
          id:            mealOpt.menuId,
          name:          mealOpt.title,
          price:         parseFloat(mealOpt.price || 0),
          baseItemPrice: parseFloat(mealOpt.price || 0),
          addons:        [],
          img:           mealOpt.img || fallbackImg(mealOpt.menuId),
          tag:           mealOpt.category || 'Extras',
          note:          '',
          choiceLabels:  [],
          qty:           q,
          selectedChoices: {},
          selectedAddons:  {},
        });
        return;
      }

      const meatOpt = UNIVERSAL_MORE_MEAT.options?.find(o => o.id === optId);
      if (meatOpt) {
        const price = parseFloat(meatOpt.price || 0);
        const menuItem = fuzzyFind(broadLookup, meatOpt.title);
        moreMeatCost += price * q;
        moreMeatCartItems.push({
          id:            menuItem?.menuId ?? optId,
          cartKey:       `moremeat-${optId}`,
          name:          menuItem?.title ?? meatOpt.title,
          price:         parseFloat(menuItem?.price ?? price),
          baseItemPrice: parseFloat(menuItem?.price ?? price),
          addons:        [],
          img:           menuItem?.img || fallbackImg(menuItem?.menuId ?? optId),
          tag:           menuItem?.category || 'Extras',
          note:          '',
          choiceLabels:  [],
          qty:           q,
          selectedChoices: {},
          selectedAddons:  {},
        });
        return;
      }

      const sauceOpt = UNIVERSAL_SAUCES.options?.find(o => o.id === optId);
      if (sauceOpt) sauceAddons.push({ name: sauceOpt.title, price: parseFloat(sauceOpt.price || 0), qty: q });
    });

    // cartKey distinguishes same item ordered with different choices
    const cartKey = Object.keys(choiceSel).length > 0
      ? `${item.id}-${JSON.stringify(choiceSel)}`
      : undefined;

    // In edit mode: remove the old item (and its children) before re-adding
    if (editCartKey) removeItem(editCartKey);

    const parentKey = cartKey ?? item.id;

    emit({
      id:            item.id,
      cartKey,
      name:          cleanName,
      price:         unitPrice - mealDrinkCost - addonMealCost - moreMeatCost,
      baseItemPrice: basePrice + choiceExtra,
      addons:        [...addonsList, ...sauceAddons],
      img:           item.image || item.image_url || categoryFallback(item),
      tag:           item.category || 'Item',
      note:          note.trim(),
      choiceLabels,
      qty,
      selectedChoices:  choiceSel,
      selectedAddons:   addonSel,
      selectedUniversal: universalSel,
    });

    // Universal Make it a Meal! / Add a Drink → separate cart entries (tagged with parentCartKey)
    mealDrinkCartItems.forEach(mi => emit({ ...mi, parentCartKey: parentKey }));
    // Universal More Meat → separate cart entries, same treatment as Meal/Drink
    moreMeatCartItems.forEach(mi => emit({ ...mi, parentCartKey: parentKey }));
    // DB global group Make it a Meal!(9002) / Add a Drink(9003) → separate cart entries
    addonMealItems.forEach(mi => emit({ ...mi, parentCartKey: parentKey }));

    if (onAddOverride) onAddOverride(itemsToEmit);
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1400);
  };

  const missingRequired = quotaRequired > 0
    ? quotaTotal !== quotaRequired
    : (modifiers.choice_groups || []).some(cg => !choiceSel[cg.id]);

  return (
    <div className="mim-overlay" onClick={onClose}>
      <div className="mim-modal" onClick={e => e.stopPropagation()}>

        <button className="mim-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* ════════ TWO-COLUMN LAYOUT ════════ */}
        <div className="mim-cols">

          {/* LEFT — large item image */}
          <div className="mim-col-left">
            {loading ? (
              <div className="mim-img-skeleton" />
            ) : (
              <>
                <img
                  src={item?.image || item?.image_url || categoryFallback(item)}
                  alt={cleanName}
                  className="mim-img"
                  onError={e => { e.target.onerror = null; e.target.src = categoryFallback(item); }}
                />
                <div className="mim-img-grad" />

                <div className="mim-img-top">
                  {(item?.is_popular || item?.is_featured) && (
                    <span className="mim-top-badge">
                      <Flame size={11} /> #1 Most Liked
                    </span>
                  )}
                </div>

                {isLoggedIn && (
                  <button
                    className={`mim-fav-btn${isFav ? ' active' : ''}`}
                    onClick={toggleFav}
                    aria-label="Save to favourites"
                  >
                    <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                )}

                <button
                  className={`mim-share-btn${copied ? ' mim-share-btn--copied' : ''}`}
                  onClick={handleShare}
                  aria-label="Share this item"
                >
                  {copied ? <Check size={15} /> : <Share2 size={15} />}
                  <span>{copied ? 'Copied!' : 'Share'}</span>
                </button>
              </>
            )}
          </div>

          {/* RIGHT — fixed header + scrollable addons */}
          <div className="mim-col-right-wrap">

            {/* ── Item header — fixed, does not scroll ── */}
            {!loading && item && (
              <div className="mim-item-hd">
                <div className="mim-item-pills">
                  <span className="mim-halal-pill">Halal</span>
                  {item.is_spicy && <span className="mim-spicy-pill">🌶 Spicy</span>}
                </div>
                <div className="mim-name-row">
                  <h2 className="mim-name">{cleanName}</h2>
                  <span className="mim-price">${basePrice.toFixed(2)}</span>
                </div>
                {item.description && <p className="mim-desc">{item.description}</p>}
                <div className="mim-stars-row">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={12} fill="#F97316" stroke="#F97316" />
                  ))}
                  <span className="mim-rating-label">4.8 · 170+ ratings</span>
                </div>
              </div>
            )}

          <div className="mim-col-right">
            {loading ? (
              <div className="mim-skel-wrap">
                <div className="mim-skel mim-skel--h1" />
                <div className="mim-skel mim-skel--line" />
                <div className="mim-skel mim-skel--line short" />
                <div className="mim-skel mim-skel--block" />
              </div>
            ) : quotaRequired > 0 ? (
              /* ════════ QUOTA ITEM UI (Dozen of Tacos, etc.) ════════ */
              <>
                {/* ── Pick-N selector ── */}
                <div className="mim-section mim-quota-section">
                  <div className="mim-section-hd">
                    <div>
                      <span className="mim-section-title">Pick Your {quotaRequired} Tacos</span>
                      <p className="mim-section-sub">Mix and match — any combo that adds up to {quotaRequired}</p>
                    </div>
                    <span className={`mim-badge ${quotaTotal === quotaRequired ? 'mim-badge--done' : 'mim-badge--req'}`}>
                      {quotaTotal === quotaRequired ? '✓ Ready!' : `${quotaTotal} / ${quotaRequired}`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mim-quota-bar-wrap">
                    <div className="mim-quota-bar">
                      <div
                        className={`mim-quota-bar-fill${quotaTotal > quotaRequired ? ' over' : ''}`}
                        style={{ width: `${Math.min(100, (quotaTotal / quotaRequired) * 100)}%` }}
                      />
                    </div>
                    <span className="mim-quota-counter">
                      {quotaTotal === quotaRequired
                        ? `All ${quotaRequired} tacos selected! ✓`
                        : quotaLeft > 0
                        ? `Ordered ${quotaTotal} · Left ${quotaLeft}`
                        : `Ordered ${quotaTotal} · ${Math.abs(quotaLeft)} too many — remove some`
                      }
                    </span>
                  </div>

                  <div className="mim-options-list">
                    {tacoItems.map(taco => {
                      const tacoQty = quotaSel[taco.name] || 0;
                      return (
                        <div key={taco.id} className={`mim-addon-row${tacoQty > 0 ? ' sel' : ''}`}>
                          <span className="mim-opt-name">{taco.name}</span>
                          <div className="mim-addon-right" onClick={e => e.stopPropagation()}>
                            <div className="mim-stepper">
                              <button
                                onClick={() => {
                                  setQuotaSel(p => {
                                    const next = Math.max(0, (p[taco.name] || 0) - 1);
                                    const r = { ...p };
                                    if (next === 0) delete r[taco.name]; else r[taco.name] = next;
                                    return r;
                                  });
                                  setQuotaError('');
                                }}
                                disabled={tacoQty === 0}
                              >
                                <Minus size={10} />
                              </button>
                              <span>{tacoQty}</span>
                              <button
                                onClick={() => {
                                  if (quotaTotal >= quotaRequired) {
                                    setQuotaError(`You already have ${quotaRequired} tacos. Remove one before adding another.`);
                                    return;
                                  }
                                  setQuotaSel(p => ({ ...p, [taco.name]: (p[taco.name] || 0) + 1 }));
                                  setQuotaError('');
                                }}
                                disabled={quotaTotal >= quotaRequired}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {quotaError && <p className="mim-quota-error">{quotaError}</p>}
                </div>

                {/* ── More Tacos add-on (+$5.99 each) ── */}
                <div className="mim-section">
                  <div className="mim-section-hd">
                    <div>
                      <span className="mim-section-title">More Tacos</span>
                      <p className="mim-section-sub">Add extra tacos to your order</p>
                    </div>
                    <span className="mim-badge mim-badge--opt">+$5.99 each</span>
                  </div>
                  <div className="mim-options-list">
                    {tacoItems.map(taco => {
                      const extraQty = moreTacosSel[taco.name] || 0;
                      return (
                        <div key={`extra-${taco.id}`} className={`mim-addon-row${extraQty > 0 ? ' sel' : ''}`}>
                          <div className="mim-opt-name-wrap">
                            <span className="mim-opt-name">{taco.name}</span>
                            <span className="mim-addon-price-inline">+$5.99 each</span>
                          </div>
                          <div className="mim-addon-right" onClick={e => e.stopPropagation()}>
                            <div className="mim-stepper">
                              <button
                                disabled={extraQty === 0}
                                onClick={() => setMoreTacosSel(p => {
                                  const n = { ...p };
                                  if ((n[taco.name] || 0) <= 1) delete n[taco.name]; else n[taco.name]--;
                                  return n;
                                })}>
                                <Minus size={10} />
                              </button>
                              <span>{extraQty}</span>
                              <button onClick={() => setMoreTacosSel(p => ({ ...p, [taco.name]: (p[taco.name] || 0) + 1 }))}>
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Special Instructions ── */}
                <div className="mim-section">
                  <div className="mim-section-hd">
                    <span className="mim-section-title">Special Instructions</span>
                    <span className="mim-badge mim-badge--opt">Optional</span>
                  </div>
                  <textarea
                    className="mim-notes"
                    placeholder="Spicy sauce on the side, extra lime..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    maxLength={300}
                  />
                </div>

                {/* ── Footer: quota add-to-cart ── */}
                <div className="mim-footer mim-footer--quota">
                  <button
                    className={`mim-add-btn${added ? ' done' : ''}${quotaTotal !== quotaRequired ? ' off' : ''}`}
                    onClick={handleAdd}
                    disabled={added}
                  >
                    {added
                      ? `✓ ${addLabel === 'Add to Cart' ? 'Added to Cart' : addLabel}!`
                      : quotaTotal !== quotaRequired
                      ? `Select ${quotaRequired} tacos (${quotaTotal}/${quotaRequired})`
                      : `${addLabel} · $${(basePrice + moreTacosExtra).toFixed(2)}`
                    }
                  </button>
                </div>
              </>
            ) : (
              /* ════════ NORMAL ITEM UI ════════ */
              <>
                {/* ── Choice groups (radio — required) ── */}
                {(modifiers.choice_groups || []).map(cg => (
                  <div key={cg.id} className="mim-section">
                    <div className="mim-section-hd">
                      <div>
                        <span className="mim-section-title">{cg.title}</span>
                        <p className="mim-section-sub">Select one option</p>
                      </div>
                      <span className="mim-badge mim-badge--req">Required</span>
                    </div>
                    <div className="mim-options-list">
                      {(cg.options || []).map(opt => {
                        const sel   = choiceSel[cg.id] === opt.id;
                        const extra = parseFloat(opt.extra_price || 0);
                        return (
                          <div
                            key={opt.id}
                            className={`mim-opt-row${sel ? ' sel' : ''}`}
                            onClick={() => setChoiceSel(p => ({ ...p, [cg.id]: opt.id }))}
                            role="radio"
                            aria-checked={sel}
                          >
                            <div className={`mim-radio${sel ? ' on' : ''}`} />
                            <span className="mim-opt-name">{opt.title}</span>
                            <span className="mim-opt-price">
                              {extra > 0 ? `+$${extra.toFixed(2)}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ── Addon groups (checkbox — optional) ── */}
                {(modifiers.addon_groups || []).map(ag => (
                  <div key={ag.id} className="mim-section">
                    <div className="mim-section-hd">
                      <div>
                        <span className="mim-section-title">{ag.title}</span>
                        <p className="mim-section-sub">
                          {ag.max_selections ? `Choose up to ${ag.max_selections}` : 'Add as many as you like'}
                        </p>
                      </div>
                      <span className="mim-badge mim-badge--opt">Optional</span>
                    </div>
                    <div className="mim-options-list">
                      {[...(ag.options || [])].sort((a, b) =>
                        a.title === 'No Sauce' ? -1 : b.title === 'No Sauce' ? 1 : 0
                      ).map(opt => {
                        const checked = !!addonSel[opt.id];
                        const aqty   = addonSel[opt.id] || 0;
                        const price  = parseFloat(opt.price || 0);
                        return (
                          <div
                            key={opt.id}
                            className={`mim-addon-row${checked ? ' sel' : ''}`}
                            onClick={() => toggleAddon(opt.id, ag)}
                            role="checkbox"
                            aria-checked={checked}
                          >
                            <div className={`mim-checkbox${checked ? ' on' : ''}`}>
                              {checked && '✓'}
                            </div>
                            <span className="mim-opt-name">{opt.title}</span>
                            <div className="mim-addon-right" onClick={e => e.stopPropagation()}>
                              {checked ? (
                                <div className="mim-stepper">
                                  <button onClick={() => adjustAddonQty(opt.id, -1)}>
                                    <Minus size={10} />
                                  </button>
                                  <span>{aqty}</span>
                                  <button onClick={() => adjustAddonQty(opt.id, 1)}>
                                    <Plus size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="mim-addon-price">
                                  {price === 0 ? '' : `+$${price.toFixed(2)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ── Universal groups: Sauces / Make it a Meal! / Add a Drink ── */}
                {universalGroups.map(ug => (
                  <div key={ug.id} className="mim-section">
                    <div className="mim-section-hd">
                      <div>
                        <span className="mim-section-title">{ug.title}</span>
                        <p className="mim-section-sub">Add as many as you like</p>
                      </div>
                      <span className="mim-badge mim-badge--opt">Optional</span>
                    </div>
                    <div className="mim-options-list">
                      {ug.options.map(opt => {
                        const checked = !!universalSel[opt.id];
                        const aqty   = universalSel[opt.id] || 0;
                        return (
                          <div
                            key={opt.id}
                            className={`mim-addon-row${checked ? ' sel' : ''}`}
                            onClick={() => toggleUniversal(opt.id)}
                            role="checkbox"
                            aria-checked={checked}
                          >
                            <div className={`mim-checkbox${checked ? ' on' : ''}`}>
                              {checked && '✓'}
                            </div>
                            <span className="mim-opt-name">{opt.title}</span>
                            <div className="mim-addon-right" onClick={e => e.stopPropagation()}>
                              {checked ? (
                                <div className="mim-stepper">
                                  <button onClick={() => adjustUniversalQty(opt.id, -1)}><Minus size={10} /></button>
                                  <span>{aqty}</span>
                                  <button onClick={() => adjustUniversalQty(opt.id, 1)}><Plus size={10} /></button>
                                </div>
                              ) : (
                                <span className="mim-addon-price">
                                  {opt.price === 0 ? '' : `+$${opt.price.toFixed(2)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ── Special Instructions ── */}
                <div className="mim-section">
                  <div className="mim-section-hd">
                    <span className="mim-section-title">Special Instructions</span>
                    <span className="mim-badge mim-badge--opt">Optional</span>
                  </div>
                  <textarea
                    className="mim-notes"
                    placeholder="No onions, extra sauce, well done..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    maxLength={300}
                  />
                </div>

                {/* ── Suggested items ── */}
                {suggestions.length > 0 && onSelectItem && (
                  <div className="mim-suggestions">
                    <p className="mim-suggestions-title">You might also like</p>
                    <div className="mim-suggestions-row">
                      {suggestions.map(s => {
                        const img = s.image || s.image_url;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className="mim-suggestion-card"
                            onClick={() => onSelectItem(s.id)}
                          >
                            <div className="mim-sug-img">
                              {img
                                ? <img src={img} alt={s.name} loading="lazy" />
                                : <div className="mim-sug-img-fallback">{s.name?.[0] || '?'}</div>
                              }
                            </div>
                            <p className="mim-sug-name">{s.name}</p>
                            <p className="mim-sug-price">${parseFloat(s.price).toFixed(2)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Footer: qty + add to cart ── */}
                <div className="mim-footer">
                  <div className="mim-qty-ctrl">
                    <button className="mim-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>
                      <Minus size={14} />
                    </button>
                    <span className="mim-qty-num">{qty}</span>
                    <button className="mim-qty-btn" onClick={() => setQty(q => q + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    className={`mim-add-btn${added ? ' done' : ''}${missingRequired ? ' off' : ''}`}
                    onClick={handleAdd}
                    disabled={missingRequired || added}
                  >
                    {added
                      ? (editCartKey ? '✓ Cart Updated!' : `✓ ${addLabel === 'Add to Cart' ? 'Added to Cart' : addLabel}!`)
                      : editCartKey
                      ? `Update Cart · $${total.toFixed(2)}`
                      : `${addLabel} · $${total.toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
          </div>{/* /mim-col-right-wrap */}
        </div>
      </div>
    </div>
  );
}
