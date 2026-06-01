import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { primeAudio } from '../../utils/sound';
import { Colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/typography';
import { useLayout } from '../../utils/useLayout';

const FEATURES = [
  { icon: 'grid',         label: 'Live Order Board — Kanban kitchen view' },
  { icon: 'toggle-right', label: 'Menu Availability — Mark sold-out items' },
  { icon: 'map-pin',      label: 'Store Status — Open / close locations' },
  { icon: 'bar-chart-2',  label: 'Sales Reports — Daily revenue & stats' },
  { icon: 'printer',      label: 'Receipt Printing — Thermal & PDF' },
];

export default function LoginScreen() {
  const { login }       = useAuth();
  const { isPhone }     = useLayout();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    primeAudio();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phone: single-column scrollable form ────────────────────
  if (isPhone) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.phoneScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.phoneLogo}>
              <View style={styles.logoMark}>
                <Feather name="zap" size={24} color={Colors.gold} />
              </View>
              <Text style={styles.phoneBrandName}>HABIBI HALAL EXPRESS</Text>
              <Text style={styles.phoneBrandSub}>Merchant Console</Text>
            </View>

            {/* Form card */}
            <View style={styles.phoneCard}>
              <Text style={styles.title}>Staff Sign In</Text>
              <Text style={styles.subtitle}>
                Use your admin or staff credentials to access the console.
              </Text>

              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                  <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color={Colors.error} style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.loginBtnText}>Sign In</Text>
                }
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              Access is restricted to admin and staff accounts.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Tablet: two-panel layout ─────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Left panel — branding ───────────────────────────── */}
        <View style={styles.left}>
          {/* Gold accent bar at the top */}
          <View style={styles.goldBar} />

          {/* Logo mark */}
          <View style={styles.logoMark}>
            <Feather name="zap" size={32} color={Colors.gold} />
          </View>

          {/* Brand text — matches website header style */}
          <Text style={styles.brandName}>HABIBI HALAL EXPRESS</Text>
          <Text style={styles.brandSub}>Authentic · Fresh · Halal</Text>
          <View style={styles.divider} />
          <Text style={styles.consoleLabel}>MERCHANT CONSOLE</Text>

          {/* Feature list */}
          <View style={styles.featureList}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.feature}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon as any} size={14} color={Colors.gold} />
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Bottom tagline */}
          <Text style={styles.bottomTagline}>
            Serving the Bronx, one order at a time.
          </Text>
        </View>

        {/* ── Right panel — form ──────────────────────────────── */}
        <View style={styles.right}>
          <Text style={styles.title}>Staff Sign In</Text>
          <Text style={styles.subtitle}>
            Use your admin or staff credentials to access the console.
          </Text>

          {/* Email */}
          <View style={styles.inputWrap}>
            <Feather name="mail" size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
              <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.loginBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>
            Access is restricted to admin and staff accounts.{'\n'}
            Contact your manager if you need credentials.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, flexDirection: 'row' },

  // ── Phone styles ─────────────────────────────────────────────
  phoneScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },
  phoneLogo: {
    alignItems: 'center',
    gap: 8,
  },
  phoneBrandName: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  phoneBrandSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1,
  },
  phoneCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    gap: 0,
  },

  // ── Left panel ───────────────────────────────────────────────
  left: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    borderRightWidth: 1,
    borderRightColor: Colors.border2,
    overflow: 'hidden',
  },

  goldBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.gold,
  },

  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  brandName: {
    color: Colors.gold,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  brandSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1,
    marginTop: 5,
    textAlign: 'center',
  },

  divider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border2,
    marginVertical: 16,
  },

  consoleLabel: {
    color: Colors.textSub,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 3,
    marginBottom: 28,
  },

  featureList: { gap: 12, width: '100%', maxWidth: 260 },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    color: Colors.textSub,
    fontSize: FontSize.xs,
    flex: 1,
  },

  bottomTagline: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 32,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ── Right panel ──────────────────────────────────────────────
  right: {
    flex: 1,
    justifyContent: 'center',
    padding: 48,
    maxWidth: 440,
  },

  title: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSub,
    fontSize: FontSize.sm,
    marginBottom: 32,
    lineHeight: 20,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  eyeBtn: { padding: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorDim,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    flex: 1,
  },

  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },

  hint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});
