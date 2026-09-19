import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TravelColors } from '@/constants/theme';
import type { Profile } from '@/features/social/types';

type Props = {
  profile: Pick<Profile, 'displayName' | 'avatarUrl'>;
  size?: number;
  /**
   * Tapping opens the picture full-size. Opt-in, because in a dense list an
   * avatar is usually a shortcut to the profile rather than to the image, and
   * two competing tap targets in one row is worse than none.
   *
   * Has no effect when there is no picture — there is nothing to enlarge, and a
   * tappable placeholder that does nothing reads as broken.
   */
  expandable?: boolean;
};

export function UserAvatar({ profile, size = 40, expandable = false }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initials = profile.displayName
    .trim()
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const radius = size / 2;
  const fontSize = size * 0.38;

  if (!profile.avatarUrl) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      </View>
    );
  }

  const image = (
    <Image
      source={{ uri: profile.avatarUrl }}
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
    />
  );

  if (!expandable) return image;

  // Square, capped so it never runs under the close button or off a short screen.
  const zoomSize = Math.min(width - 48, height - insets.top - insets.bottom - 160);

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${profile.displayName}'s profile picture, tap to enlarge`}
        onPress={() => setZoomed(true)}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        {image}
      </Pressable>

      <Modal
        visible={zoomed}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setZoomed(false)}>
        {/* The backdrop itself dismisses — tapping away is what people try first. */}
        <Pressable style={styles.backdrop} onPress={() => setZoomed(false)}>
          <Image
            source={{ uri: profile.avatarUrl }}
            style={[styles.zoomedImage, { width: zoomSize, height: zoomSize }]}
            resizeMode="cover"
          />
          <Text style={styles.zoomedName} numberOfLines={1}>
            {profile.displayName}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close picture"
          hitSlop={10}
          onPress={() => setZoomed(false)}
          style={[styles.closeButton, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={22} color="#ffffff" />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: TravelColors.tintSurface,
  },
  pressed: { opacity: 0.75 },
  placeholder: {
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: TravelColors.primary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,20,34,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
  },
  zoomedImage: {
    borderRadius: 24,
    backgroundColor: TravelColors.tintSurface,
  },
  zoomedName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
