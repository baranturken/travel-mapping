import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { uploadAvatar, uploadBanner } from '@/features/social/trip-photo-upload';
import { UserAvatar } from '@/features/social/components/user-avatar';
import { BannerCropModal } from '@/features/social/components/banner-crop-modal';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, saveProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl ?? null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(profile?.bannerUrl ?? null);
  const [localBannerUri, setLocalBannerUri] = useState<string | null>(null);
  const [bannerCropUri, setBannerCropUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  if (!profile || !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={TravelColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const previewProfile = {
    displayName: displayName.trim() || profile.displayName,
    avatarUrl: localAvatarUri ?? avatarUrl,
  };

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      setLocalAvatarUri(uri);
      setUploadingAvatar(true);
      const url = await uploadAvatar(user.id, uri);
      setAvatarUrl(url);
    } catch (err) {
      setLocalAvatarUri(null);
      Alert.alert('Could not update photo', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickBanner = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to choose a banner.');
        return;
      }
      // No allowsEditing here: iOS forces a square crop that doesn't match the
      // wide banner. Instead the user picks the full photo and frames it in our
      // own 3:1 crop sheet (BannerCropModal) below.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;

      setBannerCropUri(result.assets[0].uri);
    } catch (err) {
      Alert.alert('Could not choose banner', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleBannerCropConfirm = async (croppedUri: string) => {
    setBannerCropUri(null);
    try {
      setLocalBannerUri(croppedUri);
      setUploadingBanner(true);
      const url = await uploadBanner(user.id, croppedUri);
      setBannerUrl(url);
    } catch (err) {
      setLocalBannerUri(null);
      Alert.alert('Could not update banner', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      Alert.alert('Invalid username', 'Use 3–20 characters: lowercase letters, numbers, or underscores.');
      return;
    }
    if (!trimmedName) {
      Alert.alert('Display name required', 'Add a display name.');
      return;
    }
    if (uploadingAvatar || uploadingBanner) {
      Alert.alert('Hold on', 'An image is still uploading. Try again in a moment.');
      return;
    }

    try {
      setSaving(true);
      await saveProfile({
        username: trimmedUsername,
        displayName: trimmedName,
        bio: bio.trim(),
        avatarUrl,
        bannerUrl,
      });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      if (msg.toLowerCase().includes('username') || msg.toLowerCase().includes('unique')) {
        Alert.alert('Username taken', 'That username is already in use. Try another.');
      } else {
        Alert.alert('Could not save profile', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.bannerSection} onPress={handlePickBanner} disabled={uploadingBanner}>
            {localBannerUri ?? bannerUrl ? (
              <Image
                source={{ uri: localBannerUri ?? bannerUrl ?? '' }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}
            <View style={styles.bannerOverlay}>
              {uploadingBanner ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="image" size={18} color="#ffffff" />
              )}
              <Text style={styles.bannerOverlayText}>
                {uploadingBanner ? 'Uploading…' : 'Change banner'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarPressable} onPress={handlePickAvatar} disabled={uploadingAvatar}>
              <UserAvatar profile={previewProfile} size={104} />
              <View style={styles.avatarBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>
            <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar}>
              <Text style={styles.changePhotoText}>
                {uploadingAvatar ? 'Uploading…' : 'Change profile photo'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
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
                editable={!saving}
              />
              <Text style={styles.hint}>3–20 characters. Letters, numbers, and underscores only.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Baran"
                placeholderTextColor={TravelColors.mutedText}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell travelers a bit about yourself…"
                placeholderTextColor={TravelColors.mutedText}
                multiline
                numberOfLines={3}
                editable={!saving}
              />
            </View>
          </View>

          <Pressable
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Save changes</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {bannerCropUri ? (
        <BannerCropModal
          uri={bannerCropUri}
          onCancel={() => setBannerCropUri(null)}
          onConfirm={handleBannerCropConfirm}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 20 },
  bannerSection: {
    aspectRatio: 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.border,
    justifyContent: 'flex-end',
  },
  bannerImage: StyleSheet.absoluteFillObject,
  bannerPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: TravelColors.primary, opacity: 0.18 },
  bannerOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    margin: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bannerOverlayText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  avatarSection: { alignItems: 'center', gap: 10, paddingTop: 8 },
  avatarPressable: { position: 'relative' },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: TravelColors.background,
  },
  changePhotoText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 16,
  },
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
    minHeight: 50,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: 8 },
  cancelButtonText: { color: TravelColors.mutedText, fontSize: 14, fontWeight: '600' },
});
