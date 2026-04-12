import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripMapWebView } from '@/features/trips/components/trip-map-webview';
import { formatTripUpdatedAt, formatTripStopLabel } from '@/features/trips/mappers';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import { getTransportDisplay } from '@/features/trips/types';
import type { TripDetail } from '@/features/trips/types';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setTrip(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [repository, tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadTrip();
    }, [loadTrip]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={TravelColors.primary} />
          <Text style={styles.loadingText}>Loading trip…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <Text style={styles.emptyTitle}>{errorMessage ? 'Could not load trip' : 'Trip not found'}</Text>
          <Text style={styles.emptyBody}>
            {errorMessage
              ? errorMessage
              : 'This itinerary is no longer available in local storage.'}
          </Text>
          {errorMessage ? (
            <Pressable style={styles.backButton} onPress={() => void loadTrip()}>
              <Text style={styles.backButtonText}>Try again</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
              <Text style={styles.backButtonText}>Back to trips</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Saved itinerary</Text>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.subtitle}>
            {trip.stops.length} stops • Updated {formatTripUpdatedAt(trip.updatedAt)}
          </Text>
        </View>

        <TripMapWebView trip={trip} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stops</Text>
          <View style={styles.list}>
            {trip.stops.map((stop, index) => (
              <View key={stop.id} style={styles.rowCard}>
                <View style={styles.stopIndexBadge}>
                  <Text style={styles.stopIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{formatTripStopLabel(stop)}</Text>
                  <Text style={styles.rowBody}>
                    {stop.stayLabel?.trim()
                      ? stop.stayLabel
                      : 'No stay label added for this stop yet.'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Leg by leg</Text>
          <View style={styles.list}>
            {trip.legs.map((leg) => {
              const fromStop = trip.stops.find((stop) => stop.id === leg.fromStopId);
              const toStop = trip.stops.find((stop) => stop.id === leg.toStopId);
              const transport = getTransportDisplay(leg.transportType, leg.transportLabel);

              if (!fromStop || !toStop) {
                return null;
              }

              return (
                <View key={leg.id} style={styles.legCard}>
                  <View style={styles.legIconWrap}>
                    <Text style={styles.legEmoji}>{transport.emoji}</Text>
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>
                      {formatTripStopLabel(fromStop)} → {formatTripStopLabel(toStop)}
                    </Text>
                    <Text style={styles.rowBody}>{transport.label}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={TravelColors.mutedText} />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
    gap: 18,
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
  backButton: {
    marginTop: 4,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 8,
  },
  eyebrow: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: TravelColors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 14,
  },
  sectionTitle: {
    color: TravelColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    gap: 12,
  },
  rowCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: TravelColors.tintSurface,
  },
  stopIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndexText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: TravelColors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  rowBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  legCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: TravelColors.tintSurface,
  },
  legIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legEmoji: {
    fontSize: 18,
  },
});
