import React, { useState } from 'react';
import './StoreMapImage.css';

// A map picture of a store, for stores with no photo in CPanel yet. Esri's dark
// basemap renders any area as a single image with no API key (the same basemap
// the delivery coverage map uses), so this needs nothing but the coordinates
// CPanel already holds. A photo set in CPanel always wins over this.
const EXPORT_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_{layer}/MapServer/export';

export function storeMapImageUrl(lat, lng, { layer = 'Base', width = 640, height = 420, spanDeg = 0.006 } = {}) {
  const halfLat = spanDeg;
  // Longitude degrees shrink towards the poles; widen them so the picture isn't squashed.
  const halfLng = (spanDeg * (width / height)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bbox = [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat].map(n => n.toFixed(6)).join(',');
  const format = layer === 'Base' ? 'jpg' : 'png32';
  const transparent = layer === 'Base' ? '' : '&transparent=true';
  return `${EXPORT_BASE.replace('{layer}', layer)}?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${width},${height}&format=${format}${transparent}&f=image`;
}

export default function StoreMapImage({ lat, lng, className = '', label }) {
  // One dropped request shouldn't blank the whole map -- ask again once, then
  // fall back to the pin.
  const [attempt, setAttempt] = useState(0);
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  const usable = Number.isFinite(la) && Number.isFinite(ln) && attempt < 2;

  return (
    <div className={`store-map ${className}`.trim()} aria-hidden="true">
      {usable && (
        <>
          <img
            className="store-map-tile"
            src={storeMapImageUrl(la, ln, { layer: 'Base' }) + (attempt ? `&retry=${attempt}` : '')}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setAttempt(a => a + 1)}
          />
          <img
            className="store-map-tile store-map-labels"
            src={storeMapImageUrl(la, ln, { layer: 'Reference' })}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </>
      )}
      <span className="store-map-pin">📍</span>
      {label && <span className="store-map-label">{label}</span>}
    </div>
  );
}
