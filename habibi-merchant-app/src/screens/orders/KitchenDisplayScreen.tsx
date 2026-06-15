import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { ordersAPI, Order, OrderItem } from '../../services/ordersAPI';

const INCOMING_STATUSES  = ['pending'];
const PREPARING_STATUSES = ['accepted', 'confirmed', 'preparing', 'cooking'];

function elapsedLabel(placedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(placedAt).getTime()) / 60_000);
  if (mins < 1)  return '< 1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function urgencyColor(placedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(placedAt).getTime()) / 60_000);
  if (mins >= 20) return Colors.error;
  if (mins >= 10) return Colors.warning;
  return Colors.success;
}

function MethodBadge({ method }: { method: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    delivery: { label: 'DELIVERY', color: Colors.info },
    pickup:   { label: 'PICKUP',   color: Colors.success },
    dine_in:  { label: 'DINE IN',  color: Colors.gold },
  };
  const { label, color } = labels[method] || { label: method.toUpperCase(), color: Colors.textMuted };
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: `${color}20`, borderColor: `${color}60` }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const elapsed = elapsedLabel(order.placed_at);
  const color   = urgencyColor(order.placed_at);

  return (
    <View style={[cardStyles.card, { borderLeftColor: color, borderLeftWidth: 5 }]}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.orderNum}>#{order.order_number}</Text>
        <View style={cardStyles.headerRight}>
          <MethodBadge method={order.delivery_method} />
          <View style={[cardStyles.timerBadge, { backgroundColor: `${color}20` }]}>
            <Feather name="clock" size={14} color={color} />
            <Text style={[cardStyles.timerText, { color }]}>{elapsed}</Text>
          </View>
        </View>
      </View>

      {order.table_number ? (
        <Text style={cardStyles.tableLabel}>Table {order.table_number}</Text>
      ) : null}

      <View style={cardStyles.itemList}>
        {items.map((item, idx) => (
          <View key={idx} style={cardStyles.itemRow}>
            <Text style={cardStyles.itemQty}>{item.quantity}×</Text>
            <Text style={cardStyles.itemName}>{item.name}</Text>
            {item.special_instructions ? (
              <Text style={cardStyles.itemNote}>{item.special_instructions}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {order.notes ? (
        <Text style={cardStyles.orderNote}>📝 {order.notes}</Text>
      ) : null}
    </View>
  );
}

function Section({ title, accent, orders }: { title: string; accent: string; orders: Order[] }) {
  return (
    <View style={secStyles.section}>
      <View style={[secStyles.header, { borderBottomColor: accent }]}>
        <View style={[secStyles.dot, { backgroundColor: accent }]} />
        <Text style={[secStyles.title, { color: accent }]}>{title}</Text>
        <View style={[secStyles.countBadge, { backgroundColor: `${accent}20`, borderColor: accent }]}>
          <Text style={[secStyles.count, { color: accent }]}>{orders.length}</Text>
        </View>
      </View>
      {orders.length === 0 ? (
        <Text style={secStyles.empty}>— Clear —</Text>
      ) : (
        orders.map(o => <OrderCard key={o.order_number} order={o} />)
      )}
    </View>
  );
}

export default function KitchenDisplayScreen() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date>(new Date());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const data = await ordersAPI.getAll();
      setOrders(data);
      setLastSync(new Date());
    } catch { /* keep stale data */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(() => fetchOrders(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  const incoming  = orders.filter(o => INCOMING_STATUSES.includes((o.order_status || '').toLowerCase()));
  const preparing = orders.filter(o => PREPARING_STATUSES.includes((o.order_status || '').toLowerCase()));

  const syncLabel = (() => {
    const s = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    if (s < 5)  return 'Just synced';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  })();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading kitchen view…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="monitor" size={22} color={Colors.primary} />
          <Text style={styles.title}>KITCHEN DISPLAY</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.syncLabel}>{syncLabel}</Text>
          <TouchableOpacity onPress={() => { setRefreshing(true); fetchOrders(); }} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.board}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={Colors.primary} />}
      >
        <Section title="INCOMING" accent={Colors.pending}  orders={incoming} />
        <Section title="PREPARING" accent={Colors.info}    orders={preparing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: Colors.bg },
  loadingText: { color: Colors.textSub, fontSize: FontSize.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
  },
  syncLabel:  { color: Colors.textMuted, fontSize: FontSize.xs },
  refreshBtn: { padding: 6 },

  board: { padding: 16, gap: 24 },
});

const secStyles = StyleSheet.create({
  section: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 2, flex: 1 },
  countBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  count: { fontSize: 13, fontWeight: FontWeight.bold },
  empty: {
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: FontSize.sm,
    letterSpacing: 1,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timerText: { fontSize: 14, fontWeight: FontWeight.bold },
  tableLabel: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  itemList: { gap: 6 },
  itemRow:  { gap: 4 },
  itemQty:  { color: Colors.primary, fontSize: 16, fontWeight: FontWeight.bold },
  itemName: { color: Colors.text, fontSize: 17, fontWeight: FontWeight.medium },
  itemNote: { color: Colors.warning, fontSize: 13, fontStyle: 'italic' },
  orderNote: { color: Colors.warning, fontSize: 13, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
});

const badgeStyles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
});
