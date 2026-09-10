import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, AlertTriangle, Star, TrendingUp, HelpCircle, TrendingDown, Search } from 'lucide-react';
import { adminAPI } from '../services/api';

// Menu engineering classes. The action line is the point: a margin % alone
// doesn't tell an owner what to do with a dish.
const CLASSES = {
  star:      { label: 'Stars',      one: 'Star',      icon: Star,         tone: 'success',
               hint: 'Popular and profitable — keep them, feature them.' },
  plowhorse: { label: 'Plowhorses', one: 'Plowhorse', icon: TrendingUp,   tone: 'warning',
               hint: 'Sell well, thin margin — review the cost or nudge the price.' },
  puzzle:    { label: 'Puzzles',    one: 'Puzzle',    icon: HelpCircle,   tone: 'info',
               hint: 'Profitable but rarely ordered — promote or reposition.' },
  dog:       { label: 'Dogs',       one: 'Dog',       icon: TrendingDown, tone: 'error',
               hint: 'Rarely ordered, thin margin — rework or remove.' },
};

const money = (n) => (n === null || n === undefined ? '—' : `$${Number(n).toFixed(2)}`);
const pct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`);

function csvExport(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// One editable cost cell. Saves on Enter or blur, only if the value changed.
function CostCell({ item, onSaved }) {
  const initial = item.cost_price === null ? '' : String(item.cost_price);
  const [value, setValue] = useState(initial);
  const [state, setState] = useState('idle'); // idle | saving | error
  const [msg, setMsg] = useState('');

  useEffect(() => { setValue(initial); }, [initial]);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === initial) return;
    if (trimmed !== '' && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < 0)) {
      setState('error'); setMsg('Enter a number'); return;
    }
    setState('saving'); setMsg('');
    try {
      const res = await adminAPI.updateMenuItemCost(item.id, trimmed === '' ? null : Number(trimmed));
      setState('idle');
      if (res?.below_cost) setMsg('Costs more than its price');
      onSaved();
    } catch (e) {
      setState('error'); setMsg(e.message || 'Save failed');
    }
  };

  return (
    <div style={{ minWidth: 96 }}>
      <input
        className="input"
        inputMode="decimal"
        placeholder="Add cost"
        value={value}
        disabled={state === 'saving'}
        onChange={e => { setValue(e.target.value); if (state === 'error') setState('idle'); }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValue(initial); e.currentTarget.blur(); } }}
        aria-label={`Cost to make ${item.name}`}
        style={{
          padding: '0.3rem 0.45rem', fontSize: '0.82rem', width: 88,
          borderColor: state === 'error' ? '#dc2626' : item.cost_price === null ? '#fbbf24' : undefined,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      {msg && <div style={{ fontSize: '0.68rem', marginTop: 2, color: state === 'error' ? '#dc2626' : '#b45309' }}>{msg}</div>}
    </div>
  );
}

export default function MenuProfitability({ start, end, reloadKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('sold');
  const [search, setSearch] = useState('');

  const load = useCallback(async ({ quiet } = {}) => {
    if (!quiet) setLoading(true);
    setErr('');
    try {
      setData(await adminAPI.reportMenuProfitability(`?start=${start}&end=${end}`));
    } catch (e) { setErr(e.message); }
    if (!quiet) setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Some dish names appear on more than one listing. The owner confirmed these
  // can be deliberately distinct items, so each listing keeps its own cost.
  // The label just makes that visible, so costing one listing isn't mistaken
  // for costing them all.
  const nameCounts = useMemo(() => {
    const seen = new Map();
    (data?.items || []).forEach(i => {
      const k = (i.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    return seen;
  }, [data]);
  const listingCount = (i) => nameCounts.get((i.name || '').trim().replace(/\s+/g, ' ').toLowerCase()) || 1;
  const isDup = (i) => listingCount(i) > 1;

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.items.filter(i => {
      if (q && !`${i.name} ${i.category || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'sold') return i.units > 0;
      if (filter === 'needs_cost') return i.cost_price === null;
      if (filter === 'all') return true;
      return i.klass === filter;
    });
  }, [data, filter, search]);

  if (loading && !data) return <p className="text-muted" style={{ padding: '1rem' }}>Loading…</p>;
  if (err && !data) return <p className="text-error" style={{ padding: '1rem' }}>{err}</p>;
  if (!data) return null;

  const s = data.summary;
  const lowCoverage = s.item_revenue > 0 && s.cost_coverage_pct < 80;

  const chip = (id, label, count) => (
    <button
      key={id}
      className={`btn btn-sm ${filter === id ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setFilter(id)}
    >
      {label}{count !== undefined && <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>}
    </button>
  );

  return (
    <div>
      <div className="rpt-section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Menu Profitability</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => csvExport(
          data.items.map(i => ({
            dish: i.name, category: i.category || '', sold: i.units, revenue: i.revenue,
            avg_price: i.avg_price, cost: i.cost_price ?? '', margin: i.unit_margin ?? '',
            margin_pct: i.margin_pct ?? '', gross_profit: i.contribution ?? '',
            class: i.klass ? CLASSES[i.klass].one : '',
          })),
          `menu-profitability-${data.range.start}-to-${data.range.end}.csv`
        )}><Download size={13} /> CSV</button>
      </div>

      {/* Coverage first: margins mean little if most of the money is uncosted. */}
      {s.dishes_costed === 0 ? (
        <div style={{ margin: '0.75rem 0 1rem', padding: '0.9rem 1rem', borderRadius: 10,
                      background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.86rem', lineHeight: 1.6 }}>
          <strong>No dish costs entered yet.</strong> Add what each dish costs to make (ingredients and
          packaging) in the <strong>Cost</strong> column below, and margins and the dish
          classification fill in as you go. Start with the dishes that bring in the most money:
          {data.needs_cost.length > 0 && (
            <span> {data.needs_cost.slice(0, 5).map(n => n.name).join(', ')}.</span>
          )}
        </div>
      ) : lowCoverage && (
        <div style={{ margin: '0.75rem 0 1rem', padding: '0.75rem 1rem', borderRadius: 10,
                      background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.84rem', lineHeight: 1.55,
                      display: 'flex', gap: '0.5rem' }}>
          <AlertTriangle size={16} style={{ flex: 'none', color: '#b45309', marginTop: 2 }} />
          <span>
            Costs cover <strong>{pct(s.cost_coverage_pct)}</strong> of item sales in this period, so the
            margins below describe only that part. {s.dishes_sold_uncosted} dish
            {s.dishes_sold_uncosted === 1 ? '' : 'es'} sold without a cost —
            {' '}<button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => setFilter('needs_cost')}>
              show them
            </button>.
          </span>
        </div>
      )}

      <div className="rpt-stat-grid" style={{ marginBottom: '1rem' }}>
        <div className="card rpt-stat-card">
          <div><p className="rpt-stat-label">Blended margin</p>
            <p className="rpt-stat-value">{pct(s.blended_margin_pct)}</p>
            <p className="rpt-stat-sub">On costed dishes</p></div>
        </div>
        <div className="card rpt-stat-card">
          <div><p className="rpt-stat-label">Gross profit</p>
            <p className="rpt-stat-value">{money(s.total_contribution)}</p>
            <p className="rpt-stat-sub">Sales minus dish cost</p></div>
        </div>
        <div className="card rpt-stat-card">
          <div><p className="rpt-stat-label">Cost coverage</p>
            <p className="rpt-stat-value">{pct(s.cost_coverage_pct)}</p>
            <p className="rpt-stat-sub">{s.dishes_costed} of {s.dishes_total} dishes costed</p></div>
        </div>
        <div className="card rpt-stat-card">
          <div><p className="rpt-stat-label">Selling below cost</p>
            <p className="rpt-stat-value" style={{ color: s.negative_margin ? '#dc2626' : undefined }}>{s.negative_margin}</p>
            <p className="rpt-stat-sub">Dishes losing money</p></div>
        </div>
      </div>

      {/* The matrix — each quadrant filters the table. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {Object.entries(CLASSES).map(([key, c]) => {
          const Icon = c.icon;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="card"
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '0.85rem 1rem',
                outline: filter === key ? '2px solid #1e3a8a' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: 4 }}>
                <span className={`badge badge-${c.tone}`}><Icon size={11} /> {c.label}</span>
                <strong style={{ fontSize: '1.15rem', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {s.counts[key]}
                </strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.45 }}>{c.hint}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        {chip('sold', 'Sold this period', data.items.filter(i => i.units > 0).length)}
        {chip('needs_cost', 'Needs a cost', data.items.filter(i => i.cost_price === null).length)}
        {chip('all', 'All dishes', data.items.length)}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="input" placeholder="Find a dish" value={search} onChange={e => setSearch(e.target.value)}
                 style={{ paddingLeft: 26, width: 200, fontSize: '0.84rem' }} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Dish</th>
              <th style={{ textAlign: 'right' }}>Sold</th>
              <th style={{ textAlign: 'right' }}>Avg price</th>
              <th>Cost</th>
              <th style={{ textAlign: 'right' }}>Margin</th>
              <th style={{ textAlign: 'right' }}>Margin %</th>
              <th style={{ textAlign: 'right' }}>Gross profit</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                {filter === 'sold' ? 'No dishes sold in this period.' : 'Nothing matches.'}
              </td></tr>
            )}
            {rows.map(i => {
              const c = i.klass ? CLASSES[i.klass] : null;
              const losing = i.unit_margin !== null && i.unit_margin < 0;
              return (
                <tr key={i.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{i.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{i.category || 'Uncategorised'}</div>
                    {isDup(i) && (
                      <div style={{ fontSize: '0.68rem', marginTop: 2, color: '#6b7280' }}
                           title="This name appears on more than one menu listing. Each listing has its own cost.">
                        Listing #{i.id} · 1 of {listingCount(i)} with this name · own cost
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i.units}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(i.avg_price)}</td>
                  <td><CostCell item={i} onSaved={() => load({ quiet: true })} /></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: losing ? '#dc2626' : undefined }}>
                    {money(i.unit_margin)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: losing ? '#dc2626' : undefined }}>
                    {pct(i.margin_pct)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(i.contribution)}</td>
                  <td>
                    {c ? <span className={`badge badge-${c.tone}`}>{c.one}</span>
                       : i.cost_price === null ? <span className="badge badge-muted">No cost</span>
                       : <span className="badge badge-muted">Not sold</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Honest about what the numbers leave out. */}
      <div style={{ marginTop: '1rem', fontSize: '0.76rem', color: '#6b7280', lineHeight: 1.65 }}>
        {data.custom_builds.revenue > 0 && (
          <p style={{ margin: '0 0 0.4rem' }}>
            <strong>Not included:</strong> {money(data.custom_builds.revenue)} from {data.custom_builds.units}{' '}
            {data.custom_builds.kinds.join(' and ')} — they're built per order, so there's no single dish cost to apply.
          </p>
        )}
        <p style={{ margin: 0 }}>
          Margins use what each dish actually sold for, add-ons included, minus its base cost; add-on ingredient
          costs and order-level discounts aren't deducted. Only completed orders are counted.
          A dish counts as popular at {pct(data.thresholds.popularity_share_pct)} or more of units sold, and
          high-margin at {money(data.thresholds.avg_unit_margin)} or more per portion.
        </p>
      </div>
    </div>
  );
}
