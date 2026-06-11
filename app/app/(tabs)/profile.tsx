import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getUserTrips, getFollowCounts } from '@/features/social/social-repository';
import { UserAvatar } from '@/features/social/components/user-avatar';
import { FeedTripCard } from '@/features/social/components/feed-trip-card';
import { CommentsSheet } from '@/features/social/components/comments-sheet';
import type { FeedTrip } from '@/features/social/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, needsProfileSetup } = useAuth();
  const [trips, setTrips] = useState<FeedTrip[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [commentsTrip, setCommentsTrip] = useState<FeedTrip | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user || !profile) return;
      setLoading(true);
      void Promise.all([
        getUserTrips(user.id, user.id),
        getFollowCounts(user.id),
      ]).then(([tripData, counts]) => {
        setTrips(tripData);
        setFollowCounts(counts);
      }).finally(() => setLoading(false));
    }, [user, profile]),
  );

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
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
        <View style={styles.centeredState}>
          <ActivityIndicator color={TravelColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <UserAvatar profile={profile} size={64} />
            <View style={styles.headerCopy}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
            </View>
            <Pressable
              style={styles.editButton}
              onPress={() => router.push('/(auth)/profile-setup' as Href)}>
              <Ionicons name="create-outline" size={16} color={TravelColors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

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

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={TravelColors.primary} />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyTrips}>
            <Ionicons name="map-outline" size={28} color={TravelColors.mutedText} />
            <Text style={styles.emptyTripsText}>No published trips yet.</Text>
            <Text style={styles.emptyTripsBody}>
              Open a trip and tap Publish to share it with others.
            </Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {trips.map((trip) => (
              <FeedTripCard
                key={trip.id}
                trip={trip}
                onLike={() => {}}
                onComment={() => setCommentsTrip(trip)}
                onProfile={() => {}}
                hideAuthor
              />
            ))}
          </View>
        )}

        <View style={styles.signOutRow}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={16} color={TravelColors.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {commentsTrip ? (
        <CommentsSheet
          trip={commentsTrip}
          onClose={() => setCommentsTrip(null)}
          onCountChange={() => {}}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  content: { padding: 16, gap: 16 },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: TravelColors.text, fontSize: 17, fontWeight: '600' },
  primaryButton: {
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  editButtonText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
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
  loadingState: { paddingVertical: 32, alignItems: 'center' },
  emptyTrips: {
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  emptyTripsText: { color: TravelColors.text, fontSize: 16, fontWeight: '700' },
  emptyTripsBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tripList: { gap: 14 },
  signOutRow: { alignItems: 'center', paddingVertical: 8 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#efcaca',
    backgroundColor: '#fff9f9',
  },
  signOutText: { color: TravelColors.danger, fontSize: 14, fontWeight: '700' },
});
