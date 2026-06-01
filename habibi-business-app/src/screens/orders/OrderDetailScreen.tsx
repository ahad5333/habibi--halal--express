import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ordersAPI, BusinessOrder } from '../../services/ordersAPI';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { RootStackParams } from '../../navigation/RootNavigator';

type Nav   = NativeStackNavigationProp<RootStackParams>;
type Route = RouteProp<RootStackParams, 'OrderDetail'>;

const STATUS_STEPS = ['created', 'processed', 'on_the_way', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  created:          'Created',
  processed:        'Processed',
  on_the_way:       'On the Way',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  paid:             'Paid',
  unpaid:           'Unpaid',
  delivered_unpaid: 'Delivered — Unpaid',
};
const STATUS_COLOR: Record<string, string> = {
  created:          Colors.created,
  processed:        Colors.processed,
  on_the_way:       Colors.on_the_way,
  delivered:        Colors.delivered,
  cancelled:        Colors.error,
  paid:             Colors.success,
  unpaid:           Colors.warning,
  delivered_unpaid: Colors.warning,
};

const PAYMENT_METHODS = ['Invoice', 'Credit Card', 'Zelle', 'Cash', 'Wire Transfer'];
const CANCEL_REASONS  = [
  'Ordered by mistake',
  'Need to change items',
  'Delivery address wrong',
  'Business closed / not needed anymore',
  'Found better pricing',
  'Custom reason…',
];

