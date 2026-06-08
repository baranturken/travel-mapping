import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripMapWebView, type LegRouteData } from '@/features/trips/components/trip-map-webview';
import {
  formatTripDateRange,
  formatTripUpdatedAt,
  formatTripStopLabel,
  toDuplicatedTripInput,
} from '@/features/trips/mappers';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import {
  computeTripStats,
  formatDistanceKm,
  formatLegDistance,
  formatLegDuration,
} from '@/features/trips/trip-stats';
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
  const [legRoutes, setLegRoutes] = useState<Record<string, LegRouteData>>({});

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

  const totalMemoryCount = trip.stops.reduce((count, stop) => count + stop.memories.length, 0);
  const memoryPinCount = trip.stops.reduce(
    (count, stop) =>
      count + stop.memories.filter((memory) => memory.latitude !== null && memory.longitude !== null).length,
    0,
  );
  const dateRangeLabel = formatTripDateRange(trip.startDate, trip.endDate);
  const stats = computeTripStats(trip, legRoutes);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Saved itinerary</Text>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.subtitle}>
            {trip.stops.length} stops • Updated {formatTripUpdatedAt(trip.updatedAt)}
          </Text>
          {dateRangeLabel ? <Text style={styles.dateRange}>{dateRangeLabel}</Text> : null}
          <View style={styles.headerMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                🌍 {stats.countryCount} {stats.countryCount === 1 ? 'country' : 'countries'}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                📍 {stats.cityCount} {stats.cityCount === 1 ? 'city' : 'cities'}
              </Text>
            </View>
            {stats.dayCount !== null ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  🗓️ {stats.dayCount} {stats.dayCount === 1 ? 'day' : 'days'}
                </Text>
              </View>
            ) : null}
            {stats.totalDistanceKm !== null ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  🛣️ {formatDistanceKm(stats.totalDistanceKm)}
                </Text>
              </View>
            ) : null}
            {totalMemoryCount > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  📷 {totalMemoryCount} {totalMemoryCount === 1 ? 'memory' : 'memories'}
                </Text>
              </View>
            ) : null}
            {memoryPinCount > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{memoryPinCount} pinned</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.primaryActions}>
            <Pressable
              style={[styles.primaryActionButton, styles.primaryActionButtonFill]}
              disabled={isDeleting || isDuplicating}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/story',
                  params: { tripId: trip.id },
                })
              }>
              <Ionicons name="share-outline" size={16} color="#ffffff" />
              <Text style={styles.primaryActionButtonFillText}>Share story</Text>
            </Pressable>
            <Pressable
              style={styles.primaryActionButton}
              disabled={isDeleting || isDuplicating}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/edit',
                  params: { tripId: trip.id },
                })
              }>
              <Ionicons name="create-outline" size={16} color={TravelColors.primary} />
              <Text style={styles.primaryActionButtonText}>Edit trip</Text>
            </Pressable>
          </View>
          <View style={styles.secondaryActions}>
            <Pressable
              style={[styles.secondaryActionButton, (isDeleting || isDuplicating) && styles.secondaryActionButtonDisabled]}
              disabled={isDeleting || isDuplicating}
              onPress={() => void handleDuplicateTrip()}>
              <Ionicons name="copy-outline" size={14} color={TravelColors.mutedText} />
              <Text style={styles.secondaryActionButtonText}>
                {isDuplicating ? 'Duplicating…' : 'Duplicate'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryActionButton, styles.deleteActionButton, (isDeleting || isDuplicating) && styles.secondaryActionButtonDisabled]}
              disabled={isDeleting || isDuplicating}
              onPress={handleDeleteTrip}>
              <Ionicons name="trash-outline" size={14} color={TravelColors.danger} />
              <Text style={styles.deleteActionButtonText}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          </View>
        </View>

        <TripMapWebView trip={trip} onRoutesLoaded={setLegRoutes} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stops</Text>
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
              const routeData = legRoutes[leg.id];
              const distanceLabel = formatLegDistance(routeData?.distanceMeters ?? null);
              const durationLabel = formatLegDuration(routeData?.durationSeconds ?? null);

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
                    {(distanceLabel || durationLabel) ? (
                      <Text style={styles.legMeta}>
                        {[distanceLabel, durationLabel].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0);

  if (index === 0 && stop.isHomeBase) {
    return (
      <View style={styles.rowCard}>
        <View style={styles.stopIndexBadge}>
          <Text style={styles.stopIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>{formatTripStopLabel(stop)}</Text>
          <Text style={styles.rowBody}>This is where you are living.</Text>
          <View style={styles.homeBasePill}>
            <Text style={styles.homeBasePillText}>Home base</Text>
          </View>
        </View>
      </View>
    );
  }

  const hasAccommodation = Boolean(stop.accommodationName?.trim() || stop.accommodationType);
  const accommodation = hasAccommodation
    ? getAccommodationDisplay(stop.accommodationType, stop.accommodationName)
    : null;
  const visiblePlaces = stop.places.slice(0, 3);
  const extraPlaceCount = stop.places.length - visiblePlaces.length;
  const previewMemories = stop.memories.slice(0, 3);

  const openGalleryAt = (memoryIndex: number) => {
    setSelectedMemoryIndex(memoryIndex);
    setIsGalleryOpen(true);
  };

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
            <Pressable style={styles.memoryStackCard} onPress={() => openGalleryAt(0)}>
              <View style={styles.memoryStackCanvas}>
                {previewMemories.map((memory, memoryIndex) => (
                  <View
                    key={memory.id}
                    style={[
                      styles.memoryStackPhoto,
                      {
                        left: memoryIndex * 22,
                        transform: [{ rotate: `${(memoryIndex - 1) * 5}deg` }],
                        zIndex: previewMemories.length - memoryIndex,
                      },
                    ]}>
                    <Image source={{ uri: memory.imageUri }} style={styles.memoryStackImage} />
                  </View>
                ))}
              </View>
              <View style={styles.memoryStackCopy}>
                <Text style={styles.memoryStackTitle}>
                  {stop.memories.length} {stop.memories.length === 1 ? 'photo' : 'photos'} saved
                </Text>
                <Text style={styles.memoryStackBody}>
                  Tap to open the full gallery for this stop and browse every memory you added.
                </Text>
                <View style={styles.memoryStackAction}>
                  <Text style={styles.memoryStackActionText}>
                    {stop.memories.length === 1 ? 'Open photo' : 'Open gallery'}
                  </Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.memoryThumbRow}>
              {previewMemories.map((memory, memoryIndex) => (
                <Pressable
                  key={`${memory.id}-thumb`}
                  style={styles.memoryThumbButton}
                  onPress={() => openGalleryAt(memoryIndex)}>
                  <Image source={{ uri: memory.imageUri }} style={styles.memoryThumbImage} />
                </Pressable>
              ))}
              {stop.memories.length > previewMemories.length ? (
                <Pressable
                  style={styles.morePill}
                  onPress={() => openGalleryAt(previewMemories.length)}>
                  <Text style={styles.morePillText}>
                    +{stop.memories.length - previewMemories.length} more
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <StopMemoryGalleryModal
              stopLabel={formatTripStopLabel(stop)}
              memories={stop.memories}
              visible={isGalleryOpen}
              selectedMemoryIndex={selectedMemoryIndex}
              onSelectMemory={setSelectedMemoryIndex}
              onClose={() => setIsGalleryOpen(false)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StopMemoryGalleryModal({
  stopLabel,
  memories,
  visible,
  selectedMemoryIndex,
  onSelectMemory,
  onClose,
}: {
  stopLabel: string;
  memories: TripStop['memories'];
  visible: boolean;
  selectedMemoryIndex: number;
  onSelectMemory(index: number): void;
  onClose(): void;
}) {
  const selectedMemory = memories[selectedMemoryIndex] ?? memories[0];

  if (!selectedMemory) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.galleryBackdrop}>
        <View style={styles.gallerySheet}>
          <View style={styles.galleryHeader}>
            <View style={styles.galleryHeaderCopy}>
              <Text style={styles.galleryTitle}>{stopLabel}</Text>
              <Text style={styles.gallerySubtitle}>
                Photo {selectedMemoryIndex + 1} of {memories.length}
              </Text>
            </View>
            <Pressable style={styles.galleryCloseButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.galleryContent}>
            <Image source={{ uri: selectedMemory.imageUri }} style={styles.galleryHeroImage} />
            <Text style={styles.galleryCaption}>
              {selectedMemory.caption?.trim() ? selectedMemory.caption : 'Photo memory'}
            </Text>
            <Text style={styles.galleryMeta}>
              {selectedMemory.latitude !== null && selectedMemory.longitude !== null
                ? 'Pinned on the map for this trip.'
                : 'Saved to this stop without exact GPS coordinates.'}
            </Text>

            <View style={styles.galleryThumbRail}>
              {memories.map((memory, memoryIndex) => {
                const isSelected = memoryIndex === selectedMemoryIndex;

                return (
                  <Pressable
                    key={memory.id}
                    style={[styles.galleryThumbButton, isSelected && styles.galleryThumbButtonSelected]}
                    onPress={() => onSelectMemory(memoryIndex)}>
                    <Image source={{ uri: memory.imageUri }} style={styles.galleryThumbImage} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  dateRange: {
    color: TravelColors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
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
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  primaryActionButtonFill: {
    backgroundColor: TravelColors.primary,
    borderColor: TravelColors.primary,
  },
  primaryActionButtonText: {
    color: TravelColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionButtonFillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.5,
  },
  secondaryActionButtonText: {
    color: TravelColors.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteActionButton: {
    borderColor: '#efcaca',
    backgroundColor: '#fff9f9',
  },
  deleteActionButtonText: {
    color: TravelColors.danger,
    fontSize: 13,
    fontWeight: '600',
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
  memoryThumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  memoryThumbButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: TravelColors.border,
    backgroundColor: '#ffffff',
  },
  memoryThumbImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#dfeaf5',
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
  homeBasePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eff7ff',
    borderWidth: 1,
    borderColor: '#cfe2f4',
  },
  homeBasePillText: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  memoryStackCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#eef7ff',
    borderWidth: 1,
    borderColor: '#d4e7fa',
    alignItems: 'center',
  },
  memoryStackCanvas: {
    width: 118,
    height: 86,
    position: 'relative',
  },
  memoryStackPhoto: {
    position: 'absolute',
    top: 0,
    width: 64,
    height: 86,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#dfeaf5',
  },
  memoryStackImage: {
    width: '100%',
    height: '100%',
  },
  memoryStackCopy: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  memoryStackTitle: {
    color: TravelColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  memoryStackBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  memoryStackAction: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memoryStackActionText: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  galleryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 23, 34, 0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  gallerySheet: {
    maxHeight: '86%',
    borderRadius: 24,
    backgroundColor: TravelColors.surface,
    overflow: 'hidden',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  galleryHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  galleryTitle: {
    color: TravelColors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  gallerySubtitle: {
    color: TravelColors.secondaryText,
    fontSize: 13,
  },
  galleryCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  galleryContent: {
    padding: 18,
    gap: 12,
  },
  galleryHeroImage: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    backgroundColor: '#dfeaf5',
  },
  galleryCaption: {
    color: TravelColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  galleryMeta: {
    color: TravelColors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  galleryThumbRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  galleryThumbButton: {
    width: 68,
    height: 68,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#dfeaf5',
  },
  galleryThumbButtonSelected: {
    borderColor: TravelColors.primary,
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  legCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: TravelColors.tintSurface,
  },
  legMeta: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
