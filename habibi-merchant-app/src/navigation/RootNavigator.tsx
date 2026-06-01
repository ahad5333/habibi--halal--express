import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../utils/useLayout';
import { Colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import MainLayout  from './MainLayout';
import MainTabs    from './MainTabs';

export type RootStackParams = {
  Login: undefined;
  Main:  undefined;
};

const Stack = createNativeStackNavigator<RootStackParams>();

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { isPhone }       = useLayout();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Tablet gets the full sidebar layout; phone gets bottom tabs
  const MainScreen = isPhone ? MainTabs : MainLayout;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main"  component={MainScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
