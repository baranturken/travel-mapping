import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
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
import { ProfileSkeleton, TripListSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { getUserTrips, getFollowCounts } from '@/features/social/social-repository';
import { summarizeStops } from '@/features/social/trip-summary-stats';
import { UserAvatar } from '@/features/social/components/user-avatar';
import { FeedTripCard } from '@/features/social/components/feed-trip-card';
import type { FeedTrip } from '@/features/social/types';

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, needsProfileSetup } = useAuth();
  const [trips, setTrips] = useState<FeedTrip[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user || !profile) return;
      setLoading(true);
      void Promise.all([getUserTrips(user.id, user.id), getFollowCounts(user.id)])
        .then(([tripData, counts]) => {
          setTrips(tripData);
          setFollowCounts(counts);
        })
        .finally(() => setLoading(false));
    }, [user, profile]),
  );

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (needsProfileSetup) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <Text style={styles.emptyTitle}>Profile not set up</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/profile-setup' as Href)}>
            <Text style={styles.primaryButtonText}>Set up profile</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  const joined = formatJoinedDate(profile.createdAt);
  const visitedCities = new Set(
    trips.flatMap((t) =>
      summarizeStops(t.stopsJson).travelStops.map(
        (s) => `${s.cityName.trim().toLowerCase()}:${s.countryName.trim().toLowerCase()}`,
      ),
    ),
  );
  const visitedCountries = new Set(
    trips.flatMap((t) =>
      summarizeStops(t.stopsJson).travelStops.map((s) => s.countryName.trim().toLowerCase()),
    ),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.banner}>
            {profile.bannerUrl ? (
              <Image source={{ uri: profile.bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
            ) : null}
            <Pressable
              style={styles.bannerIconButton}
              onPress={() => router.push('/profile/edit' as Href)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit profile">
              <Ionicons name="create-outline" size={17} color="#ffffff" />
            </Pressable>
            <Pressable
              style={styles.bannerIconButton}
              onPress={handleSignOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={17} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <UserAvatar profile={profile} size={84} />
            </View>
          </View>

          <View style={styles.identity}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            {joined ? (
              <View style={styles.joinedRow}>
                <Ionicons name="calendar-outline" size={13} color={TravelColors.mutedText} />
                <Text style={styles.joinedText}>Joined {joined}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{trips.length}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {!loading && trips.length > 0 ? (
          <View style={styles.travelStatsCard}>
            <View style={styles.travelStatItem}>
              <Text style={styles.travelStatEmoji}>🌍</Text>
              <Text style={styles.travelStatValue}>{visitedCountries.size}</Text>
              <Text style={styles.travelStatLabel}>
                {visitedCountries.size === 1 ? 'country' : 'countries'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.travelStatItem}>
              <Text style={styles.travelStatEmoji}>📍</Text>
              <Text style={styles.travelStatValue}>{visitedCities.size}</Text>
              <Text style={styles.travelStatLabel}>
                {visitedCities.size === 1 ? 'city' : 'cities'}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Published trips</Text>

        {loading ? (
          <TripListSkeleton count={2} />
        ) : trips.length === 0 ? (
          <View style={styles.emptyTrips}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="map-outline" size={26} color={TravelColors.primary} />
            </View>
            <Text style={styles.emptyTripsText}>No published trips yet</Text>
            <Text style={styles.emptyTripsBody}>
              Open one of your trips and tap Publish to share it with other travelers.
            </Text>
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
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: TravelColors.text, fontSize: 17, fontWeight: '600' },
  primaryButton: {
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  profileCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    overflow: 'hidden',
  },
  banner: {
    aspectRatio: 3,
    backgroundColor: TravelColors.primary,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  bannerImage: StyleSheet.absoluteFill,
  bannerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { marginTop: -42, alignItems: 'center' },
  avatarRing: {
    borderRadius: 50,
    borderWidth: 4,
    borderColor: TravelColors.surface,
    backgroundColor: TravelColors.surface,
  },
  identity: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 3 },
  displayName: { color: TravelColors.text, fontSize: 22, fontWeight: '800' },
  username: { color: TravelColors.mutedText, fontSize: 14 },
  bio: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingTop: 6,
  },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6 },
  joinedText: { color: TravelColors.mutedText, fontSize: 12.5, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  statItem: { alignItems: 'center', gap: 2, minWidth: 76 },
  statValue: { color: TravelColors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: TravelColors.mutedText, fontSize: 12, fontWeight: '600' },
  statDivider: { width: 1, height: 30, backgroundColor: TravelColors.border },
  travelStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    paddingVertical: 14,
  },
  travelStatItem: { alignItems: 'center', gap: 1, minWidth: 100 },
  travelStatEmoji: { fontSize: 18 },
  travelStatValue: { color: TravelColors.text, fontSize: 19, fontWeight: '800' },
  travelStatLabel: { color: TravelColors.mutedText, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: TravelColors.text, fontSize: 17, fontWeight: '800', paddingLeft: 2 },
  loadingState: { paddingVertical: 32, alignItems: 'center' },
  emptyTrips: {
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTripsText: { color: TravelColors.text, fontSize: 16, fontWeight: '700' },
  emptyTripsBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tripList: { gap: 14 },
});
