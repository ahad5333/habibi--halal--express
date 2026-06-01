import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontSize, FontWeight } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../utils/useLayout';
import { useInventoryAlerts } from '../hooks/useInventoryAlerts';
import OrderBoardScreen from '../screens/orders/OrderBoardScreen';
import ItemAvailabilityScreen from '../screens/menu/ItemAvailabilityScreen';
import SalesReportScreen from '../screens/reports/SalesReportScreen';
import ReceiptsScreen from '../screens/receipts/ReceiptsScreen';
import StoreStatusScreen from '../screens/locations/StoreStatusScreen';
import TakeOrderScreen from '../screens/pos/TakeOrderScreen';

type TabName = 'Live Orders' | 'Take Order' | 'Menu' | 'Store Status' | 'Sales Report' | 'Receipts';

const SIDEBAR_ITEMS: { name: TabName; icon: keyof typeof Feather.glyphMap }[] = [
  { name: 'Live Orders',  icon: 'grid' },
  { name: 'Take Order',   icon: 'clipboard' },
  { name: 'Menu',         icon: 'list' },
  { name: 'Store Status', icon: 'map-pin' },
  { name: 'Sales Report', icon: 'bar-chart-2' },
  { name: 'Receipts',     icon: 'printer' },
];

export default function MainLayout() {
  const { user, logout }                    = useAuth();
  const { width }                           = useLayout();
  const [activeTab, setActiveTab]           = useState<TabName>('Live Orders');
  const [showStockModal, setShowStockModal] = useState(false);
  const { lowStock, loading: stockLoading, refresh } = useInventoryAlerts();

  const renderContent = () => {
    switch (activeTab) {
      case 'Live Orders':  return <OrderBoardScreen />;
      case 'Take Order':   return <TakeOrderScreen />;
      case 'Menu':         return <ItemAvailabilityScreen />;
      case 'Store Status': return <StoreStatusScreen />;
      case 'Sales Report': return <SalesReportScreen />;
      case 'Receipts':     return <ReceiptsScreen />;
      default:             return <OrderBoardScreen />;
    }
  };

  const stockLevel = (item: { current_stock: number; low_stock_threshold: number }) => {
    const pct = Number(item.current_stock) / Number(item.low_stock_threshold);
    if (pct <= 0)   return { label: 'OUT',      color: Colors.error };
    if (pct <= 0.5) return { label: 'CRITICAL', color: Colors.error };
    return               { label: 'LOW',       color: Colors.warning };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <View style={styles.sidebar}>
        {/* Gold accent top bar */}
        <View style={styles.sidebarTopBar} />
        <View style={styles.logoContainer}>
          <View style={styles.logoIconRow}>
            <View style={styles.logoIconWrap}>
              <Feather name="zap" size={16} color={Colors.gold} />
            </View>
            <Text style={styles.logoTitle}>HABIBI HALAL</Text>
          </View>
          <Text style={styles.logoSubtitle}>MERCHANT CONSOLE</Text>
        </View>

        {/* Nav items */}
        <View style={styles.navContainer}>
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => setActiveTab(item.name)}
              >
                <Feather
                  name={item.icon}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textMuted}
                  style={styles.navIcon}
                />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Low-stock alert strip ───────────────────────────── */}
        {!stockLoading && (
          <TouchableOpacity
            style={[
              styles.stockStrip,
              lowStock.length > 0 ? styles.stockStripWarn : styles.stockStripOk,
            ]}
            onPress={() => lowStock.length > 0 && setShowStockModal(true)}
            activeOpacity={lowStock.length > 0 ? 0.7 : 1}
          >
            <Feather
              name={lowStock.length > 0 ? 'alert-triangle' : 'check-circle'}
              size={14}
              color={lowStock.length > 0 ? Colors.warning : Colors.success}
            />
            <Text style={[
              styles.stockStripText,
              { color: lowStock.length > 0 ? Colors.warning : Colors.success },
            ]}>
              {lowStock.length > 0
                ? `${lowStock.length} item${lowStock.length !== 1 ? 's' : ''} low on stock`
                : 'All items stocked'}
            </Text>
            {lowStock.length > 0 && (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>{lowStock.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* User + logout */}
        <View style={styles.userContainer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Feather name="log-out" size={18} color={Colors.textMuted} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          <View style={styles.profileBox}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.name || 'Chief Admin'}</Text>
              <Text style={styles.userRole}>
                {user?.role
                  ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                  : 'Merchant'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      {/* ── Low-stock modal ─────────────────────────────────── */}
      <Modal
        visible={showStockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStockModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStockModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.stockModal, { width: Math.min(420, width - 40) }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Feather name="alert-triangle" size={18} color={Colors.warning} />
                <Text style={styles.modalTitle}>Low Stock Alerts</Text>
              </View>
              <TouchableOpacity onPress={() => { refresh(); }} style={styles.modalRefresh}>
                <Feather name="refresh-cw" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowStockModal(false)} style={styles.modalClose}>
                <Feather name="x" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Contact your supplier or restock via the admin panel.
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {lowStock.map(item => {
                const { label, color } = stockLevel(item);
                const pct = Math.max(0, Math.min(1,
                  Number(item.current_stock) / Number(item.low_stock_threshold)
                ));
                return (
                  <View key={item.id} style={styles.stockRow}>
                    <View style={styles.stockRowLeft}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockCategory}>{item.category}</Text>
                    </View>

                    {/* Mini progress bar */}
                    <View style={styles.barWrap}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.stockQty}>
                        {Number(item.current_stock).toFixed(1)} / {Number(item.low_stock_threshold)} {item.unit}
                      </Text>
                    </View>

                    <View style={[styles.levelBadge, { borderColor: color, backgroundColor: `${color}20` }]}>
                      <Text style={[styles.levelText, { color }]}>{label}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: Colors.bg },

  sidebar: {
    width: 250,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border2,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  sidebarTopBar:  { height: 3, backgroundColor: Colors.gold },
  logoContainer:  { paddingHorizontal: 20, paddingTop: 20, marginBottom: 28 },
  logoIconRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logoIconWrap:   { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.goldDim, borderWidth: 1, borderColor: Colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  logoTitle:      { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold, letterSpacing: 2 },
  logoSubtitle:   { color: Colors.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2.5, marginTop: 2 },

  navContainer: { flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navItemActive: { backgroundColor: Colors.primaryDim, borderLeftColor: Colors.primary },
  navIcon:       { marginRight: 15 },
  navText:       { color: Colors.textSub, fontSize: FontSize.md, fontWeight: '500' },
  navTextActive: { color: Colors.primary, fontWeight: '600' },

  // Low-stock strip
  stockStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  stockStripWarn: { backgroundColor: `${Colors.warning}12`, borderColor: `${Colors.warning}40` },
  stockStripOk:   { backgroundColor: `${Colors.success}12`, borderColor: `${Colors.success}40` },
  stockStripText: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  stockBadge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  stockBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },

  userContainer: { paddingHorizontal: 20, gap: 16 },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  logoutText:    { color: Colors.textSub, fontSize: FontSize.md },
  profileBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface2, padding: 12, borderRadius: 8, gap: 12 },
  avatar:        { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: Colors.text, fontSize: FontSize.md, fontWeight: 'bold' },
  userName:      { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  userRole:      { color: Colors.textMuted, fontSize: FontSize.xs },

  contentArea: { flex: 1, backgroundColor: Colors.bg },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  stockModal: {
    maxHeight: 500,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  modalHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalTitle:       { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalRefresh:     { padding: 6 },
  modalClose:       { padding: 6 },
  modalSubtitle:    { color: Colors.textMuted, fontSize: FontSize.xs, paddingHorizontal: 16, paddingVertical: 10 },

  modalList: { maxHeight: 380 },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  stockRowLeft: { width: 110 },
  stockName:    { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  stockCategory:{ color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },

  barWrap:  { flex: 1, gap: 4 },
  barTrack: { height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
  stockQty: { color: Colors.textMuted, fontSize: 10 },

  levelBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  levelText:  { fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
});
