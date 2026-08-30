import React, { createContext, useContext, useState } from 'react';

const DineInContext = createContext(null);

// Client doesn't currently offer dine-in service, so the QR-landing route
// (/dine-in/:tableSlug) that's the only way to ever call setTable() has been
// removed from App.jsx. That alone stops any NEW table from being set, but a
// customer whose browser still has an old 'habibi_table' value from before
// this change would otherwise keep seeing dine-in mode indefinitely -- this
// flag forces isDineIn false and clears that stale value regardless. Flip
// back to true (and re-add the App.jsx routes) to bring dine-in back.
const DINE_IN_ENABLED = false;

export function DineInProvider({ children }) {
  const [table, setTableState] = useState(() => {
    if (!DINE_IN_ENABLED) {
      try { localStorage.removeItem('habibi_table'); } catch (_) {}
      return null;
    }
    try {
      const stored = localStorage.getItem('habibi_table');
      return stored ? JSON.parse(stored) : null;
    } catch (_) { return null; }
  });

  const setTable = (tableData) => {
    if (!DINE_IN_ENABLED) return;
    setTableState(tableData);
    if (tableData) {
      localStorage.setItem('habibi_table', JSON.stringify(tableData));
    } else {
      localStorage.removeItem('habibi_table');
    }
  };

  const clearTable = () => setTable(null);

  return (
    <DineInContext.Provider value={{ table, setTable, clearTable, isDineIn: !!table }}>
      {children}
    </DineInContext.Provider>
  );
}

export function useDineIn() {
  const ctx = useContext(DineInContext);
  if (!ctx) throw new Error('useDineIn must be used inside DineInProvider');
  return ctx;
}
