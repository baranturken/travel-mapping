import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { formatTripDateRange } from '@/features/trips/mappers';
import type { FeedTrip } from '@/features/social/types';
import { UserAvatar } from './user-avatar';

type Props = {
  trip: FeedTrip;
  onLike(): void;
  onComment(): void;
  onProfile(): void;
  hideAuthor?: boolean;
};

export function FeedTripCard({ trip, onLike, onComment, onProfile, hideAuthor = false }: Props) {
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  const travelStops = trip.stopsJson.filter((s) => !s.isHomeBase);
  const countries = [...new Set(travelStops.map((s) => s.countryName))];
  const previewStops = travelStops.slice(0, 4);

  return (
    <View style={styles.card}>
      {!hideAuthor && (
        <Pressable style={styles.authorRow} onPress={onProfile}>
          <UserAvatar profile={trip.profile} size={38} />
          <View style={styles.authorCopy}>
            <Text style={styles.authorName}>{trip.profile.displayName}</Text>
            <Text style={styles.authorUsername}>@{trip.profile.username}</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {trip.title}
        </Text>

        {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}

        <View style={styles.metaRow}>
          {countries.length > 0 ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                🌍 {countries.length} {countries.length === 1 ? 'country' : 'countries'}
              </Text>
            </View>
          ) : null}
          {travelStops.length > 0 ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                📍 {travelStops.length} {travelStops.length === 1 ? 'city' : 'cities'}
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
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={trip.isLikedByMe ? 'heart' : 'heart-outline'}
            size={20}
            color={trip.isLikedByMe ? '#e84545' : TravelColors.mutedText}
          />
          {trip.likeCount > 0 ? (
            <Text style={[styles.actionCount, trip.isLikedByMe && styles.likedCount]}>
              {trip.likeCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={20} color={TravelColors.mutedText} />
          {trip.commentCount > 0 ? (
            <Text style={styles.actionCount}>{trip.commentCount}</Text>
          ) : null}
        </Pressable>
      </View>
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
