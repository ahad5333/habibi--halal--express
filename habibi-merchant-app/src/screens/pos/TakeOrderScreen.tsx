import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, FlatList, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { menuAPI, MenuItem } from '../../services/menuAPI';
import { ordersAPI, Order } from '../../services/ordersAPI';
import { formatCurrency } from '../../utils/formatters';
import { useLayout } from '../../utils/useLayout';

// ── Constants ─────────────────────────────────────────────────────────────────
const TABLE_COUNT  = 20;
const TAX_RATE     = 0.08875; // NYC 8.875 %
const ACTIVE_ST    = new Set(['pending','accepted','confirmed','preparing','cooking','ready']);
const PAY_OPTIONS  = ['Cash', 'Card', 'Split'] as const;
type  PayMethod    = typeof PAY_OPTIONS[number];
type  Step         = 'tables' | 'menu' | 'confirm';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CartItem {
  item:  MenuItem;
  qty:   number;
  note:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcTotals(cart: CartItem[]) {
  const subtotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const tax      = subtotal * TAX_RATE;
  return { subtotal, tax, total: subtotal + tax };
}

// ── Table grid ────────────────────────────────────────────────────────────────
function TableGrid({
  occupied, onSelect,
}: {
  occupied: Record<string, number>;   // table -> open-order count
  onSelect: (tableNum: string) => void;
}) {
  const [manual, setManual] = useState('');
  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => String(i + 1));

  return (
    <ScrollView contentContainerStyle={tg.wrap} showsVerticalScrollIndicator={false}>
      <Text style={tg.heading}>Select Table</Text>
      <Text style={tg.sub}>Tap a table to start taking the order.</Text>

      <View style={tg.grid}>
        {tables.map(t => {
          const count = occupied[t] ?? 0;
          const busy  = count > 0;
          return (
            <TouchableOpacity
              key={t}
              style={[tg.cell, busy ? tg.cellBusy : tg.cellFree]}
              onPress={() => onSelect(t)}
              activeOpacity={0.75}
            >
              <Text style={[tg.cellNum, busy ? tg.cellNumBusy : tg.cellNumFree]}>
                {t}
              </Text>
              {busy && (
                <View style={tg.badge}>
                  <Text style={tg.badgeText}>{count}</Text>
                </View>
              )}
              {busy && <Text style={tg.cellOccupied}>occupied</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Manual entry */}
      <View style={tg.manualRow}>
        <View style={tg.manualInputWrap}>
          <Feather name="hash" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={tg.manualInput}
            placeholder="Other table number…"
            placeholderTextColor={Colors.textMuted}
            value={manual}
            onChangeText={setManual}
            keyboardType="default"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (manual.trim()) { onSelect(manual.trim()); setManual(''); }
            }}
          />
        </View>
        <TouchableOpacity
          style={[tg.manualBtn, !manual.trim() && { opacity: 0.4 }]}
          onPress={() => { if (manual.trim()) { onSelect(manual.trim()); setManual(''); } }}
          disabled={!manual.trim()}
        >
          <Text style={tg.manualBtnText}>Go</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Item note modal ───────────────────────────────────────────────────────────
function NoteModal({
  visible, initial, onDone,
}: {
  visible: boolean;
  initial: string;
  onDone: (note: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => { setText(initial); }, [initial, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={nm.overlay}>
          <View style={nm.card}>
            <Text style={nm.title}>Item Note</Text>
            <Text style={nm.sub}>e.g. "no onions", "extra sauce", allergy info</Text>
            <TextInput
              style={nm.input}
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholderTextColor={Colors.textMuted}
              placeholder="Add a note for the kitchen…"
            />
            <View style={nm.row}>
              <TouchableOpacity style={nm.cancelBtn} onPress={() => onDone(initial)}>
                <Text style={nm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={nm.doneBtn} onPress={() => onDone(text.trim())}>
                <Text style={nm.doneText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Menu browser + cart ───────────────────────────────────────────────────────
function MenuBrowser({
  tableNum, menuItems, cart, setCart,
  onBack, onConfirm,
}: {
  tableNum: string;
  menuItems: MenuItem[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { isPhone }     = useLayout();
  const [category, setCategory] = useState('');
  const [noteFor, setNoteFor]   = useState<MenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);

  // Use ALL items for categories (not filtered) so every category always shows
  const categories = Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)));

  useEffect(() => {
    if (!category && categories.length > 0) setCategory(categories[0]);
  }, [menuItems]);

  const visible = menuItems.filter(
    m => m.is_available !== false && m.is_active !== false && (category ? m.category === category : true)
  );

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const { subtotal } = calcTotals(cart);

  const getQty = (id: number) => cart.find(c => c.item.id === id)?.qty ?? 0;

  const changeQty = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.item.id === item.id);
      if (idx === -1 && delta > 0) return [...prev, { item, qty: 1, note: '' }];
      if (idx === -1) return prev;
      const newQty = prev[idx].qty + delta;
      if (newQty <= 0) return prev.filter(c => c.item.id !== item.id);
      return prev.map((c, i) => i === idx ? { ...c, qty: newQty } : c);
    });
  };

  const updateNote = (item: MenuItem, note: string) => {
    setCart(prev => prev.map(c => c.item.id === item.id ? { ...c, note } : c));
    setNoteFor(null);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Top bar */}
      <View style={mb.topBar}>
        <TouchableOpacity onPress={onBack} style={mb.backBtn}>
          <Feather name="chevron-left" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={mb.topInfo}>
          <Text style={mb.topTable}>Table {tableNum}</Text>
          <Text style={mb.topSub}>Select items for the order</Text>
        </View>
        {cartCount > 0 && (
          <TouchableOpacity style={mb.cartBtn} onPress={() => setShowCart(true)}>
            <Feather name="shopping-cart" size={18} color={Colors.white} />
            <View style={mb.cartBadge}>
              <Text style={mb.cartBadgeText}>{cartCount}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Category bar — outer View holds the height, ScrollView fills it */}
      <View style={mb.catContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={mb.catRow}
          style={{ flex: 1 }}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[mb.catPill, category === cat && mb.catPillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[mb.catPillText, category === cat && mb.catPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Items list */}
      <FlatList
        data={visible}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={mb.list}
        renderItem={({ item }) => {
          const qty = getQty(item.id);
          const inCart = qty > 0;
          return (
            <View style={[mb.itemRow, inCart && mb.itemRowActive]}>
              <View style={mb.itemInfo}>
                <Text style={mb.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={mb.itemDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={mb.itemPrice}>{formatCurrency(item.price)}</Text>
              </View>

              {inCart && (
                <TouchableOpacity
                  style={mb.noteBtn}
                  onPress={() => setNoteFor(item)}
                >
                  <Feather name="edit-3" size={13} color={Colors.textMuted} />
                  <Text style={mb.noteBtnText}>
                    {cart.find(c => c.item.id === item.id)?.note ? 'Note ✓' : 'Note'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Qty controls */}
              <View style={mb.qtyRow}>
                {inCart && (
                  <TouchableOpacity style={mb.qtyBtn} onPress={() => changeQty(item, -1)}>
                    <Feather name={qty === 1 ? 'trash-2' : 'minus'} size={15} color={Colors.error} />
                  </TouchableOpacity>
                )}
                {inCart && <Text style={mb.qtyNum}>{qty}</Text>}
                <TouchableOpacity
                  style={[mb.qtyAddBtn, inCart && mb.qtyAddBtnActive]}
                  onPress={() => changeQty(item, 1)}
                >
                  <Feather name="plus" size={16} color={inCart ? Colors.white : Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Cart summary bar */}
      {cartCount > 0 && (
        <View style={mb.cartBar}>
          <View>
            <Text style={mb.cartBarCount}>{cartCount} item{cartCount !== 1 ? 's' : ''}</Text>
            <Text style={mb.cartBarTotal}>{formatCurrency(subtotal)} + tax</Text>
          </View>
          <TouchableOpacity style={mb.cartBarBtn} onPress={onConfirm}>
            <Text style={mb.cartBarBtnText}>Review Order</Text>
            <Feather name="chevron-right" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Item note modal */}
      <NoteModal
        visible={noteFor !== null}
        initial={noteFor ? (cart.find(c => c.item.id === noteFor.id)?.note ?? '') : ''}
        onDone={note => noteFor && updateNote(noteFor, note)}
      />

      {/* Cart detail sheet */}
      <Modal visible={showCart} transparent animationType="slide">
        <View style={cs.overlay}>
          <View style={cs.sheet}>
            <View style={cs.header}>
              <Text style={cs.title}>Cart — Table {tableNum}</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Feather name="x" size={20} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView style={cs.list}>
              {cart.map((c, i) => (
                <View key={i} style={cs.row}>
                  <View style={cs.rowQty}>
                    <Text style={cs.qtyText}>{c.qty}×</Text>
                  </View>
                  <View style={cs.rowInfo}>
                    <Text style={cs.rowName}>{c.item.name}</Text>
                    {c.note ? <Text style={cs.rowNote}>📝 {c.note}</Text> : null}
                  </View>
                  <Text style={cs.rowPrice}>{formatCurrency(c.item.price * c.qty)}</Text>
                  <TouchableOpacity onPress={() => changeQty(c.item, -c.qty)}>
                    <Feather name="trash-2" size={15} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={cs.proceedBtn}
              onPress={() => { setShowCart(false); onConfirm(); }}
            >
              <Text style={cs.proceedBtnText}>Review Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Confirm + send ────────────────────────────────────────────────────────────
function OrderConfirm({
  tableNum, cart, onBack, onSent,
}: {
  tableNum: string;
  cart: CartItem[];
  onBack: () => void;
  onSent: () => void;
}) {
  const [payMethod, setPayMethod] = useState<PayMethod>('Cash');
  const [orderNote, setOrderNote] = useState('');
  const [sending, setSending]     = useState(false);
  const { subtotal, tax, total }  = calcTotals(cart);

  const handleSend = async () => {
    setSending(true);
    try {
      await ordersAPI.create({
        customer_name:   `Table ${tableNum}`,
        delivery_method: 'dine_in',
        table_number:    tableNum,
        payment_method:  payMethod.toLowerCase(),
        sub_total:       parseFloat(subtotal.toFixed(2)),
        tax:             parseFloat(tax.toFixed(2)),
        service_fee:     0,
        delivery_fee:    0,
        tip:             0,
        discount:        0,
        total:           parseFloat(total.toFixed(2)),
        notes:           orderNote.trim() || undefined,
        items: cart.map(c => ({
          name:                  c.item.name,
          qty:                   c.qty,
          price:                 c.item.price,
          special_instructions:  c.note || undefined,
        })),
      });
      Alert.alert(
        'Order Sent!',
        `Table ${tableNum} order is now in the kitchen queue.`,
        [{ text: 'Done', onPress: onSent }]
      );
    } catch (err: any) {
      Alert.alert('Failed to Send', err.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={oc.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={oc.header}>
          <TouchableOpacity onPress={onBack} style={oc.backBtn}>
            <Feather name="chevron-left" size={22} color={Colors.primary} />
            <Text style={oc.backText}>Add More</Text>
          </TouchableOpacity>
          <View style={oc.headerBadge}>
            <Feather name="coffee" size={14} color={Colors.primary} />
            <Text style={oc.headerBadgeText}>Table {tableNum}</Text>
          </View>
        </View>

        <Text style={oc.title}>Review Order</Text>
        <Text style={oc.sub}>Confirm items and payment before sending to the kitchen.</Text>

        {/* Items */}
        <View style={oc.section}>
          <Text style={oc.sectionLabel}>Items ({cart.reduce((s, c) => s + c.qty, 0)})</Text>
          {cart.map((c, i) => (
            <View key={i} style={oc.itemRow}>
              <View style={oc.itemQty}>
                <Text style={oc.itemQtyText}>{c.qty}</Text>
              </View>
              <View style={oc.itemBody}>
                <Text style={oc.itemName}>{c.item.name}</Text>
                {c.note ? <Text style={oc.itemNote}>📝 {c.note}</Text> : null}
              </View>
              <Text style={oc.itemPrice}>{formatCurrency(c.item.price * c.qty)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={oc.section}>
          <Text style={oc.sectionLabel}>Bill Summary</Text>
          <View style={oc.totalRow}>
            <Text style={oc.totalLabel}>Subtotal</Text>
            <Text style={oc.totalVal}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={oc.totalRow}>
            <Text style={oc.totalLabel}>Tax (8.875%)</Text>
            <Text style={oc.totalVal}>{formatCurrency(tax)}</Text>
          </View>
          <View style={oc.divider} />
          <View style={oc.totalRow}>
            <Text style={[oc.totalLabel, oc.totalBold]}>Total</Text>
            <Text style={[oc.totalVal, oc.totalBold, { color: Colors.primary }]}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Payment method */}
        <View style={oc.section}>
          <Text style={oc.sectionLabel}>Payment Method</Text>
          <View style={oc.payRow}>
            {PAY_OPTIONS.map(p => (
              <TouchableOpacity
                key={p}
                style={[oc.payBtn, payMethod === p && oc.payBtnActive]}
                onPress={() => setPayMethod(p)}
              >
                <Feather
                  name={p === 'Cash' ? 'dollar-sign' : p === 'Card' ? 'credit-card' : 'users'}
                  size={15}
                  color={payMethod === p ? Colors.white : Colors.textMuted}
                />
                <Text style={[oc.payBtnText, payMethod === p && oc.payBtnTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order note */}
        <View style={oc.section}>
          <Text style={oc.sectionLabel}>Kitchen Note (optional)</Text>
          <TextInput
            style={oc.noteInput}
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder="e.g. birthday table, severe allergy, rush order…"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[oc.sendBtn, sending && { opacity: 0.7 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Feather name="send" size={20} color={Colors.white} />
              <Text style={oc.sendBtnText}>Send to Kitchen</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function TakeOrderScreen() {
  const [step,       setStep]      = useState<Step>('tables');
  const [tableNum,   setTableNum]  = useState('');
  const [menuItems,  setMenuItems] = useState<MenuItem[]>([]);
  const [occupied,   setOccupied]  = useState<Record<string, number>>({});
  const [cart,       setCart]      = useState<CartItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Load menu items and occupied tables on mount
  const loadData = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const [items, orders] = await Promise.all([
        menuAPI.getAll(),
        ordersAPI.getAll(),
      ]);
      setMenuItems(items);

      // Build occupied table map: table -> count of active orders
      const occ: Record<string, number> = {};
      orders.forEach(o => {
        if (o.delivery_method === 'dine_in' && o.table_number && ACTIVE_ST.has((o.order_status || '').toLowerCase())) {
          occ[o.table_number] = (occ[o.table_number] ?? 0) + 1;
        }
      });
      setOccupied(occ);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTableSelect = (t: string) => {
    const count = occupied[t] ?? 0;
    if (count > 0) {
      Alert.alert(
        `Table ${t}`,
        `This table has ${count} active order${count !== 1 ? 's' : ''}.\nDo you want to add a new ticket?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add New Ticket',
            onPress: () => { setTableNum(t); setCart([]); setStep('menu'); },
          },
        ]
      );
    } else {
      setTableNum(t); setCart([]); setStep('menu');
    }
  };

  const handleSent = () => {
    // Refresh occupancy, return to table grid
    loadData();
    setStep('tables');
    setTableNum('');
    setCart([]);
  };

  if (loadingMenu) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Loading menu…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {step === 'tables' && (
        <View style={{ flex: 1 }}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Feather name="clipboard" size={20} color={Colors.primary} />
              <Text style={s.headerTitle}>Take Order</Text>
            </View>
            <TouchableOpacity style={s.refreshBtn} onPress={loadData}>
              <Feather name="refresh-cw" size={16} color={Colors.textSub} />
            </TouchableOpacity>
          </View>
          <TableGrid occupied={occupied} onSelect={handleTableSelect} />
        </View>
      )}

      {step === 'menu' && (
        <MenuBrowser
          tableNum={tableNum}
          menuItems={menuItems}
          cart={cart}
          setCart={setCart}
          onBack={() => setStep('tables')}
          onConfirm={() => setStep('confirm')}
        />
      )}

      {step === 'confirm' && (
        <OrderConfirm
          tableNum={tableNum}
          cart={cart}
          onBack={() => setStep('menu')}
          onSent={handleSent}
        />
      )}
    </SafeAreaView>
  );
}

// ── StyleSheets ───────────────────────────────────────────────────────────────

// Main
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: Colors.bg },
  loadingText: { color: Colors.textSub, fontSize: FontSize.sm },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  refreshBtn:  { padding: 8, backgroundColor: Colors.surface2, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
});

// Table grid
const tg = StyleSheet.create({
  wrap:    { padding: 20, paddingBottom: 40 },
  heading: { color: Colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
  sub:     { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: 20 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  cell: {
    width: 72, height: 72, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, position: 'relative',
  },
  cellFree: { backgroundColor: Colors.surface, borderColor: Colors.border },
  cellBusy: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: '#f59e0b' },

  cellNum:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  cellNumFree: { color: Colors.textSub },
  cellNumBusy: { color: '#92400e' },

  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: Colors.error, borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
  cellOccupied: { fontSize: 9, color: '#b45309', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  manualRow: { flexDirection: 'row', gap: 10, marginTop: 24, alignItems: 'center' },
  manualInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 46,
  },
  manualInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  manualBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 20, height: 46,
    justifyContent: 'center', alignItems: 'center',
  },
  manualBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});

// Note modal
const nm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, gap: 12 },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sub:   { color: Colors.textMuted, fontSize: FontSize.xs },
  input: {
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, color: Colors.text, fontSize: FontSize.sm,
    minHeight: 80, textAlignVertical: 'top',
  },
  row:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { color: Colors.textMuted, fontWeight: FontWeight.semibold },
  doneBtn:    { flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  doneText:   { color: Colors.white, fontWeight: FontWeight.bold },
});

// Menu browser
const mb = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  topInfo: { flex: 1 },
  topTable: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  topSub:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
  cartBtn: {
    backgroundColor: Colors.primary, borderRadius: 22,
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: 9,
    minWidth: 18, height: 18, paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },

  catContainer: {
    height: 68,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: 'center',
  },
  catRow: {
    paddingHorizontal: 14,
    gap: 10,
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 14,
  },
  catPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.bg,
  },
  catPillActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText:       { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  catPillTextActive: { color: Colors.white, fontWeight: FontWeight.bold },

  list: { padding: 12, gap: 8, paddingBottom: 100 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 10,
  },
  itemRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  itemInfo:  { flex: 1 },
  itemName:  { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemDesc:  { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
  itemPrice: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginTop: 3 },

  noteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  noteBtnText: { color: Colors.textMuted, fontSize: 10, fontWeight: FontWeight.semibold },

  qtyRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  qtyNum:      { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold, minWidth: 20, textAlign: 'center' },
  qtyAddBtn:   { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  qtyAddBtnActive: { backgroundColor: Colors.primary },

  cartBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 14, paddingBottom: 18,
  },
  cartBarCount:  { color: Colors.textSub,  fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  cartBarTotal:  { color: Colors.textMuted, fontSize: FontSize.xs },
  cartBarBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  cartBarBtnText:{ color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});

// Cart sheet
const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:   { color: Colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  list:    { maxHeight: 300 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  rowQty:  { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.primaryDim, justifyContent: 'center', alignItems: 'center' },
  qtyText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  rowInfo: { flex: 1 },
  rowName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  rowNote: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
  rowPrice:{ color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginRight: 8 },
  proceedBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  proceedBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

// Order confirm
const oc = StyleSheet.create({
  scroll:  { padding: 20, paddingBottom: 40 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:{ color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerBadgeText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginBottom: 4 },
  sub:   { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: 20 },

  section:      { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.textMuted, marginBottom: 12 },

  itemRow:     { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  itemQty:     { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.primaryDim, justifyContent: 'center', alignItems: 'center' },
  itemQtyText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  itemBody:    { flex: 1 },
  itemName:    { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemNote:    { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  itemPrice:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, paddingTop: 3 },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { color: Colors.textSub, fontSize: FontSize.sm },
  totalVal:   { color: Colors.text,    fontSize: FontSize.sm },
  totalBold:  { fontWeight: FontWeight.bold, fontSize: FontSize.md },
  divider:    { height: 1, backgroundColor: Colors.border, marginVertical: 6 },

  payRow: { flexDirection: 'row', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  payBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  payBtnText:       { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  payBtnTextActive: { color: Colors.white },

  noteInput: {
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, color: Colors.text, fontSize: FontSize.sm,
    minHeight: 72, textAlignVertical: 'top',
  },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    marginTop: 4,
  },
  sendBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
