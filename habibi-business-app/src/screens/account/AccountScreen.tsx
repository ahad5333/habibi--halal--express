import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import request from '../../services/api';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface OrderSummary {
  total_orders: number;
  total_spent:  number;
  unpaid_count: number;
  unpaid_total: number;
}

export default function AccountScreen() {
  const { user, logout }    = useAuth();
  const [summary,   setSummary]   = useState<OrderSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loggingOut,setLoggingOut]= useState(false);

  useEffect(() => {
    request<OrderSummary>('/api/partner/summary')
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {(user?.business_name || user?.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.businessName}>{user?.business_name || user?.name || 'Business'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Wholesale Partner</Text>
            </View>
          </View>
        </View>

        {/* Business Stats */}
        <Text style={styles.sectionLabel}>YOUR ACTIVITY</Text>
        {loading ? (
          <View style={styles.statsCard}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary?.total_orders ?? 0}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxMid]}>
              <Text style={[styles.statValue, { color: Colors.gold }]}>
                {formatCurrency(summary?.total_spent ?? 0)}
              </Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, (summary?.unpaid_count ?? 0) > 0 ? { color: Colors.warning } : {}]}>
                {summary?.unpaid_count ?? 0}
              </Text>
              <Text style={styles.statLabel}>Unpaid Orders</Text>
            </View>
          </View>
        )}
        {(summary?.unpaid_total ?? 0) > 0 && (
          <View style={styles.unpaidAlert}>
            <Feather name="alert-triangle" size={14} color={Colors.warning} />
            <Text style={styles.unpaidAlertText}>
              You have {formatCurrency(summary!.unpaid_total)} in outstanding payments.
            </Text>
          </View>
        )}

        {/* Account Links */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="package"      label="My Orders"         sub="View and track all orders" onPress={() => {}} />
          <MenuItem icon="file-text"    label="Invoices"          sub="Download PDF invoices" onPress={() => {}} />
          <MenuItem icon="map-pin"      label="Delivery Addresses"sub="Manage saved addresses" onPress={() => {}} />
          <MenuItem icon="bell"         label="Notifications"     sub="Order updates via email & SMS" onPress={() => {}} />
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="phone"        label="Call Us"            sub="+1 (347) 703-3731"  onPress={() => {}} />
          <MenuItem icon="mail"         label="Email Support"      sub="wholesale@habibihe.com" onPress={() => {}} last />
        </View>

        {/* App Info */}
        <Text style={styles.appInfo}>
          Habibi Business App v1.0{'\n'}
          Habibi Halal Express, INC.{'\n'}
          All wholesale orders subject to approval
        </Text>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? <ActivityIndicator size="small" color={Colors.error} /> : (
            <>
              <Feather name="log-out" size={16} color={Colors.error} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon, label, sub, onPress, last,
}: { icon: string; label: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, !last && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIcon}>
        <Feather name={icon as any} size={18} color={Colors.gold} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  scroll:   { padding: Spacing.md, paddingBottom: 40 },

  profileCard:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: 14,
  },
  avatarWrap:   {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.goldDim, borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.gold },
  profileInfo:  { flex: 1 },
  businessName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSub, marginTop: 2 },
  roleBadge:    {
    marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.goldDim, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.gold,
  },
  roleBadgeText:{ fontSize: 11, color: Colors.gold, fontWeight: FontWeight.semibold },

  sectionLabel: { fontSize: 11, fontWeight: FontWeight.black, color: Colors.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 4 },

  statsCard:    { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  statsGrid:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, overflow: 'hidden' },
  statBox:      { flex: 1, padding: Spacing.md, alignItems: 'center' },
  statBoxMid:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statValue:    { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.text },
  statLabel:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  unpaidAlert:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(210,153,34,0.1)', borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.warning,
  },
  unpaidAlertText: { fontSize: FontSize.sm, color: Colors.warning, flex: 1 },

  menuCard:     { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, overflow: 'hidden' },
  menuItem:     { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  menuItemBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon:     { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  menuSub:      { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  appInfo:      { textAlign: 'center', fontSize: 11, color: Colors.textMuted, lineHeight: 18, marginBottom: Spacing.lg },

  logoutBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.full, padding: 14,
    backgroundColor: 'rgba(248,81,73,0.08)',
  },
  logoutText:   { color: Colors.error, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
