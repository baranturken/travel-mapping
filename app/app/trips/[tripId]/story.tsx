import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripStoryCard } from '@/features/trips/components/trip-story-card';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';
import { formatTripDateRange } from '@/features/trips/mappers';
import { getOsrmProfile } from '@/features/trips/routing/osrm-route-fetcher';
import { buildRouteCacheKey, getCachedRoute } from '@/features/trips/routing/route-cache';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import { computeTripStats, formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripDetail } from '@/features/trips/types';

export default function TripStoryScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [legRoutes, setLegRoutes] = useState<Record<string, LegRouteData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStory = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!tripId) {
      setTrip(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextTrip = await repository.getTripDetail(tripId);
      setTrip(nextTrip);

      if (nextTrip) {
        const stopLookup = new Map(nextTrip.stops.map((stop) => [stop.id, stop]));
        const routes: Record<string, LegRouteData> = {};

        await Promise.all(
          nextTrip.legs.map(async (leg) => {
            const profile = getOsrmProfile(leg.transportType);
            if (!profile) return;

            const from = stopLookup.get(leg.fromStopId);
            const to = stopLookup.get(leg.toStopId);
            if (!from || !to) return;

            const cacheKey = buildRouteCacheKey(
              from.latitude,
              from.longitude,
              to.latitude,
              to.longitude,
              profile,
            );
            const cached = await getCachedRoute(db, cacheKey);
            if (cached) {
              routes[leg.id] = {
                geometry: cached.geometry,
                distanceMeters: cached.distanceMeters,
                durationSeconds: cached.durationSeconds,
              };
            }
          }),
        );

        setLegRoutes(routes);
      } else {
        setLegRoutes({});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setTrip(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [db, repository, tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadStory();
    }, [loadStory]),
  );

  const handleShare = useCallback(async () => {
    if (!trip) return;

    const stats = computeTripStats(trip, legRoutes);
    const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
    const distance =
      stats.totalDistanceKm !== null ? formatDistanceKm(stats.totalDistanceKm) : null;

    const statsLine =
      `🌍 ${stats.countryCount} ${stats.countryCount === 1 ? 'country' : 'countries'} · 📍 ${stats.cityCount} ${stats.cityCount === 1 ? 'city' : 'cities'}` +
      (stats.dayCount !== null ? ` · 🗓️ ${stats.dayCount} ${stats.dayCount === 1 ? 'day' : 'days'}` : '') +
      (distance ? ` · 🛣️ ${distance}` : '');

    const routeLines = trip.stops
      .map((stop, index) => `${index + 1}. ${stop.cityName}, ${stop.countryName}`)
      .join('\n');

    const message =
      `✈️ ${trip.title}\n` +
      (dateRange ? `📅 ${dateRange}\n` : '') +
      `${statsLine}\n\n` +
      `Route:\n${routeLines}\n\n` +
      `Made with Travel Mapping`;

    try {
      await Share.share({ message });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not share trip', detail);
    }
  }, [legRoutes, trip]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={TravelColors.primary} />
          <Text style={styles.loadingText}>Preparing your story…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <Text style={styles.emptyTitle}>{errorMessage ? 'Could not load story' : 'Trip not found'}</Text>
          <Text style={styles.emptyBody}>
            {errorMessage ?? 'This itinerary is no longer available in local storage.'}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={TravelColors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.cardWrap}>
          <TripStoryCard trip={trip} legRoutes={legRoutes} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.shareButton} onPress={() => void handleShare()}>
          <Ionicons name="share-outline" size={18} color="#ffffff" />
          <Text style={styles.shareButtonText}>Share trip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TravelColors.background,
  },
  content: {
    padding: 20,
    gap: 16,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  backButtonText: {
    color: TravelColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    color: TravelColors.mutedText,
    fontSize: 14,
  },
  emptyTitle: {
    color: TravelColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: TravelColors.primary,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
