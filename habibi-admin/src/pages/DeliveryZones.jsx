import React, { useState, useEffect } from 'react';
import { Truck, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminAPI } from '../services/api';
import './DeliveryZones.css';

const BLANK = { location_id: '', name: '', min_radius_mi: 0, max_radius_mi: 5, delivery_fee: 0, is_active: true };

export default function DeliveryZones() {
  const [zones, setZones]         = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [z, locs] = await Promise.all([adminAPI.getZones(), adminAPI.getLocations()]);
      setZones(z);
      setLocations(locs);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(BLANK); setModal('add'); };
  const openEdit = (z) => {
    setForm({ ...z, location_id: z.location_id || '', min_radius_mi: z.min_radius_mi, max_radius_mi: z.max_radius_mi, delivery_fee: z.delivery_fee });
    setModal(z);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        location_id: form.location_id || null,
        min_radius_mi: parseFloat(form.min_radius_mi)||0,
        max_radius_mi: parseFloat(form.max_radius_mi)||5,
        delivery_fee: parseFloat(form.delivery_fee)||0,
      };
      if (modal === 'add') await adminAPI.createZone(payload);
      else await adminAPI.updateZone(modal.id, payload);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const del = async () => {
    await adminAPI.deleteZone(deleteTarget.id);
    setDelete(null);
    load();
  };

  const grouped = locations.reduce((acc, loc) => {
    acc[loc.id] = { ...loc, zones: zones.filter(z => z.location_id === loc.id) };
    return acc;
  }, {});
  const unassigned = zones.filter(z => !z.location_id);

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Delivery Zones</h1>
          <p className="page-sub">{zones.length} zone{zones.length!==1?'s':''} · {zones.filter(z=>z.is_active).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add Zone</button>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : (
        <div>
          {/* Zones by location */}
          {Object.values(grouped).map(loc => (
            <div key={loc.id} className="card dz-location-card">
              <div className="dz-location-hdr">
                <Truck size={16}/>
                <h3>{loc.title}</h3>
                <span className="text-muted" style={{fontSize:'0.72rem'}}>{loc.brief_address}</span>
              </div>
              {loc.zones.length === 0 ? (
                <p className="text-muted" style={{fontSize:'0.82rem',padding:'0.5rem 0'}}>No zones defined for this location.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Zone Name</th><th>Distance Range</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {loc.zones.map(z => (
                        <ZoneRow key={z.id} zone={z} onEdit={() => openEdit(z)} onDelete={() => setDelete(z)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Unassigned zones */}
          {unassigned.length > 0 && (
            <div className="card dz-location-card">
              <div className="dz-location-hdr">
                <Truck size={16}/>
                <h3>Global Zones (all locations)</h3>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Zone Name</th><th>Distance Range</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {unassigned.map(z => (
                      <ZoneRow key={z.id} zone={z} onEdit={() => openEdit(z)} onDelete={() => setDelete(z)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {zones.length === 0 && (
            <div className="empty card"><Truck size={32}/><p>No delivery zones yet. Add one to get started.</p></div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">{modal === 'add' ? 'Add Delivery Zone' : 'Edit Zone'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Zone Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. Local Zone, Express Zone" />
              </div>
              <div className="field">
                <label>Location (optional)</label>
                <select className="input select" value={form.location_id} onChange={e => setForm({...form,location_id:e.target.value})}>
                  <option value="">All Locations</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Min (miles)</label>
                  <input className="input" type="number" min="0" step="0.5" value={form.min_radius_mi} onChange={e => setForm({...form,min_radius_mi:e.target.value})} />
                </div>
                <div className="field">
                  <label>Max (miles)</label>
                  <input className="input" type="number" min="0" step="0.5" value={form.max_radius_mi} onChange={e => setForm({...form,max_radius_mi:e.target.value})} />
                </div>
                <div className="field">
                  <label>Fee ($)</label>
                  <input className="input" type="number" min="0" step="0.50" value={form.delivery_fee} onChange={e => setForm({...form,delivery_fee:e.target.value})} />
                </div>
              </div>
              <label className="dz-active-toggle">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form,is_active:e.target.checked})} />
                <span>Zone is Active</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.name.trim()}>
                {saving ? <div className="spinner"/> : <><Check size={14}/> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDelete(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Delete Zone</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDelete(null)}><X size={16}/></button>
            </div>
            <p style={{marginBottom:'1.5rem'}}>Delete zone <strong>{deleteTarget.name}</strong>?</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={del}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneRow({ zone, onEdit, onDelete }) {
  return (
    <tr>
      <td style={{fontWeight:600}}>{zone.name}</td>
      <td className="text-muted">{zone.min_radius_mi} – {zone.max_radius_mi} mi</td>
      <td style={{fontWeight:600}}>${parseFloat(zone.delivery_fee).toFixed(2)}</td>
      <td>
        {zone.is_active
          ? <span className="badge badge-success">Active</span>
          : <span className="badge badge-muted">Inactive</span>
        }
      </td>
      <td>
        <div style={{display:'flex',gap:'0.4rem'}}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onEdit}><Pencil size={13}/></button>
          <button className="btn btn-danger btn-sm btn-icon" onClick={onDelete}><Trash2 size={13}/></button>
        </div>
      </td>
    </tr>
  );
}
