import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="nf-page">
      <div className="nf-content">
        <p className="nf-code">404</p>
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-sub">
          Looks like this page wandered off — probably looking for more food.
        </p>
        <div className="nf-actions">
          <Link to="/"     className="btn btn-primary nf-btn">Back to Home</Link>
          <Link to="/menu" className="btn btn-outline nf-btn">Browse Menu</Link>
        </div>
      </div>
    </div>
  );
}
