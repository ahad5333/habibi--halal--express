import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, MapPin, Eye, EyeOff, Save, RefreshCw,
  CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp,
  Layers, AlertTriangle,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './PlatformCredentials.css';

// Field definitions per platform — tells the UI what credentials to collect
const PLATFORM_FIELDS = {
  ubereats: [
    { key: 'client_id',      label: 'Client ID',      hint: 'From UberEats Developer Portal' },
    { key: 'client_secret',  label: 'Client Secret',  hint: 'OAuth 2.0 client secret', secret: true },
    { key: 'webhook_secret', label: 'Webhook Secret',  hint: 'For validating inbound webhooks', secret: true },
  ],
  grubhub: [
    { key: 'username',        label: 'API Username',     hint: 'GrubHub partner username' },
    { key: 'password',        label: 'API Password',     hint: 'GrubHub partner password', secret: true },
    { key: 'restaurant_id',   label: 'Restaurant ID',    hint: 'Numeric GrubHub restaurant ID' },
  ],
  doordash: [
    { key: 'developer_id',   label: 'Developer ID',    hint: 'From DoorDash Developer Portal' },
    { key: 'key_id',         label: 'Key ID',          hint: 'JWT key identifier' },
    { key: 'signing_secret', label: 'Signing Secret',  hint: 'Base64-encoded HS256 secret', secret: true },
  ],
  caviar: [
    { key: 'developer_id',   label: 'Developer ID',    hint: 'Same as DoorDash (Caviar uses DoorDash API)' },
    { key: 'key_id',         label: 'Key ID',          hint: 'JWT key identifier' },
    { key: 'signing_secret', label: 'Signing Secret',  hint: 'Base64-encoded HS256 secret', secret: true },
  ],
};

const PLATFORM_COLORS = { ubereats: '#06c167', grubhub: '#f63440', doordash: '#ff3008', caviar: '#cc3a00' };

function CredentialField({ fieldDef, currentValue }) {
  const [show, setShow]   = useState(false);
  const [value, setValue] = useState('');
  const isSet = currentValue?.set;

  return (
    <div className="cred-field">
      <label className="cred-field-label">
        {fieldDef.label}
        {isSet && <span className="cred-set-badge"><CheckCircle2 size={11}/> Set ({currentValue.preview})</span>}
      </label>
      <div className="cred-input-row">
        <input
          type={show || !fieldDef.secret ? 'text' : 'password'}
          className="cred-input"
          placeholder={isSet ? 'Enter new value to update...' : `Enter ${fieldDef.label}...`}
          value={value}
          onChange={e => setValue(e.target.value)}
          data-field={fieldDef.key}
        />
        {fieldDef.secret && (
          <button type="button" className="cred-toggle-vis" onClick={() => setShow(s => !s)}>
            {show ? <EyeOff size={14}/> : <Eye size={14}/>}
          </button>
        )}
      </div>
      {fieldDef.hint && <p className="cred-hint">{fieldDef.hint}</p>}
    </div>
  );
}

