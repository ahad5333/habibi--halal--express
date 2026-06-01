import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { FontSize, FontWeight } from '../theme/typography';
import { Order } from '../services/ordersAPI';
import OrderCard from './OrderCard';

interface Props {
  title: string;
  accent: string;
  orders: Order[];
  onPress: (order: Order) => void;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onAdvance?: (order: Order) => void;
}

export default function KanbanColumn({
  title, accent, orders, onPress, onAccept, onReject, onAdvance,
}: Props) {
  return (
    <View style={styles.column}>
      {/* Column header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: accent }]}>{title}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: Colors.surface2 }]}>
          <Text style={[styles.count, { color: accent }]}>{orders.length > 0 ? orders.length : '0'}</Text>
        </View>
      </View>

      {/* Orders */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Waiting for incoming orders...</Text>
          </View>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={onPress}
              onAccept={onAccept}
              onReject={onReject}
              onAdvance={onAdvance}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  count: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  empty: {
    flex: 1,
    marginTop: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    borderStyle: 'dashed',
    paddingVertical: 40,
    borderRadius: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 10,
  },
});
