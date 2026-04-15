import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  formatTripUpdatedAt,
  formatTripStopLabel,
  toDuplicatedTripInput,
} from '@/features/trips/mappers';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import {
  getAccommodationDisplay,
  getTransportDisplay,
  type TripDetail,
  type TripStop,
} from '@/features/trips/types';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
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

  const handleDeleteTrip = useCallback(() => {
    if (!trip || isDeleting) {
      return;
    }

    Alert.alert(
      'Delete trip?',
      'This will remove the saved itinerary and its stored photo memories from local storage on this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setIsDeleting(true);
                await repository.deleteTrip(trip.id);
                router.replace('/');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Please try again.';
                Alert.alert('Could not delete trip', message);
              } finally {
                setIsDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [isDeleting, repository, router, trip]);

  const handleDuplicateTrip = useCallback(async () => {
    if (!trip || isDuplicating) {
      return;
    }

    try {
      setIsDuplicating(true);
      const duplicatedTripId = await repository.createTrip(toDuplicatedTripInput(trip));
      router.push({
        pathname: '/trips/[tripId]',
        params: { tripId: duplicatedTripId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not duplicate trip', message);
    } finally {
      setIsDuplicating(false);
    }
  }, [isDuplicating, repository, router, trip]);

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

  const memoryPinCount = trip.stops.reduce(
    (count, stop) =>
      count + stop.memories.filter((memory) => memory.latitude !== null && memory.longitude !== null).length,
    0,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Saved itinerary</Text>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.subtitle}>
            {trip.stops.length} stops • Updated {formatTripUpdatedAt(trip.updatedAt)}
          </Text>
          <View style={styles.headerMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                {trip.stops.reduce((count, stop) => count + stop.places.length, 0)} places
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                {trip.stops.reduce((count, stop) => count + stop.memories.length, 0)} memories
              </Text>
            </View>
            {memoryPinCount > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{memoryPinCount} pinned on map</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            style={styles.editButton}
            disabled={isDeleting || isDuplicating}
            onPress={() =>
              router.push({
                pathname: '/trips/[tripId]/edit',
                params: { tripId: trip.id },
              })
            }>
            <Ionicons name="create-outline" size={16} color={TravelColors.primary} />
            <Text style={styles.editButtonText}>Edit trip</Text>
          </Pressable>
          <Pressable
            style={[styles.duplicateButton, isDuplicating && styles.duplicateButtonDisabled]}
            disabled={isDeleting || isDuplicating}
            onPress={() => void handleDuplicateTrip()}>
            <Ionicons name="copy-outline" size={16} color={TravelColors.primary} />
            <Text style={styles.duplicateButtonText}>
              {isDuplicating ? 'Duplicating…' : 'Duplicate trip'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            disabled={isDeleting || isDuplicating}
            onPress={handleDeleteTrip}>
            <Ionicons name="trash-outline" size={16} color={TravelColors.danger} />
            <Text style={styles.deleteButtonText}>{isDeleting ? 'Deleting…' : 'Delete trip'}</Text>
          </Pressable>
        </View>

        <TripMapWebView trip={trip} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stops and story</Text>
          <View style={styles.list}>
            {trip.stops.map((stop, index) => (
              <StopStoryCard key={stop.id} stop={stop} index={index} />
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

function StopStoryCard({ stop, index }: { stop: TripStop; index: number }) {
  const hasAccommodation = Boolean(stop.accommodationName?.trim() || stop.accommodationType);
  const accommodation = hasAccommodation
    ? getAccommodationDisplay(stop.accommodationType, stop.accommodationName)
    : null;
  const visiblePlaces = stop.places.slice(0, 3);
  const extraPlaceCount = stop.places.length - visiblePlaces.length;
  const visibleMemories = stop.memories.slice(0, 3);
  const extraMemoryCount = stop.memories.length - visibleMemories.length;

  return (
    <View style={styles.rowCard}>
      <View style={styles.stopIndexBadge}>
        <Text style={styles.stopIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{formatTripStopLabel(stop)}</Text>
        <Text style={styles.rowBody}>
          {stop.stayLabel?.trim() ? stop.stayLabel : 'No stay label added for this stop yet.'}
        </Text>

        {accommodation ? (
          <View style={styles.storyBlock}>
            <Text style={styles.storyLabel}>Accommodation</Text>
            <View style={styles.accommodationChip}>
              <Text style={styles.accommodationChipText}>
                {accommodation.emoji} {accommodation.label}
              </Text>
            </View>
            {stop.accommodationNote?.trim() ? (
              <Text style={styles.storyBody}>{stop.accommodationNote}</Text>
            ) : null}
          </View>
        ) : null}

        {stop.places.length > 0 ? (
          <View style={styles.storyBlock}>
            <Text style={styles.storyLabel}>Visited places</Text>
            <View style={styles.placeChipRow}>
              {visiblePlaces.map((place) => (
                <View key={place.id} style={styles.placeChip}>
                  <Text style={styles.placeChipTitle}>{place.title}</Text>
                  {place.note?.trim() ? <Text style={styles.placeChipBody}>{place.note}</Text> : null}
                </View>
              ))}
              {extraPlaceCount > 0 ? (
                <View style={styles.morePill}>
                  <Text style={styles.morePillText}>+{extraPlaceCount} more</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {stop.memories.length > 0 ? (
          <View style={styles.storyBlock}>
            <Text style={styles.storyLabel}>Photo memories</Text>
            <View style={styles.memoryGrid}>
              {visibleMemories.map((memory) => (
                <View key={memory.id} style={styles.memoryCard}>
                  <Image source={{ uri: memory.imageUri }} style={styles.memoryImage} />
                  <Text style={styles.memoryCaption}>
                    {memory.caption?.trim() ? memory.caption : 'Photo memory'}
                  </Text>
                  <Text style={styles.memoryMeta}>
                    {memory.latitude !== null && memory.longitude !== null
                      ? 'Pinned on map'
                      : 'Shown in stop gallery'}
                  </Text>
                </View>
              ))}
              {extraMemoryCount > 0 ? (
                <View style={styles.morePill}>
                  <Text style={styles.morePillText}>+{extraMemoryCount} more</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
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
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: TravelColors.tintSurface,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  metaPillText: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  editButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  editButtonText: {
    color: TravelColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  duplicateButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  duplicateButtonDisabled: {
    opacity: 0.6,
  },
  duplicateButtonText: {
    color: TravelColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: '#efcaca',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: TravelColors.danger,
    fontSize: 14,
    fontWeight: '700',
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
    gap: 8,
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
  storyBlock: {
    gap: 8,
    marginTop: 2,
  },
  storyLabel: {
    color: TravelColors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storyBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  accommodationChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  accommodationChipText: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  placeChipRow: {
    gap: 8,
  },
  placeChip: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 12,
    gap: 4,
  },
  placeChipTitle: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  placeChipBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  morePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  morePillText: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  memoryCard: {
    width: 132,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: TravelColors.border,
    overflow: 'hidden',
  },
  memoryImage: {
    width: '100%',
    height: 92,
    backgroundColor: '#dfeaf5',
  },
  memoryCaption: {
    color: TravelColors.text,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  memoryMeta: {
    color: TravelColors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 10,
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
