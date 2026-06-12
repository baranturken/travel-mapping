import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  followUser,
  getUserProfile,
  getUserTrips,
  unfollowUser,
} from '@/features/social/social-repository';
import { UserAvatar } from '@/features/social/components/user-avatar';
import { FeedTripCard } from '@/features/social/components/feed-trip-card';
import type { FeedTrip, UserProfile } from '@/features/social/types';

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<FeedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !user) return;
      setLoading(true);
      void Promise.all([
        getUserProfile(userId, user.id),
        getUserTrips(userId, user.id),
      ])
        .then(([p, t]) => {
          setProfile(p);
          setTrips(t);
        })
        .finally(() => setLoading(false));
    }, [userId, user]),
  );

  const handleToggleFollow = async () => {
    if (!user || !profile || followLoading) return;
    const wasFollowing = profile.isFollowedByMe;
    setFollowLoading(true);
    setProfile((p) =>
      p
        ? {
            ...p,
            isFollowedByMe: !wasFollowing,
            followersCount: p.followersCount + (wasFollowing ? -1 : 1),
          }
        : null,
    );
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, profile.id);
      } else {
        await followUser(user.id, profile.id);
      }
    } catch (err) {
      setProfile((p) =>
        p
          ? {
              ...p,
              isFollowedByMe: wasFollowing,
              followersCount: p.followersCount + (wasFollowing ? 1 : -1),
            }
          : null,
      );
      Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={TravelColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <Text style={styles.emptyTitle}>User not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <UserAvatar profile={profile} size={64} />
            <View style={styles.headerCopy}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
            </View>
            {user?.id !== profile.id ? (
              <Pressable
                style={[styles.followButton, profile.isFollowedByMe && styles.followingButton]}
                onPress={() => void handleToggleFollow()}
                disabled={followLoading}>
                <Text
                  style={[
                    styles.followButtonText,
                    profile.isFollowedByMe && styles.followingButtonText,
                  ]}>
                  {profile.isFollowedByMe ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.tripsCount}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {trips.length === 0 ? (
          <View style={styles.emptyTrips}>
            <Ionicons name="map-outline" size={28} color={TravelColors.mutedText} />
            <Text style={styles.emptyTripsText}>No public trips yet.</Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {trips.map((trip) => (
              <FeedTripCard
                key={trip.id}
                trip={trip}
                onPress={() =>
                  router.push({
                    pathname: '/trips/shared/[publishedId]',
                    params: { publishedId: trip.id },
                  } as any)
                }
                hideAuthor
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  content: { padding: 16, gap: 16 },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: TravelColors.text, fontSize: 18, fontWeight: '700' },
  backLink: { color: TravelColors.primary, fontSize: 15, fontWeight: '700' },
  headerCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerCopy: { flex: 1, gap: 2 },
  displayName: { color: TravelColors.text, fontSize: 20, fontWeight: '800' },
  username: { color: TravelColors.mutedText, fontSize: 14 },
  followButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: TravelColors.primary,
  },
  followingButton: {
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  followButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  followingButtonText: { color: TravelColors.text },
  bio: { color: TravelColors.secondaryText, fontSize: 14, lineHeight: 20 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { color: TravelColors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: TravelColors.mutedText, fontSize: 12, fontWeight: '600' },
  statDivider: { width: 1, height: 28, backgroundColor: TravelColors.border },
  emptyTrips: {
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  emptyTripsText: { color: TravelColors.secondaryText, fontSize: 15 },
  tripList: { gap: 14 },
});
