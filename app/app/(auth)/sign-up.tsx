import { useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim(), password);
    } catch (err) {
      Alert.alert('Sign-up failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const redirectUrl = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success') {
          const parsed = Linking.parse(result.url);
          const code = parsed.queryParams?.code;
          if (code) await supabase.auth.exchangeCodeForSession(String(code));
        }
      }
    } catch (err) {
      Alert.alert('Google sign-in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') return;
    try {
      setAppleLoading(true);
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Ionicons name="map" size={28} color={TravelColors.primary} />
            <Text style={styles.brand}>Travel Mapping</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subheading}>Share your trips with fellow travelers.</Text>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={TravelColors.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={TravelColors.mutedText}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat your password"
                  placeholderTextColor={TravelColors.mutedText}
                  secureTextEntry
                  editable={!loading}
                  onSubmitEditing={handleSignUp}
                  returnKeyType="go"
                />
              </View>
            </View>

            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.oauthButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}>
              {googleLoading ? (
                <ActivityIndicator color={TravelColors.text} size="small" />
              ) : (
                <>
                  <Text style={styles.oauthIcon}>G</Text>
                  <Text style={styles.oauthButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable
                style={[styles.oauthButton, styles.appleButton, appleLoading && styles.buttonDisabled]}
                onPress={handleAppleSignIn}
                disabled={appleLoading}>
                {appleLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={18} color="#ffffff" />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/sign-in' as Href)}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  flex: { flex: 1 },
  content: { padding: 24, gap: 24, flexGrow: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  brand: { color: TravelColors.primary, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 16,
  },
  heading: { color: TravelColors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subheading: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: -4 },
  fields: { gap: 12 },
  field: { gap: 6 },
  label: { color: TravelColors.text, fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: TravelColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: TravelColors.text,
    backgroundColor: TravelColors.background,
  },
  primaryButton: {
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 50,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: TravelColors.border },
  dividerText: { color: TravelColors.mutedText, fontSize: 13, fontWeight: '600' },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    borderRadius: 999,
    paddingVertical: 13,
    backgroundColor: TravelColors.surface,
    minHeight: 50,
  },
  oauthIcon: { fontSize: 16, fontWeight: '800', color: TravelColors.text },
  oauthButtonText: { color: TravelColors.text, fontSize: 15, fontWeight: '600' },
  appleButton: { backgroundColor: '#000000', borderColor: '#000000' },
  appleButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  footerText: { color: TravelColors.secondaryText, fontSize: 15 },
  footerLink: { color: TravelColors.primary, fontSize: 15, fontWeight: '700' },
});
