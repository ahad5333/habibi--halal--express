import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { adminAPI } from '../services/api';
import './GlobalAddons.css';

export default function GlobalAddons() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});
  const [error,   setError]   = useState('');
  const [open,    setOpen]    = useState({});

  useEffect(() => {
    adminAPI.getGlobalAddons()
      .then(d => { setGroups(d); setLoading(false); })
      .catch(() => { setError('Failed to load global add-on groups'); setLoading(false); });
  }, []);

  const toggleOpen = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const setGroupField = (gid, field, val) => {
    setGroups(gs => gs.map(g => g.id === gid ? { ...g, [field]: val } : g));
  };

  const setOption = (gid, idx, field, val) => {
    setGroups(gs => gs.map(g => {
      if (g.id !== gid) return g;
      const opts = [...(g.options || [])];
      opts[idx] = { ...opts[idx], [field]: val };
      return { ...g, options: opts };
    }));
  };

  const addOption = (gid) => {
    setGroups(gs => gs.map(g => {
      if (g.id !== gid) return g;
      const opts = [...(g.options || [])];
      const maxId = opts.reduce((m, o) => Math.max(m, o.id || 0), 0);
      opts.push({ id: maxId + 1, title: '', price: 0 });
      return { ...g, options: opts };
    }));
  };

  const removeOption = (gid, idx) => {
    setGroups(gs => gs.map(g => {
      if (g.id !== gid) return g;
      const opts = (g.options || []).filter((_, i) => i !== idx);
      return { ...g, options: opts };
    }));
  };

  const saveGroup = async (g) => {
    setSaving(s => ({ ...s, [g.id]: true }));
    try {
      const updated = await adminAPI.updateGlobalAddon(g.id, {
        name: g.name,
        options: g.options,
        sort_order: g.sort_order,
        is_active: g.is_active,
      });
      setGroups(gs => gs.map(x => x.id === g.id ? updated : x));
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(s => ({ ...s, [g.id]: false }));
    }
  };

  if (loading) return <div className="ga-loading">Loading global add-ons...</div>;

  return (
    <div className="ga-page">
      <div className="ga-header">
        <div>
          <h1 className="ga-title">Global Add-ons</h1>
          <p className="ga-sub">These three groups appear automatically on every menu item unless "Exclude Global Add-ons" is toggled on in the item's settings.</p>
        </div>
      </div>

      {error && <div className="ga-error">{error}</div>}

      <div className="ga-groups">
        {groups.map(g => (
          <div key={g.id} className={`ga-group${!g.is_active ? ' ga-group--inactive' : ''}`}>
            <div className="ga-group-hdr" onClick={() => toggleOpen(g.id)}>
              <div className="ga-group-left">
                <span className="ga-group-name">{g.name}</span>
                <span className="ga-group-count">{(g.options || []).length} options</span>
                {!g.is_active && <span className="ga-badge ga-badge--off">Hidden</span>}
              </div>
              <div className="ga-group-right">
                <button
                  type="button"
                  className={`ga-toggle${g.is_active ? ' on' : ''}`}
                  onClick={e => { e.stopPropagation(); setGroupField(g.id, 'is_active', !g.is_active); }}
                  title={g.is_active ? 'Hide this group from all items' : 'Show this group on all items'}
                >
                  {g.is_active ? 'Active' : 'Hidden'}
                </button>
                {open[g.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {open[g.id] && (
              <div className="ga-group-body">
                <div className="ga-field">
                  <label className="ga-label">Group Name</label>
                  <input
                    className="input"
                    value={g.name}
                    onChange={e => setGroupField(g.id, 'name', e.target.value)}
                  />
                </div>

                <div className="ga-options-hdr">
                  <span className="ga-label">Options</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addOption(g.id)}>
                    <Plus size={13} /> Add Option
                  </button>
                </div>

                <div className="ga-options">
                  {(g.options || []).map((opt, idx) => (
                    <div key={opt.id || idx} className="ga-opt-row">
                      <input
                        className="input ga-opt-name"
                        placeholder="Option name"
                        value={opt.title}
                        onChange={e => setOption(g.id, idx, 'title', e.target.value)}
                      />
                      <div className="ga-opt-price-wrap">
                        <span className="ga-opt-price-prefix">$</span>
                        <input
                          className="input ga-opt-price"
                          type="number"
                          step="0.25"
                          min="0"
                          placeholder="0.00"
                          value={opt.price}
                          onChange={e => setOption(g.id, idx, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeOption(g.id, idx)}>
                        <Trash2 size={13} color="var(--color-error)" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="ga-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => saveGroup(g)}
                    disabled={saving[g.id]}
                  >
                    <Save size={14} />
                    {saving[g.id] ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ga-note">
        <strong>Note:</strong> Changes here take effect immediately on the customer-facing menu. The "More Meat" add-on group is managed per-item in the Menu Builder.
      </div>
    </div>
  );
}
