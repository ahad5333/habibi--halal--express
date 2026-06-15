import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput,
  Platform, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { ordersAPI, Order } from '../../services/ordersAPI';
import { playNewOrderSound } from '../../utils/sound';
import { getSocket } from '../../services/socket';
import KanbanColumn from '../../components/KanbanColumn';
import OrderDetailModal from './OrderDetailModal';
import { formatTime } from '../../utils/formatters';
import { useLayout } from '../../utils/useLayout';

const COLUMNS = [
  { key: 'incoming',  label: 'Incoming',  accent: Colors.pending,   statuses: ['pending'],                                         emptyText: 'No pending orders — all clear!' },
  { key: 'preparing', label: 'Preparing', accent: Colors.info,      statuses: ['accepted', 'confirmed', 'preparing', 'cooking'],   emptyText: 'Nothing cooking yet' },
  { key: 'ready',     label: 'Ready',     accent: Colors.success,   statuses: ['ready'],                                           emptyText: 'Nothing ready for pickup' },
  { key: 'done',      label: 'Done',      accent: Colors.delivered, statuses: ['delivered', 'completed'],                          emptyText: 'No completed orders today' },
];

const ADVANCE_STATUS: Record<string, string> = {
  pending:   'preparing',
  accepted:  'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  cooking:   'ready',
  ready:     'delivered',
};

const CANCEL_REASONS = [
  'Customer requested cancellation',
  'Item(s) out of stock',
  'Unable to fulfill delivery',
  'Duplicate order',
  'Payment issue',
  'Kitchen capacity — too busy',
  'Address undeliverable',
  'Custom reason…',
];

const todayStr = new Date().toISOString().slice(0, 10);

