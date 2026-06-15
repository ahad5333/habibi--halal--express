import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontSize, FontWeight } from '../theme/typography';
import { Order } from '../services/ordersAPI';
import { formatCurrency } from '../utils/formatters';

const DELIVERY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  delivery: 'truck',
  pickup:   'package',
  dine_in:  'coffee',
};

function elapsedMin(placedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(placedAt).getTime()) / 60_000));
}

interface Props {
  order: Order;
  onPress: (order: Order) => void;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onAdvance?: (order: Order) => void;
}

export default function OrderCard({ order, onPress, onAccept, onReject, onAdvance }: Props) {
  const mins        = elapsedMin(order.placed_at);
  const isLate      = mins >= 15;
  const elapsedLabel = mins < 1 ? 'Just now' : `${mins} min`;
  const deliveryIcon = DELIVERY_ICON[order.delivery_method] ?? 'circle';
  const typeLabel    = order.delivery_method === 'dine_in' && order.table_number
    ? `Table ${order.table_number}`
    : order.delivery_method === 'dine_in' ? 'Dine-In'
    : order.delivery_method === 'delivery' ? 'Delivery'
    : 'Pickup';

  return (
    <TouchableOpacity
      style={[styles.card, isLate && styles.cardLate]}
      onPress={() => onPress(order)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.customerName}>{order.customer_name}</Text>
        <Text style={styles.orderNum}>#{order.order_number}</Text>
      </View>

      <View style={styles.divider} />

      {/* Items List - showing up to 3 items */}
      <View style={styles.itemsContainer}>
        {Array.isArray(order.items) && order.items.slice(0, 3).map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}x</Text>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.special_instructions ? (
                 <View style={styles.itemTag}>
                    <Text style={styles.itemTagText}>{item.special_instructions.toUpperCase()}</Text>
                 </View>
              ) : null}
            </View>
          </View>
        ))}
        {Array.isArray(order.items) && order.items.length > 3 && (
          <Text style={styles.moreItems}>+ {order.items.length - 3} more items...</Text>
        )}
      </View>

      {/* Footer: delivery type | elapsed time | total */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Feather name={deliveryIcon} size={12} color={Colors.textMuted} />
          <Text style={styles.footerType}>{typeLabel}</Text>
        </View>
        <View style={styles.footerRight}>
          <View style={[styles.timerBadge, isLate && styles.timerBadgeLate]}>
            <Feather name="clock" size={11} color={isLate ? Colors.error : Colors.textMuted} />
            <Text style={[styles.timerText, isLate && styles.timerTextLate]}>{elapsedLabel}</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Action buttons */}
      <View style={styles.actions}>
        {onAccept && (
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity style={[styles.btn, styles.rejectBtn, {flex: 1}]} onPress={() => onReject && onReject(order)}>
              <Text style={[styles.btnText, { color: Colors.text }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.advanceBtn, {flex: 2}]} onPress={() => onAccept(order)}>
              <Feather name="check-circle" size={16} color={Colors.white} style={{marginRight: 6}} />
              <Text style={[styles.btnText, { color: Colors.white }]}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        )}
        {onAdvance && (
          <TouchableOpacity style={[styles.btn, styles.advanceBtn]} onPress={() => onAdvance(order)}>
            <Feather name="check-circle" size={16} color={Colors.white} style={{marginRight: 6}} />
            <Text style={[styles.btnText, { color: Colors.white }]}>Mark As Next Status</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLate: {
    borderColor: Colors.error,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  orderNum: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerType: { color: Colors.textMuted, fontSize: FontSize.xs },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surface2, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  timerBadgeLate: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  timerText:      { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  timerTextLate:  { color: Colors.error },
  total: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  itemsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemQty: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: 'bold',
    marginRight: 10,
    width: 24,
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
    marginBottom: 6,
  },
  itemTag: {
    backgroundColor: Colors.errorDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  itemTagText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  moreItems: {
    color: Colors.textSub,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
  },
  rejectBtn:  { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  advanceBtn: { backgroundColor: Colors.primary },
  btnText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
