import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { MapPin, Navigation, CheckCircle, Phone, Package } from 'lucide-react';
import io from 'socket.io-client';
import './Driver.css';

export default function DriverView() {
  const [searchParams] = useSearchParams();
  const driverId = searchParams.get('id');
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!driverId) {
      setError('No driver ID provided.');
      setLoading(false);
      return;
    }
    
    // Connect to websocket
    const adminToken = localStorage.getItem('habibi_admin_token');
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      auth: adminToken ? { token: adminToken } : undefined,
    });
    setSocket(newSocket);

    // Fetch assignment
    const fetchAssignment = async () => {
      try {
        const data = await adminAPI.getDriverAssignment(driverId);
        setAssignment(data);
      } catch (err) {
        setError('Failed to load assignment. Make sure you are logged in as admin.');
      }
      setLoading(false);
    };

    fetchAssignment();

    return () => newSocket.disconnect();
  }, [driverId]);

  // GPS Tracking Loop
  useEffect(() => {
    if (!tracking || !assignment || !socket) return;
    
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            adminAPI.updateDriverGPS(assignment.id, { lat: latitude, lng: longitude, driver_id: driverId })
              .catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }, 10000); // Send GPS every 10 seconds

    return () => clearInterval(interval);
  }, [tracking, assignment, socket, driverId]);

  const toggleTracking = () => {
    if (!tracking) {
      // Prompt permissions
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => setTracking(true),
          (err) => alert("Please allow location access to start tracking. " + err.message)
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    } else {
      setTracking(false);
    }
  };

  const markDelivered = async () => {
    if (!window.confirm("Mark this order as delivered?")) return;
    try {
      await adminAPI.updateAssignmentStatus(assignment.id, 'delivered');
      setAssignment(null);
      setTracking(false);
      alert("Order delivered successfully!");
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  if (loading) return <div className="driver-loading">Loading assignment...</div>;
  if (error) return <div className="driver-error">{error}</div>;
  if (!assignment) return (
    <div className="driver-empty">
      <CheckCircle size={64} className="driver-empty-icon" />
      <h2>You're all caught up!</h2>
      <p>Waiting for your next delivery assignment...</p>
      <button onClick={() => window.location.reload()} className="driver-btn">Refresh</button>
    </div>
  );

  return (
    <div className="driver-view">
      <div className="driver-header">
        <h1>Current Delivery</h1>
        <div className={`driver-status ${assignment.status}`}>
          {assignment.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      <div className="driver-card">
        <div className="driver-card-header">
          <h2>Order {assignment.order_number || `#${assignment.order_id}`}</h2>
        </div>
        <div className="driver-card-body">
          <div className="driver-info-item">
            <UserIcon />
            <div>
              <p className="label">Customer</p>
              <p className="value">{assignment.customer_name || 'N/A'}</p>
            </div>
          </div>
          <div className="driver-info-item">
            <MapPin />
            <div>
              <p className="label">Delivery Address</p>
              <p className="value">{assignment.delivery_address || 'N/A'}</p>
              {assignment.delivery_address && (
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(assignment.delivery_address)}`}
                  target="_blank" rel="noreferrer"
                  className="driver-map-link"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>
          {assignment.customer_phone && (
            <div className="driver-info-item">
              <Phone />
              <div>
                <p className="label">Contact</p>
                <a href={`tel:${assignment.customer_phone}`} className="value driver-phone-link">
                  {assignment.customer_phone}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="driver-actions">
          <button 
            className={`driver-btn ${tracking ? 'tracking' : 'start'}`}
            onClick={toggleTracking}
          >
            <Navigation size={18} />
            {tracking ? 'Stop GPS Broadcast' : 'Start GPS Broadcast'}
          </button>
          
          <button 
            className="driver-btn complete"
            onClick={markDelivered}
          >
            <CheckCircle size={18} />
            Mark as Delivered
          </button>
        </div>
      </div>
      {tracking && <div className="tracking-pulse">Live location is being shared with dispatch...</div>}
    </div>
  );
}

function UserIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
}
