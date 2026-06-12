import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatTripDateRange } from '@/features/trips/mappers';
import { likeTrip, unlikeTrip } from '@/features/social/social-repository';
import { summarizeStops } from '@/features/social/trip-summary-stats';
import type { FeedTrip } from '@/features/social/types';
import { CommentsSheet } from './comments-sheet';
import { UserAvatar } from './user-avatar';

type Props = {
  trip: FeedTrip;
  onPress?(): void;
  onProfile?(): void;
  hideAuthor?: boolean;
};

export function FeedTripCard({ trip, onPress, onProfile, hideAuthor = false }: Props) {
  const { user } = useAuth();
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  const { travelStops, cityCount, countryCount } = summarizeStops(trip.stopsJson);
  const previewStops = travelStops.slice(0, 4);

  const [liked, setLiked] = useState(trip.isLikedByMe);
  const [likeCount, setLikeCount] = useState(trip.likeCount);
  const [commentCount, setCommentCount] = useState(trip.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    setLiked(trip.isLikedByMe);
    setLikeCount(trip.likeCount);
    setCommentCount(trip.commentCount);
  }, [trip.id, trip.isLikedByMe, trip.likeCount, trip.commentCount]);

  const handleLike = async () => {
    if (!user || likeBusy) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    setLikeBusy(true);
    try {
      if (wasLiked) {
        await unlikeTrip(trip.id, user.id);
      } else {
        await likeTrip(trip.id, user.id);
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      {!hideAuthor && (
        <Pressable
          style={styles.authorRow}
          onPress={onProfile}
          accessibilityRole="button"
          accessibilityLabel={`View profile of ${trip.profile.displayName}`}>
          <UserAvatar profile={trip.profile} size={38} />
          <View style={styles.authorCopy}>
            <Text style={styles.authorName}>{trip.profile.displayName}</Text>
            <Text style={styles.authorUsername}>@{trip.profile.username}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={TravelColors.mutedText} />
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.body, pressed && onPress ? styles.bodyPressed : null]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Open trip ${trip.title}` : undefined}>
        <Text style={styles.title} numberOfLines={2}>
          {trip.title}
        </Text>

        {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}

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
        </View>

        {previewStops.length > 0 ? (
          <View style={styles.stopsPreview}>
            {previewStops.map((stop, i) => (
              <View key={`${stop.cityName}-${i}`} style={styles.stopRow}>
                <View style={styles.stopDot} />
                <Text style={styles.stopText} numberOfLines={1}>
                  {stop.cityName}
                  {stop.countryName ? `, ${stop.countryName}` : ''}
                </Text>
              </View>
            ))}
            {travelStops.length > 4 ? (
              <Text style={styles.moreStops}>+{travelStops.length - 4} more stops</Text>
            ) : null}
          </View>
        ) : null}

        {onPress ? (
          <View style={styles.viewTripRow}>
            <Text style={styles.viewTripText}>View full trip</Text>
            <Ionicons name="arrow-forward" size={13} color={TravelColors.primary} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => void handleLike()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike trip' : 'Like trip'}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? '#e84545' : TravelColors.mutedText}
          />
          {likeCount > 0 ? (
            <Text style={[styles.actionCount, liked && styles.likedCount]}>{likeCount}</Text>
          ) : null}
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => setCommentsOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="View comments">
          <Ionicons name="chatbubble-outline" size={20} color={TravelColors.mutedText} />
          {commentCount > 0 ? <Text style={styles.actionCount}>{commentCount}</Text> : null}
        </Pressable>
      </View>

      {commentsOpen ? (
        <CommentsSheet
          trip={trip}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  authorCopy: { flex: 1 },
  authorName: { color: TravelColors.text, fontSize: 14, fontWeight: '700' },
  authorUsername: { color: TravelColors.mutedText, fontSize: 12 },
  body: { padding: 16, gap: 8 },
  bodyPressed: { backgroundColor: TravelColors.tintSurface },
  title: { color: TravelColors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  dateRange: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
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
  stopsPreview: {
    backgroundColor: TravelColors.background,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    marginTop: 2,
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TravelColors.primary,
    flexShrink: 0,
  },
  stopText: {
    flex: 1,
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  moreStops: {
    color: TravelColors.mutedText,
    fontSize: 12,
    paddingLeft: 15,
    fontWeight: '600',
  },
  viewTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
  },
  viewTripText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  actionCount: { color: TravelColors.mutedText, fontSize: 14, fontWeight: '600' },
  likedCount: { color: '#e84545' },
});
