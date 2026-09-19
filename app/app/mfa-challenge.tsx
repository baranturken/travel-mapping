import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { getMfaStatus, verifyTotp } from '@/features/auth/mfa';

// Second factor gate after password sign-in. Lives outside the (auth) group
// because the AAL1 session already exists and would trigger its redirect.
export default function MfaChallengeScreen() {
  const router = useRouter();
  const { refreshMfaPending, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setVerifying(true);
      const status = await getMfaStatus();
      if (!status.factorId) {
        // No verified factor — nothing to challenge; let the gates re-route.
        await refreshMfaPending();
        router.replace('/' as Href);
        return;
      }
      await verifyTotp(status.factorId, code);
      await refreshMfaPending();
      router.replace('/(tabs)/feed' as Href);
    } catch (err) {
      Alert.alert(
        'Verification failed',
        err instanceof Error ? err.message : 'Check the code and try again.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = async () => {
    await signOut();
    router.replace('/(auth)/sign-in' as Href);
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
            <Text style={styles.brand}>Sharevel</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={30} color={TravelColors.primary} />
            </View>
            <Text style={styles.heading}>Two-factor check</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit code from your authenticator app to finish signing in.
            </Text>

            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={TravelColors.mutedText}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={!verifying}
              onSubmitEditing={handleVerify}
            />

            <Pressable
              style={[styles.primaryButton, verifying && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={verifying}>
              {verifying ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => void handleCancel()}>
              <Text style={styles.footerLink}>Cancel and sign out</Text>
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
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { color: TravelColors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subheading: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: -4 },
  codeInput: {
    borderWidth: 1,
    borderColor: TravelColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: TravelColors.text,
    backgroundColor: TravelColors.background,
    fontVariant: ['tabular-nums'],
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
  footerLink: { color: TravelColors.mutedText, fontSize: 14, fontWeight: '600' },
});