function PlatformCredCard({ platform, data, onSave }) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const fields              = PLATFORM_FIELDS[platform] || [];
  const color               = PLATFORM_COLORS[platform] || '#888';
  const setCount            = fields.filter(f => data.credentials?.[f.key]?.set).length;

  const handleSave = async (e) => {
    e.preventDefault();
    const form   = e.currentTarget;
    const inputs = form.querySelectorAll('input[data-field]');
    const creds  = {};
    inputs.forEach(inp => { if (inp.value.trim()) creds[inp.dataset.field] = inp.value.trim(); });
    if (!Object.keys(creds).length) return;

    setSaving(true);
    setMsg(null);
    const ok = await onSave(platform, creds);
    setSaving(false);
    setMsg(ok ? 'Saved successfully' : 'Save failed — check backend logs');
    setTimeout(() => setMsg(null), 3000);
    if (ok) form.reset();
  };

  return (
    <div className="cred-card" style={{ borderTopColor: color }}>
      <div className="cred-card-hdr" onClick={() => setOpen(o => !o)}>
        <div>
          <span className="cred-platform-name" style={{ color }}>{data.display_name}</span>
          <div className="cred-status-row">
            <span className={`cred-badge ${data.api_key_set ? 'cred-badge-ok' : 'cred-badge-warn'}`}>
              {data.api_key_set ? <><CheckCircle2 size={10}/> Keys Set</> : <><XCircle size={10}/> No Keys</>}
            </span>
            <span className="cred-field-count">{setCount}/{fields.length} fields configured</span>
          </div>
        </div>
        <button className="cred-expand-btn">
          {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
      </div>

      {open && (
        <form className="cred-card-body" onSubmit={handleSave}>
          {fields.map(f => (
            <CredentialField
              key={f.key}
              fieldDef={f}
              currentValue={data.credentials?.[f.key]}
            />
          ))}
          {msg && (
            <div className={`cred-msg ${msg.includes('failed') ? 'cred-msg-err' : 'cred-msg-ok'}`}>
              {msg}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-sm cred-save-btn" disabled={saving}>
            {saving ? <div className="spinner"/> : <><Save size={13}/> Save Credentials</>}
          </button>
        </form>
      )}
    </div>
  );
}

function LocationMappingTable({ mappings, locations, platforms, onSave, onSync }) {
  const [editing, setEditing] = useState(null); // "locationId-platform"
  const [values, setValues]   = useState({});
  const [syncing, setSyncing] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const getMapping = (locationId, platform) =>
    mappings.find(m => m.location_id === locationId && m.platform === platform);

  const startEdit = (locationId, platform) => {
    const m = getMapping(locationId, platform) || {};
    const key = `${locationId}-${platform}`;
    setValues(v => ({
      ...v,
      [key]: {
        platform_store_id:      m.platform_store_id      || '',
        platform_restaurant_id: m.platform_restaurant_id || '',
      },
    }));
    setEditing(key);
  };

  const handleSave = async (locationId, platform) => {
    const key = `${locationId}-${platform}`;
    await onSave({ location_id: locationId, platform, ...values[key], is_active: true });
    setEditing(null);
  };

  const handleSync = async (locationId, platform) => {
    const key = `${locationId}-${platform}`;
    setSyncing(key);
    setSyncMsg(null);
    const result = await onSync(platform, locationId);
    setSyncing(null);
    setSyncMsg(result?.success ? `Synced to ${platform}` : (result?.reason || result?.message || 'Sync failed'));
    setTimeout(() => setSyncMsg(null), 4000);
  };

  return (
    <div className="lm-section">
      <h3 className="cred-section-title"><MapPin size={16}/> Location → Platform Mapping</h3>
      <p className="cred-section-sub">
        Enter the Store ID / Restaurant ID assigned to each Habibi location on each platform.
        Once set, use "Sync" to push the menu to that platform location.
      </p>

      {syncMsg && (
        <div className={`lm-sync-msg ${syncMsg.includes('failed') || syncMsg.includes('Sync failed') ? 'lm-sync-err' : 'lm-sync-ok'}`}>
          {syncMsg}
        </div>
      )}

      <div className="lm-table-wrap">
        <table className="lm-table">
          <thead>
            <tr>
              <th>Location</th>
              {platforms.map(p => <th key={p.platform}>{p.display_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {locations.map(loc => (
              <tr key={loc.id}>
                <td>
                  <p className="lm-loc-name">{loc.title}</p>
                  <p className="lm-loc-addr">{loc.brief_address}</p>
                </td>
                {platforms.map(p => {
                  const m   = getMapping(loc.id, p.platform);
                  const key = `${loc.id}-${p.platform}`;
                  const isEditing = editing === key;

                  return (
                    <td key={p.platform}>
                      {isEditing ? (
                        <div className="lm-edit-cell">
                          <input
                            className="lm-input"
                            placeholder="Store ID"
                            value={values[key]?.platform_store_id || ''}
                            onChange={e => setValues(v => ({ ...v, [key]: { ...v[key], platform_store_id: e.target.value } }))}
                          />
                          <input
                            className="lm-input"
                            placeholder="Restaurant ID"
                            value={values[key]?.platform_restaurant_id || ''}
                            onChange={e => setValues(v => ({ ...v, [key]: { ...v[key], platform_restaurant_id: e.target.value } }))}
                          />
                          <div className="lm-edit-actions">
                            <button className="btn btn-primary btn-xs" onClick={() => handleSave(loc.id, p.platform)}>Save</button>
                            <button className="btn btn-secondary btn-xs" onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="lm-cell">
                          {m ? (
                            <>
                              {m.platform_store_id && <code className="lm-id">Store: {m.platform_store_id}</code>}
                              {m.platform_restaurant_id && <code className="lm-id">Rest: {m.platform_restaurant_id}</code>}
                              <div className="lm-cell-actions">
                                <button className="lm-btn-edit" onClick={() => startEdit(loc.id, p.platform)}>Edit</button>
                                <button
                                  className="lm-btn-sync"
                                  onClick={() => handleSync(loc.id, p.platform)}
                                  disabled={syncing === key}
                                >
                                  {syncing === key ? <div className="spinner spinner-xs"/> : <><RotateCcw size={10}/> Sync</>}
                                </button>
                              </div>
                            </>
                          ) : (
                            <button className="lm-btn-add" onClick={() => startEdit(loc.id, p.platform)}>
                              + Add IDs
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlatformCredentials() {
  const [creds, setCreds]           = useState([]);
  const [mappingData, setMappingData] = useState({ mappings: [], locations: [], platforms: [] });
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([adminAPI.getCredentials(), adminAPI.getLocationMappings()]);
      setCreds(Array.isArray(c) ? c : []);
      setMappingData(m || { mappings: [], locations: [], platforms: [] });
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveCreds = async (platform, credentials) => {
    try {
      await adminAPI.updateCredentials(platform, credentials);
      await load();
      return true;
    } catch (_) { return false; }
  };

  const handleSaveMapping = async (body) => {
    try {
      await adminAPI.upsertLocationMapping(body);
      await load();
    } catch (_) {}
  };

  const handleSync = async (platform, locationId) => {
    try {
      return await adminAPI.triggerMenuSync({ platform, location_id: locationId });
    } catch (err) { return { success: false, reason: err.message }; }
  };

  return (
    <div className="cred-page">
      <div className="page-hdr">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={22}/> Platform Credentials
          </h1>
          <p className="page-sub">
            Manage API keys for UberEats, GrubHub, DoorDash &amp; Caviar. Enter credentials when received from each platform.
          </p>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh"><RefreshCw size={15}/></button>
      </div>

      <div className="cred-warning">
        <AlertTriangle size={15}/>
        <p>Credentials are stored in the database. For production, move them to environment variables (.env) for better security.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner"/></div>
      ) : (
        <>
          <div className="cred-section">
            <h2 className="cred-section-title"><KeyRound size={16}/> API Credentials</h2>
            <p className="cred-section-sub">Click a platform to expand and enter credentials. Existing values are masked — enter a new value to replace.</p>
            <div className="cred-cards-grid">
              {creds.map(p => (
                <PlatformCredCard key={p.platform} platform={p.platform} data={p} onSave={handleSaveCreds} />
              ))}
            </div>
          </div>

          <div className="cred-env-hint">
            <h3 className="cred-env-title"><Layers size={15}/> Alternatively — use Environment Variables</h3>
            <p>Add these to your <code>.env</code> file on the server (takes precedence over DB values):</p>
            <div className="cred-env-grid">
              {[
                { section: 'UberEats', vars: ['UBEREATS_CLIENT_ID', 'UBEREATS_CLIENT_SECRET', 'UBEREATS_WEBHOOK_SECRET'] },
                { section: 'GrubHub',  vars: ['GRUBHUB_USERNAME', 'GRUBHUB_PASSWORD', 'GRUBHUB_RESTAURANT_ID'] },
                { section: 'DoorDash / Caviar', vars: ['DOORDASH_DEVELOPER_ID', 'DOORDASH_KEY_ID', 'DOORDASH_SIGNING_SECRET'] },
              ].map(g => (
                <div key={g.section} className="cred-env-card">
                  <p className="cred-env-section">{g.section}</p>
                  {g.vars.map(v => <code key={v} className="cred-env-var">{v}=your_value_here</code>)}
                </div>
              ))}
            </div>
          </div>

          <LocationMappingTable
            mappings={mappingData.mappings}
            locations={mappingData.locations}
            platforms={mappingData.platforms}
            onSave={handleSaveMapping}
            onSync={handleSync}
          />
        </>
      )}
    </div>
  );
}
