import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BRONX = [40.8448, -73.8648];

const driverIcon = L.divIcon({
  className: '',
  html: '<div class="dv-map-driver-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const destIcon = L.divIcon({
  className: '',
  html: '<div class="dv-map-dest-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function DriverMap({ driverPos, destPos }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const driverRef    = useRef(null);
  const destRef      = useRef(null);
  const lineRef      = useRef(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = driverPos
      ? [driverPos.lat, driverPos.lng]
      : destPos
      ? [destPos.lat, destPos.lng]
      : BRONX;

    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Minimal attribution bottom-left
    L.control.attribution({ prefix: false, position: 'bottomleft' })
      .addAttribution('© <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      driverRef.current = null;
      destRef.current = null;
      lineRef.current = null;
    };
  }, []);

  // Update driver marker + route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPos) return;
    const latlng = [driverPos.lat, driverPos.lng];

    if (driverRef.current) {
      driverRef.current.setLatLng(latlng);
    } else {
      driverRef.current = L.marker(latlng, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
    }

    // Update dashed route line if dest exists
    if (destRef.current) {
      const pts = [latlng, destRef.current.getLatLng()];
      if (lineRef.current) {
        lineRef.current.setLatLngs(pts);
      } else {
        lineRef.current = L.polyline(pts, {
          color: '#00c853',
          weight: 2,
          dashArray: '6 8',
          opacity: 0.7,
        }).addTo(map);
      }
    }

    // Pan if no dest yet
    if (!destRef.current) map.panTo(latlng);
  }, [driverPos]);

  // Set destination marker + fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !destPos) return;
    const latlng = [destPos.lat, destPos.lng];

    if (!destRef.current) {
      destRef.current = L.marker(latlng, { icon: destIcon }).addTo(map);

      // Draw line if driver already placed
      if (driverRef.current) {
        const pts = [driverRef.current.getLatLng(), latlng];
        lineRef.current = L.polyline(pts, {
          color: '#00c853',
          weight: 2,
          dashArray: '6 8',
          opacity: 0.7,
        }).addTo(map);
      }
    }

    // Fit both pins in view
    if (driverRef.current) {
      map.fitBounds(
        [driverRef.current.getLatLng(), latlng],
        { padding: [36, 36], maxZoom: 16 }
      );
    } else {
      map.setView(latlng, 15);
    }
  }, [destPos]);

  return (
    <div className="dv-map-wrap">
      <div ref={containerRef} className="dv-map-container" />
      <div className="dv-map-legend">
        <span className="dv-map-you">● You</span>
        <span className="dv-map-drop">● Drop-off</span>
      </div>
    </div>
  );
}
