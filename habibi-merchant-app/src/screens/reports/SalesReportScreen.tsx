import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { ordersAPI, Order } from '../../services/ordersAPI';
import { formatCurrency, formatTime } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';

interface Stats {
  orders: number;
  revenue: number;
  pending: number;
}

export default function SalesReportScreen() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing,   setPrinting]   = useState(false);

  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const fetchData = useCallback(async () => {
    try {
      const [statsData, ordersData] = await Promise.all([
        ordersAPI.getStats(),
        ordersAPI.getAll(),
      ]);
      setStats({
        orders:  Number(statsData.orders)  || 0,
        revenue: Number(statsData.revenue) || 0,
        pending: Number(statsData.pending) || 0,
      });

      // Filter to today's orders only
      const todayStr = new Date().toISOString().split('T')[0];
      const todayOrders = ordersData.filter((o: Order) =>
        o.placed_at && o.placed_at.startsWith(todayStr)
      );
      setOrders(todayOrders);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Derived metrics from today's orders
  const delivered = orders.filter(o => ['delivered', 'completed'].includes((o.order_status || '').toLowerCase()));
  const todayRevenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const avgOrder    = delivered.length > 0 ? todayRevenue / delivered.length : 0;

  const byMethod = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.delivery_method] = (acc[o.delivery_method] || 0) + 1;
    return acc;
  }, {});

  const byPayment = orders.reduce<Record<string, number>>((acc, o) => {
    const pm = o.payment_method || 'unknown';
    acc[pm] = (acc[pm] || 0) + 1;
    return acc;
  }, {});

  // Top selling items by quantity
  const itemCounts: Record<string, { qty: number; revenue: number }> = {};
  orders.forEach(o => {
    (Array.isArray(o.items) ? o.items : []).forEach(item => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { qty: 0, revenue: 0 };
      itemCounts[item.name].qty     += item.quantity || 1;
      itemCounts[item.name].revenue += (item.price || 0) * (item.quantity || 1);
    });
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 8);

  const handlePrintReport = async () => {
    setPrinting(true);
    try {
      const itemRows = topItems.map(([name, { qty, revenue }]) =>
        `<tr><td>${name}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${formatCurrency(revenue)}</td></tr>`
      ).join('');

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>
          body { font-family: sans-serif; padding: 30px; max-width: 700px; margin: auto; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
          .stats { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
          .stat { background: #f5f5f5; border-radius: 8px; padding: 14px 20px; flex: 1; min-width: 130px; }
          .stat-val { font-size: 26px; font-weight: bold; }
          .stat-lbl { font-size: 12px; color: #666; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f0f0f0; text-align: left; padding: 8px 10px; font-size: 12px; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
          h3 { font-size: 15px; margin-bottom: 10px; }
        </style></head><body>
        <h1>Habibi Halal Express — Sales Report</h1>
        <div class="sub">${today}</div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${orders.length}</div><div class="stat-lbl">Total Orders Today</div></div>
          <div class="stat"><div class="stat-val">${delivered.length}</div><div class="stat-lbl">Completed</div></div>
          <div class="stat"><div class="stat-val">${formatCurrency(todayRevenue)}</div><div class="stat-lbl">Today's Revenue</div></div>
          <div class="stat"><div class="stat-val">${formatCurrency(avgOrder)}</div><div class="stat-lbl">Avg Order Value</div></div>
        </div>
        <h3>Top Selling Items</h3>
        <table>
          <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr>
          ${itemRows || '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>'}
        </table>
        </body></html>
      `;

      if (Platform.OS === 'web') {
        const win = window.open('', '_blank', 'width=800,height=700');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }
      } else {
        const Print   = await import('expo-print');
        const Sharing = await import('expo-sharing');
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Sales Report' });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (err: any) {
      Alert.alert('Print Error', err.message);
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading report…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sales Report</Text>
          <Text style={styles.subtitle}>{today}</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
            <Feather name="refresh-cw" size={16} color={Colors.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.printBtn} onPress={handlePrintReport} disabled={printing}>
            {printing
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <><Feather name="printer" size={15} color={Colors.white} /><Text style={styles.printBtnText}>Export PDF</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <StatCard icon="shopping-bag"  label="Orders Today"   value={String(orders.length)}         accent={Colors.info} />
          <StatCard icon="check-circle"  label="Completed"      value={String(delivered.length)}       accent={Colors.success} />
          <StatCard icon="dollar-sign"   label="Today's Revenue" value={formatCurrency(todayRevenue)} accent={Colors.gold} />
          <StatCard icon="trending-up"   label="Avg Order"      value={formatCurrency(avgOrder)}      accent={Colors.warning} />
          <StatCard icon="clock"         label="Pending Now"    value={String(stats?.pending ?? 0)}   accent={Colors.pending} />
          <StatCard icon="package"       label="All-Time Orders" value={String(stats?.orders ?? 0)}  accent={Colors.textSub} />
        </View>

        {/* Order type breakdown */}
        <Section title="Orders by Type">
          {Object.entries(byMethod).length === 0
            ? <EmptyState />
            : Object.entries(byMethod).map(([method, count]) => (
              <BarRow
                key={method}
                label={method.replace('_', ' ').toUpperCase()}
                count={count}
                total={orders.length}
                color={method === 'delivery' ? Colors.info : method === 'dine_in' ? Colors.warning : Colors.success}
              />
            ))
          }
        </Section>

        {/* Payment method breakdown */}
        <Section title="Orders by Payment">
          {Object.entries(byPayment).length === 0
            ? <EmptyState />
            : Object.entries(byPayment).map(([pm, count]) => (
              <BarRow
                key={pm}
                label={pm.toUpperCase()}
                count={count}
                total={orders.length}
                color={Colors.info}
              />
            ))
          }
        </Section>

        {/* Top selling items */}
        <Section title="Top Selling Items">
          {topItems.length === 0
            ? <EmptyState />
            : topItems.map(([name, { qty, revenue }], idx) => (
              <View key={name} style={styles.topItemRow}>
                <View style={styles.topItemRank}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <Text style={styles.topItemName} numberOfLines={1}>{name}</Text>
                <Text style={styles.topItemQty}>{qty}x</Text>
                <Text style={styles.topItemRevenue}>{formatCurrency(revenue)}</Text>
              </View>
            ))
          }
        </Section>

        {/* Recent orders */}
        <Section title={`Today's Orders (${orders.length})`}>
          {orders.length === 0
            ? <EmptyState />
            : orders
                .sort((a, b) => new Date(b.placed_at || 0).getTime() - new Date(a.placed_at || 0).getTime())
                .slice(0, 20)
                .map(order => (
                  <View key={order.id} style={styles.orderRow}>
                    <Text style={styles.orderNum}>#{order.order_number}</Text>
                    <Text style={styles.orderName} numberOfLines={1}>{order.customer_name}</Text>
                    <Text style={styles.orderTime}>{formatTime(order.placed_at)}</Text>
                    <StatusBadge status={order.order_status} small />
                    <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                  </View>
                ))
          }
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <View style={[statStyles.card, { borderColor: `${accent}30` }]}>
      <Feather name={icon as any} size={20} color={accent} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={secStyles.container}>
      <Text style={secStyles.title}>{title}</Text>
      <View style={secStyles.body}>{children}</View>
    </View>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.barBg}>
        <View style={[barStyles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={barStyles.count}>{count}</Text>
      <Text style={barStyles.pct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function EmptyState() {
  return <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm, padding: 12 }}>No data for today yet.</Text>;
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSub, fontSize: FontSize.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:    { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: 'serif' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn:  { padding: 8, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  printBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 40, padding: 16, gap: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Today's orders list
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  orderNum:   { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, width: 80 },
  orderName:  { flex: 1, color: Colors.text, fontSize: FontSize.xs },
  orderTime:  { color: Colors.textMuted, fontSize: FontSize.xs, width: 50, textAlign: 'center' },
  orderTotal: { color: Colors.text, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, width: 60, textAlign: 'right' },

  // Top items
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  topItemRank: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText:        { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  topItemName:     { flex: 1, color: Colors.text, fontSize: FontSize.sm },
  topItemQty:      { color: Colors.textSub, fontSize: FontSize.xs, width: 36, textAlign: 'center' },
  topItemRevenue:  { color: Colors.success, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, width: 70, textAlign: 'right' },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1, minWidth: 130,
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6, alignItems: 'flex-start',
  },
  value: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  label: { color: Colors.textMuted, fontSize: FontSize.xs },
});

const secStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  title: {
    color: Colors.textMuted, fontSize: FontSize.xs,
    fontWeight: FontWeight.bold, letterSpacing: 0.8,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  body: { paddingHorizontal: 16, paddingBottom: 8 },
});

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  label: { color: Colors.text, fontSize: FontSize.xs, width: 90 },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  count:  { color: Colors.text, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, width: 28, textAlign: 'right' },
  pct:    { color: Colors.textMuted, fontSize: FontSize.xs, width: 36, textAlign: 'right' },
});
