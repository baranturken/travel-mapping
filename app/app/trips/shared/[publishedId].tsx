import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatTripDateRange } from '@/features/trips/mappers';
import { getTransportDisplay, type TransportType } from '@/features/trips/types';
import { getPublishedTrip, likeTrip, unlikeTrip } from '@/features/social/social-repository';
import { summarizeStops } from '@/features/social/trip-summary-stats';
import { CommentsSheet } from '@/features/social/components/comments-sheet';
import { SharedTripMap } from '@/features/social/components/shared-trip-map';
import { UserAvatar } from '@/features/social/components/user-avatar';
import type { FeedTrip } from '@/features/social/types';

export default function SharedTripScreen() {
  const router = useRouter();
  const { publishedId } = useLocalSearchParams<{ publishedId: string }>();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  // Two-column grid: screen minus 16px page padding each side and an 8px gutter.
  const galleryImageSize = Math.floor((windowWidth - 32 - 8) / 2);
  const [trip, setTrip] = useState<FeedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!publishedId) return;
      setLoading(true);
      void getPublishedTrip(publishedId, user?.id ?? null)
        .then(setTrip)
        .catch(() => setTrip(null))
        .finally(() => setLoading(false));
    }, [publishedId, user]),
  );

  const handleLike = async () => {
    if (!user || !trip || likeBusy) return;
    const wasLiked = trip.isLikedByMe;
    setTrip({
      ...trip,
      isLikedByMe: !wasLiked,
      likeCount: trip.likeCount + (wasLiked ? -1 : 1),
    });
    setLikeBusy(true);
    try {
      if (wasLiked) await unlikeTrip(trip.id, user.id);
      else await likeTrip(trip.id, user.id);
    } catch {
      setTrip((t) =>
        t
          ? { ...t, isLikedByMe: wasLiked, likeCount: t.likeCount + (wasLiked ? 1 : -1) }
          : t,
      );
    } finally {
      setLikeBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trip' }} />
        <View style={styles.centeredState}>
          <ActivityIndicator color={TravelColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trip' }} />
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={36} color={TravelColors.mutedText} />
          <Text style={styles.emptyTitle}>Trip not available</Text>
          <Text style={styles.emptyBody}>
            This trip may have been unpublished or set to private.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  const { cityCount, countryCount } = summarizeStops(trip.stopsJson);
  const legByIndex = new Map(trip.legsJson.map((l) => [l.orderIndex, l]));

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: trip.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.authorCard}
          onPress={() =>
            router.push({
              pathname: '/users/[userId]',
              params: { userId: trip.userId },
            } as never)
          }
          accessibilityRole="button"
          accessibilityLabel={`View profile of ${trip.profile.displayName}`}>
          <UserAvatar profile={trip.profile} size={44} />
          <View style={styles.authorCopy}>
            <Text style={styles.authorName}>{trip.profile.displayName}</Text>
            <Text style={styles.authorUsername}>@{trip.profile.username}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={TravelColors.mutedText} />
        </Pressable>

        <View style={styles.headerBlock}>
          <Text style={styles.title}>{trip.title}</Text>
          {dateRange ? <Text style={styles.dateRange}>📅 {dateRange}</Text> : null}
          <View style={styles.metaRow}>
            {countryCount > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  🌍 {countryCount} {countryCount === 1 ? 'country' : 'countries'}
                </Text>
              </View>
            ) : null}
            {cityCount > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  📍 {cityCount} {cityCount === 1 ? 'city' : 'cities'}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                🧭 {trip.stopsJson.length} {trip.stopsJson.length === 1 ? 'stop' : 'stops'}
              </Text>
            </View>
          </View>
        </View>

        {trip.coverImageUrl ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Story</Text>
            <View style={styles.storyCard}>
              <Image
                source={{ uri: trip.coverImageUrl }}
                style={styles.storyCover}
                resizeMode="contain"
                accessibilityLabel="Trip story"
              />
            </View>
          </View>
        ) : null}

        {trip.photosJson.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos · {trip.photosJson.length}
            </Text>
            <View style={styles.gallery}>
              {trip.photosJson.map((photo, i) => (
                <Image
                  key={`${photo.url}-${i}`}
                  source={{ uri: photo.url }}
                  style={[styles.galleryImage, { width: galleryImageSize, height: galleryImageSize }]}
                  resizeMode="cover"
                  accessibilityLabel={photo.caption ?? photo.cityName ?? 'Trip photo'}
                />
              ))}
            </View>
          </View>
        ) : null}

        {trip.stopsJson.length > 0 ? <SharedTripMap stops={trip.stopsJson} /> : null}

        <View style={styles.routeCard}>
          <Text style={styles.sectionTitle}>Route</Text>
          {trip.stopsJson.map((stop, i) => {
            const leg = legByIndex.get(i);
            const transport = leg
              ? getTransportDisplay(leg.transportType as TransportType, leg.transportLabel)
              : null;
            return (
              <View key={`${stop.cityName}-${i}`}>
                <View style={styles.stopRow}>
                  <View style={[styles.stopBadge, stop.isHomeBase && styles.homeBadge]}>
                    <Text style={styles.stopBadgeText}>
                      {stop.isHomeBase ? '🏠' : i + 1}
                    </Text>
                  </View>
                  <View style={styles.stopCopy}>
                    <Text style={styles.stopCity}>{stop.cityName}</Text>
                    <Text style={styles.stopCountry}>
                      {stop.countryName}
                      {stop.stayLabel ? ` · ${stop.stayLabel}` : ''}
                    </Text>
                  </View>
                </View>
                {transport && i < trip.stopsJson.length - 1 ? (
                  <View style={styles.transportRow}>
                    <View style={styles.transportLine} />
                    <Text style={styles.transportText}>
                      {transport.emoji} {transport.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          style={styles.actionButton}
          onPress={() => void handleLike()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={trip.isLikedByMe ? 'Unlike trip' : 'Like trip'}>
          <Ionicons
            name={trip.isLikedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={trip.isLikedByMe ? '#e84545' : TravelColors.mutedText}
          />
          <Text style={[styles.actionCount, trip.isLikedByMe && styles.likedCount]}>
            {trip.likeCount > 0 ? trip.likeCount : 'Like'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => setCommentsOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="View comments">
          <Ionicons name="chatbubble-outline" size={22} color={TravelColors.mutedText} />
          <Text style={styles.actionCount}>
            {trip.commentCount > 0 ? trip.commentCount : 'Comment'}
          </Text>
        </Pressable>
      </View>

      {commentsOpen ? (
        <CommentsSheet
          trip={trip}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(delta) =>
            setTrip((t) =>
              t ? { ...t, commentCount: Math.max(0, t.commentCount + delta) } : t,
            )
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: { color: TravelColors.text, fontSize: 19, fontWeight: '700' },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TravelColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 14,
  },
  authorCopy: { flex: 1, gap: 1 },
  authorName: { color: TravelColors.text, fontSize: 15, fontWeight: '700' },
  authorUsername: { color: TravelColors.mutedText, fontSize: 13 },
  headerBlock: { gap: 8 },
  title: { color: TravelColors.text, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  dateRange: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    borderRadius: 999,
    backgroundColor: TravelColors.tintSurface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  metaPillText: { color: TravelColors.primary, fontSize: 12, fontWeight: '700' },
  section: { gap: 4 },
  storyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0f2540',
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  storyCover: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#0f2540',
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryImage: {
    borderRadius: 14,
    backgroundColor: TravelColors.tintSurface,
  },
  routeCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    color: TravelColors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stopBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBadge: { backgroundColor: '#11833b' },
  stopBadgeText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  stopCopy: { flex: 1, gap: 1 },
  stopCity: { color: TravelColors.text, fontSize: 15, fontWeight: '700' },
  stopCountry: { color: TravelColors.mutedText, fontSize: 13 },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 13,
    paddingVertical: 2,
  },
  transportLine: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: TravelColors.border,
  },
  transportText: { color: TravelColors.secondaryText, fontSize: 13, fontWeight: '600' },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  actionCount: { color: TravelColors.mutedText, fontSize: 15, fontWeight: '600' },
  likedCount: { color: '#e84545' },
});
