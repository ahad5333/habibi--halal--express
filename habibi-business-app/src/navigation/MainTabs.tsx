import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { RootStackParams } from './RootNavigator';
import { useCart } from '../context/CartContext';
import CatalogScreen  from '../screens/catalog/CatalogScreen';
import OrdersScreen   from '../screens/orders/OrdersScreen';
import AccountScreen  from '../screens/account/AccountScreen';

const Tab = createBottomTabNavigator();

function CartBadge() {
  const { totalItems } = useCart();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Cart')}
      style={styles.cartBtn}
      activeOpacity={0.7}
    >
      <Feather name="shopping-cart" size={22} color={Colors.text} />
      {totalItems > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          borderTopWidth:  1,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle:           { backgroundColor: Colors.surface },
        headerTintColor:       Colors.text,
        headerTitleStyle:      { fontWeight: '700', color: Colors.text },
        headerShadowVisible:   false,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Catalog: 'grid',
            Orders:  'package',
            Account: 'user',
          };
          return <Feather name={icons[route.name] as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{
          title: 'Catalog',
          headerTitle: 'Wholesale Catalog',
          headerRight: () => <CartBadge />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: 'My Orders', headerTitle: 'Order History' }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'Account', headerTitle: 'Business Account' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  cartBtn: {
    marginRight: 16,
    position: 'relative',
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2, right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
