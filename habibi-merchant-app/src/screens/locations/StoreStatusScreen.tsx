import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Switch,
  RefreshControl, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { locationsAPI, Location } from '../../services/locationsAPI';

type TogglingKey = `${number}-${'is_active' | 'accepting_orders'}`;

export default function StoreStatusScreen() {
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling,   setToggling]   = useState<Set<TogglingKey>>(new Set());

  const fetchLocations = useCallback(async () => {
    try {
      const data = await locationsAPI.getAll();
      setLocations(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const handleToggle = async (loc: Location, field: 'is_active' | 'accepting_orders') => {
    const key: TogglingKey = `${loc.id}-${field}`;

    // Guard: warn before fully deactivating a location
    if (field === 'is_active' && loc.is_active) {
      Alert.alert(
        'Deactivate Location',
        `This will hide "${loc.title}" from customers entirely. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deactivate', style: 'destructive', onPress: () => doToggle(loc, field, key) },
        ]
      );
      return;
    }

    doToggle(loc, field, key);
  };

  const doToggle = async (loc: Location, field: 'is_active' | 'accepting_orders', key: TogglingKey) => {
    // Optimistic update
    setLocations(prev => prev.map(l =>
      l.id === loc.id ? { ...l, [field]: !l[field] } : l
    ));
    setToggling(prev => new Set(prev).add(key));
    try {
      const updated = await locationsAPI.toggle(loc.id, field);
      setLocations(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
    } catch (err: any) {
      // Revert
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, [field]: loc[field] } : l));
      Alert.alert('Error', err.message);
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const allAccepting = locations.length > 0 && locations.every(l => l.accepting_orders);
  const someAccepting = locations.some(l => l.accepting_orders);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading locations…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Store Status</Text>
          <Text style={styles.subtitle}>
            {allAccepting
              ? 'All locations accepting orders'
              : someAccepting
              ? 'Some locations paused'
              : 'All locations paused'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: allAccepting ? `${Colors.success}20` : `${Colors.error}20`, borderColor: allAccepting ? Colors.success : Colors.error }]}>
          <View style={[styles.pillDot, { backgroundColor: allAccepting ? Colors.success : Colors.error }]} />
          <Text style={[styles.pillText, { color: allAccepting ? Colors.success : Colors.error }]}>
            {allAccepting ? 'OPEN' : 'PAUSED'}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <Feather name="zap" size={13} color={Colors.primary} />
          <Text style={styles.legendText}>
            <Text style={{ color: Colors.text, fontWeight: FontWeight.semibold }}>Accepting Orders</Text>
            {' '}— pausing stops new orders without hiding the location
          </Text>
        </View>
        <View style={styles.legendRow}>
          <Feather name="eye-off" size={13} color={Colors.textMuted} />
          <Text style={styles.legendText}>
            <Text style={{ color: Colors.text, fontWeight: FontWeight.semibold }}>Active (Visible)</Text>
            {' '}— hiding removes the location from the customer app entirely
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLocations(); }} tintColor={Colors.primary} />}
      >
        {locations.map(loc => {
          const togglingOrders = toggling.has(`${loc.id}-accepting_orders`);
          const togglingActive = toggling.has(`${loc.id}-is_active`);
          return (
            <View key={loc.id} style={[styles.card, !loc.is_active && styles.cardDimmed]}>
              {/* Location info */}
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="map-pin" size={18} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.locationName}>{loc.title}</Text>
                  <Text style={styles.locationAddress}>{loc.brief_address}</Text>
                  {loc.phone_number ? <Text style={styles.locationPhone}>{loc.phone_number}</Text> : null}
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: loc.accepting_orders && loc.is_active ? `${Colors.success}20` : `${Colors.error}20` },
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: loc.accepting_orders && loc.is_active ? Colors.success : Colors.error },
                  ]}>
                    {loc.accepting_orders && loc.is_active ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              {/* Toggles */}
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Feather name="zap" size={14} color={loc.accepting_orders ? Colors.primary : Colors.textMuted} />
                  <View>
                    <Text style={styles.toggleLabel}>Accepting Orders</Text>
                    <Text style={styles.toggleSub}>
                      {loc.accepting_orders ? 'Taking new orders' : 'Paused — no new orders'}
                    </Text>
                  </View>
                </View>
                {togglingOrders
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : (
                    <Switch
                      value={loc.accepting_orders}
                      onValueChange={() => handleToggle(loc, 'accepting_orders')}
                      trackColor={{ false: Colors.surface2, true: `${Colors.success}60` }}
                      thumbColor={loc.accepting_orders ? Colors.success : Colors.textMuted}
                    />
                  )
                }
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Feather name="eye" size={14} color={loc.is_active ? Colors.info : Colors.textMuted} />
                  <View>
                    <Text style={styles.toggleLabel}>Active (Visible)</Text>
                    <Text style={styles.toggleSub}>
                      {loc.is_active ? 'Shown in customer app' : 'Hidden from customers'}
                    </Text>
                  </View>
                </View>
                {togglingActive
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : (
                    <Switch
                      value={loc.is_active}
                      onValueChange={() => handleToggle(loc, 'is_active')}
                      trackColor={{ false: Colors.surface2, true: `${Colors.info}60` }}
                      thumbColor={loc.is_active ? Colors.info : Colors.textMuted}
                    />
                  )
                }
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.textSub, fontSize: FontSize.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:    { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: 'serif' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillDot:  { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 1 },

  legend: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { color: Colors.textMuted, fontSize: FontSize.xs, flex: 1 },

  list: { padding: 16, gap: 14, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardDimmed: { opacity: 0.6 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  cardIcon: {
    width: 40, height: 40,
    borderRadius: 10,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo:        { flex: 1 },
  locationName:    { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  locationAddress: { color: Colors.textSub, fontSize: FontSize.xs, marginTop: 2 },
  locationPhone:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  toggleSub:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
});
