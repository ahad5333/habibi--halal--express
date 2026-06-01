import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, RefreshControl, TextInput,
  Modal, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { ordersAPI, Order } from '../../services/ordersAPI';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';

const todayStr = new Date().toISOString().slice(0, 10);

const RESTAURANT = {
  name:    'Habibi Halal Express',
  address: '204 E Mosholu Pkwy S, Bronx, NY 10458',
  phone:   '(718) 933-4550',
  tagline: 'Authentic · Fresh · Halal',
};

// ── Receipt HTML ─────────────────────────────────────────────────────────────
function buildReceiptHtml(order: Order): string {
  const items = Array.isArray(order.items) ? order.items : [];

  const itemRows = items.map(item => {
    const lineTotal = formatCurrency((item.price || 0) * (item.quantity || 1));
    const sub = [item.choices, item.addons].filter(Boolean).join(' · ');
    const note = item.special_instructions ? `<div class="item-note">⚠ ${item.special_instructions}</div>` : '';
    return `
      <div class="item-row">
        <div class="item-qty">${item.quantity}</div>
        <div class="item-body">
          <div class="item-name">${item.name}</div>
          ${sub ? `<div class="item-sub">${sub}</div>` : ''}
          ${note}
        </div>
        <div class="item-price">${lineTotal}</div>
      </div>`;
  }).join('');

  const deliveryLine = order.delivery_method === 'delivery'
    ? `Delivery${order.delivery_address ? ` → ${order.delivery_address}` : ''}`
    : order.delivery_method === 'dine_in' && order.table_number
      ? `Dine-In — Table ${order.table_number}`
      : 'Pickup';

  const extraRows = [
    order.tax          > 0 ? `<div class="total-row"><span>Tax</span><span>${formatCurrency(order.tax)}</span></div>` : '',
    order.delivery_fee > 0 ? `<div class="total-row"><span>Delivery Fee</span><span>${formatCurrency(order.delivery_fee)}</span></div>` : '',
    order.service_fee  > 0 ? `<div class="total-row"><span>Service Fee</span><span>${formatCurrency(order.service_fee)}</span></div>` : '',
    order.tip          > 0 ? `<div class="total-row"><span>Tip</span><span>${formatCurrency(order.tip)}</span></div>` : '',
    order.discount     > 0 ? `<div class="total-row discount"><span>Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>−${formatCurrency(order.discount)}</span></div>` : '',
  ].filter(Boolean).join('');

  const noteSection = order.notes
    ? `<div class="note-section"><div class="section-label">Order Note</div><div class="note-text">${order.notes}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Receipt #${order.order_number}</title>
  <style>
    *  { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size:13px; color:#0f172a; background:#fff; max-width:400px; margin:0 auto; }

    /* ── Header ── */
    .hdr { background:#1e3a8a; color:#fff; padding:20px 20px 16px; text-align:center; }
    .hdr-name  { font-size:17px; font-weight:700; letter-spacing:1.5px; margin-bottom:3px; }
    .hdr-addr  { font-size:11px; opacity:0.8; margin-bottom:1px; }
    .hdr-phone { font-size:11px; opacity:0.8; margin-bottom:8px; }
    .hdr-badge { display:inline-block; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.35); border-radius:4px; padding:2px 10px; font-size:10px; letter-spacing:2px; text-transform:uppercase; }

    /* ── Order meta ── */
    .meta { padding:14px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .meta-row { display:flex; justify-content:space-between; padding:2px 0; font-size:12px; }
    .meta-lbl { color:#64748b; }
    .meta-val { font-weight:600; color:#0f172a; }
    .meta-val.blue { color:#1e3a8a; }

    /* ── Section label ── */
    .section-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#64748b; margin-bottom:10px; }

    /* ── Items ── */
    .items { padding:14px 20px; border-bottom:1px solid #e2e8f0; }
    .item-row { display:flex; align-items:flex-start; gap:10px; padding:6px 0; border-bottom:1px solid #f1f5f9; }
    .item-row:last-child { border-bottom:none; }
    .item-qty  { background:#e0e7ff; color:#1e3a8a; border-radius:5px; min-width:26px; height:26px; line-height:26px; text-align:center; font-size:11px; font-weight:700; flex-shrink:0; }
    .item-body { flex:1; }
    .item-name { font-weight:600; font-size:13px; line-height:1.35; }
    .item-sub  { font-size:11px; color:#64748b; margin-top:2px; }
    .item-note { font-size:11px; color:#f59e0b; margin-top:2px; }
    .item-price{ font-weight:600; white-space:nowrap; padding-top:3px; }

    /* ── Totals ── */
    .totals { padding:14px 20px; border-bottom:1px solid #e2e8f0; }
    .total-row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; color:#475569; }
    .total-row.discount span:last-child { color:#22c55e; }
    .total-divider { border-top:1px dashed #cbd5e1; margin:8px 0; }
    .grand-total { display:flex; justify-content:space-between; padding:4px 0; font-size:16px; font-weight:700; color:#1e3a8a; }

    /* ── Note section ── */
    .note-section { padding:12px 20px; border-bottom:1px solid #e2e8f0; background:#fffbeb; }
    .note-text { font-size:12px; color:#92400e; font-style:italic; }

    /* ── Footer ── */
    .footer { padding:16px 20px; text-align:center; background:#f8fafc; }
    .footer-pay { font-size:11px; color:#64748b; margin-bottom:10px; }
    .footer-pay strong { color:#0f172a; }
    .footer-thanks { font-size:13px; font-weight:700; color:#1e3a8a; margin-bottom:3px; }
    .footer-tagline { font-size:10px; color:#94a3b8; letter-spacing:0.5px; }

    @media print {
      .hdr  { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .item-qty { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="hdr-name">${RESTAURANT.name.toUpperCase()}</div>
    <div class="hdr-addr">${RESTAURANT.address}</div>
    <div class="hdr-phone">${RESTAURANT.phone}</div>
    <div class="hdr-badge">Order Receipt</div>
  </div>

  <div class="meta">
    <div class="meta-row"><span class="meta-lbl">Order #</span><span class="meta-val blue">${order.order_number}</span></div>
    <div class="meta-row"><span class="meta-lbl">Date</span><span class="meta-val">${formatDate(order.placed_at)} at ${formatTime(order.placed_at)}</span></div>
    <div class="meta-row"><span class="meta-lbl">Customer</span><span class="meta-val">${order.customer_name}</span></div>
    <div class="meta-row"><span class="meta-lbl">Type</span><span class="meta-val">${deliveryLine}</span></div>
    ${order.payment_method ? `<div class="meta-row"><span class="meta-lbl">Payment</span><span class="meta-val">${order.payment_method.toUpperCase()}</span></div>` : ''}
  </div>

  <div class="items">
    <div class="section-label">${items.length} Item${items.length !== 1 ? 's' : ''}</div>
    ${itemRows || '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:8px 0">No item details available</div>'}
  </div>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${formatCurrency(order.sub_total)}</span></div>
    ${extraRows}
    <div class="total-divider"></div>
    <div class="grand-total"><span>TOTAL</span><span>${formatCurrency(order.total)}</span></div>
  </div>

  ${noteSection}

  <div class="footer">
    ${order.payment_method ? `<div class="footer-pay">Paid via <strong>${order.payment_method.toUpperCase()}</strong></div>` : ''}
    <div class="footer-thanks">Thank you for your order!</div>
    <div class="footer-tagline">${RESTAURANT.tagline}</div>
  </div>
</body>
</html>`;
}