export default function OrderDetailScreen() {
  const navigation   = useNavigation<Nav>();
  const route        = useRoute<Route>();
  const { orderId }  = route.params;

  const [order,       setOrder]       = useState<BusinessOrder | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showPay,     setShowPay]     = useState(false);
  const [showCancel,  setShowCancel]  = useState(false);
  const [payMethod,   setPayMethod]   = useState('Invoice');
  const [cancelReason,setCancelReason]= useState('');
  const [customReason,setCustomReason]= useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await ordersAPI.getById(orderId);
      setOrder(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load order.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handlePayNow = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await ordersAPI.payNow(order.id, payMethod);
      setShowPay(false);
      await load();
      Alert.alert('Payment Recorded', `Payment via ${payMethod} has been recorded for order #${order.order_number}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePaymentMethod = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await ordersAPI.updatePaymentMethod(order.id, payMethod);
      setShowPay(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update payment method.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !cancelReason) return;
    const finalReason = cancelReason === 'Custom reason…'
      ? (customReason.trim() || 'No reason provided')
      : cancelReason;
    setSubmitting(true);
    try {
      await ordersAPI.cancel(order.id, finalReason);
      setShowCancel(false);
      await load();
      Alert.alert('Order Cancelled', `Order #${order.order_number} has been cancelled.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not cancel order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const statusColor  = STATUS_COLOR[order.status]  ?? Colors.textSub;
  const statusLabel  = STATUS_LABELS[order.status]  ?? order.status;
  const currentStep  = STATUS_STEPS.indexOf(order.status);
  const isCancelled  = order.status === 'cancelled';
  const canCancel    = order.status === 'created';
  const canPay       = order.payment_status === 'unpaid' && !isCancelled;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_number}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status Hero */}
        <View style={[styles.statusHero, { borderColor: statusColor }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusColor + '22' }]}>
            <Feather
              name={isCancelled ? 'x-circle' : order.status === 'delivered' ? 'check-circle' : 'package'}
              size={32} color={statusColor}
            />
          </View>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.statusDate}>{formatDateTime(order.updated_at)}</Text>
        </View>

        {/* Progress tracker (only when not cancelled) */}
        {!isCancelled && currentStep >= 0 && (
          <View style={styles.progressWrap}>
            {STATUS_STEPS.map((step, idx) => {
              const done   = idx <= currentStep;
              const active = idx === currentStep;
              return (
                <React.Fragment key={step}>
                  <View style={styles.progressStep}>
                    <View style={[
                      styles.progressDot,
                      done  && { backgroundColor: Colors.gold, borderColor: Colors.gold },
                      active && { borderColor: Colors.gold },
                    ]}>
                      {done && <Feather name="check" size={10} color="#000" />}
                    </View>
                    <Text style={[styles.progressLabel, done && { color: Colors.gold }]}>
                      {STATUS_LABELS[step]}
                    </Text>
                  </View>
                  {idx < STATUS_STEPS.length - 1 && (
                    <View style={[styles.progressLine, idx < currentStep && { backgroundColor: Colors.gold }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemTotal}>{formatCurrency(item.unit_price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        {/* Financials */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financials</Text>
          <Row label="Subtotal"     value={formatCurrency(order.sub_total)} />
          <Row label="Service Fee"  value={formatCurrency(order.service_fee)} />
          <Row label="Delivery Fee" value={formatCurrency(order.delivery_fee)} />
          {order.credit_applied > 0 && (
            <Row label="Credit Applied" value={`-${formatCurrency(order.credit_applied)}`} valueColor={Colors.success} />
          )}
          <View style={styles.divider} />
          <Row label="TOTAL"  value={formatCurrency(order.total)} bold />
          <Row
            label="Payment Status"
            value={order.payment_status === 'paid' ? '✓ Paid' : 'Unpaid'}
            valueColor={order.payment_status === 'paid' ? Colors.success : Colors.warning}
          />
          {order.payment_method && (
            <Row label="Payment Method" value={order.payment_method} />
          )}
        </View>

        {/* Delivery */}
        {order.delivery_address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <Text style={styles.address}>{order.delivery_address}</Text>
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <Text style={styles.notes}>{order.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {canPay && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setPayMethod(order.payment_method || 'Invoice'); setShowPay(true); }}>
              <Feather name="credit-card" size={16} color={Colors.gold} />
              <Text style={styles.actionBtnText}>Pay Now / Change Method</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => { setCancelReason(''); setCustomReason(''); setShowCancel(true); }}>
              <Feather name="x-circle" size={16} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Pay Modal */}
      <Modal visible={showPay} animationType="slide" transparent onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Payment</Text>
            <Text style={styles.modalSub}>Select payment method for order #{order.order_number}</Text>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.payOpt, payMethod === m && styles.payOptActive]}
                onPress={() => setPayMethod(m)}
              >
                <View style={[styles.payRadio, payMethod === m && styles.payRadioActive]} />
                <Text style={[styles.payOptText, payMethod === m && { color: Colors.gold, fontWeight: FontWeight.semibold }]}>{m}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setShowPay(false)}>
                <Text style={{ color: Colors.textSub, fontWeight: FontWeight.semibold }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, submitting && { opacity: 0.6 }]}
                onPress={canPay ? handlePayNow : handleChangePaymentMethod}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#000" /> : (
                  <Text style={{ color: '#000', fontWeight: FontWeight.bold }}>
                    {canPay ? 'Mark as Paid' : 'Update Method'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={showCancel} animationType="slide" transparent onRequestClose={() => setShowCancel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Cancel Order #{order.order_number}</Text>
            <Text style={styles.modalSub}>Select a reason for cancellation:</Text>
            {CANCEL_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.payOpt, cancelReason === r && styles.payOptActive]}
                onPress={() => setCancelReason(r)}
              >
                <View style={[styles.payRadio, cancelReason === r && { ...styles.payRadioActive, backgroundColor: Colors.error, borderColor: Colors.error }]} />
                <Text style={[styles.payOptText, cancelReason === r && { color: Colors.error, fontWeight: FontWeight.semibold }]}>{r}</Text>
              </TouchableOpacity>
            ))}
            {cancelReason === 'Custom reason…' && (
              <TextInput
                style={styles.customInput}
                placeholder="Type your reason…"
                placeholderTextColor={Colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
              />
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setShowCancel(false)}>
                <Text style={{ color: Colors.textSub, fontWeight: FontWeight.semibold }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnDanger, (!cancelReason || submitting) && { opacity: 0.5 }]}
                onPress={handleCancel}
                disabled={!cancelReason || submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: FontWeight.bold }}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, bold && rowStyles.bold]}>{label}</Text>
      <Text style={[rowStyles.value, bold && rowStyles.bold, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: FontSize.sm, color: Colors.textSub },
  value: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },
  bold:  { fontWeight: FontWeight.black, color: Colors.text, fontSize: FontSize.md },
});

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  header:   {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  scroll:      { padding: Spacing.md, paddingBottom: 40 },

  statusHero:    {
    alignItems: 'center', padding: Spacing.xl,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 2, marginBottom: Spacing.md,
  },
  statusIconWrap:{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statusLabel:   { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  statusDate:    { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },

  progressWrap:  { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, paddingHorizontal: Spacing.sm },
  progressStep:  { alignItems: 'center', flex: 1 },
  progressDot:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2, marginBottom: 4 },
  progressLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', fontWeight: FontWeight.semibold },
  progressLine:  { flex: 1, height: 2, backgroundColor: Colors.border, marginBottom: 16 },

  section:     { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionTitle:{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
  itemRow:     { flexDirection: 'row', paddingVertical: 4 },
  itemQty:     { width: 28, fontSize: FontSize.sm, color: Colors.textMuted },
  itemName:    { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  itemTotal:   { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  address:     { fontSize: FontSize.base, color: Colors.textSub, lineHeight: 22 },
  notes:       { fontSize: FontSize.sm, color: Colors.textSub, fontStyle: 'italic', lineHeight: 20 },

  actions:       { gap: 10, marginBottom: 20 },
  actionBtn:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.goldDim, borderRadius: Radius.full,
    padding: 14, borderWidth: 1, borderColor: Colors.gold,
  },
  cancelBtn:     { backgroundColor: 'rgba(248,81,73,0.1)', borderColor: Colors.error },
  actionBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.gold },

  modalOverlay:  { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40 },
  modalTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  modalSub:      { fontSize: FontSize.sm, color: Colors.textSub, marginBottom: Spacing.md },
  payOpt:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  payOptActive:  { },
  payRadio:      { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.textMuted, marginRight: 12 },
  payRadioActive:{ backgroundColor: Colors.gold, borderColor: Colors.gold },
  payOptText:    { fontSize: FontSize.base, color: Colors.text },
  customInput:   { backgroundColor: Colors.surface2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.text, marginTop: 10, minHeight: 60 },
  modalBtns:     { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  modalBtnSecondary: { flex: 1, padding: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modalBtnPrimary:   { flex: 1, padding: 14, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center' },
  modalBtnDanger:    { flex: 1, padding: 14, borderRadius: Radius.full, backgroundColor: Colors.error, alignItems: 'center' },
});
