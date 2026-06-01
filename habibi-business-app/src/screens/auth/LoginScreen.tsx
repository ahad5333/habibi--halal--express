import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/typography';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError('Please enter your email/phone and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🏢</Text>
            </View>
            <Text style={styles.appName}>Habibi Business</Text>
            <Text style={styles.appSub}>Wholesale Ordering Portal</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your business account credentials.
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email / Phone */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>EMAIL OR PHONE</Text>
              <View style={styles.inputRow}>
                <Feather name="user" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="business@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="username"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPw(p => !p)} style={styles.eyeBtn}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helpText}>
              Don't have a business account?{'\n'}
              Contact us at{' '}
              <Text style={{ color: Colors.gold }}>wholesale@habibihe.com</Text>
            </Text>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Habibi Halal Express, INC. · Business Portal v1.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  container:   { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  logoWrap:    { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle:  {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.goldDim,
    borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji:   { fontSize: 36 },
  appName:     { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.gold, letterSpacing: 1 },
  appSub:      { fontSize: FontSize.sm, color: Colors.textSub, marginTop: 4 },
  card:        {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  title:       { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 6 },
  subtitle:    { fontSize: FontSize.sm, color: Colors.textSub, marginBottom: Spacing.lg, lineHeight: 20 },
  errorBox:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(248,81,73,0.1)', borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(248,81,73,0.3)',
  },
  errorText:   { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  fieldWrap:   { marginBottom: Spacing.md },
  label:       { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  inputRow:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, color: Colors.text, fontSize: FontSize.base },
  eyeBtn:      { padding: 4 },
  loginBtn:    {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    height: 50,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText:     { color: '#000', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  helpText:    { textAlign: 'center', color: Colors.textSub, fontSize: FontSize.xs, marginTop: Spacing.lg, lineHeight: 18 },
  footer:      { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: Spacing.xl },
});
