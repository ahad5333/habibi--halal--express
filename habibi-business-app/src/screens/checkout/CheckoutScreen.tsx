import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../services/ordersAPI';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency } from '../../utils/formatters';
import { RootStackParams } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParams>;

const PAYMENT_METHODS = [
  { id: 'invoice',  label: 'Invoice (Pay Later)',   icon: 'file-text' },
  { id: 'card',     label: 'Credit / Debit Card',   icon: 'credit-card' },
  { id: 'zelle',    label: 'Zelle',                 icon: 'smartphone' },
  { id: 'cash',     label: 'Cash on Delivery',      icon: 'dollar-sign' },
  { id: 'wire',     label: 'Bank Wire Transfer',    icon: 'trending-up' },
] as const;

export default function CheckoutScreen() {
  const navigation  = useNavigation<Nav>();
  const { user }    = useAuth();
  const { items, subtotal, clear } = useCart();

  const [address,    setAddress]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [payMethod,  setPayMethod]  = useState<string>('invoice');
  const [payNow,     setPayNow]     = useState(false);
  const [placing,    setPlacing]    = useState(false);

  const SERVICE_FEE_RATE = 0.04273;
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const deliveryFee = subtotal >= 200 ? 0 : 15;
  const total = subtotal + serviceFee + deliveryFee;

  const handlePlace = async () => {
    if (!address.trim()) {
      Alert.alert('Missing Address', 'Please enter your delivery address.');
      return;
    }
    setPlacing(true);
    try {
      const result = await ordersAPI.place({
        items: items.map(i => ({
          menu_item_id: i.id,
          name:         i.name,
          quantity:     i.quantity,
          unit_price:   i.unit_price,
        })),
        delivery_address: address.trim(),
        notes:            notes.trim() || undefined,
        payment_method:   payMethod,
        pay_now:          payNow && payMethod !== 'invoice',
      });
      clear();
      Alert.alert(
        'Order Placed!',
        `Your order ${result.order_number} has been submitted successfully.`,
        [{ text: 'View Order', onPress: () => {
          navigation.replace('OrderDetail', { orderId: result.id });
        }}]
      );
    } catch (err: any) {
      Alert.alert('Order Failed', err.message || 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Delivery Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Feather name="map-pin" size={14} color={Colors.gold} />{'  '}Delivery Address
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter full delivery address including city, state, ZIP"
              placeholderTextColor={Colors.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Order Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Feather name="message-square" size={14} color={Colors.gold} />{'  '}Order Notes (optional)
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Special instructions, preferred delivery window, etc."
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Feather name="credit-card" size={14} color={Colors.gold} />{'  '}Payment Method
            </Text>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.payOption, payMethod === m.id && styles.payOptionActive]}
                onPress={() => setPayMethod(m.id)}
              >
                <View style={[styles.payRadio, payMethod === m.id && styles.payRadioActive]} />
                <Feather name={m.icon as any} size={16} color={payMethod === m.id ? Colors.gold : Colors.textSub} style={{ marginRight: 10 }} />
                <Text style={[styles.payLabel, payMethod === m.id && styles.payLabelActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}

            {/* Pay now toggle (only for non-invoice methods) */}
            {payMethod !== 'invoice' && (
              <TouchableOpacity style={styles.payNowToggle} onPress={() => setPayNow(p => !p)}>
                <View style={[styles.checkbox, payNow && styles.checkboxActive]}>
                  {payNow && <Feather name="check" size={12} color="#000" />}
                </View>
                <Text style={styles.payNowLabel}>Pay now (at order time)</Text>
                <Text style={styles.payNowHint}>  or leave unchecked to pay upon delivery</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Feather name="list" size={14} color={Colors.gold} />{'  '}Order Summary
            </Text>
            {items.map(i => (
              <View key={i.id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{i.quantity}×</Text>
                <Text style={styles.itemName} numberOfLines={1}>{i.name}</Text>
                <Text style={styles.itemTotal}>{formatCurrency(i.unit_price * i.quantity)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Service Fee</Text>
              <Text style={styles.summaryValue}>{formatCurrency(serviceFee)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={[styles.summaryValue, deliveryFee === 0 && { color: Colors.success }]}>
                {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
              </Text>
            </View>
            <View style={[styles.summaryLine, styles.totalLine]}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>{formatCurrency(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeBtn, placing && { opacity: 0.6 }]}
          onPress={handlePlace}
          disabled={placing}
          activeOpacity={0.85}
        >
          {placing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#000" />
              <Text style={styles.placeBtnText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  scroll:      { padding: Spacing.md, paddingBottom: 20 },
  section:     {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle:{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: Spacing.sm },
  textArea:    {
    backgroundColor: Colors.surface2, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.text,
    fontSize: FontSize.base, minHeight: 80,
  },
  payOption:   {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: Radius.md, marginBottom: 6,
    backgroundColor: Colors.surface2,
    borderWidth: 1, borderColor: Colors.border,
  },
  payOptionActive: { borderColor: Colors.gold, backgroundColor: Colors.goldDim },
  payRadio:        { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.textMuted, marginRight: 10 },
  payRadioActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold },
  payLabel:        { fontSize: FontSize.base, color: Colors.textSub },
  payLabelActive:  { color: Colors.text, fontWeight: FontWeight.semibold },
  payNowToggle:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  checkbox:        {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.textMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  checkboxActive:  { backgroundColor: Colors.gold, borderColor: Colors.gold },
  payNowLabel:     { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },
  payNowHint:      { fontSize: FontSize.xs, color: Colors.textMuted },
  itemRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  itemQty:         { width: 28, fontSize: FontSize.sm, color: Colors.textMuted },
  itemName:        { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  itemTotal:       { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  divider:         { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  summaryLine:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel:    { fontSize: FontSize.sm, color: Colors.textSub },
  summaryValue:    { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },
  totalLine:       { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  totalLabel:      { fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.text },
  totalValue:      { fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.gold },
  footer:          {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerLabel:     { fontSize: FontSize.xs, color: Colors.textMuted },
  footerTotal:     { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.gold },
  placeBtn:        {
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  placeBtnText:    { color: '#000', fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
