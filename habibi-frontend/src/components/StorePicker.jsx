import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, ChevronDown, Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './StorePicker.css';

// A photo bundled with the site also ships as .webp; CPanel uploads are used as-is.
const storeImage = (url) => {
  if (!url) return null;
  return url.startsWith('/images/') ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;
};

// Distances only mean something within reach of the stores: the server stops
// ranking by distance past 350 miles (the spec's long-distance limit).
const milesLabel = (t, miles) => {
  const m = Number(miles);
  if (miles == null || !Number.isFinite(m) || m > 350) return '';
  return t('checkout.storeMilesAway', { miles: m < 10 ? m.toFixed(1) : Math.round(m) });
};

function OpenState({ store }) {
  const { t } = useTranslation();
  if (store.open_now === true) return <span className="sp-open">{t('checkout.storeOpenNow')}</span>;
  if (store.open_now === false) return <span className="sp-closed">{t('checkout.storeClosedNow')}</span>;
  return null;
}

/**
 * Where the order comes from, as one card, with a list to change it.
 * The store is picked automatically (see utils/servingLocation.js on the
 * server); the customer only opens the list if they want a different one.
 */
export default function StorePicker({
  mode,               // 'delivery' | 'pickup'
  stores,             // ranked list (or the plain list if ranking is unavailable)
  selected,
  recommendedId,
  rankingReady,       // true once the server's ranking has answered
  waitingForAddress,  // delivery, before the address is confirmed
  reasonFor,          // store -> '' when it can take this cart, else why not
  onChoose,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const changeRef = useRef(null);
  const sheetRef = useRef(null);

  const available = stores.filter(s => !reasonFor(s));
  const unavailable = stores.filter(s => reasonFor(s));
  const noneCanServe = rankingReady && !recommendedId && stores.length > 0;
  const isRecommended = !!selected && rankingReady && selected.id === recommendedId;

  const openList = () => {
    setShowUnavailable(noneCanServe);
    setOpen(true);
  };

  // Escape closes; focus goes into the list, and back to "Change" afterwards.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const target = sheetRef.current?.querySelector('[role="radio"][aria-checked="true"]')
      || sheetRef.current?.querySelector('[role="radio"], button');
    target?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      changeRef.current?.focus();
    };
  }, [open]);

  const choose = (store) => {
    onChoose(store);
    setOpen(false);
  };

  let summary;
  if (mode === 'delivery' && waitingForAddress) {
    summary = <p className="sp-hint">{t('checkout.storeWaitingForAddress')}</p>;
  } else if (noneCanServe) {
    summary = (
      <div className="sp-card sp-card--warn">
        <p className="sp-warn">{t('checkout.noStoreCanServe')}</p>
        <button type="button" className="sp-change" ref={changeRef} onClick={openList} aria-haspopup="dialog">
          {t('checkout.storeSeeWhy')}
        </button>
      </div>
    );
  } else if (selected) {
    // Checkout keeps the same store object while the id is unchanged (so the fee
    // isn't re-quoted); the ranked entry has the fresh distance and open state.
    const shown = stores.find(s => s.id === selected.id) || selected;
    const img = storeImage(shown.image_url);
    const miles = milesLabel(t, shown.distance_miles);
    const address = shown.exact_address || shown.brief_address;
    summary = (
      <div className="sp-card">
        <div className="sp-thumb" aria-hidden="true">
          {img ? <img src={img} alt="" loading="lazy" /> : <MapPin size={20} />}
        </div>
        <div className="sp-body">
          <p className="sp-eyebrow">{mode === 'pickup' ? t('checkout.storePickupFrom') : t('checkout.storePreparedAt')}</p>
          <p className="sp-name">
            {selected.title}
            {isRecommended && <span className="sp-pill">{t('checkout.storeRecommended')}</span>}
          </p>
          <p className="sp-meta">
            {address && <span>{address}</span>}
            {miles && <span>{miles}</span>}
            {(shown.open_now === true || shown.open_now === false) && <span><OpenState store={shown} /></span>}
          </p>
          {rankingReady && (
            <p className="sp-why">{isRecommended ? t('checkout.storeWhyRecommended') : t('checkout.storeChosenByYou')}</p>
          )}
          {mode === 'pickup' && address && (
            <a
              className="sp-directions"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={12} /> {t('checkout.storeDirections')}
            </a>
          )}
        </div>
        {stores.length > 1 && (
          <button type="button" className="sp-change" ref={changeRef} onClick={openList} aria-haspopup="dialog">
            {t('checkout.storeChange')}
          </button>
        )}
      </div>
    );
  } else {
    summary = <p className="sp-hint">{t('checkout.storeFinding')}</p>;
  }

  return (
    <div className="sp">
      <p className="form-label sp-label">{t('checkout.storeSectionLabel')}</p>
      {summary}

      {open && (
        <div className="sp-overlay" onClick={() => setOpen(false)}>
          <div
            className="sp-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-title"
            ref={sheetRef}
            onClick={e => e.stopPropagation()}
          >
            <div className="sp-sheet-hd">
              <h3 id="sp-title">{t('checkout.storeChooseTitle')}</h3>
              <button type="button" className="sp-close" onClick={() => setOpen(false)} aria-label={t('checkout.storeClose')}>
                <X size={18} />
              </button>
            </div>

            {available.length > 0 && (
              <div className="sp-list" role="radiogroup" aria-labelledby="sp-title">
                {available.map(s => {
                  const checked = selected?.id === s.id;
                  const miles = milesLabel(t, s.distance_miles);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      className={`sp-row${checked ? ' is-checked' : ''}`}
                      onClick={() => choose(s)}
                    >
                      <span className="sp-radio" aria-hidden="true" />
                      <span className="sp-row-main">
                        <span className="sp-row-name">
                          {s.title}
                          {rankingReady && s.id === recommendedId && <span className="sp-pill">{t('checkout.storeRecommended')}</span>}
                        </span>
                        <span className="sp-row-addr">{s.exact_address || s.brief_address}</span>
                      </span>
                      <span className="sp-row-side">
                        {miles && <span>{miles}</span>}
                        <OpenState store={s} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {unavailable.length > 0 && (
              <div className="sp-unavail">
                <button
                  type="button"
                  className="sp-unavail-toggle"
                  aria-expanded={showUnavailable}
                  onClick={() => setShowUnavailable(v => !v)}
                >
                  <ChevronDown size={14} className={showUnavailable ? 'sp-rot' : undefined} />
                  {t('checkout.storeNotAvailableGroup', { count: unavailable.length })}
                </button>
                {showUnavailable && (
                  <ul className="sp-unavail-list">
                    {unavailable.map(s => (
                      <li key={s.id}>
                        <span className="sp-row-name">{s.title}</span>
                        <span className="sp-row-reason">{reasonFor(s)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
