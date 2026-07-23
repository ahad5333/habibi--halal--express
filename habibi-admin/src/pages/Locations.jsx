import React, { useState, useEffect } from 'react';
import { MapPin, Pencil, ToggleLeft, ToggleRight, Clock, Phone, CheckCircle, XCircle, X, Check, Plus, Trash2 } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Locations.css';

const BLANK_NEW_LOCATION = {
  title: '', exact_address: '', brief_address: '', latitude: '', longitude: '',
  phone_number: '', working_days_hours: '', delivery_radius_miles: 5, preference_level: 1, is_active: true,
};

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState(null);
  const [addrInput, setAddrInput] = useState('');
  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState(BLANK_NEW_LOCATION);
  const [addErr, setAddErr]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getLocations();
      setLocations(data);
    } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (loc) => {
    setForm({
      title:                 loc.title,
      exact_address:         loc.exact_address || '',
      brief_address:         loc.brief_address || '',
      latitude:              loc.latitude ?? '',
      longitude:             loc.longitude ?? '',
      phone_number:          loc.phone_number || '',
      working_days_hours:    loc.working_days_hours || '',
      holidays:              loc.holidays || '',
      is_active:             loc.is_active,
      accepting_orders:      loc.accepting_orders !== false,
      delivery_radius_miles: loc.delivery_radius_miles || 5,
      delivery_cost:         loc.delivery_cost || 0,
      preference_level:      loc.preference_level || 1,
      // delivery partner checkboxes
      partner_ubereats:  !!(loc.delivery_partners?.includes?.('ubereats')  || loc.partner_ubereats),
      partner_doordash:  !!(loc.delivery_partners?.includes?.('doordash')  || loc.partner_doordash),
      partner_grubhub:   !!(loc.delivery_partners?.includes?.('grubhub')   || loc.partner_grubhub),
      partner_roadie:    !!(loc.delivery_partners?.includes?.('roadie')    || loc.partner_roadie),
      partner_self:      !!(loc.delivery_partners?.includes?.('self')      || loc.partner_self),
      // tablet access credentials
      tablet_username:   loc.tablet_username || '',
      tablet_password:   '',
      // location image
      image_url:         loc.image_url || '',
      // pre-selected delivery addresses
      delivery_addresses: Array.isArray(loc.delivery_addresses) ? loc.delivery_addresses
        : (typeof loc.delivery_addresses === 'string' ? JSON.parse(loc.delivery_addresses || '[]') : []),
    });
    setAddrInput('');
    setModal(loc);
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.updateLocation(modal.id, form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const toggle = async (loc, field) => {
    setToggling(`${loc.id}_${field}`);
    try {
      const updated = await adminAPI.toggleLocation(loc.id, field);
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, ...updated } : l));
    } catch (e) { alert(e.message); }
    setToggling(null);
  };

  const openAdd = () => { setAddForm(BLANK_NEW_LOCATION); setAddErr(''); setAddModal(true); };

  const createLoc = async () => {
    if (!addForm.title.trim()) { setAddErr('Name is required.'); return; }
    if (!addForm.exact_address.trim()) { setAddErr('Address is required.'); return; }
    if (addForm.latitude === '' || addForm.longitude === '') { setAddErr('Latitude and longitude are required.'); return; }
    setSaving(true);
    setAddErr('');
    try {
      await adminAPI.createLocation(addForm);
      setAddModal(false);
      load();
    } catch (e) {
      setAddErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminAPI.deleteLocation(deleteTarget.id);
      setDeleteTarget(null);
      setModal(null);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = locations.filter(l => l.is_active).length;
  const acceptingCount = locations.filter(l => l.accepting_orders !== false).length;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Location Management</h1>
          <p className="page-sub">{activeCount} active · {acceptingCount} accepting orders</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add Location</button>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner"/></div>
      ) : (
        <div className="loc-grid">
          {locations.map(loc => (
            <div key={loc.id} className={`card loc-card ${!loc.is_active ? 'loc-inactive' : ''}`}>
              <div className="loc-card-hdr">
                <div className="loc-icon-wrap">
                  <MapPin size={18}/>
                </div>
                <div className="loc-info">
                  <h3 className="loc-name">{loc.title}</h3>
                  <p className="loc-addr">{loc.brief_address || loc.exact_address}</p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(loc)} title="Edit"><Pencil size={14}/></button>
              </div>

              <div className="loc-details">
                {loc.phone_number && (
                  <div className="loc-detail-row">
                    <Phone size={12}/> {loc.phone_number}
                  </div>
                )}
                {loc.working_days_hours && (
                  <div className="loc-detail-row">
                    <Clock size={12}/> {loc.working_days_hours}
                  </div>
                )}
                {loc.holidays && (
                  <div className="loc-detail-row" style={{color:'var(--color-text-muted)',fontSize:'0.72rem'}}>
                    Holidays: {loc.holidays}
                  </div>
                )}
                <div className="loc-detail-row">
                  <MapPin size={12}/> Delivery radius: {loc.delivery_radius_miles} mi · ${parseFloat(loc.delivery_cost||0).toFixed(2)} fee
                </div>
              </div>

              <div className="loc-toggles">
                <div className="loc-toggle-row">
                  <span className="loc-toggle-label">Location Active</span>
                  <button
                    className={`loc-toggle-btn ${loc.is_active ? 'on' : 'off'}`}
                    onClick={() => toggle(loc, 'is_active')}
                    disabled={toggling === `${loc.id}_is_active`}
                  >
                    {loc.is_active
                      ? <><ToggleRight size={20}/> <span>On</span></>
                      : <><ToggleLeft size={20}/> <span>Off</span></>
                    }
                  </button>
                </div>
                <div className="loc-toggle-row">
                  <span className="loc-toggle-label">Accepting Orders</span>
                  <button
                    className={`loc-toggle-btn ${loc.accepting_orders !== false ? 'on' : 'off'}`}
                    onClick={() => toggle(loc, 'accepting_orders')}
                    disabled={toggling === `${loc.id}_accepting_orders`}
                  >
                    {loc.accepting_orders !== false
                      ? <><CheckCircle size={16}/> <span>Yes</span></>
                      : <><XCircle size={16}/> <span>No</span></>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Edit — {modal.title}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Location Name</label>
                <input className="input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} />
              </div>
              <div className="field">
                <label>Exact Address</label>
                <input className="input" value={form.exact_address} onChange={e => setForm({...form,exact_address:e.target.value})} placeholder="e.g. 3717 Bedford Park Blvd, Bronx, NY 10467" />
              </div>
              <div className="field">
                <label>Brief Address <span className="text-muted" style={{fontWeight:400,fontSize:'0.7rem'}}>(shown to customers, optional)</span></label>
                <input className="input" value={form.brief_address} onChange={e => setForm({...form,brief_address:e.target.value})} placeholder="Bedford Park, Bronx" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Latitude</label>
                  <input className="input" type="number" step="any" value={form.latitude} onChange={e => setForm({...form,latitude:e.target.value})} placeholder="40.8712" />
                </div>
                <div className="field">
                  <label>Longitude</label>
                  <input className="input" type="number" step="any" value={form.longitude} onChange={e => setForm({...form,longitude:e.target.value})} placeholder="-73.8859" />
                </div>
              </div>
              <p className="text-muted" style={{fontSize:'0.7rem',marginTop:'-0.5rem',marginBottom:'0.75rem'}}>
                Used to calculate delivery distance. Right-click the location on Google Maps and copy the coordinates shown at the top of the menu.
              </p>
              <div className="field">
                <label>Phone Number</label>
                <input className="input" value={form.phone_number} onChange={e => setForm({...form,phone_number:e.target.value})} placeholder="(718) 555-0000" />
              </div>
              <div className="field">
                <label>Hours</label>
                <input className="input" value={form.working_days_hours} onChange={e => setForm({...form,working_days_hours:e.target.value})} placeholder="Mon–Sun: 7AM – 11PM" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Delivery Radius (miles)</label>
                  <input className="input" type="number" min="0" step="0.5" value={form.delivery_radius_miles} onChange={e => setForm({...form,delivery_radius_miles:e.target.value})} />
                </div>
                <div className="field">
                  <label>Delivery Fee ($)</label>
                  <input className="input" type="number" min="0" step="0.50" value={form.delivery_cost} onChange={e => setForm({...form,delivery_cost:e.target.value})} />
                </div>
              </div>
              <div className="field">
                <label>Holidays / Closures</label>
                <textarea className="input" rows={2} value={form.holidays} onChange={e => setForm({...form,holidays:e.target.value})} placeholder="e.g. Eid al-Adha, Eid al-Fitr" />
              </div>
              <div className="field">
                <label>Preference Level (1 = highest priority)</label>
                <input className="input" type="number" min="1" max="10" value={form.preference_level} onChange={e => setForm({...form,preference_level:+e.target.value})} />
              </div>
              <div className="field">
                <label>Delivery Partners</label>
                <div className="loc-partners-grid">
                  {[['ubereats','Uber Eats'],['doordash','DoorDash'],['grubhub','Grubhub'],['roadie','Roadie'],['self','Self-Delivery']].map(([key,label]) => (
                    <label key={key} className="loc-modal-toggle">
                      <input type="checkbox" checked={!!form[`partner_${key}`]} onChange={e => setForm({...form,[`partner_${key}`]:e.target.checked})} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Tablet Username</label>
                  <input className="input" value={form.tablet_username} onChange={e => setForm({...form,tablet_username:e.target.value})} placeholder="tablet@location" />
                </div>
                <div className="field">
                  <label>Tablet Password</label>
                  <input className="input" type="password" value={form.tablet_password} onChange={e => setForm({...form,tablet_password:e.target.value})} placeholder="Leave blank to keep current" />
                </div>
              </div>
              <div className="field">
                <label>Location Image URL</label>
                <input className="input" value={form.image_url} onChange={e => setForm({...form,image_url:e.target.value})} placeholder="/images/locations/bedford-park.jpg" />
                {form.image_url && (
                  <img src={form.image_url} alt="preview" style={{marginTop:'0.4rem',height:60,width:'100%',objectFit:'cover',borderRadius:6,opacity:0.85}} onError={e=>{e.target.style.display='none'}} />
                )}
              </div>
              <div className="loc-modal-toggles">
                <label className="loc-modal-toggle">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form,is_active:e.target.checked})} />
                  <span>Location is Active</span>
                </label>
                <label className="loc-modal-toggle">
                  <input type="checkbox" checked={form.accepting_orders} onChange={e => setForm({...form,accepting_orders:e.target.checked})} />
                  <span>Accepting Orders</span>
                </label>
              </div>

              {/* Pre-selected delivery addresses */}
              <div className="field">
                <label>
                  Pre-Selected Delivery Addresses
                  <span className="text-muted" style={{fontWeight:400,marginLeft:'0.4rem',fontSize:'0.7rem'}}>
                    ({(form.delivery_addresses||[]).length}/30)
                  </span>
                </label>
                <div className="loc-addr-list">
                  {(form.delivery_addresses||[]).map((addr, i) => (
                    <div key={i} className="loc-addr-row">
                      <span style={{flex:1,fontSize:'0.8rem'}}>{addr}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{color:'#ef4444',padding:'0.2rem'}}
                        onClick={() => setForm({...form, delivery_addresses: form.delivery_addresses.filter((_,j)=>j!==i)})}
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
                {(form.delivery_addresses||[]).length < 30 && (
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                    <input
                      className="input"
                      style={{flex:1}}
                      placeholder="123 Main St, Bronx, NY 10451"
                      value={addrInput}
                      onChange={e => setAddrInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = addrInput.trim();
                          if (v && (form.delivery_addresses||[]).length < 30) {
                            setForm({...form, delivery_addresses: [...(form.delivery_addresses||[]), v]});
                            setAddrInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const v = addrInput.trim();
                        if (v && (form.delivery_addresses||[]).length < 30) {
                          setForm({...form, delivery_addresses: [...(form.delivery_addresses||[]), v]});
                          setAddrInput('');
                        }
                      }}
                    >
                      <Plus size={13}/> Add
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{justifyContent:'space-between'}}>
              <button className="btn btn-danger" onClick={() => setDeleteTarget(modal)}>
                <Trash2 size={14}/> Delete Location
              </button>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? <div className="spinner"/> : <><Check size={14}/> Save</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Add Location</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              {addErr && <p style={{color:'#ef4444',fontSize:'0.8rem',marginBottom:'0.75rem'}}>{addErr}</p>}
              <div className="field">
                <label>Location Name *</label>
                <input className="input" value={addForm.title} onChange={e => setAddForm({...addForm,title:e.target.value})} placeholder="e.g. Yonkers" />
              </div>
              <div className="field">
                <label>Exact Address *</label>
                <input className="input" value={addForm.exact_address} onChange={e => setAddForm({...addForm,exact_address:e.target.value})} placeholder="123 Main St, Yonkers, NY 10701" />
              </div>
              <div className="field">
                <label>Brief Address <span className="text-muted" style={{fontWeight:400,fontSize:'0.7rem'}}>(shown to customers, optional)</span></label>
                <input className="input" value={addForm.brief_address} onChange={e => setAddForm({...addForm,brief_address:e.target.value})} placeholder="Downtown Yonkers" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Latitude *</label>
                  <input className="input" type="number" step="any" value={addForm.latitude} onChange={e => setAddForm({...addForm,latitude:e.target.value})} placeholder="40.9312" />
                </div>
                <div className="field">
                  <label>Longitude *</label>
                  <input className="input" type="number" step="any" value={addForm.longitude} onChange={e => setAddForm({...addForm,longitude:e.target.value})} placeholder="-73.8988" />
                </div>
              </div>
              <p className="text-muted" style={{fontSize:'0.7rem',marginTop:'-0.5rem',marginBottom:'0.75rem'}}>
                Right-click the location on Google Maps and copy the coordinates shown at the top of the menu.
              </p>
              <div className="field">
                <label>Phone Number</label>
                <input className="input" value={addForm.phone_number} onChange={e => setAddForm({...addForm,phone_number:e.target.value})} placeholder="(718) 555-0000" />
              </div>
              <div className="field">
                <label>Hours</label>
                <input className="input" value={addForm.working_days_hours} onChange={e => setAddForm({...addForm,working_days_hours:e.target.value})} placeholder="Mon–Sun: 7AM – 11PM" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem'}}>
                <div className="field">
                  <label>Delivery Radius (miles)</label>
                  <input className="input" type="number" min="0" step="0.5" value={addForm.delivery_radius_miles} onChange={e => setAddForm({...addForm,delivery_radius_miles:e.target.value})} />
                </div>
                <div className="field">
                  <label>Preference Level (1 = highest)</label>
                  <input className="input" type="number" min="1" max="10" value={addForm.preference_level} onChange={e => setAddForm({...addForm,preference_level:+e.target.value})} />
                </div>
              </div>
              <label className="loc-modal-toggle">
                <input type="checkbox" checked={addForm.is_active} onChange={e => setAddForm({...addForm,is_active:e.target.checked})} />
                <span>Location is Active</span>
              </label>
              <p className="text-muted" style={{fontSize:'0.72rem',marginTop:'0.75rem'}}>
                After creating, open the new location's Edit panel to set up tablet login, delivery partners, holidays, and pre-selected delivery addresses.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createLoc} disabled={saving}>
                {saving ? <div className="spinner"/> : <><Check size={14}/> Create Location</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Delete Location</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:'0.75rem'}}>
                Permanently delete <strong>{deleteTarget.title}</strong>? This removes its menu availability settings and delivery-platform mappings. This cannot be undone.
              </p>
              <p className="text-muted" style={{fontSize:'0.8rem'}}>
                If you just want to stop taking orders here temporarily, use "Active: Off" instead — it's reversible.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? <div className="spinner"/> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
