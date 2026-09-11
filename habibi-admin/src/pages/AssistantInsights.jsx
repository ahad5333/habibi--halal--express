import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Mic } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Reports.css';
import './AssistantInsights.css';

// What customers ask the home-page assistant, and -- the reason this page
// exists -- what it couldn't answer, so the owner can see what's missing:
// a dish people keep asking for, or a question the assistant needs to learn.

const RANGES = [7, 30, 90];

// Plain-English names for the assistant's internal topic labels.
const TOPICS = {
  add_to_cart: 'Ordered a dish',
  menu_search: 'Searched the menu',
  did_you_mean: 'Unclear dish name',
  not_on_menu: "Asked for a dish we don't have",
  deals: 'Deals & coupons',
  popular: "What's popular",
  spicy: 'Spicy food',
  vegetarian: 'Vegetarian',
  burgers: 'Burgers',
  hours: 'Opening hours',
  catering: 'Catering',
  halal: 'Halal',
  track_order: 'Tracking an order',
  view_cart: 'Checked their cart',
  clear_cart: 'Cleared their cart',
  remove_item: 'Removed an item',
  change_quantity: 'Changed a quantity',
  checkout: 'Went to checkout',
  greeting: 'Said hi / asked for help',
  ai_reply: 'Answered by AI',
  unanswered: "Couldn't answer",
};
const topicName = (intent) => TOPICS[intent] || intent;

const OUTCOME = {
  answered:   { label: 'Answered',        badge: 'badge-success' },
  guessed:    { label: 'Guessed',         badge: 'badge-warning' },
  unanswered: { label: "Couldn't answer", badge: 'badge-error' },
};

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const when = (ts) => new Date(ts).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function gapDetail(g) {
  if (g.outcome === 'guessed') {
    return g.item_names?.length
      ? `Offered instead: ${g.item_names.slice(0, 3).join(', ')}`
      : 'Offered close matches';
  }
  if (g.intent === 'not_on_menu') return 'Asked for something that isn’t on the menu';
  if (g.intent === 'remove_item') return 'Tried to remove something that wasn’t in their cart';
  return 'Had no answer';
}

export default function AssistantInsights() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminAPI.assistantInsights(days));
    } catch (e) {
      setError(e.message || 'Could not load assistant questions.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const gaps = data?.needs_attention || [];
  const topics = data?.topics || [];
  const dishes = data?.top_dishes || [];
  const recent = data?.recent || [];
  const topTopic = topics[0]?.times || 1;
  const topDish = dishes[0]?.times || 1;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <p className="page-title"><Bot size={20} style={{ verticalAlign: -3, marginRight: 6 }} />AI Assistant</p>
          <p className="page-sub">What customers ask the assistant on the home page, and what it couldn’t answer</p>
        </div>
        <div className="ai-range">
          {RANGES.map(r => (
            <button
              key={r}
              className={`btn btn-sm ${days === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(r)}
            >
              {r} days
            </button>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'ai-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="card ai-error">{error}</div>}

      {loading && !data ? (
        <div className="card"><div className="empty" style={{ minHeight: 200 }}><div className="spinner" /></div></div>
      ) : data && s.total === 0 ? (
        <div className="card">
          <div className="empty" style={{ minHeight: 220 }}>
            <Bot size={34} />
            <p style={{ maxWidth: 420 }}>
              No questions in the last {days} days. The assistant lives on the home page. As customers
              use it, their questions show up here, including the ones it couldn’t answer.
            </p>
          </div>
        </div>
      ) : data && (
        <>
          <div className="rpt-stat-grid">
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Questions asked</p>
              <p className="rpt-stat-value">{s.total.toLocaleString()}</p>
              <p className="rpt-stat-sub">In the last {days} days</p>
            </div></div>
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Answered</p>
              <p className="rpt-stat-value">{pct(s.answered, s.total)}</p>
              <p className="rpt-stat-sub">{s.answered} of {s.total}</p>
            </div></div>
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Couldn’t answer</p>
              <p className="rpt-stat-value" style={{ color: s.unanswered ? '#dc2626' : undefined }}>{s.unanswered}</p>
              <p className="rpt-stat-sub">
                {s.guessed ? `Plus ${s.guessed} where it had to guess` : 'No guesses either'}
              </p>
            </div></div>
            <div className="card rpt-stat-card"><div>
              <p className="rpt-stat-label">Spoken</p>
              <p className="rpt-stat-value">{pct(s.voice, s.total)}</p>
              <p className="rpt-stat-sub">{s.voice} used the microphone</p>
            </div></div>
          </div>

          <div className="card ai-section">
            <p className="ai-section-title">Couldn’t answer</p>
            <p className="ai-section-help">
              The gaps, most-asked first. The same question worded differently is counted once. A dish that
              keeps coming up may be worth adding to the menu. For anything else, send the list to your
              developer so the assistant can learn the answer.
            </p>
            {gaps.length === 0 ? (
              <p className="text-muted ai-none">Nothing unanswered in the last {days} days.</p>
            ) : (
              <div className="table-wrap">
                <table className="table ai-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th style={{ textAlign: 'right' }}>Times</th>
                      <th>Last asked</th>
                      <th>What happened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g, i) => (
                      <tr key={i}>
                        <td className="ai-question">“{g.question}”</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{g.times}</td>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{when(g.last_asked)}</td>
                        <td>
                          <span className={`badge ${OUTCOME[g.outcome].badge}`}>{OUTCOME[g.outcome].label}</span>
                          <div className="ai-detail">{gapDetail(g)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ai-columns">
            <div className="card ai-section">
              <p className="ai-section-title">What people ask about</p>
              <div className="ai-bars">
                {topics.map(t => (
                  <div key={t.intent} className="ai-bar-row">
                    <span className="ai-bar-label">{topicName(t.intent)}</span>
                    <span className="ai-bar-track">
                      <span
                        className={`ai-bar-fill ${['unanswered', 'not_on_menu'].includes(t.intent) ? 'bad' : ''}`}
                        style={{ width: `${(t.times / topTopic) * 100}%` }}
                      />
                    </span>
                    <span className="ai-bar-num">{t.times}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card ai-section">
              <p className="ai-section-title">Dishes asked for by name</p>
              <p className="ai-section-help">Only dishes customers named themselves, when ordering or searching.</p>
              {dishes.length === 0 ? (
                <p className="text-muted ai-none">No dishes named yet in this period.</p>
              ) : (
                <div className="ai-bars">
                  {dishes.map(d => (
                    <div key={d.name} className="ai-bar-row">
                      <span className="ai-bar-label">{d.name}</span>
                      <span className="ai-bar-track">
                        <span className="ai-bar-fill" style={{ width: `${(d.times / topDish) * 100}%` }} />
                      </span>
                      <span className="ai-bar-num">{d.times}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <details className="card ai-section ai-recent">
            <summary className="ai-section-title">Latest {recent.length} questions</summary>
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="table ai-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Question</th>
                    <th>Topic</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                      <td className="ai-question">
                        {r.input_mode === 'voice' && (
                          <Mic size={12} className="ai-mic" aria-label="Spoken" />
                        )}
                        {r.message}
                      </td>
                      <td className="text-muted">{topicName(r.intent)}</td>
                      <td><span className={`badge ${OUTCOME[r.outcome].badge}`}>{OUTCOME[r.outcome].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <p className="ai-footnote">
            Questions are saved without names, accounts or IP addresses. Phone numbers and email addresses
            are masked before saving, and everything is deleted after {data.retention_days} days.
          </p>
        </>
      )}
    </div>
  );
}