// ── Print helper ─────────────────────────────────────────────────────────────
async function printReceipt(order: Order) {
  const html = buildReceiptHtml(order);
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank', 'width=480,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
    return;
  }
  const Print   = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Receipt #${order.order_number}` });
  } else {
    await Print.printAsync({ html });
  }
}

// ── Receipt preview modal ────────────────────────────────────────────────────
function PreviewModal({
  order,
  onClose,
  onPrint,
  printing,
}: {
  order: Order;
  onClose: () => void;
  onPrint: () => void;
  printing: boolean;
}) {
  const { height: winH } = useWindowDimensions();
  const items = Array.isArray(order.items) ? order.items : [];
  const bodyMaxH = winH * 0.92 - 56 - 52 - 72; // total - handle/header - footer - padding

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalSt.overlay}>
        <View style={[modalSt.sheet, { maxHeight: winH * 0.92 }]}>
          {/* Handle */}
          <View style={modalSt.handle} />

          {/* Header */}
          <View style={modalSt.header}>
            <View>
              <Text style={modalSt.orderNum}>#{order.order_number}</Text>
              <Text style={modalSt.date}>{formatDate(order.placed_at)} · {formatTime(order.placed_at)}</Text>
            </View>
            <View style={modalSt.headerRight}>
              <StatusBadge status={order.order_status} />
              <TouchableOpacity onPress={onClose} style={modalSt.closeBtn}>
                <Feather name="x" size={20} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={[modalSt.body, { maxHeight: bodyMaxH }]} showsVerticalScrollIndicator={false}>
            {/* Customer / type */}
            <View style={modalSt.section}>
              <Text style={modalSt.sectionLabel}>Order Info</Text>
              <InfoRow icon="user"  label="Customer" value={order.customer_name} />
              <InfoRow
                icon={order.delivery_method === 'delivery' ? 'truck' : order.delivery_method === 'dine_in' ? 'coffee' : 'package'}
                label="Type"
                value={
                  order.delivery_method === 'dine_in' && order.table_number
                    ? `Dine-In — Table ${order.table_number}`
                    : order.delivery_method === 'delivery'
                      ? `Delivery${order.delivery_address ? ` → ${order.delivery_address}` : ''}`
                      : 'Pickup'
                }
              />
              {order.payment_method && (
                <InfoRow icon="credit-card" label="Payment" value={order.payment_method.toUpperCase()} />
              )}
            </View>

            {/* Items */}
            <View style={modalSt.section}>
              <Text style={modalSt.sectionLabel}>
                Items ({items.reduce((s, i) => s + (i.quantity || 1), 0)})
              </Text>
              {items.length === 0 ? (
                <Text style={modalSt.noItems}>No item details available</Text>
              ) : (
                items.map((item, idx) => (
                  <View key={idx} style={modalSt.itemRow}>
                    <View style={modalSt.itemQty}>
                      <Text style={modalSt.itemQtyText}>{item.quantity}</Text>
                    </View>
                    <View style={modalSt.itemBody}>
                      <Text style={modalSt.itemName}>{item.name}</Text>
                      {item.choices && <Text style={modalSt.itemSub}>{item.choices}</Text>}
                      {item.addons  && <Text style={modalSt.itemSub}>{item.addons}</Text>}
                      {item.special_instructions && (
                        <Text style={modalSt.itemNote}>⚠ {item.special_instructions}</Text>
                      )}
                    </View>
                    <Text style={modalSt.itemPrice}>
                      {formatCurrency((item.price || 0) * (item.quantity || 1))}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Totals */}
            <View style={modalSt.section}>
              <Text style={modalSt.sectionLabel}>Payment Summary</Text>
              <TotalRow label="Subtotal"    value={formatCurrency(order.sub_total)} />
              {order.tax          > 0 && <TotalRow label="Tax"          value={formatCurrency(order.tax)} />}
              {order.delivery_fee > 0 && <TotalRow label="Delivery Fee" value={formatCurrency(order.delivery_fee)} />}
              {order.service_fee  > 0 && <TotalRow label="Service Fee"  value={formatCurrency(order.service_fee)} />}
              {order.tip          > 0 && <TotalRow label="Tip"          value={formatCurrency(order.tip)} />}
              {order.discount     > 0 && (
                <TotalRow
                  label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`}
                  value={`−${formatCurrency(order.discount)}`}
                  green
                />
              )}
              <View style={modalSt.totalDivider} />
              <TotalRow label="TOTAL" value={formatCurrency(order.total)} bold />
            </View>

            {order.notes ? (
              <View style={[modalSt.section, modalSt.noteBox]}>
                <Text style={modalSt.sectionLabel}>Order Note</Text>
                <Text style={modalSt.noteText}>{order.notes}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Print footer */}
          <View style={modalSt.footer}>
            <TouchableOpacity style={modalSt.printBtn} onPress={onPrint} disabled={printing}>
              {printing
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <><Feather name="printer" size={18} color={Colors.white} /><Text style={modalSt.printBtnText}>Print Receipt</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={infoSt.row}>
      <Feather name={icon as any} size={13} color={Colors.textMuted} style={infoSt.icon} />
      <Text style={infoSt.label}>{label}</Text>
      <Text style={infoSt.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <View style={totSt.row}>
      <Text style={[totSt.label, bold && totSt.bold]}>{label}</Text>
      <Text style={[totSt.value, bold && totSt.bold, green && { color: Colors.success }]}>{value}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
type Filter = 'today' | 'all';

export default function ReceiptsScreen() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing,   setPrinting]   = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<Filter>('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersAPI.getAll();
      setOrders(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handlePrint = async (order: Order) => {
    setPrinting(order.order_number);
    try {
      await printReceipt(order);
    } catch (err: any) {
      Alert.alert('Print Error', err.message);
    } finally {
      setPrinting(null);
    }
  };

  const handlePrintFromPreview = async () => {
    if (!selectedOrder) return;
    await handlePrint(selectedOrder);
  };

  const filtered = orders
    .filter(o => {
      if (filter === 'today' && !(o.placed_at || '').startsWith(todayStr)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => new Date(b.placed_at || 0).getTime() - new Date(a.placed_at || 0).getTime());

  const itemCount = (o: Order) =>
    Array.isArray(o.items) ? o.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0;

  const deliveryIcon = (method?: string): keyof typeof Feather.glyphMap =>
    method === 'delivery' ? 'truck' : method === 'dine_in' ? 'coffee' : 'package';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading orders…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Receipts</Text>
          <Text style={styles.subtitle}>
            {filtered.length} order{filtered.length !== 1 ? 's' : ''}
            {filter === 'today' ? ' today' : ' total'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); fetchOrders(); }}>
          <Feather name="refresh-cw" size={16} color={Colors.textSub} />
        </TouchableOpacity>
      </View>

      {/* ── Search + filter ── */}
      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order # or customer…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          {(['today', 'all'] as Filter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Feather
                name={f === 'today' ? 'sun' : 'archive'}
                size={13}
                color={filter === f ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                {f === 'today' ? "Today" : 'All Orders'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={o => o.order_number}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrders(); }}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="printer" size={40} color={Colors.border2} />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'today' ? 'No orders placed today yet.' : 'No orders match your search.'}
            </Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const isPrinting = printing === order.order_number;
          const qty = itemCount(order);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedOrder(order)}
              activeOpacity={0.82}
            >
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.orderNum}>#{order.order_number}</Text>
                  <StatusBadge status={order.order_status} />
                </View>
                <Text style={styles.total}>{formatCurrency(order.total)}</Text>
              </View>

              {/* Customer + meta */}
              <Text style={styles.customer}>{order.customer_name}</Text>
              <View style={styles.cardMeta}>
                <Feather name={deliveryIcon(order.delivery_method)} size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  {order.delivery_method?.replace('_', ' ')}
                  {order.table_number ? ` · Table ${order.table_number}` : ''}
                </Text>
                <Text style={styles.metaDot}>·</Text>
                <Feather name="clock" size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{formatTime(order.placed_at)}</Text>
                {qty > 0 && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{qty} item{qty !== 1 ? 's' : ''}</Text>
                  </>
                )}
              </View>

              {/* Actions */}
              <View style={styles.cardFooter}>
                <Text style={styles.previewHint}>
                  <Feather name="eye" size={11} color={Colors.textMuted} /> Tap to preview
                </Text>
                <TouchableOpacity
                  style={[styles.printBtn, isPrinting && { opacity: 0.6 }]}
                  onPress={() => handlePrint(order)}
                  disabled={isPrinting}
                >
                  {isPrinting
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <><Feather name="printer" size={13} color={Colors.white} /><Text style={styles.printBtnText}>Print</Text></>
                  }
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Preview modal ── */}
      {selectedOrder && (
        <PreviewModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onPrint={handlePrintFromPreview}
          printing={printing === selectedOrder.order_number}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSub, fontSize: FontSize.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:      { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  refreshBtn: { padding: 8, backgroundColor: Colors.surface2, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },

  controls:   { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, gap: 8, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm },

  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  filterBtnActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  filterBtnText:       { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  filterBtnTextActive: { color: Colors.primary },

  listContent: { padding: 12, gap: 10, paddingBottom: 30 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum:   { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  total:      { color: Colors.text,    fontSize: FontSize.md, fontWeight: FontWeight.bold },
  customer:   { color: Colors.text,    fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { color: Colors.textMuted, fontSize: FontSize.xs, textTransform: 'capitalize' },
  metaDot:  { color: Colors.border2,   fontSize: FontSize.xs },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  previewHint: { color: Colors.textMuted, fontSize: FontSize.xs },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  printBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:   { color: Colors.text,      fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  emptySubtitle:{ color: Colors.textMuted, fontSize: FontSize.sm },
});

// ── Preview modal styles ─────────────────────────────────────────────────────
const modalSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderNum:    { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  date:        { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn:    { padding: 4 },

  body: {},
  section: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  noItems: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: 8 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemQty: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: Colors.primaryDim,
    justifyContent: 'center', alignItems: 'center',
  },
  itemQtyText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  itemBody:    { flex: 1, gap: 2 },
  itemName:    { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemSub:     { color: Colors.textSub, fontSize: FontSize.xs },
  itemNote:    { color: Colors.warning, fontSize: FontSize.xs, fontStyle: 'italic' },
  itemPrice:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, paddingTop: 3 },

  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  noteBox:      { backgroundColor: '#fffbeb', borderRadius: 8, marginHorizontal: 12, marginTop: 4 },
  noteText:     { color: '#92400e', fontSize: FontSize.sm, fontStyle: 'italic' },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  printBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

// ── Info row / total row helpers ─────────────────────────────────────────────
const infoSt = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, gap: 8 },
  icon:  { marginTop: 2 },
  label: { color: Colors.textMuted, fontSize: FontSize.sm, width: 72 },
  value: { color: Colors.text, fontSize: FontSize.sm, flex: 1 },
});

const totSt = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: Colors.textSub, fontSize: FontSize.sm },
  value: { color: Colors.text,    fontSize: FontSize.sm },
  bold:  { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
