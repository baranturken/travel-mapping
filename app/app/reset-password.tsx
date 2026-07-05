import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { PasswordRequirements } from '@/features/auth/components/password-requirements';
import { evaluatePassword } from '@/features/auth/password-policy';
import { supabase } from '@/lib/supabase';

// Pull key=value pairs out of a URL hash fragment
// (travelmapping://reset-password#access_token=...&refresh_token=...).
function parseFragment(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(hashIndex + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return params;
}

type LinkState = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const passwordResult = evaluatePassword(password);

  // The recovery link either carries session tokens in the hash fragment
  // (implicit flow) or a one-time ?code= (PKCE). Exchange whichever we got for
  // a session, then let the user set a new password via updateUser.
  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      // Already signed in (e.g. the auth listener processed the link first)?
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) setLinkState('ready');
        return;
      }
      if (!url) return; // wait for the URL to arrive

      const fragment = parseFragment(url);
      const { queryParams } = Linking.parse(url);
      const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
      const errorDescription =
        fragment.error_description ??
        (typeof queryParams?.error_description === 'string' ? queryParams.error_description : null);

      try {
        if (fragment.access_token && fragment.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: fragment.access_token,
            refresh_token: fragment.refresh_token,
          });
          if (error) throw error;
          if (!cancelled) setLinkState('ready');
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) setLinkState('ready');
        } else {
          if (!cancelled) {
            setLinkError(errorDescription ?? 'This reset link is missing its security token.');
            setLinkState('invalid');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLinkError(err instanceof Error ? err.message : 'This reset link is invalid or expired.');
          setLinkState('invalid');
        }
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleSave = async () => {
    if (!passwordResult.ok) {
      Alert.alert('Weak password', passwordResult.error ?? 'Choose a stronger password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Password updated', 'You are signed in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed' as Href) },
      ]);
    } catch (err) {
      Alert.alert('Could not update password', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Ionicons name="map" size={28} color={TravelColors.primary} />
            <Text style={styles.brand}>Travel Mapping</Text>
          </View>

          <View style={styles.card}>
            {linkState === 'checking' ? (
              <View style={styles.checkingState}>
                <ActivityIndicator color={TravelColors.primary} />
                <Text style={styles.subheading}>Verifying your reset link…</Text>
              </View>
            ) : linkState === 'invalid' ? (
              <>
                <Text style={styles.heading}>Link expired</Text>
                <Text style={styles.subheading}>
                  {linkError ?? 'This reset link is invalid or has expired.'} Request a new one from
                  the sign-in screen.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.replace('/(auth)/sign-in' as Href)}>
                  <Text style={styles.primaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Choose a new password</Text>
                <Text style={styles.subheading}>
                  Your identity is verified. Set a new password for your account.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>New password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    placeholderTextColor={TravelColors.mutedText}
                    secureTextEntry
                    editable={!saving}
                  />
                  {password.length > 0 && <PasswordRequirements result={passwordResult} />}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repeat your new password"
                    placeholderTextColor={TravelColors.mutedText}
                    secureTextEntry
                    editable={!saving}
                    onSubmitEditing={handleSave}
                    returnKeyType="go"
                  />
                </View>

                <Pressable
                  style={[styles.primaryButton, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Update password</Text>
                  )}
                </Pressable>
              </>
            )}
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
  checkingState: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  heading: { color: TravelColors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subheading: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: -4 },
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
});
