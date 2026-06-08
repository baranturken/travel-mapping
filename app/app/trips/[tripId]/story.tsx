import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';
import { TripStoryCard } from '@/features/trips/components/trip-story-card';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';
import { formatTripDateRange } from '@/features/trips/mappers';
import { getOsrmProfile } from '@/features/trips/routing/osrm-route-fetcher';
import { buildRouteCacheKey, getCachedRoute } from '@/features/trips/routing/route-cache';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import { computeTripStats, formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripDetail } from '@/features/trips/types';
import { buildPhotoStoryHtml } from '@/features/trips/photo-story-renderer';

type PickerMemory = {
  id: string;
  stopLabel: string;
  imageUri: string;
};

export default function TripStoryScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [legRoutes, setLegRoutes] = useState<Record<string, LegRouteData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoStoryHtml, setPhotoStoryHtml] = useState<string | null>(null);
  const [isGeneratingPhotoStory, setIsGeneratingPhotoStory] = useState(false);
  const [pickerMemories, setPickerMemories] = useState<PickerMemory[]>([]);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

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

  const handleOpenPhotoPicker = useCallback(() => {
    if (!trip || isGeneratingPhotoStory) return;

    const allMemories: PickerMemory[] = trip.stops.flatMap((s) =>
      s.memories.map((m) => ({
        id: m.id,
        stopLabel: `${s.cityName}, ${s.countryName}`,
        imageUri: m.imageUri,
      })),
    );

    if (allMemories.length === 0) {
      // No photos — generate story card without photos immediately
      setIsGeneratingPhotoStory(true);
      const stats = computeTripStats(trip, legRoutes);
      setPhotoStoryHtml(buildPhotoStoryHtml(trip, stats, legRoutes, []));
      return;
    }

    setPickerMemories(allMemories);
    setIsPhotoPickerOpen(true);
  }, [isGeneratingPhotoStory, legRoutes, trip]);

  const handlePickerConfirm = useCallback(
    async (selectedUris: string[]) => {
      setIsPhotoPickerOpen(false);
      if (!trip) return;

      setIsGeneratingPhotoStory(true);

      const photoBase64s: string[] = [];
      for (const uri of selectedUris) {
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          photoBase64s.push(b64);
        } catch {
          // skip unreadable photo
        }
      }

      const stats = computeTripStats(trip, legRoutes);
      setPhotoStoryHtml(buildPhotoStoryHtml(trip, stats, legRoutes, photoBase64s));
    },
    [legRoutes, trip],
  );

  const handlePhotoStoryRendered = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      const data = event.nativeEvent.data;
      setPhotoStoryHtml(null);

      if (data.startsWith('data:image')) {
        try {
          const base64 = data.split(',')[1];
          const fileUri = (FileSystem.cacheDirectory ?? '') + 'travel-mapping-story.jpg';
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'image/jpeg',
              dialogTitle: trip?.title,
            });
          } else {
            Alert.alert('Sharing not available', 'This device does not support image sharing.');
          }
        } catch (err) {
          Alert.alert(
            'Could not generate story image',
            err instanceof Error ? err.message : 'Please try again.',
          );
        }
      } else {
        Alert.alert('Could not render story image', data.replace('error:', ''));
      }

      setIsGeneratingPhotoStory(false);
    },
    [trip],
  );

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
        <Pressable
          style={[styles.photoStoryButton, isGeneratingPhotoStory && styles.buttonDisabled]}
          disabled={isGeneratingPhotoStory}
          onPress={handleOpenPhotoPicker}>
          <Ionicons name="images-outline" size={18} color={TravelColors.primary} />
          <Text style={styles.photoStoryButtonText}>
            {isGeneratingPhotoStory ? 'Building photo story…' : 'Share as photo story'}
          </Text>
        </Pressable>
        <Pressable style={styles.shareButton} onPress={() => void handleShare()}>
          <Ionicons name="share-outline" size={18} color="#ffffff" />
          <Text style={styles.shareButtonText}>Share as text</Text>
        </Pressable>
      </View>

      {photoStoryHtml ? (
        <View style={styles.hiddenRenderer}>
          <WebView
            source={{ html: photoStoryHtml }}
            onMessage={handlePhotoStoryRendered}
            style={styles.hiddenWebView}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        </View>
      ) : null}

      <PhotoPickerModal
        memories={pickerMemories}
        visible={isPhotoPickerOpen}
        onConfirm={(uris) => void handlePickerConfirm(uris)}
        onCancel={() => setIsPhotoPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function PhotoPickerModal({
  memories,
  visible,
  onConfirm,
  onCancel,
}: {
  memories: PickerMemory[];
  visible: boolean;
  onConfirm(selectedUris: string[]): void;
  onCancel(): void;
}) {
  const [selectedUris, setSelectedUris] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelectedUris([]);
  }, [visible]);

  const toggle = (uri: string) => {
    setSelectedUris((prev) => {
      if (prev.includes(uri)) return prev.filter((u) => u !== uri);
      if (prev.length >= 4) return prev;
      return [...prev, uri];
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={pickerStyles.backdrop}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <View style={pickerStyles.headerCopy}>
              <Text style={pickerStyles.title}>Choose photos</Text>
              <Text style={pickerStyles.subtitle}>
                {selectedUris.length === 0
                  ? 'Select up to 4 for your story'
                  : `${selectedUris.length} of 4 selected`}
              </Text>
            </View>
            <Pressable style={pickerStyles.closeButton} onPress={onCancel}>
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={pickerStyles.grid}>
            {memories.map((mem) => {
              const orderIndex = selectedUris.indexOf(mem.imageUri);
              const isSelected = orderIndex !== -1;
              const isDisabled = !isSelected && selectedUris.length >= 4;

              return (
                <Pressable
                  key={mem.id}
                  style={[
                    pickerStyles.thumb,
                    isSelected && pickerStyles.thumbSelected,
                    isDisabled && pickerStyles.thumbDisabled,
                  ]}
                  onPress={() => toggle(mem.imageUri)}>
                  <Image source={{ uri: mem.imageUri }} style={pickerStyles.thumbImage} />
                  {isSelected ? (
                    <View style={pickerStyles.orderBadge}>
                      <Text style={pickerStyles.orderBadgeText}>{orderIndex + 1}</Text>
                    </View>
                  ) : null}
                  <Text style={pickerStyles.thumbLabel} numberOfLines={1}>
                    {mem.stopLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={pickerStyles.footer}>
            <Pressable
              style={[pickerStyles.confirmButton, selectedUris.length === 0 && pickerStyles.confirmDisabled]}
              disabled={selectedUris.length === 0}
              onPress={() => onConfirm(selectedUris)}>
              <Ionicons name="images-outline" size={18} color="#ffffff" />
              <Text style={pickerStyles.confirmText}>
                {selectedUris.length === 0 ? 'Select photos first' : 'Create story'}
              </Text>
            </Pressable>
          </View>
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
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
  },
  photoStoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  photoStoryButtonText: {
    color: TravelColors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  hiddenRenderer: {
    position: 'absolute',
    left: -1200,
    top: -2100,
    width: 1080,
    height: 1920,
  },
  hiddenWebView: {
    flex: 1,
  },
});

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,23,34,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: TravelColors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: TravelColors.secondaryText,
    fontSize: 13,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  thumb: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'transparent',
    backgroundColor: TravelColors.tintSurface,
    position: 'relative',
  },
  thumbSelected: {
    borderColor: TravelColors.primary,
  },
  thumbDisabled: {
    opacity: 0.4,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  orderBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: TravelColors.primary,
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
