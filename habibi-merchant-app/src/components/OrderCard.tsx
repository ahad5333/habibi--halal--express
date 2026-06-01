import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontSize, FontWeight } from '../theme/typography';
import { Order } from '../services/ordersAPI';
import { formatCurrency } from '../utils/formatters';

interface Props {
  order: Order;
  onPress: (order: Order) => void;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onAdvance?: (order: Order) => void;
}

export default function OrderCard({ order, onPress, onAccept, onReject, onAdvance }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(order)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.customerName}>{order.customer_name}</Text>
        <Text style={styles.orderNum}>Order #{order.order_number}</Text>
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
  header: {
    marginBottom: 12,
  },
  customerName: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderNum: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
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
