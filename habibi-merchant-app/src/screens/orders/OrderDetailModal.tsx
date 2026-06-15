import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform, TextInput, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { ordersAPI, Order } from '../../services/ordersAPI';
import { menuAPI, MenuItem } from '../../services/menuAPI';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatTime, formatDate } from '../../utils/formatters';

interface Props {
  order: Order;
  onClose: () => void;
  onStatusChange: (status: string, cancelReason?: string, estimatedMinutes?: number) => void;
  onOrderUpdated?: (updated: Order) => void;
}

const PREP_TIME_OPTIONS = [10, 15, 20, 30, 45] as const;

const STATUS_ACTIONS: { label: string; status: string; color: string }[] = [
  { label: 'Accept → Preparing', status: 'preparing', color: Colors.info },
  { label: 'Mark Ready',         status: 'ready',     color: Colors.success },
  { label: 'Mark Delivered',     status: 'delivered', color: Colors.delivered },
  { label: 'Cancel Order',       status: 'cancelled', color: Colors.error },
];

function buildReceiptHtml(order: Order): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items.map(item => `
    <tr>
      <td>${item.quantity}x</td>
      <td>${item.name}${item.choices ? `<br/><small>${item.choices}</small>` : ''}${item.addons ? `<br/><small>${item.addons}</small>` : ''}</td>
      <td style="text-align:right">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 320px; margin: auto; }
      h2  { text-align:center; font-size:18px; margin-bottom:4px; }
      .center { text-align:center; color:#555; margin-bottom:12px; }
      .divider { border-top:1px dashed #ccc; margin:10px 0; }
      table { width:100%; border-collapse:collapse; }
      td { padding:3px 0; vertical-align:top; }
      td:last-child { white-space:nowrap; }
      .totals td { padding:2px 0; }
      .total-row td { font-weight:bold; font-size:15px; }
      small { color:#666; }
    </style>
    </head><body>
    <h2>Habibi Halal Express</h2>
    <div class="center">Order Receipt</div>
    <div class="divider"></div>
    <table>
      <tr><td><b>Order #</b></td><td>${order.order_number}</td></tr>
      <tr><td><b>Date</b></td><td>${formatDate(order.placed_at)} ${formatTime(order.placed_at)}</td></tr>
      <tr><td><b>Customer</b></td><td>${order.customer_name}</td></tr>
      <tr><td><b>Type</b></td><td>${order.delivery_method.replace('_', ' ').toUpperCase()}</td></tr>
      ${order.table_number ? `<tr><td><b>Table</b></td><td>${order.table_number}</td></tr>` : ''}
      ${order.delivery_address ? `<tr><td><b>Address</b></td><td>${order.delivery_address}</td></tr>` : ''}
    </table>
    <div class="divider"></div>
    <table>${itemRows}</table>
    <div class="divider"></div>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(order.sub_total)}</td></tr>
      ${order.tax > 0 ? `<tr><td>Tax</td><td style="text-align:right">${formatCurrency(order.tax)}</td></tr>` : ''}
      ${order.delivery_fee > 0 ? `<tr><td>Delivery Fee</td><td style="text-align:right">${formatCurrency(order.delivery_fee)}</td></tr>` : ''}
      ${order.tip > 0 ? `<tr><td>Tip</td><td style="text-align:right">${formatCurrency(order.tip)}</td></tr>` : ''}
      ${order.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${formatCurrency(order.discount)}</td></tr>` : ''}
      <tr class="total-row"><td><b>TOTAL</b></td><td style="text-align:right"><b>${formatCurrency(order.total)}</b></td></tr>
    </table>
    <div class="divider"></div>
    <div class="center">Payment: ${order.payment_method?.toUpperCase()}</div>
    <div class="center" style="margin-top:12px">Thank you for dining with us!</div>
    </body></html>
  `;
}

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

const MODIFIABLE_STATUSES = ['pending', 'accepted', 'confirmed', 'preparing', 'cooking'];

export default function OrderDetailModal({ order, onClose, onStatusChange, onOrderUpdated }: Props) {
  const [printing, setPrinting] = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState(false);
  const [showPrepModal, setShowPrepModal]       = useState(false);
  const [prepMinutes, setPrepMinutes]           = useState<number | null>(null);
  const [cancelReason, setCancelReason]         = useState('');
  const [customReason, setCustomReason]         = useState('');

  // Add-item state
  const [showAddItem, setShowAddItem]       = useState(false);
  const [menuItems, setMenuItems]           = useState<MenuItem[]>([]);
  const [addSearch, setAddSearch]           = useState('');
  const [selectedItem, setSelectedItem]     = useState<MenuItem | null>(null);
  const [addQty, setAddQty]                 = useState(1);
  const [addNote, setAddNote]               = useState('');
  const [addLoading, setAddLoading]         = useState(false);

  useEffect(() => {
    if (!showAddItem || menuItems.length > 0) return;
    menuAPI.getAll()
      .then(data => setMenuItems(data.filter(m => m.is_available && m.is_active)))
      .catch(() => {});
  }, [showAddItem]);

  const items = Array.isArray(order.items) ? order.items : [];
  const canAddItems = MODIFIABLE_STATUSES.includes((order.order_status || '').toLowerCase());

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = buildReceiptHtml(order);

      if (Platform.OS === 'web') {
        const win = window.open('', '_blank', 'width=420,height=680');
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
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Print Receipt' });
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

  const availableActions = STATUS_ACTIONS.filter(a => {
    const s = (order.order_status || '').toLowerCase();
    if (a.status === 'cancelled') return s !== 'delivered' && s !== 'cancelled' && s !== 'completed';
    if (a.status === 'preparing') return s === 'pending' || s === 'accepted' || s === 'confirmed';
    if (a.status === 'ready')     return s === 'preparing' || s === 'cooking';
    if (a.status === 'delivered') return s === 'ready';
    return false;
  });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.orderNum}>Order #{order.order_number}</Text>
              <Text style={styles.placedAt}>
                {formatDate(order.placed_at)} at {formatTime(order.placed_at)}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <StatusBadge status={order.order_status} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Customer info */}
            <Section title="Customer">
              <InfoRow icon="user"  label="Name"    value={order.customer_name} />
              {order.customer_phone && (
                <InfoRow icon="phone" label="Phone" value={order.customer_phone}
                  onPress={() => Linking.openURL(`tel:${order.customer_phone}`)} />
              )}
              {order.customer_email && (
                <InfoRow icon="mail" label="Email" value={order.customer_email}
                  onPress={() => Linking.openURL(`mailto:${order.customer_email}`)} />
              )}
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
            </Section>

            {/* Items */}
            <Section title={`Items (${items.reduce((s, i) => s + (i.quantity || 1), 0)})`}>
              {items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQty}>{item.quantity}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.choices && <Text style={styles.itemMeta}>{item.choices}</Text>}
                    {item.addons  && <Text style={styles.itemMeta}>{item.addons}</Text>}
                    {item.special_instructions && (
                      <Text style={styles.itemNote}>Note: {item.special_instructions}</Text>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatCurrency((item.price || 0) * (item.quantity || 1))}
                  </Text>
                </View>
              ))}
              {canAddItems && (
                <TouchableOpacity
                  style={styles.addItemBtn}
                  onPress={() => { setSelectedItem(null); setAddQty(1); setAddNote(''); setAddSearch(''); setShowAddItem(true); }}
                >
                  <Feather name="plus-circle" size={14} color={Colors.primary} />
                  <Text style={styles.addItemBtnText}>Add Item to Order</Text>
                </TouchableOpacity>
              )}
            </Section>

            {/* Totals */}
            <Section title="Payment">
              <TotalRow label="Subtotal"    value={formatCurrency(order.sub_total)} />
              {order.tax > 0          && <TotalRow label="Tax"          value={formatCurrency(order.tax)} />}
              {order.delivery_fee > 0 && <TotalRow label="Delivery Fee" value={formatCurrency(order.delivery_fee)} />}
              {order.service_fee > 0  && <TotalRow label="Service Fee"  value={formatCurrency(order.service_fee)} />}
              {order.tip > 0          && <TotalRow label="Tip"          value={formatCurrency(order.tip)} />}
              {order.discount > 0     && <TotalRow label="Discount"     value={`-${formatCurrency(order.discount)}`} negative />}
              <View style={styles.totalDivider} />
              <TotalRow label="TOTAL" value={formatCurrency(order.total)} bold />
              <InfoRow icon="credit-card" label="Payment" value={order.payment_method?.toUpperCase()} />
              {order.coupon_code && <InfoRow icon="tag" label="Coupon" value={order.coupon_code} />}
            </Section>

            {/* Special notes */}
            {order.notes ? (
              <Section title="Order Notes">
                <Text style={styles.notes}>{order.notes}</Text>
              </Section>
            ) : null}
          </ScrollView>

          {/* Action footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} disabled={printing}>
              {printing
                ? <ActivityIndicator size="small" color={Colors.gold} />
                : <><Feather name="printer" size={16} color={Colors.gold} /><Text style={styles.printBtnText}>Print Receipt</Text></>
              }
            </TouchableOpacity>

            <View style={styles.statusActions}>
              {availableActions.map(a => (
                <TouchableOpacity
                  key={a.status}
                  style={[styles.actionBtn, { backgroundColor: `${a.color}20`, borderColor: a.color }]}
                  onPress={() => {
                    if (a.status === 'cancelled') {
                      setCancelReason('');
                      setCustomReason('');
                      setShowCancelModal(true);
                    } else if (a.status === 'preparing') {
                      setPrepMinutes(null);
                      setShowPrepModal(true);
                    } else {
                      onStatusChange(a.status);
                    }
                  }}
                >
                  <Text style={[styles.actionBtnText, { color: a.color }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
      {/* Prep time picker */}
      <Modal visible={showPrepModal} animationType="fade" transparent onRequestClose={() => setShowPrepModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius:16, padding:20 }}>
            <Text style={{ color:Colors.text, fontWeight:'700', fontSize:16, marginBottom:4 }}>
              Accept Order #{order.order_number}
            </Text>
            <Text style={{ color:Colors.textMuted, fontSize:13, marginBottom:16 }}>
              Set estimated kitchen prep time:
            </Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 }}>
              {PREP_TIME_OPTIONS.map(min => (
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
                onPress={() => setShowPrepModal(false)}
              >
                <Text style={{ color:Colors.textMuted, fontWeight:'600' }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, backgroundColor: Colors.info, alignItems:'center' }}
                onPress={() => {
                  setShowPrepModal(false);
                  onStatusChange('preparing', undefined, prepMinutes && prepMinutes > 0 ? prepMinutes : undefined);
                  onClose();
                }}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>Accept Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add item to order */}
      <Modal visible={showAddItem} animationType="fade" transparent onRequestClose={() => setShowAddItem(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', padding:16 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius:16, padding:20, maxHeight:'85%' }}>
            <Text style={{ color:Colors.text, fontWeight:'700', fontSize:16, marginBottom:12 }}>
              Add Item to Order #{order.order_number}
            </Text>
            <TextInput
              style={{ borderWidth:1, borderColor:Colors.border, borderRadius:10, padding:10, color:Colors.text, marginBottom:12, backgroundColor:Colors.surface2 }}
              placeholder="Search menu…"
              placeholderTextColor={Colors.textMuted}
              value={addSearch}
              onChangeText={setAddSearch}
            />
            <ScrollView style={{ maxHeight:220 }} showsVerticalScrollIndicator={false}>
              {menuItems
                .filter(m => m.name.toLowerCase().includes(addSearch.toLowerCase()))
                .map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:Colors.border, backgroundColor: selectedItem?.id === m.id ? `${Colors.primary}12` : 'transparent', paddingHorizontal:4, borderRadius:6 }}
                    onPress={() => setSelectedItem(m)}
                  >
                    <Text style={{ color: selectedItem?.id === m.id ? Colors.primary : Colors.text, fontSize:14, flex:1 }}>{m.name}</Text>
                    <Text style={{ color:Colors.textMuted, fontSize:13 }}>{formatCurrency(m.price)}</Text>
                    {selectedItem?.id === m.id && <Feather name="check" size={14} color={Colors.primary} style={{ marginLeft:8 }} />}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
            {selectedItem && (
              <View style={{ marginTop:14, gap:10 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                  <Text style={{ color:Colors.textMuted, fontSize:13 }}>Qty:</Text>
                  <TouchableOpacity onPress={() => setAddQty(q => Math.max(1, q - 1))} style={{ padding:6 }}>
                    <Feather name="minus-circle" size={22} color={Colors.textSub} />
                  </TouchableOpacity>
                  <Text style={{ color:Colors.text, fontSize:16, fontWeight:'700', minWidth:24, textAlign:'center' }}>{addQty}</Text>
                  <TouchableOpacity onPress={() => setAddQty(q => q + 1)} style={{ padding:6 }}>
                    <Feather name="plus-circle" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={{ color:Colors.textMuted, fontSize:13, marginLeft:'auto' }}>
                    = {formatCurrency(selectedItem.price * addQty)}
                  </Text>
                </View>
                <TextInput
                  style={{ borderWidth:1, borderColor:Colors.border, borderRadius:8, padding:9, color:Colors.text, fontSize:13, backgroundColor:Colors.surface2 }}
                  placeholder="Special instructions (optional)…"
                  placeholderTextColor={Colors.textMuted}
                  value={addNote}
                  onChangeText={setAddNote}
                />
              </View>
            )}
            <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, borderWidth:1, borderColor:Colors.border, alignItems:'center' }}
                onPress={() => setShowAddItem(false)}
              >
                <Text style={{ color:Colors.textMuted, fontWeight:'600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, backgroundColor: selectedItem ? Colors.primary : Colors.surface2, alignItems:'center' }}
                disabled={!selectedItem || addLoading}
                onPress={async () => {
                  if (!selectedItem) return;
                  setAddLoading(true);
                  try {
                    const updated = await ordersAPI.addItem(order.order_number, {
                      name: selectedItem.name,
                      price: selectedItem.price,
                      qty: addQty,
                      special_instructions: addNote || undefined,
                    });
                    setShowAddItem(false);
                    onOrderUpdated?.(updated);
                  } catch (e: any) {
                    Alert.alert('Error', e.message);
                  } finally { setAddLoading(false); }
                }}
              >
                {addLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: selectedItem ? '#fff' : Colors.textMuted, fontWeight:'700' }}>Add to Order</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation reason picker */}
      <Modal visible={showCancelModal} animationType="fade" transparent onRequestClose={() => setShowCancelModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius:16, padding:20 }}>
            <Text style={{ color:Colors.text, fontWeight:'700', fontSize:16, marginBottom:4 }}>
              Cancel Order #{order.order_number}
            </Text>
            <Text style={{ color:Colors.textMuted, fontSize:13, marginBottom:16 }}>
              Select a reason for cancellation:
            </Text>
            {CANCEL_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={{ flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:Colors.border }}
                onPress={() => setCancelReason(r)}
              >
                <View style={{ width:18, height:18, borderRadius:9, borderWidth:2, borderColor: cancelReason === r ? Colors.error : Colors.textMuted, backgroundColor: cancelReason === r ? Colors.error : 'transparent', marginRight:12 }} />
                <Text style={{ color: cancelReason === r ? Colors.error : Colors.text, fontSize:14 }}>{r}</Text>
              </TouchableOpacity>
            ))}
            {cancelReason === 'Custom reason…' && (
              <TextInput
                style={{ marginTop:10, borderWidth:1, borderColor:Colors.border, borderRadius:8, padding:10, color:Colors.text, fontSize:13 }}
                placeholder="Type reason here…"
                placeholderTextColor={Colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
              />
            )}
            <View style={{ flexDirection:'row', gap:10, marginTop:20 }}>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, borderWidth:1, borderColor:Colors.border, alignItems:'center' }}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={{ color:Colors.textMuted, fontWeight:'600' }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex:1, padding:12, borderRadius:10, backgroundColor: cancelReason ? Colors.error : Colors.border, alignItems:'center' }}
                disabled={!cancelReason}
                onPress={() => {
                  setShowCancelModal(false);
                  const finalReason = cancelReason === 'Custom reason…' ? (customReason || 'Cancelled') : cancelReason;
                  onStatusChange('cancelled', finalReason);
                  onClose();
                }}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>Confirm Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
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

function InfoRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress?: () => void }) {
  if (!value) return null;
  const inner = (
    <View style={infoStyles.row}>
      <Feather name={icon as any} size={14} color={Colors.textMuted} style={infoStyles.icon} />
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, !!onPress && { color: Colors.primary }]} numberOfLines={2}>{value}</Text>
      {onPress && <Feather name="chevron-right" size={13} color={Colors.primary} />}
    </View>
  );
  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
    : inner;
}

function TotalRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <View style={totStyles.row}>
      <Text style={[totStyles.label, bold && totStyles.bold]}>{label}</Text>
      <Text style={[totStyles.value, bold && totStyles.bold, negative && { color: Colors.success }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderNum: { color: Colors.gold, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  placedAt: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { flex: 1 },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  itemQtyBadge: {
    width: 28, height: 28,
    borderRadius: 6,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemQty: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemMeta: { color: Colors.textSub, fontSize: FontSize.xs },
  itemNote: { color: Colors.warning, fontSize: FontSize.xs, fontStyle: 'italic' },
  itemPrice: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    borderStyle: 'dashed',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}08`,
  },
  addItemBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  notes: { color: Colors.textSub, fontSize: FontSize.sm, fontStyle: 'italic' },

  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    backgroundColor: Colors.goldDim,
  },
  printBtnText: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  statusActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

const secStyles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 16 },
  title: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  body: { gap: 4 },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, gap: 8 },
  icon: { marginTop: 2 },
  label: { color: Colors.textMuted, fontSize: FontSize.sm, width: 70 },
  value: { color: Colors.text, fontSize: FontSize.sm, flex: 1 },
});

const totStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: Colors.textSub, fontSize: FontSize.sm },
  value: { color: Colors.text, fontSize: FontSize.sm },
  bold:  { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
