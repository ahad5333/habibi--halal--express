import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { Platform, UIManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:    Colors.gold,
    background: Colors.bg,
    card:       Colors.surface,
    text:       Colors.text,
    border:     Colors.border,
    notification: Colors.gold,
  },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={NAV_THEME}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
