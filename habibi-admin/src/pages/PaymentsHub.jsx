import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Transactions from './Payments';
import CardProcessors from './PaymentProcessors';
import OtherWaysToPay from './PaymentAccounts';
import './Reports.css'; // reuses .rpt-tabs / .rpt-tab

// The panel used to carry three separate sidebar entries for money coming in —
// Payments, Payment Processors and Payment Accounts. They are one job, so they
// are one page with tabs now. Each tab still renders its original component
// untouched; they just hide their own <h1> when embedded here.
const TABS = [
  { id: 'transactions', label: 'Transactions', Component: Transactions },
  { id: 'processors',   label: 'Card Processors', Component: CardProcessors },
  { id: 'accounts',     label: 'Other Ways to Pay', Component: OtherWaysToPay },
];

export default function PaymentsHub() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active = TABS.some(t => t.id === requested) ? requested : 'transactions';

  const select = (id) => {
    // replace: switching tabs shouldn't stack up browser history entries.
    setParams(id === 'transactions' ? {} : { tab: id }, { replace: true });
  };

  const Active = TABS.find(t => t.id === active).Component;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Payments</h1>
        </div>
      </div>

      <div className="rpt-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rpt-tab ${active === t.id ? 'active' : ''}`}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active embedded />
    </div>
  );
}
