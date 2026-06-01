import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontSize } from '../theme/typography';
import OrderBoardScreen       from '../screens/orders/OrderBoardScreen';
import ItemAvailabilityScreen from '../screens/menu/ItemAvailabilityScreen';
import StoreStatusScreen      from '../screens/locations/StoreStatusScreen';
import SalesReportScreen      from '../screens/reports/SalesReportScreen';
import ReceiptsScreen         from '../screens/receipts/ReceiptsScreen';
import TakeOrderScreen        from '../screens/pos/TakeOrderScreen';

export type MainTabParams = {
  Orders:      undefined;
  TakeOrder:   undefined;
  Menu:        undefined;
  StoreStatus: undefined;
  Reports:     undefined;
  Receipts:    undefined;
};

const Tab = createBottomTabNavigator<MainTabParams>();

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Orders:      'grid',
  TakeOrder:   'clipboard',
  Menu:        'toggle-right',
  StoreStatus: 'map-pin',
  Reports:     'bar-chart-2',
  Receipts:    'printer',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          borderTopWidth:  1,
          height:          58,
          paddingBottom:   8,
          paddingTop:      4,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Feather name={TAB_ICONS[route.name] ?? 'circle'} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Orders"      component={OrderBoardScreen}       options={{ title: 'Orders' }} />
      <Tab.Screen name="TakeOrder"   component={TakeOrderScreen}        options={{ title: 'Take Order' }} />
      <Tab.Screen name="Menu"        component={ItemAvailabilityScreen} options={{ title: 'Menu' }} />
      <Tab.Screen name="StoreStatus" component={StoreStatusScreen}      options={{ title: 'Store' }} />
      <Tab.Screen name="Reports"     component={SalesReportScreen}      options={{ title: 'Reports' }} />
      <Tab.Screen name="Receipts"    component={ReceiptsScreen}         options={{ title: 'Receipts' }} />
    </Tab.Navigator>
  );
}
