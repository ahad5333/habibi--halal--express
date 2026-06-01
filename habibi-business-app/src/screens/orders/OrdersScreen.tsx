import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ordersAPI, BusinessOrder, OrderStatus } from '../../services/ordersAPI';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { RootStackParams } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParams>;

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'all',               label: 'All' },
  { key: 'created',           label: 'Created' },
  { key: 'processed',         label: 'Processed' },
  { key: 'on_the_way',        label: 'On the Way' },
  { key: 'delivered',         label: 'Delivered' },
  { key: 'unpaid',            label: 'Unpaid' },
  { key: 'cancelled',         label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  created:          Colors.created,
  processed:        Colors.processed,
  on_the_way:       Colors.on_the_way,
  delivered:        Colors.delivered,
  cancelled:        Colors.cancelled,
  paid:             Colors.paid,
  unpaid:           Colors.unpaid,
  delivered_unpaid: Colors.unpaid,
};

const STATUS_ICON: Record<string, string> = {
  created:          'file-plus',
  processed:        'settings',
  on_the_way:       'truck',
  delivered:        'check-circle',
  cancelled:        'x-circle',
  paid:             'check-circle',
  unpaid:           'alert-circle',
  delivered_unpaid: 'alert-triangle',
};

function OrderCard({ order, onPress }: { order: BusinessOrder; onPress: () => void }) {
  const color  = STATUS_COLOR[order.status] ?? Colors.textSub;
  const icon   = STATUS_ICON[order.status]  ?? 'package';
  const items  = order.items || [];
  const names  = items.map(i => i.name).join(', ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.orderNum}>#{order.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Feather name={icon as any} size={11} color={color} style={{ marginRight: 4 }} />
          <Text style={[styles.statusText, { color }]}>
            {order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Text>
        </View>
      </View>

      <Text style={styles.itemsText} numberOfLines={2}>{names || '—'}</Text>

      <View style={styles.cardBottom}>
        <Text style={styles.date}><Feather name="clock" size={11} color={Colors.textMuted} />{'  '}{formatDateTime(order.placed_at)}</Text>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
      </View>

      {order.payment_status === 'unpaid' && order.status !== 'cancelled' && (
        <View style={styles.unpaidBanner}>
          <Feather name="alert-triangle" size={12} color={Colors.warning} />
          <Text style={styles.unpaidText}>Payment pending</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const navigation  = useNavigation<Nav>();
  const [orders,    setOrders]    = useState<BusinessOrder[]>([]);
  const [tab,       setTab]       = useState('all');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await ordersAPI.getAll();
      setOrders(data);
    } catch (err: any) {
      if (!silent) Alert.alert('Error', err.message || 'Could not load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload when screen is focused (e.g., returning from order detail)
  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const filtered = tab === 'all'
    ? orders
    : orders.filter(o => o.status === tab || (tab === 'unpaid' && o.payment_status === 'unpaid'));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Status Tabs */}
      <FlatList
        horizontal
        data={STATUS_TABS}
        keyExtractor={t => t.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        renderItem={({ item: t }) => {
          const count = t.key === 'all'
            ? orders.length
            : orders.filter(o => o.status === t.key || (t.key === 'unpaid' && o.payment_status === 'unpaid')).length;
          return (
            <TouchableOpacity
              style={[styles.tabChip, tab === t.key && styles.tabChipActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[styles.tabCount, tab === t.key && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, tab === t.key && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        style={styles.tabList}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptySubtitle}>
            {tab === 'all' ? 'Place your first order from the Catalog.' : `No ${tab.replace(/_/g,' ')} orders.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.gold} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  tabList:  { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow:   { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center', paddingVertical: 8 },
  tabChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabChipActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  tabText:           { fontSize: FontSize.sm, color: Colors.textSub, fontWeight: FontWeight.semibold },
  tabTextActive:     { color: '#000' },
  tabCount:          { backgroundColor: Colors.surface2, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive:    { backgroundColor: 'rgba(0,0,0,0.15)' },
  tabCountText:      { fontSize: 10, color: Colors.textSub, fontWeight: FontWeight.bold },
  tabCountTextActive:{ color: '#000' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.xl },
  emptyTitle:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptySubtitle:{ fontSize: FontSize.base, color: Colors.textSub, textAlign: 'center' },
  list:         { padding: Spacing.md, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot:    { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  orderNum:     { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, flex: 1 },
  statusBadge:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
  },
  statusText:   { fontSize: 11, fontWeight: FontWeight.semibold },
  itemsText:    { fontSize: FontSize.sm, color: Colors.textSub, marginBottom: 8, lineHeight: 18 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:         { fontSize: FontSize.xs, color: Colors.textMuted },
  total:        { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  unpaidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  unpaidText:   { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
});
