import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, VolumeX } from 'lucide-react';
import { COLUMN_MAP } from '../utils/orderFlow';
import { soundIsOn, onSoundChange, enableSound, startRing, stopRing, testRing, keepScreenOn } from '../utils/orderAlarm';
import './OrderAlarm.css';

// New orders older than this sit in the New column silently. They are stuck,
// not new -- and kitchen-all returns every unfinished order with no time limit,
// so without this cut-off the stale test orders would make every screen ring
// without end.
const RING_WINDOW_MS = 24 * 60 * 60 * 1000;

// The new-order alarm, shared by /kitchen and /staff.
//
// It rings for as long as anything is waiting in the New column -- the state,
// not the arrival. The screens used to beep when a new order id appeared, but
// only if the previous poll had returned orders, so an order arriving at an
// empty queue (the normal case here) made no sound at all.
//
// Accepting an order updates the screen's own list straight away, so the
// device that taps Accept goes quiet immediately; other devices follow on
// their next poll. If nobody accepts, the backend texts the owner
// (habibi-backend/src/services/acceptEscalation.js).
export default function OrderAlarm({ orders }) {
  const waiting = useMemo(() => orders.filter(o =>
    COLUMN_MAP[o.order_status] === 'new'
    && Date.now() - new Date(o.placed_at).getTime() < RING_WINDOW_MS
  ).length, [orders]);

  const [soundOn, setSoundOn] = useState(soundIsOn);
  // The shift screen shows until the first tap. Sound may already be on if
  // this is a return visit within the same page session.
  const [started, setStarted] = useState(soundIsOn);
  useEffect(() => onSoundChange(() => setSoundOn(soundIsOn())), []);

  const ringing = waiting > 0;
  useEffect(() => {
    if (ringing && soundOn) startRing();
    else stopRing();
  }, [ringing, soundOn]);
  useEffect(() => stopRing, []);   // leaving the page must never leave it ringing

  // A background tab still shows its title.
  useEffect(() => {
    if (!ringing) return undefined;
    const base = document.title;
    document.title = `(${waiting}) New order${waiting > 1 ? 's' : ''} - ${base}`;
    return () => { document.title = base; };
  }, [ringing, waiting]);

  const turnOn = async () => {
    const ok = await enableSound();
    keepScreenOn();
    setStarted(true);
    setSoundOn(ok);
    if (ok && !ringing) testRing();   // prove it works; if orders wait, the real ring starts anyway
  };

  if (!started) {
    return (
      <div className="oa-overlay" role="dialog" aria-modal="true" aria-labelledby="oa-title">
        <div className="oa-card">
          <BellRing size={44} className="oa-card-icon" aria-hidden="true" />
          <h2 id="oa-title" className="oa-title">Start your shift</h2>
          <p className="oa-text">
            Turn on the new-order alarm. It rings until every new order is accepted,
            and keeps this screen awake. Keep the tablet plugged in and the volume up.
          </p>
          {waiting > 0 && (
            <p className="oa-waiting">{waiting} order{waiting > 1 ? 's are' : ' is'} already waiting.</p>
          )}
          <button type="button" className="oa-btn" onClick={turnOn} autoFocus>
            Turn on order alarm
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!soundOn && (
        <button type="button" className="oa-bar oa-bar--off" onClick={turnOn}>
          <VolumeX size={18} aria-hidden="true" />
          <span>Order alarm is OFF. New orders will not ring. <u>Tap to turn it back on</u></span>
        </button>
      )}
      {ringing && (
        <div className="oa-bar oa-bar--ringing" role="alert">
          <BellRing size={18} className="oa-bell" aria-hidden="true" />
          <span>
            {/* Worded by outcome, not button: a Zelle order's button reads "Confirm
                Payment", and both move the order to accepted. */}
            <strong>{waiting} new order{waiting > 1 ? 's' : ''} waiting.</strong> The alarm stops once {waiting > 1 ? 'they are' : 'it is'} accepted.
          </span>
        </div>
      )}
    </>
  );
}
