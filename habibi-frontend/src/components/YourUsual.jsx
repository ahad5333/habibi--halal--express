import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MenuItemModal from './MenuItemModal';
import './YourUsual.css';

// One-tap reordering for signed-in customers: the few things they order most,
// with the way they usually have it already selected.
//
// Tapping opens the item's own dialog rather than dropping it straight into the
// cart. The dialog prices it from today's menu and add-on prices; rebuilding a
// cart line from an old order would carry that order's prices and could
// undercharge. Two taps, and the total is right.
//
// Renders nothing for signed-out visitors, for anyone with no history, and if
// the request fails -- it is a shortcut, never something in the way.
const lastOrderedLabel = (iso) => {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  // New York time: it is the restaurant's clock that decides an order's date.
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
};

export default function YourUsual() {
  const { isLoggedIn } = useAuth();
  const [usual, setUsual] = useState([]);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) { setUsual([]); return undefined; }
    let cancelled = false;
    userAPI.getUsual()
      .then(list => { if (!cancelled && Array.isArray(list)) setUsual(list); })
      .catch(() => { /* no shortcut this time; the menu is still right there */ });
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  if (!isLoggedIn || usual.length === 0) return null;

  return (
    <section className="yu-section" aria-labelledby="yu-title">
      <div className="yu-head">
        <h2 id="yu-title" className="yu-title">Your usual</h2>
        <p className="yu-sub">Straight back to what you order most.</p>
      </div>

      <ul className="yu-list">
        {usual.map(u => {
          const last = lastOrderedLabel(u.last_ordered_at);
          return (
            <li key={u.menu_item_id} className="yu-item">
              <button type="button" className="yu-card" onClick={() => setPicked(u)}>
                <span className="yu-top">
                  {u.image_url
                    ? <img className="yu-img" src={u.image_url} alt="" loading="lazy" />
                    : <span className="yu-img yu-img--empty" aria-hidden="true" />}
                  <span className="yu-body">
                    <span className="yu-name">{u.name}</span>
                    {u.usual_note && <span className="yu-note">usually {u.usual_note}</span>}
                    <span className="yu-meta">
                      Ordered {u.times_ordered} {u.times_ordered === 1 ? 'time' : 'times'}
                      {last ? ` · last ${last}` : ''}
                    </span>
                  </span>
                </span>
                <span className="yu-add"><RotateCcw size={15} aria-hidden="true" /> Order again</span>
              </button>
            </li>
          );
        })}
      </ul>

      {picked && (
        <MenuItemModal
          itemId={picked.menu_item_id}
          initialChoiceSel={picked.usual_choices || {}}
          initialAddonSel={picked.usual_addons || {}}
          initialNote={picked.usual_note || ''}
          initialQty={1}
          onClose={() => setPicked(null)}
          onSelectItem={() => setPicked(null)}
        />
      )}
    </section>
  );
}
