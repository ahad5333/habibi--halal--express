import React, { useState, useEffect } from 'react';
import { Users, X, Mail, Phone, MapPin, ShoppingBag } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Customers.css';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminAPI.customers()
      .then(d => setCustomers(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCustomer = async (c) => {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try { const d = await adminAPI.customer(c.id); setDetail(d); }
    catch (_) { setDetail(c); }
    finally { setDetailLoading(false); }
  };

  const visible = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name + c.email + c.phone).toLowerCase().includes(q);
  });

  return (
    <div className="customers-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Customers</p>
          <p className="page-sub">{customers.length} registered accounts</p>
        </div>
        <input className="input" style={{width:240}} placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="customers-layout">
        {/* List */}
        <div className="card" style={{padding:0,overflow:'hidden',flex:1}}>
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : visible.length === 0 ? (
            <div className="empty"><Users size={36} /><p>No customers found</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th>Orders</th>
                    <th>Total Spent</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(c => (
                    <tr key={c.id} onClick={() => openCustomer(c)} style={{cursor:'pointer'}} className={selected?.id === c.id ? 'row-selected' : ''}>
                      <td>
                        <div className="cust-name-cell">
                          <div className="cust-avatar">{(c.name||'?').charAt(0).toUpperCase()}</div>
                          <span style={{fontWeight:500}}>{c.name || '—'}</span>
                        </div>
                      </td>
                      <td className="text-muted">{c.email}</td>
                      <td className="text-muted">{c.phone || '—'}</td>
                      <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                      </td>
                      <td style={{textAlign:'center'}}><span className="badge badge-muted">{c.total_orders ?? 0}</span></td>
                      <td style={{fontWeight:500,color:'var(--gold)'}}>${parseFloat(c.total_spent || 0).toFixed(2)}</td>
                      <td><span className="badge badge-muted">{c.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="cust-detail card">
            <div className="cust-detail-hdr">
              <div className="cust-detail-avatar">{(selected.name||'?').charAt(0).toUpperCase()}</div>
              <div style={{flex:1}}>
                <p style={{fontWeight:600,fontSize:'0.95rem'}}>{selected.name}</p>
                <p className="text-muted" style={{fontSize:'0.72rem'}}>{selected.role}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            {detailLoading ? <div className="empty" style={{minHeight:100}}><div className="spinner" /></div> : (
              <>
                <div className="cust-detail-fields">
                  <div className="cust-detail-field"><Mail size={13} /><span>{(detail||selected).email}</span></div>
                  <div className="cust-detail-field"><Phone size={13} /><span>{(detail||selected).phone || '—'}</span></div>
                  {(detail||selected).dob && <div className="cust-detail-field"><span className="text-muted" style={{fontSize:'0.72rem'}}>DOB:</span><span>{(detail||selected).dob}</span></div>}
                </div>
                <div style={{display:'flex',gap:12,marginTop:12}}>
                  <div style={{flex:1,background:'var(--surface-2)',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <p style={{fontSize:'0.65rem',color:'var(--text-muted)',marginBottom:4}}>ORDERS</p>
                    <p style={{fontSize:'1.2rem',fontWeight:700}}>{selected.total_orders ?? 0}</p>
                  </div>
                  <div style={{flex:1,background:'var(--surface-2)',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <p style={{fontSize:'0.65rem',color:'var(--text-muted)',marginBottom:4}}>TOTAL SPENT</p>
                    <p style={{fontSize:'1.2rem',fontWeight:700,color:'var(--gold)'}}>${parseFloat(selected.total_spent || 0).toFixed(2)}</p>
                  </div>
                </div>

                {detail?.addresses?.length > 0 && (
                  <div className="cust-detail-section">
                    <p className="cust-detail-label">ADDRESSES</p>
                    {detail.addresses.map((a,i) => (
                      <div key={i} className="cust-detail-addr"><MapPin size={12} /><span>{a.street}, {a.city}</span></div>
                    ))}
                  </div>
                )}

                {detail?.orders?.length > 0 && (
                  <div className="cust-detail-section">
                    <p className="cust-detail-label">RECENT ORDERS ({detail.orders.length})</p>
                    {detail.orders.slice(0,5).map((o,i) => (
                      <div key={i} className="cust-detail-order">
                        <ShoppingBag size={12} />
                        <span className="mono text-primary" style={{fontSize:'0.72rem'}}>{o.order_number || o.id}</span>
                        <span className="text-muted" style={{fontSize:'0.72rem'}}>${parseFloat(o.total||0).toFixed(2)}</span>
                        <span className={`badge ${(o.order_status||o.status) === 'delivered' ? 'badge-success' : 'badge-warning'}`}>{o.order_status||o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
