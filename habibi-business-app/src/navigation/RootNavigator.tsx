import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import MainTabs from './MainTabs';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import CartScreen from '../screens/cart/CartScreen';

export type RootStackParams = {
  MainTabs:    undefined;
  Login:       undefined;
  Cart:        undefined;
  Checkout:    undefined;
  OrderDetail: { orderId: number };
};

const Stack = createNativeStackNavigator<RootStackParams>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:      Colors.gold,
    background:   Colors.bg,
    card:         Colors.surface,
    text:         Colors.text,
    border:       Colors.border,
    notification: Colors.gold,
  },
};

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs"    component={MainTabs} />
            <Stack.Screen name="Cart"        component={CartScreen}     options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Checkout"    component={CheckoutScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
