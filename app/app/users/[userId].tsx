import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { ProfileSkeleton } from '@/components/skeleton';
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
import { cacheKey, invalidateCache, readCache, writeCache } from '@/features/social/social-cache';
import { ReportSheet } from '@/features/social/components/report-sheet';
import { blockUser, isBlockedByMe, unblockUser } from '@/features/social/moderation';

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  // Seed from cache so a revisit paints immediately. The focus effect still
  // refetches underneath; this only removes the blank skeleton in between.
  const profileKey = cacheKey('profile', userId ?? '');
  const tripsKey = cacheKey('userTrips', userId ?? '');
  const [profile, setProfile] = useState<UserProfile | null>(
    () => readCache<UserProfile>(profileKey),
  );
  const [trips, setTrips] = useState<FeedTrip[]>(() => readCache<FeedTrip[]>(tripsKey) ?? []);
  const [loading, setLoading] = useState(() => readCache<UserProfile>(profileKey) === null);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Tapping the Trips stat should park the header off-screen and start the
  // list at the top, rather than jumping to an arbitrary offset. Declared here,
  // above the early returns, so hook order stays stable across renders.
  const hasLoadedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const tripsOffsetRef = useRef(0);
  const scrollToTrips = () => {
    scrollRef.current?.scrollTo({ y: Math.max(tripsOffsetRef.current - 8, 0), animated: true });
  };

  const openFollows = (tab: 'followers' | 'following') =>
    router.push({
      pathname: '/users/[userId]/follows',
      params: { userId: userId as string, tab },
    } as unknown as Href);


  useFocusEffect(
    useCallback(() => {
      if (!userId || !user) return;
      // Skeletons only when there is genuinely nothing to show — no cache and
      // no previous load. Otherwise the content stays put and is replaced once
      // the fresh copy lands.
      if (!hasLoadedRef.current && readCache<UserProfile>(profileKey) === null) setLoading(true);
      void Promise.all([
        getUserProfile(userId, user.id),
        getUserTrips(userId, user.id),
        isBlockedByMe(user.id, userId),
      ])
        .then(([p, t, isBlocked]) => {
          setProfile(p);
          setTrips(t);
          setBlocked(isBlocked);
          if (p) writeCache(profileKey, p);
          writeCache(tripsKey, t);
        })
        .finally(() => {
          hasLoadedRef.current = true;
          setLoading(false);
        });
    }, [userId, user, profileKey, tripsKey]),
  );

  const handleToggleBlock = () => {
    if (!user || !profile) return;

    if (blocked) {
      void (async () => {
        try {
          await unblockUser(user.id, profile.id);
          setBlocked(false);
          invalidateCache('');
        } catch (err) {
          Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
        }
      })();
      return;
    }

    Alert.alert(
      `Block @${profile.username}?`,
      'You will not see their trips or comments, and they will not see yours. They are not told. You can undo this any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await blockUser(user.id, profile.id);
                setBlocked(true);
                // Their content is now hidden everywhere, so every cached feed
                // and profile is out of date.
                invalidateCache('');
                router.back();
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
              }
            })();
          },
        },
      ],
    );
  };

  const openModerationMenu = () => {
    if (!profile) return;
    Alert.alert(`@${profile.username}`, undefined, [
      { text: 'Report account', onPress: () => setReportOpen(true) },
      {
        text: blocked ? 'Unblock account' : 'Block account',
        style: blocked ? 'default' : 'destructive',
        onPress: handleToggleBlock,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleFollow = async () => {
    if (!user || !profile || followLoading) return;
    const wasFollowing = profile.isFollowedByMe;
    setFollowLoading(true);
    setProfile((p) => {
      if (!p) return null;
      const next = {
        ...p,
        isFollowedByMe: !wasFollowing,
        followersCount: p.followersCount + (wasFollowing ? -1 : 1),
      };
      // Otherwise leaving and returning would show the pre-toggle state from
      // cache until the refetch lands.
      writeCache(profileKey, next);
      return next;
    });
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, profile.id);
      } else {
        await followUser(user.id, profile.id);
      }
    } catch (err) {
      setProfile((p) => {
        if (!p) return null;
        const reverted = {
          ...p,
          isFollowedByMe: wasFollowing,
          followersCount: p.followersCount + (wasFollowing ? 1 : -1),
        };
        writeCache(profileKey, reverted);
        return reverted;
      });
      Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ProfileSkeleton />
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
      <Stack.Screen
        options={{
          title: `@${profile.username}`,
          headerRight: () =>
            user?.id !== profile.id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report or block this account"
                hitSlop={10}
                onPress={openModerationMenu}>
                <Ionicons name="ellipsis-horizontal" size={22} color={TravelColors.text} />
              </Pressable>
            ) : null,
        }}
      />

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="profile"
        targetId={profile.id}
        targetOwnerId={profile.id}
        targetLabel={`@${profile.username}`}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          {profile.bannerUrl ? (
            <Image source={{ uri: profile.bannerUrl }} style={styles.banner} resizeMode="cover" />
          ) : null}
          <View style={styles.headerRow}>
            <UserAvatar profile={profile} size={64} expandable />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.tripsCount} trips, jump to trips`}
              onPress={scrollToTrips}
              style={({ pressed }) => [styles.statItem, pressed && styles.statPressed]}>
              <Text style={styles.statValue}>{profile.tripsCount}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.followersCount} followers, view list`}
              onPress={() => openFollows('followers')}
              style={({ pressed }) => [styles.statItem, pressed && styles.statPressed]}>
              <Text style={styles.statValue}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.followingCount} following, view list`}
              onPress={() => openFollows('following')}
              style={({ pressed }) => [styles.statItem, pressed && styles.statPressed]}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>
        </View>

        <View
          onLayout={(e) => {
            tripsOffsetRef.current = e.nativeEvent.layout.y;
          }}>
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
        </View>
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
    overflow: 'hidden',
  },
  banner: {
    aspectRatio: 3,
    marginTop: -20,
    marginHorizontal: -20,
    marginBottom: 2,
    backgroundColor: TravelColors.tintSurface,
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
  statPressed: { opacity: 0.55 },
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
