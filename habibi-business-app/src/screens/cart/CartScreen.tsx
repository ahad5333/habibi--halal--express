import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart, CartItem } from '../../context/CartContext';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency } from '../../utils/formatters';
import { RootStackParams } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParams>;

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001';

function CartRow({ item }: { item: CartItem }) {
  const { updateQty, remove } = useCart();
  const src = item.image_url
    ? (item.image_url.startsWith('http') ? item.image_url : `${BASE_URL}${item.image_url}`)
    : null;

  return (
    <View style={styles.row}>
      {src ? (
        <Image source={{ uri: src }} style={styles.rowImg} resizeMode="cover" />
      ) : (
        <View style={[styles.rowImg, styles.rowImgFallback]}>
          <Feather name="box" size={20} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {item.category && <Text style={styles.rowCat}>{item.category}</Text>}
        <Text style={styles.rowPrice}>{formatCurrency(item.unit_price)} each</Text>
      </View>
      <View style={styles.rowControls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}>
          <Feather name={item.quantity <= 1 ? 'trash-2' : 'minus'} size={14} color={item.quantity <= 1 ? Colors.error : Colors.text} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}>
          <Feather name="plus" size={14} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.rowTotal}>{formatCurrency(item.unit_price * item.quantity)}</Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const navigation = useNavigation<Nav>();
  const { items, clear, subtotal, totalItems } = useCart();

  const SERVICE_FEE_RATE = 0.04273;
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const DELIVERY_FEE = subtotal >= 200 ? 0 : 15; // free delivery over $200
  const total = subtotal + serviceFee + DELIVERY_FEE;

  const handleClear = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart ({totalItems} items)</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse the catalog to add wholesale items.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.browseBtnText}>Browse Catalog</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <CartRow item={item} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {/* Order Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Subtotal ({totalItems} items)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Service Fee (4.273%)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(serviceFee)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={[styles.summaryValue, DELIVERY_FEE === 0 && { color: Colors.success }]}>
                {DELIVERY_FEE === 0 ? 'FREE' : formatCurrency(DELIVERY_FEE)}
              </Text>
            </View>
            {subtotal < 200 && (
              <Text style={styles.freeDeliveryHint}>
                Add {formatCurrency(200 - subtotal)} more for free delivery
              </Text>
            )}

            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => navigation.navigate('Checkout')}
              activeOpacity={0.85}
            >
              <Feather name="arrow-right" size={18} color="#000" />
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginLeft: 8 },
  clearBtn:    { paddingHorizontal: 8 },
  clearText:   { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 12 },
  emptyTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptySubtitle: { fontSize: FontSize.base, color: Colors.textSub, textAlign: 'center' },
  browseBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  browseBtnText: { color: '#000', fontWeight: FontWeight.bold, fontSize: FontSize.base },
  list:      { padding: Spacing.md },
  separator: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  row:       {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.sm, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowImg:         { width: 72, height: 72, borderRadius: Radius.sm },
  rowImgFallback: { backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  rowInfo:        { flex: 1 },
  rowName:        { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 2 },
  rowCat:         { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  rowPrice:       { fontSize: FontSize.sm, color: Colors.textSub },
  rowControls:    { alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: Radius.sm,
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, minWidth: 24, textAlign: 'center' },
  rowTotal: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.gold },

  summary:       { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg },
  summaryTitle:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  summaryLine:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel:  { fontSize: FontSize.sm, color: Colors.textSub },
  summaryValue:  { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },
  freeDeliveryHint: { fontSize: FontSize.xs, color: Colors.warning, marginBottom: 8 },
  totalLine:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, marginBottom: Spacing.md },
  totalLabel:    { fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.text },
  totalValue:    { fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.gold },
  checkoutBtn:   {
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 8,
  },
  checkoutBtnText: { color: '#000', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
