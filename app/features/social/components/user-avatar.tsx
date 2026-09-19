import { Image, StyleSheet, Text, View } from 'react-native';
import { TravelColors } from '@/constants/theme';
import type { Profile } from '@/features/social/types';

type Props = {
  profile: Pick<Profile, 'displayName' | 'avatarUrl'>;
  size?: number;
};

export function UserAvatar({ profile, size = 40 }: Props) {
  const initials = profile.displayName
    .trim()
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const radius = size / 2;
  const fontSize = size * 0.38;

  if (profile.avatarUrl) {
    return (
      <Image
        source={{ uri: profile.avatarUrl }}
        style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
      ]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: TravelColors.tintSurface,
  },
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
});