export default function OrderBoardScreen() {
  const { isPhone, width } = useLayout();
  const navigation = useNavigation();
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [selected,     setSelected]     = useState<Order | null>(null);
  const [search,       setSearch]       = useState('');
  const [quietMode,    setQuietMode]    = useState(false);
  const [showAlerts,   setShowAlerts]   = useState(false);
  const [showSummary,  setShowSummary]  = useState(false);
  const [prepOrder,    setPrepOrder]    = useState<Order | null>(null);
  const [prepMinutes,  setPrepMinutes]  = useState<number | null>(null);
  const [rejectOrder,  setRejectOrder]  = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertRingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef   = useRef<Set<string>>(new Set());
  const seededRef     = useRef(false);
  const ordersRef     = useRef<Order[]>([]);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const data = await ordersAPI.getAll();

      const incoming = data.filter(o => (o.order_status || '').toLowerCase() === 'pending');

      if (!seededRef.current) {
        // First load — seed known IDs without alerting
        incoming.forEach(o => knownIdsRef.current.add(o.order_number));
        seededRef.current = true;
      } else if (!quietMode) {
        const newOnes = incoming.filter(o => !knownIdsRef.current.has(o.order_number));
        if (newOnes.length > 0) {
          playNewOrderSound();
          newOnes.forEach(o => knownIdsRef.current.add(o.order_number));
        }
      }

      setOrders(data);
      ordersRef.current = data;
    } catch (err: any) {
      if (!silent) console.warn('[OrderBoard] fetch failed:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quietMode]);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(() => fetchOrders(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  // 30-second recurring alert ring for unanswered pending orders (spec requirement)
  useEffect(() => {
    alertRingRef.current = setInterval(() => {
      if (quietMode) return;
      const pending = ordersRef.current.filter(o => (o.order_status || '').toLowerCase() === 'pending');
      if (pending.length > 0) {
        playNewOrderSound();
      }
    }, 30_000);
    return () => { if (alertRingRef.current) clearInterval(alertRingRef.current); };
  }, [quietMode]);

  // Update tab badge whenever pending count changes
  useEffect(() => {
    const count = orders.filter(o => (o.order_status || '').toLowerCase() === 'pending').length;
    navigation.setOptions({ tabBarBadge: count > 0 ? count : undefined });
  }, [orders, navigation]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_admin');
    const onStatusUpdate = ({ order_id, status }: { order_id: string; status: string }) => {
      setOrders(prev =>
        prev.map(o =>
          o.order_number === order_id || String(o.id) === String(order_id)
            ? { ...o, order_status: status }
            : o
        )
      );
    };
    // Trigger an immediate silent fetch when a new order is placed by a customer
    const onNewOrder = () => { fetchOrders(true); };
    socket.on('order_status_updated', onStatusUpdate);
    socket.on('new_order', onNewOrder);
    return () => {
      socket.off('order_status_updated', onStatusUpdate);
      socket.off('new_order', onNewOrder);
    };
  }, [fetchOrders]);

  const updateStatus = async (order: Order, status: string, cancelReason?: string, estimatedMinutes?: number) => {
    try {
      await ordersAPI.updateStatus(order.order_number, status, cancelReason, estimatedMinutes);
      setOrders(prev =>
        prev.map(o => o.order_number === order.order_number ? { ...o, order_status: status } : o)
      );
      if (selected?.order_number === order.order_number) {
        setSelected(prev => prev ? { ...prev, order_status: status } : null);
      }
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    }
  };

  const handleAccept  = (o: Order) => { setPrepMinutes(null); setPrepOrder(o); };
  const handleReject  = (o: Order) => { setRejectReason(''); setRejectOrder(o); };
  const handleAdvance = (o: Order) => {
    const next = ADVANCE_STATUS[(o.order_status || '').toLowerCase()];
    if (next) updateStatus(o, next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const handleToggleQuiet = () => {
    const next = !quietMode;
    setQuietMode(next);
    Alert.alert(
      next ? 'Quiet Mode On' : 'Quiet Mode Off',
      next
        ? 'Sound and vibration alerts for new orders are disabled.'
        : 'Sound and vibration alerts are enabled.',
      [{ text: 'OK' }]
    );
  };

  const activeOrders  = orders.filter(o => ['pending', 'accepted', 'confirmed', 'preparing', 'cooking', 'ready'].includes((o.order_status || '').toLowerCase()));
  const pendingOrders = orders.filter(o => (o.order_status || '').toLowerCase() === 'pending');

  // Today's summary stats
  const todayOrders    = orders.filter(o => (o.placed_at || '').startsWith(todayStr));
  const todayDone      = todayOrders.filter(o => ['delivered', 'completed'].includes((o.order_status || '').toLowerCase())).length;
  const todayCancelled = todayOrders.filter(o => (o.order_status || '').toLowerCase() === 'cancelled').length;
  const todayActive    = todayOrders.filter(o => ['pending', 'accepted', 'confirmed', 'preparing', 'cooking', 'ready'].includes((o.order_status || '').toLowerCase())).length;

  const groupedOrders = (statuses: string[], todayOnly = false) =>
    orders
      .filter(o => {
        if (!statuses.includes((o.order_status || '').toLowerCase())) return false;
        if (todayOnly && !(o.placed_at || '').startsWith(todayStr)) return false;
        const q = search.toLowerCase();
        return o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(a.placed_at || 0).getTime() - new Date(b.placed_at || 0).getTime());

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading orders…</Text>
      </View>
    );
  }


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right']}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      {isPhone ? (
        /* Phone: compact two-row header */
        <View style={styles.topBarPhone}>
          <View style={styles.topBarPhoneRow1}>
            <Text style={styles.pageTitle}>Live Orders</Text>
            <View style={styles.topRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAlerts(true)}>
                <Feather name="bell" size={20} color={pendingOrders.length > 0 ? Colors.primary : Colors.text} />
                {pendingOrders.length > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{pendingOrders.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSummary(true)}>
                <Feather name="clock" size={20} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, quietMode && styles.iconBtnActive]}
                onPress={handleToggleQuiet}
              >
                <Feather name="moon" size={20} color={quietMode ? Colors.primary : Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshBtnSm} onPress={handleRefresh} disabled={refreshing}>
                {refreshing
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Feather name="refresh-cw" size={18} color={Colors.primary} />
                }
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.topBarPhoneRow2}>
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color={Colors.textSub} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search orders..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.activeOrdersBadge, { paddingHorizontal: 10 }]}>
              <View style={[styles.dot, { backgroundColor: activeOrders.length > 0 ? Colors.primary : Colors.textMuted }]} />
              <Text style={styles.activeOrdersText}>{activeOrders.length}</Text>
            </View>
          </View>
        </View>
      ) : (
        /* Tablet: full three-column header */
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Text style={styles.pageTitle}>Live Kitchen</Text>
            <Text style={styles.pageTitle}>Dashboard</Text>
          </View>
          <View style={styles.topCenter}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color={Colors.textSub} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search orders or customers..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.activeOrdersBadge}>
              <View style={[styles.dot, { backgroundColor: activeOrders.length > 0 ? Colors.primary : Colors.textMuted }]} />
              <Text style={styles.activeOrdersText}>{activeOrders.length} ACTIVE ORDERS</Text>
            </View>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAlerts(true)}>
              <Feather name="bell" size={20} color={pendingOrders.length > 0 ? Colors.primary : Colors.text} />
              {pendingOrders.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{pendingOrders.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSummary(true)}>
              <Feather name="clock" size={20} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, quietMode && styles.iconBtnActive]}
              onPress={handleToggleQuiet}
            >
              <Feather name="moon" size={20} color={quietMode ? Colors.primary : Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.dashboardBtn} onPress={handleRefresh} disabled={refreshing}>
              {refreshing
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Text style={styles.dashboardBtnText}>Refresh</Text>
                    <Text style={styles.dashboardBtnText}>Orders</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Kanban board ─────────────────────────────────────── */}
      {isPhone ? (
        /* Phone: full-width columns, snap-scroll horizontally */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          decelerationRate="fast"
          snapToAlignment="start"
          style={{ flex: 1 }}
        >
          {COLUMNS.map((col) => {
            const colOrders = groupedOrders(col.statuses, col.key === 'done');
            return (
              <View key={col.key} style={{ width }}>
                <KanbanColumn
                  title={col.label}
                  accent={col.accent}
                  orders={colOrders}
                  emptyText={col.emptyText}
                  onPress={setSelected}
                  onAccept={col.key === 'incoming' ? handleAccept  : undefined}
                  onReject={col.key === 'incoming' ? handleReject  : undefined}
                  onAdvance={col.key !== 'incoming' && col.key !== 'done' ? handleAdvance : undefined}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        /* Tablet: side-by-side columns */
        <View style={styles.board}>
          {COLUMNS.map((col) => {
            const colOrders = groupedOrders(col.statuses, col.key === 'done');
            return (
              <KanbanColumn
                key={col.key}
                title={col.label}
                accent={col.accent}
                orders={colOrders}
                emptyText={col.emptyText}
                onPress={setSelected}
                onAccept={col.key === 'incoming' ? handleAccept  : undefined}
                onReject={col.key === 'incoming' ? handleReject  : undefined}
                onAdvance={col.key !== 'incoming' && col.key !== 'done' ? handleAdvance : undefined}
              />
            );
          })}
        </View>
      )}

      {/* Phone: swipe hint */}
      {isPhone && (
        <View style={styles.swipeHint}>
          <Feather name="chevrons-right" size={13} color={Colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe to see Preparing · Ready · Done</Text>
        </View>
      )}

      {/* Order detail modal */}
      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(status, cancelReason, estimatedMinutes) => updateStatus(selected, status, cancelReason, estimatedMinutes)}
        />
      )}

      {/* Prep time picker — triggered by Accept button on the order card */}
      <Modal visible={prepOrder !== null} animationType="fade" transparent onRequestClose={() => setPrepOrder(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius:16, padding:20 }}>
            <Text style={{ color:Colors.text, fontWeight:'700', fontSize:16, marginBottom:4 }}>
              Accept Order {prepOrder ? `#${prepOrder.order_number}` : ''}
            </Text>
            <Text style={{ color:Colors.textMuted, fontSize:13, marginBottom:16 }}>
              Set estimated kitchen prep time:
            </Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 }}>
              {([10, 15, 20, 30, 45] as const).map(min => (
                <TouchableOpacity
                  key={min}
                  style={{
                    paddingHorizontal:16, paddingVertical:10, borderRadius:10,
                    borderWidth:2, borderColor: prepMinutes === min ? Colors.info : Colors.border,
                    backgroundColor: prepMinutes === min ? `${Colors.info}20` : Colors.surface2,
                  }}
                  onPress={() => setPrepMinutes(min)}
                >
                  <Text style={{ color: prepMinutes === min ? Colors.info : Colors.text, fontWeight:'600', fontSize:14 }}>
                    {min} min
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={{
                  paddingHorizontal:16, paddingVertical:10, borderRadius:10,
                  borderWidth:2, borderColor: prepMinutes === 0 ? Colors.info : Colors.border,
                  backgroundColor: prepMinutes === 0 ? `${Colors.info}20` : Colors.surface2,
                }}
                onPress={() => setPrepMinutes(0)}
              >
                <Text style={{ color: prepMinutes === 0 ? Colors.info : Colors.textMuted, fontWeight:'600', fontSize:14 }}>
                  No ETA
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection:'row', gap:10 }}>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, borderWidth:1, borderColor:Colors.border, alignItems:'center' }}
                onPress={() => setPrepOrder(null)}
              >
                <Text style={{ color:Colors.textMuted, fontWeight:'600' }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, backgroundColor:Colors.info, alignItems:'center' }}
                onPress={() => {
                  const order = prepOrder!;
                  setPrepOrder(null);
                  updateStatus(order, 'preparing', undefined, prepMinutes && prepMinutes > 0 ? prepMinutes : undefined);
                }}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>Accept Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick-reject with reason modal */}
      <Modal visible={rejectOrder !== null} animationType="fade" transparent onRequestClose={() => setRejectOrder(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius:16, padding:20 }}>
            <Text style={{ color:Colors.text, fontWeight:'700', fontSize:16, marginBottom:4 }}>
              Reject Order {rejectOrder ? `#${rejectOrder.order_number}` : ''}
            </Text>
            <Text style={{ color:Colors.textMuted, fontSize:13, marginBottom:16 }}>
              Select a cancellation reason:
            </Text>
            <ScrollView style={{ maxHeight:240 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap:8 }}>
                {CANCEL_REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={{
                      paddingHorizontal:14, paddingVertical:10, borderRadius:10,
                      borderWidth:2, borderColor: rejectReason === r ? Colors.error : Colors.border,
                      backgroundColor: rejectReason === r ? `${Colors.error}15` : Colors.surface2,
                    }}
                    onPress={() => setRejectReason(r)}
                  >
                    <Text style={{ color: rejectReason === r ? Colors.error : Colors.text, fontSize:14 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, borderWidth:1, borderColor:Colors.border, alignItems:'center' }}
                onPress={() => setRejectOrder(null)}
              >
                <Text style={{ color:Colors.textMuted, fontWeight:'600' }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex:1, padding:12, borderRadius:10, alignItems:'center',
                  backgroundColor: rejectReason ? Colors.error : Colors.surface2,
                }}
                disabled={!rejectReason}
                onPress={() => {
                  const order = rejectOrder!;
                  setRejectOrder(null);
                  setRejectReason('');
                  updateStatus(order, 'cancelled', rejectReason);
                }}
              >
                <Text style={{ color: rejectReason ? '#fff' : Colors.textMuted, fontWeight:'700' }}>Reject Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pending orders alert panel */}
      <Modal visible={showAlerts} transparent animationType="fade" onRequestClose={() => setShowAlerts(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAlerts(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.alertPanel, { width: Math.min(320, width - 32) }]}>
            <View style={styles.alertHeader}>
              <Feather name="bell" size={18} color={Colors.primary} />
              <Text style={styles.alertTitle}>Pending Orders</Text>
              <TouchableOpacity onPress={() => setShowAlerts(false)}>
                <Feather name="x" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.alertScroll}>
              {pendingOrders.length === 0 ? (
                <View style={styles.alertEmpty}>
                  <Feather name="check-circle" size={32} color={Colors.success} />
                  <Text style={styles.alertEmptyText}>No pending orders</Text>
                </View>
              ) : (
                pendingOrders.map(o => (
                  <TouchableOpacity
                    key={o.order_number}
                    style={styles.alertRow}
                    onPress={() => { setSelected(o); setShowAlerts(false); }}
                  >
                    <View style={styles.alertDot} />
                    <View style={styles.alertInfo}>
                      <Text style={styles.alertOrderNum}>#{o.order_number}</Text>
                      <Text style={styles.alertCustomer}>{o.customer_name}</Text>
                    </View>
                    <Text style={styles.alertTime}>{formatTime(o.placed_at)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Today's summary panel */}
      <Modal visible={showSummary} transparent animationType="fade" onRequestClose={() => setShowSummary(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSummary(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.summaryPanel, { width: Math.min(380, width - 32) }]}>
            <View style={styles.alertHeader}>
              <Feather name="clock" size={18} color={Colors.primary} />
              <Text style={styles.alertTitle}>Today's Summary</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Feather name="x" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryGrid}>
              <SummaryStat label="Total Orders" value={todayOrders.length} color={Colors.text} />
              <SummaryStat label="Active"       value={todayActive}        color={Colors.info} />
              <SummaryStat label="Completed"    value={todayDone}          color={Colors.success} />
              <SummaryStat label="Cancelled"    value={todayCancelled}     color={Colors.error} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={summaryStyles.card}>
      <Text style={[summaryStyles.value, { color }]}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card:  { flex: 1, minWidth: 70, alignItems: 'center', padding: 12, backgroundColor: Colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  value: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  label: { color: Colors.textMuted, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSub, fontSize: FontSize.md },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topLeft: { justifyContent: 'center' },
  pageTitle: {
    color: Colors.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    fontFamily: 'serif',
    lineHeight: 28,
  },
  topCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    paddingHorizontal: 30,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    flex: 1,
    maxWidth: 350,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm, height: '100%' },

  activeOrdersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorDim,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  activeOrdersText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: 'bold', letterSpacing: 1 },

  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  iconBtn: { padding: 8, position: 'relative' },
  iconBtnActive: { backgroundColor: Colors.primaryDim, borderRadius: 8 },

  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  dashboardBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
    minHeight: 44,
    justifyContent: 'center',
  },
  dashboardBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: 'bold', lineHeight: 16 },

  board: { flex: 1, flexDirection: 'row', padding: 10, gap: 10 },

  // ── Phone top bar ────────────────────────────────────────────
  topBarPhone: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  topBarPhoneRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarPhoneRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtnSm: {
    padding: 8,
  },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 70,
    paddingRight: 16,
  },
  alertPanel: {
    maxHeight: 420,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  summaryPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    padding: 0,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  alertTitle: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  alertScroll: { maxHeight: 340 },
  alertEmpty: { alignItems: 'center', padding: 32, gap: 12 },
  alertEmptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.pending },
  alertInfo: { flex: 1 },
  alertOrderNum: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  alertCustomer:  { color: Colors.textSub, fontSize: FontSize.xs, marginTop: 2 },
  alertTime: { color: Colors.textMuted, fontSize: FontSize.xs },

  summaryGrid: { flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' },

  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    backgroundColor: Colors.surface2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  swipeHintText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
