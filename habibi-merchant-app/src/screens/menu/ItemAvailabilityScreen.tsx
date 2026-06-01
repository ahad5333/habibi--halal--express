import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Switch, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { menuAPI, MenuItem } from '../../services/menuAPI';

export default function ItemAvailabilityScreen() {
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [saving,     setSaving]     = useState<Set<number>>(new Set());

  const fetchItems = useCallback(async () => {
    try {
      const data = await menuAPI.getAll();
      setItems(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const toggleItem = async (item: MenuItem) => {
    const next = !item.is_available;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: next } : i));
    setSaving(prev => new Set(prev).add(item.id));
    try {
      await menuAPI.toggleAvailability([item.id], next);
    } catch (err: any) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: item.is_available } : i));
      Alert.alert('Error', err.message);
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  const toggleCategory = (category: string, currentAvailable: boolean) => {
    const next = !currentAvailable;
    Alert.alert(
      `${next ? 'Enable' : 'Disable'} Category`,
      `Mark all items in "${category}" as ${next ? 'available' : 'unavailable'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            // Optimistic
            setItems(prev => prev.map(i => i.category === category ? { ...i, is_available: next } : i));
            try {
              await menuAPI.toggleCategoryAvailability(category, next);
            } catch (err: any) {
              fetchItems(); // refetch to restore correct state
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // Group items by category
  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
    : items;

  const categories = Array.from(new Set(filtered.map(i => i.category)));

  type ListItem =
    | { type: 'category'; category: string; available: number; total: number }
    | { type: 'item'; item: MenuItem };

  const listData: ListItem[] = [];
  categories.forEach(cat => {
    const catItems = filtered.filter(i => i.category === cat);
    const available = catItems.filter(i => i.is_available).length;
    listData.push({ type: 'category', category: cat, available, total: catItems.length });
    catItems.forEach(item => listData.push({ type: 'item', item }));
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading menu items…</Text>
      </View>
    );
  }

  const unavailableCount = items.filter(i => !i.is_available).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Menu Availability</Text>
          <Text style={styles.subtitle}>
            {unavailableCount > 0
              ? `${unavailableCount} item${unavailableCount !== 1 ? 's' : ''} currently unavailable`
              : 'All items available'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Feather name="refresh-cw" size={16} color={Colors.textSub} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items or categories…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item, idx) =>
          item.type === 'category' ? `cat-${item.category}` : `item-${item.item.id}`
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item: row }) => {
          if (row.type === 'category') {
            const allAvailable = row.available === row.total;
            return (
              <TouchableOpacity
                style={styles.categoryRow}
                onPress={() => toggleCategory(row.category, allAvailable)}
              >
                <View style={styles.categoryLeft}>
                  <Feather name="folder" size={15} color={Colors.primary} />
                  <Text style={styles.categoryName}>{row.category}</Text>
                  <Text style={styles.categoryCount}>
                    {row.available}/{row.total} available
                  </Text>
                </View>
                <View style={styles.categoryToggle}>
                  <Text style={[styles.categoryToggleText, { color: allAvailable ? Colors.success : Colors.error }]}>
                    {allAvailable ? 'All On' : 'Some Off'}
                  </Text>
                  <Feather
                    name={allAvailable ? 'toggle-right' : 'toggle-left'}
                    size={18}
                    color={allAvailable ? Colors.success : Colors.error}
                  />
                </View>
              </TouchableOpacity>
            );
          }

          const { item } = row;
          const isSaving = saving.has(item.id);
          return (
            <View style={[styles.itemRow, !item.is_available && styles.itemRowOff]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, !item.is_available && styles.textOff]}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  ${Number(item.price).toFixed(2)}
                </Text>
              </View>
              {!item.is_available && (
                <View style={styles.soldOutBadge}>
                  <Text style={styles.soldOutText}>SOLD OUT</Text>
                </View>
              )}
              {isSaving
                ? <ActivityIndicator size="small" color={Colors.primary} style={styles.switch} />
                : (
                  <Switch
                    value={item.is_available}
                    onValueChange={() => toggleItem(item)}
                    trackColor={{ false: Colors.surface2, true: `${Colors.success}60` }}
                    thumbColor={item.is_available ? Colors.success : Colors.textMuted}
                    style={styles.switch}
                  />
                )
              }
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
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
    paddingVertical: 12,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:    { color: Colors.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: 'serif' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  refreshBtn: { padding: 8, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm },

  listContent: { paddingBottom: 30 },

  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.surface2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  categoryLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryName:  { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  categoryCount: { color: Colors.textMuted, fontSize: FontSize.xs },
  categoryToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryToggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  itemRowOff: { opacity: 0.55 },
  itemInfo:  { flex: 1, gap: 2 },
  itemName:  { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemPrice: { color: Colors.textMuted, fontSize: FontSize.xs },
  textOff:   { textDecorationLine: 'line-through', color: Colors.textMuted },
  soldOutBadge: {
    backgroundColor: Colors.errorDim,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 10,
  },
  soldOutText: { color: Colors.error, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  switch: { marginLeft: 8 },
});
