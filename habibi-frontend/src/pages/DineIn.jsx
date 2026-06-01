import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ShoppingBag, Clock, CheckCircle } from 'lucide-react';
import { useDineIn } from '../context/DineInContext';
import './DineIn.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function DineIn() {
  const { tableSlug } = useParams();
  const navigate = useNavigate();
  const { setTable, isDineIn, table: existingTable } = useDineIn();

  const [table, setLocalTable]  = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/dine-in/tables/by-slug/${tableSlug}`)
      .then(r => {
        if (!r.ok) throw new Error('Table not found');
        return r.json();
      })
      .then(data => {
        setLocalTable(data);
        setTable(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [tableSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartOrdering = () => navigate('/menu');

  if (loading) {
    return (
      <div className="di-page">
        <div className="di-loading">
          <div className="di-spinner" />
          <p>Finding your table…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="di-page">
        <div className="di-error-card">
          <UtensilsCrossed size={48} strokeWidth={1.5} />
          <h2>Table Not Found</h2>
          <p>This QR code may be outdated. Please ask a staff member for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="di-page">
      <div className="di-container">

        {/* Logo / brand */}
        <div className="di-brand">
          <img src="/images/logos/logo.png" alt="Habibi Halal Express" className="di-logo" />
        </div>

        {/* Welcome card */}
        <div className="di-welcome-card">
          <div className="di-check-ring">
            <CheckCircle size={40} strokeWidth={1.5} />
          </div>
          <p className="di-pre-title">Welcome to</p>
          <h1 className="di-title">Habibi Halal Express</h1>
          <div className="di-table-badge">
            <UtensilsCrossed size={16} />
            <span>{table?.table_name || 'Your Table'}</span>
          </div>
        </div>

        {/* How it works */}
        <div className="di-steps">
          <div className="di-step">
            <div className="di-step-num">1</div>
            <div>
              <p className="di-step-title">Browse the Menu</p>
              <p className="di-step-sub">Add your favourites to the cart</p>
            </div>
          </div>
          <div className="di-step">
            <div className="di-step-num">2</div>
            <div>
              <p className="di-step-title">Place Your Order</p>
              <p className="di-step-sub">Pay by card, Apple Pay, or cash</p>
            </div>
          </div>
          <div className="di-step">
            <div className="di-step-num">3</div>
            <div>
              <p className="di-step-title">We Bring It to You</p>
              <p className="di-step-sub">Delivered hot to your table</p>
            </div>
          </div>
        </div>

        {/* ETA note */}
        <div className="di-eta-note">
          <Clock size={15} />
          <span>Food usually arrives within 10–15 minutes</span>
        </div>

        {/* CTA */}
        <button className="di-cta" onClick={handleStartOrdering}>
          <ShoppingBag size={20} />
          Start Ordering
        </button>

        <p className="di-halal-note">100% Zabiha Halal · Hand-Slaughtered</p>
      </div>
    </div>
  );
}
