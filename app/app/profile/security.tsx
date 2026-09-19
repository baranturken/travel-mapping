import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
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
import {
  enrollTotp,
  getMfaStatus,
  unenrollTotp,
  verifyTotp,
  type TotpEnrollment,
} from '@/features/auth/mfa';

// Security settings: enable/disable TOTP two-factor authentication.
export default function SecurityScreen() {
  const { refreshMfaPending } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getMfaStatus();
      setEnabled(status.enabled);
      setFactorId(status.factorId);
    } catch {
      // Leave defaults; the user can retry by reopening the screen.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleStartEnroll = async () => {
    try {
      setBusy(true);
      const data = await enrollTotp();
      setEnrollment(data);
      setCode('');
    } catch (err) {
      Alert.alert('Could not start setup', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollment) return;
    if (code.trim().length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setBusy(true);
      await verifyTotp(enrollment.factorId, code);
      await refreshMfaPending();
      setEnrollment(null);
      setCode('');
      await loadStatus();
      Alert.alert('Two-factor enabled', 'You will be asked for a code at each sign-in.');
    } catch (err) {
      Alert.alert('Verification failed', err instanceof Error ? err.message : 'Check the code.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = () => {
    if (!factorId) return;
    Alert.alert('Disable two-factor?', 'Your account will rely on your password alone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              setBusy(true);
              await unenrollTotp(factorId);
              await refreshMfaPending();
              await loadStatus();
            } catch (err) {
              Alert.alert('Could not disable', err instanceof Error ? err.message : 'Try again.');
            } finally {
              setBusy(false);
            }
          })(),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={TravelColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={TravelColors.primary} />
            <Text style={styles.title}>Two-factor authentication</Text>
          </View>

          {enabled ? (
            <>
              <View style={styles.statusRow}>
                <View style={styles.statusDotOn} />
                <Text style={styles.statusOn}>Enabled</Text>
              </View>
              <Text style={styles.body}>
                Signing in requires your password and a 6-digit code from your authenticator app.
              </Text>
              <Pressable
                style={[styles.dangerButton, busy && styles.buttonDisabled]}
                onPress={handleDisable}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={TravelColors.danger} size="small" />
                ) : (
                  <Text style={styles.dangerButtonText}>Disable two-factor</Text>
                )}
              </Pressable>
            </>
          ) : enrollment ? (
            <>
              <Text style={styles.body}>
                1. Add this secret to an authenticator app (Google Authenticator, 1Password,
                Authy…):
              </Text>
              <Pressable
                onPress={() => void Linking.openURL(enrollment.uri).catch(() => undefined)}
                style={styles.secretBox}>
                <Text style={styles.secret} selectable>
                  {enrollment.secret}
                </Text>
                <Text style={styles.secretHint}>Tap to open in your authenticator app</Text>
              </Pressable>
              <Text style={styles.body}>2. Enter the 6-digit code it shows:</Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={TravelColors.mutedText}
                keyboardType="number-pad"
                maxLength={6}
                editable={!busy}
                onSubmitEditing={handleVerifyEnrollment}
              />
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={handleVerifyEnrollment}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify and enable</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setEnrollment(null)} disabled={busy}>
                <Text style={styles.cancelText}>Cancel setup</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Add a second step to sign-in: your password plus a rotating 6-digit code from an
                authenticator app. Protects your account even if your password leaks.
              </Text>
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={() => void handleStartEnroll()}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Set up two-factor</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16 },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: TravelColors.text, fontSize: 18, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDotOn: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2d7a47' },
  statusOn: { color: '#2d7a47', fontSize: 14, fontWeight: '700' },
  body: { color: TravelColors.secondaryText, fontSize: 14, lineHeight: 21 },
  secretBox: {
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  secret: {
    color: TravelColors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  secretHint: { color: TravelColors.primary, fontSize: 12, fontWeight: '600' },
  codeInput: {
    borderWidth: 1,
    borderColor: TravelColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: TravelColors.text,
    backgroundColor: TravelColors.background,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  cancelText: {
    color: TravelColors.mutedText,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  dangerButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.danger,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  dangerButtonText: { color: TravelColors.danger, fontSize: 15, fontWeight: '700' },
});
