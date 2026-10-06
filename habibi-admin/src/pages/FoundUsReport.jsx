import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

// "How did you find out about us?" -- the one-tap answers customers give
// after ordering in the app, totalled for orders placed in the chosen range.
export default function FoundUsReport({ start, end, reloadKey }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    adminAPI.reportFoundUs(`?start=${start}&end=${end}`)
      .then(setData)
      .catch(e => setErr(e.message || 'Could not load the answers.'));
  }, [start, end, reloadKey]);

  const rows = data?.rows || [];
  const total = data?.total || 0;
  return (
    <div>
      <div className="rpt-section-hdr"><span>How Customers Found Us</span></div>
      <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
        Asked once after each order in the app (optional). {total ? `${total} answer${total === 1 ? '' : 's'} in this range.` : ''}
      </p>
      {err && <p className="text-error">{err}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Answer</th><th>Orders</th><th>Share</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted" style={{ padding: '2rem' }}>No answers in this period yet</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.source}>
                <td style={{ fontWeight: 600 }}>{r.label}</td>
                <td>{r.n}</td>
                <td className="text-muted">{total ? Math.round((r.n / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
