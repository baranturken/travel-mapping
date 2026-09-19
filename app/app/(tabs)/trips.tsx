import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripListSkeleton } from '@/components/skeleton';
import { formatTripDateRange, formatTripUpdatedAt } from '@/features/trips/mappers';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import type { TripListItem } from '@/features/trips/types';

export default function TripsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextTrips = await repository.listTrips();
      setTrips(nextTrips);
    } catch (error) {
      setTrips([]);
      setErrorMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void loadTrips()}
            tintColor={TravelColors.primary}
          />
        }>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Sharevel</Text>
          <Text style={styles.title}>Build a clean trip story you can read on a map.</Text>
          <Text style={styles.description}>
            Save multi-stop journeys, keep transport legs in order, and see each trip as a
            road-following route with stats and a shareable story card.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/trips/new')}>
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Create a trip</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved trips</Text>
            <Text style={styles.sectionSubtitle}>Stored locally on this device</Text>
          </View>

          {isLoading ? (
            <TripListSkeleton />
          ) : errorMessage ? (
            <View style={styles.errorState}>
              <Text style={styles.emptyTitle}>Could not load saved trips</Text>
              <Text style={styles.emptyBody}>{errorMessage}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => void loadTrips()}>
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : trips.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="map-outline" size={28} color={TravelColors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>
                Start with a title and at least two stops. Each trip gets a real road-following
                map, leg-by-leg summary, and a shareable story card.
              </Text>
              <Pressable style={styles.secondaryButton} onPress={() => router.push('/trips/new')}>
                <Text style={styles.secondaryButtonText}>Build your first itinerary</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.tripList}>
              {trips.map((trip) => {
                const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
                return (
                  <Pressable
                    key={trip.id}
                    style={({ pressed }) => [styles.tripCard, pressed && styles.tripCardPressed]}
                    onPress={() =>
                      router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } })
                    }>
                    <View style={styles.tripCardHeader}>
                      <Text style={styles.tripTitle}>{trip.title}</Text>
                      <View style={styles.tripCardRight}>
                        {trip.publishedAt ? (
                          <View style={styles.publishedBadge}>
                            <Text style={styles.publishedBadgeText}>Published</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={20} color={TravelColors.mutedText} />
                      </View>
                    </View>
                    <Text style={styles.tripRoute}>
                      {trip.firstStopLabel} → {trip.lastStopLabel}
                    </Text>
                    <View style={styles.tripMetaRow}>
                      <View style={styles.tripMetaLeft}>
                        <Text style={styles.tripMeta}>
                          {trip.stopCount} {trip.stopCount === 1 ? 'stop' : 'stops'}
                        </Text>
                        {dateRange ? <Text style={styles.tripDate}>{dateRange}</Text> : null}
                      </View>
                      <Text style={styles.tripMeta}>{formatTripUpdatedAt(trip.updatedAt)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  content: { padding: 20, gap: 18 },
  heroCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 14,
  },
  eyebrow: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { color: TravelColors.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  description: { color: TravelColors.secondaryText, fontSize: 16, lineHeight: 24 },
  primaryButton: {
    marginTop: 4,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  sectionCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 16,
  },
  sectionHeader: { gap: 4 },
  sectionTitle: { color: TravelColors.text, fontSize: 21, fontWeight: '700' },
  sectionSubtitle: { color: TravelColors.mutedText, fontSize: 14 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  errorState: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  emptyTitle: { color: TravelColors.text, fontSize: 19, fontWeight: '700' },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: TravelColors.primary, fontSize: 15, fontWeight: '700' },
  tripList: { gap: 12 },
  tripCard: {
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  tripCardPressed: { opacity: 0.75 },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripTitle: { flex: 1, color: TravelColors.text, fontSize: 18, fontWeight: '700' },
  tripCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  publishedBadge: {
    backgroundColor: '#e6f4ea',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#b7dfc2',
  },
  publishedBadgeText: { color: '#2d7a47', fontSize: 11, fontWeight: '700' },
  tripRoute: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22 },
  tripMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  tripMetaLeft: { gap: 2 },
  tripMeta: { color: TravelColors.mutedText, fontSize: 13, fontWeight: '600' },
  tripDate: { color: TravelColors.primary, fontSize: 12, fontWeight: '600' },
});
