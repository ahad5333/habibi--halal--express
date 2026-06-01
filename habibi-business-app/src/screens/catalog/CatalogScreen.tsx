import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { menuAPI, BusinessMenuItem } from '../../services/menuAPI';
import { useCart } from '../../context/CartContext';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';
import { formatCurrency } from '../../utils/formatters';
import { RootStackParams } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParams>;

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001';

function imgSrc(url?: string) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function ItemCard({ item, onAdd }: { item: BusinessMenuItem; onAdd: (item: BusinessMenuItem) => void }) {
  const [qty, setQty] = useState(1);
  const src = imgSrc(item.image_url);

  return (
    <View style={styles.card}>
      {src ? (
        <Image source={{ uri: src }} style={styles.cardImg} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImg, styles.cardImgFallback]}>
          <Feather name="image" size={28} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        {item.category && (
          <Text style={styles.cardCat}>{item.category}</Text>
        )}
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.notes ? (
          <Text style={styles.cardNotes}>{item.notes}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
              <Feather name="minus" size={14} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => q + 1)}>
              <Feather name="plus" size={14} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => { onAdd(item); setQty(1); }}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CatalogScreen() {
  const navigation   = useNavigation<Nav>();
  const { addItem }  = useCart();
  const [items,      setItems]      = useState<BusinessMenuItem[]>([]);
  const [filtered,   setFiltered]   = useState<BusinessMenuItem[]>([]);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addedId,    setAddedId]    = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await menuAPI.getCatalog();
      const active = data.filter(i => i.is_active !== false && i.is_available !== false);
      setItems(active);
      const cats = ['All', ...Array.from(new Set(active.map(i => i.category).filter(Boolean) as string[]))];
      setCategories(cats);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = items;
    if (category !== 'All') result = result.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [items, category, search]);

  const handleAdd = (item: BusinessMenuItem) => {
    addItem({
      id:         item.id,
      name:       item.name,
      unit_price: item.price,
      image_url:  item.image_url,
      category:   item.category,
    });
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={c => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.catChip, category === c && styles.catChipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        )}
        style={styles.catList}
      />

      {/* Items */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>
            {search ? `No items matching "${search}"` : 'No items in this category'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.gold}
            />
          }
          renderItem={({ item }) => (
            <View style={{ position: 'relative' }}>
              <ItemCard item={item} onAdd={handleAdd} />
              {addedId === item.id && (
                <View style={styles.addedBanner}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.addedText}>Added to cart</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  searchWrap:{
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md,
    height: 44, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput:{ flex: 1, color: Colors.text, fontSize: FontSize.base },
  catList:   { maxHeight: 48, marginTop: Spacing.sm },
  catRow:    { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center' },
  catChip:   {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  catChipText:       { fontSize: FontSize.sm, color: Colors.textSub, fontWeight: FontWeight.semibold },
  catChipTextActive: { color: '#000' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: Colors.textSub, fontSize: FontSize.base },
  list:      { padding: Spacing.md, gap: 12, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImg: { width: 110, height: 110 },
  cardImgFallback: {
    backgroundColor: Colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: Spacing.md },
  cardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 2 },
  cardCat:  { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4,
    backgroundColor: Colors.surface2, alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  cardDesc: { fontSize: FontSize.xs, color: Colors.textSub, lineHeight: 16, marginBottom: 4 },
  cardNotes:{ fontSize: 11, color: Colors.warning, fontStyle: 'italic', marginBottom: 4 },
  cardFooter:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  cardPrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:    {
    width: 28, height: 28, borderRadius: Radius.sm,
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText:   { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, minWidth: 22, textAlign: 'center' },
  addBtn:    {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText:{ color: '#000', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  addedBanner:{
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: Colors.success, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  addedText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
