import { useState } from 'react';
import { useRouter } from 'expo-router';
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
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Missing email', 'Enter the email you signed up with.');
      return;
    }
    try {
      setLoading(true);
      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      // Supabase rate-limits reset emails server-side. Surface rate-limit
      // errors, but otherwise always show the same success state so the form
      // can't be used to probe which emails have accounts.
      if (error && error.status === 429) throw error;
      setSent(true);
    } catch (err) {
      Alert.alert(
        'Could not send email',
        err instanceof Error ? err.message : 'Please try again in a minute.',
      );
    } finally {
      setLoading(false);
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
            {sent ? (
              <>
                <View style={styles.sentIconWrap}>
                  <Ionicons name="mail-unread-outline" size={30} color={TravelColors.primary} />
                </View>
                <Text style={styles.heading}>Check your email</Text>
                <Text style={styles.subheading}>
                  If an account exists for {email.trim()}, we sent a link to reset your password.
                  Open it on this device to continue.
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => router.back()}>
                  <Text style={styles.primaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Reset password</Text>
                <Text style={styles.subheading}>
                  Enter your email and we&apos;ll send you a link to choose a new password.
                </Text>

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
                    onSubmitEditing={handleSendReset}
                    returnKeyType="go"
                  />
                </View>

                <Pressable
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSendReset}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send reset link</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>

          {!sent && (
            <View style={styles.footer}>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.footerLink}>Back to sign in</Text>
              </Pressable>
            </View>
          )}
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
  sentIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 8 },
  footerLink: { color: TravelColors.primary, fontSize: 15, fontWeight: '700' },
});
