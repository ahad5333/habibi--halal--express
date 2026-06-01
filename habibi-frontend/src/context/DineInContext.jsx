import React, { createContext, useContext, useState } from 'react';

const DineInContext = createContext(null);

export function DineInProvider({ children }) {
  const [table, setTableState] = useState(() => {
    try {
      const stored = localStorage.getItem('habibi_table');
      return stored ? JSON.parse(stored) : null;
    } catch (_) { return null; }
  });

  const setTable = (tableData) => {
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
