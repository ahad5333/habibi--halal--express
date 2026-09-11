import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { isAutoPrintOn, setAutoPrint, printTicket, TEST_ORDER } from '../utils/kitchenTicket';

// Header control on the order screens: turn auto-print on for THIS device
// (the one connected to the receipt printer), print a test ticket, and the
// one-time setup for printing without a dialog.
export default function PrinterPanel({ orders }) {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(isAutoPrintOn);

  const toggle = () => {
    const next = !on;
    setAutoPrint(next, orders);
    setOn(next);
  };

  return (
    <div className="kd-print">
      <button
        className={`kd-manual-refresh kd-print-btn${on ? ' is-on' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="Ticket printing"
      >
        <Printer size={13} />
        <span className="kd-print-state">{on ? 'Auto-print on' : 'Print'}</span>
      </button>

      {open && (
        <div className="kd-print-panel" role="dialog" aria-label="Ticket printing">
          <div className="kd-print-hdr">
            <strong>Ticket printing</strong>
            <button className="kd-manual-refresh" onClick={() => setOpen(false)} aria-label="Close"><X size={13} /></button>
          </div>

          <label className="kd-print-toggle">
            <input type="checkbox" checked={on} onChange={toggle} />
            <span>
              Print new orders automatically on this device
              <small>Turn this on only on the computer connected to the receipt printer. Orders already on screen won't print.</small>
            </span>
          </label>

          <button className="kd-print-test" onClick={() => printTicket(TEST_ORDER)}>Print a test ticket</button>

          <details className="kd-print-help">
            <summary>Print without a pop-up each time</summary>
            <ol>
              <li>Make the receipt printer the computer's <b>default printer</b>, paper size 80mm.</li>
              <li><b>Windows:</b> right-click the Chrome shortcut → Properties → at the end of <i>Target</i> add <code>--kiosk-printing</code> → OK. Close all Chrome windows, then open this page from that shortcut.</li>
              <li><b>Mac:</b> quit Chrome, then in Terminal run <code>open -a "Google Chrome" --args --kiosk-printing</code>.</li>
              <li>Tablets and phones can't print silently; they'll show the print screen for each ticket.</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
