import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { TravelColors } from '@/constants/theme';

// A single shimmering placeholder block. Everything else in this file composes
// these into screen-shaped skeletons so a loading screen mirrors its real
// layout instead of showing a bare spinner.
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width ?? '100%', height: height ?? 16, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Mirrors a FeedTripCard: cover image, author row, title, meta line.
function FeedCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={170} radius={16} />
      <View style={styles.authorRow}>
        <Skeleton width={38} height={38} radius={19} />
        <View style={styles.authorText}>
          <Skeleton width="45%" height={13} />
          <Skeleton width="30%" height={11} />
        </View>
      </View>
      <Skeleton width="75%" height={18} />
      <View style={styles.metaRow}>
        <Skeleton width={64} height={12} />
        <Skeleton width={48} height={12} />
      </View>
    </View>
  );
}

export function FeedListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </View>
  );
}

// Mirrors a saved-trip row: title, route line, meta row.
function TripCardSkeleton() {
  return (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Skeleton width="55%" height={18} />
        <Skeleton width={20} height={20} radius={10} />
      </View>
      <Skeleton width="70%" height={14} />
      <View style={styles.metaRow}>
        <Skeleton width={50} height={12} />
        <Skeleton width={70} height={12} />
      </View>
    </View>
  );
}

export function TripListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.tripList}>
      {Array.from({ length: count }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: TravelColors.border },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 14,
    gap: 12,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorText: { flex: 1, gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripList: { gap: 12 },
  tripCard: {
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
