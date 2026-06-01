import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export interface LowStockItem {
  id: number;
  name: string;
  category: string;
  current_stock: number;
  low_stock_threshold: number;
  unit: string;
}

const POLL_MS = 5 * 60 * 1000; // refresh every 5 minutes

export function useInventoryAlerts() {
  const [lowStock, setLowStock]   = useState<LowStockItem[]>([]);
  const [loading,  setLoading]    = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/inventory');
      const all: LowStockItem[] = res.data;
      setLowStock(all.filter(i => Number(i.current_stock) <= Number(i.low_stock_threshold)));
    } catch {
      // silently ignore — non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch]);

  return { lowStock, loading, refresh: fetch };
}
