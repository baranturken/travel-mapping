import { useState } from 'react';
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

export default function ProfileSetupScreen() {
  const { saveProfile, user } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedUsername) {
      Alert.alert('Username required', 'Pick a username for your profile.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      Alert.alert(
        'Invalid username',
        'Use 3–20 characters: lowercase letters, numbers, or underscores.',
      );
      return;
    }
    if (!trimmedName) {
      Alert.alert('Display name required', 'Add a display name.');
      return;
    }

    try {
      setLoading(true);
      await saveProfile({ username: trimmedUsername, displayName: trimmedName, bio: bio.trim() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      if (msg.toLowerCase().includes('username') || msg.toLowerCase().includes('unique')) {
        Alert.alert('Username taken', 'That username is already in use. Try another.');
      } else {
        Alert.alert('Could not save profile', msg);
      }
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
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={32} color={TravelColors.primary} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Set up your profile</Text>
            <Text style={styles.subheading}>
              Choose a username so other travelers can find and follow you.
            </Text>
            {user?.email ? (
              <Text style={styles.emailNote}>Signed in as {user.email}</Text>
            ) : null}

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. baran_travels"
                  placeholderTextColor={TravelColors.mutedText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <Text style={styles.hint}>
                  3–20 characters. Letters, numbers, and underscores only.
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="e.g. Baran"
                  placeholderTextColor={TravelColors.mutedText}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Bio (optional)</Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell travelers a bit about yourself…"
                  placeholderTextColor={TravelColors.mutedText}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>
            </View>

            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save profile</Text>
              )}
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
  iconRow: { alignItems: 'center', paddingTop: 16 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: TravelColors.border,
  },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 16,
  },
  heading: { color: TravelColors.text, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  subheading: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: -4 },
  emailNote: { color: TravelColors.mutedText, fontSize: 13 },
  fields: { gap: 14 },
  field: { gap: 6 },
  label: { color: TravelColors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: TravelColors.mutedText, fontSize: 12, lineHeight: 16 },
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
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
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
