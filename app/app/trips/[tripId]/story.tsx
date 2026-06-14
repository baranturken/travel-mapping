import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';
import { TripStoryCard } from '@/features/trips/components/trip-story-card';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';
import { formatTripDateRange } from '@/features/trips/mappers';
import { getOsrmProfile } from '@/features/trips/routing/osrm-route-fetcher';
import { buildRouteCacheKey, getCachedRoute } from '@/features/trips/routing/route-cache';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import { buildStaticRouteMapUrl } from '@/features/trips/geoapify-map';
import { computeTripStats, formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripDetail } from '@/features/trips/types';
import {
  buildPhotoStoryHtml,
  DEFAULT_ROUTE_POSITION,
  TEMPLATE_PHOTO_LIMITS,
  type PhotoCropParams,
  type RoutePosition,
  type StoryTemplate,
} from '@/features/trips/photo-story-renderer';

type PickerMemory = {
  id: string;
  stopLabel: string;
  imageUri: string;
};

const TEMPLATE_META: {
  key: StoryTemplate;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  {
    key: 'navy',
    label: 'Classic',
    icon: 'albums-outline',
    description: '',
  },
  {
    key: 'journey',
    label: 'Journey',
    icon: 'map-outline',
    description:
      'Full-bleed photo background with a floating route map card and stop list. Best with at least one photo selected.',
  },
  {
    key: 'filmstrip',
    label: 'Film',
    icon: 'film-outline',
    description:
      'Vertical film strip on the left with your photos, trip stats and route minimap on the right.',
  },
  {
    key: 'minimal',
    label: 'Minimal',
    icon: 'document-text-outline',
    description:
      'Clean, light editorial layout with elegant typography, a photo strip and a large route card.',
  },
  {
    key: 'sunset',
    label: 'Sunset',
    icon: 'sunny-outline',
    description:
      'Warm sunset gradient with tilted polaroid-style photos and a glowing route card.',
  },
  {
    key: 'passport',
    label: 'Boarding Pass',
    icon: 'airplane-outline',
    description:
      'Retro boarding-pass ticket with an itinerary manifest, route stamp, photo strip and barcode.',
  },
];

// injectedJavaScript is executed by react-native-webview AFTER the
// ReactNativeWebView bridge is injected — this guarantees the bridge
// exists when runStoryCanvas calls postMessage.
const TRIGGER_JS =
  'if(window.runStoryCanvas){window.runStoryCanvas().catch(function(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage("error:"+String(e));});}true;';

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
  const [showRoute, setShowRoute] = useState(true);
  // Geoapify static-map URL framing the visited cities; drawn into the route
  // card by the renderer. Synchronous — no network call here.
  const mapUrl = useMemo(() => (trip ? buildStaticRouteMapUrl(trip.stops) : null), [trip]);

  // Photo picker state
  const [pickerMemories, setPickerMemories] = useState<PickerMemory[]>([]);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  // Crop flow state
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [cropCurrentIndex, setCropCurrentIndex] = useState(0);
  const [cropParamsAccumulated, setCropParamsAccumulated] = useState<PhotoCropParams[]>([]);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const [routePosition, setRoutePosition] = useState<RoutePosition>(DEFAULT_ROUTE_POSITION);
  const [storyTemplate, setStoryTemplate] = useState<StoryTemplate>('navy');
  const scrollRef = useRef<ScrollView>(null);

  // Each template declares how many photos it can place (Sunset needs exactly
  // three polaroids; others take up to four). Drives the picker's gating.
  const { min: minPhotos, max: maxPhotos } = TEMPLATE_PHOTO_LIMITS[storyTemplate];

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
              from.latitude, from.longitude, to.latitude, to.longitude, profile,
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

  // Backstop only: the canvas self-posts within ~14 s via its own watchdog, so
  // this should rarely fire. Kept slightly above that to unblock the UI if the
  // WebView itself never loads.
  useEffect(() => {
    if (!isGeneratingPhotoStory) return;
    const timer = setTimeout(() => {
      setIsGeneratingPhotoStory(false);
      setPhotoStoryHtml(null);
      Alert.alert(
        'Story timed out',
        'The story took too long to generate. Try selecting fewer or smaller photos.',
      );
    }, 22000);
    return () => clearTimeout(timer);
  }, [isGeneratingPhotoStory]);

  const hiddenWebViewRef = useRef<WebView>(null);
  const handleHiddenWebViewLoad = useCallback(() => {
    hiddenWebViewRef.current?.injectJavaScript(TRIGGER_JS);
  }, []);

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
      setIsGeneratingPhotoStory(true);
      const stats = computeTripStats(trip, legRoutes);
      setPhotoStoryHtml(buildPhotoStoryHtml(trip, stats, legRoutes, [], { showRoute, routePosition, template: storyTemplate, mapUrl }));
      return;
    }

    setPickerMemories(allMemories);
    setIsPhotoPickerOpen(true);
  }, [isGeneratingPhotoStory, legRoutes, mapUrl, routePosition, showRoute, storyTemplate, trip]);

  const handleShareCardAsImage = useCallback(() => {
    if (!trip || isGeneratingPhotoStory) return;
    setIsGeneratingPhotoStory(true);
    const stats = computeTripStats(trip, legRoutes);
    setPhotoStoryHtml(buildPhotoStoryHtml(trip, stats, legRoutes, [], { showRoute, routePosition, template: storyTemplate, mapUrl }));
  }, [isGeneratingPhotoStory, legRoutes, mapUrl, routePosition, showRoute, storyTemplate, trip]);

  // Called after photo picker confirms URIs — opens crop flow
  const handlePickerConfirm = useCallback((selectedUris: string[]) => {
    setIsPhotoPickerOpen(false);
    if (selectedUris.length === 0) {
      if (!trip) return;
      setIsGeneratingPhotoStory(true);
      const stats = computeTripStats(trip, legRoutes);
      setPhotoStoryHtml(buildPhotoStoryHtml(trip, stats, legRoutes, [], { showRoute, routePosition, template: storyTemplate, mapUrl }));
      return;
    }
    setCropQueue(selectedUris);
    setCropCurrentIndex(0);
    setCropParamsAccumulated(new Array(selectedUris.length).fill(null));
    setIsCropOpen(true);
  }, [legRoutes, mapUrl, routePosition, showRoute, storyTemplate, trip]);

  // Generate story after all crops are decided
  // Crop params are passed to the canvas renderer which applies them via coverImage.
  const generateStory = useCallback(async (uris: string[], params: PhotoCropParams[]) => {
    if (!trip) return;
    setIsGeneratingPhotoStory(true);

    const photoBase64s: string[] = [];
    let firstPhotoError: string | null = null;
    for (const uri of uris) {
      try {
        // Resize to 960px wide before encoding. Camera photos can be 12MP+;
        // the canvas is 1080px wide but photo panels are ≤1080px, so 960px
        // is sufficient and keeps the HTML payload small enough for WKWebView.
        const { uri: jpegUri } = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 960 } }],
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
        );
        const b64 = await FileSystem.readAsStringAsync(jpegUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        photoBase64s.push(b64);
      } catch (err) {
        if (!firstPhotoError) {
          firstPhotoError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    if (uris.length > 0 && photoBase64s.length === 0) {
      setIsGeneratingPhotoStory(false);
      Alert.alert(
        'Could not process photos',
        firstPhotoError ?? 'Check that the app has photo library access and try again.',
      );
      return;
    }

    const stats = computeTripStats(trip, legRoutes);
    setPhotoStoryHtml(
      buildPhotoStoryHtml(trip, stats, legRoutes, photoBase64s, {
        showRoute,
        cropParams: params,
        routePosition,
        template: storyTemplate,
        mapUrl,
      }),
    );
  }, [legRoutes, mapUrl, routePosition, showRoute, storyTemplate, trip]);

  const handleCropConfirm = useCallback((params: PhotoCropParams) => {
    const newParams = cropParamsAccumulated.slice();
    newParams[cropCurrentIndex] = params;
    setCropParamsAccumulated(newParams);
    if (cropCurrentIndex + 1 < cropQueue.length) {
      setCropCurrentIndex((i) => i + 1);
    } else {
      setIsCropOpen(false);
      const finalParams = newParams.map((p) => p ?? { normX: 0, normY: 0, scale: 1 as const });
      void generateStory(cropQueue, finalParams);
    }
  }, [cropCurrentIndex, cropParamsAccumulated, cropQueue, generateStory]);

  const handleCropSkip = useCallback(() => {
    handleCropConfirm({ normX: 0, normY: 0, scale: 1 });
  }, [handleCropConfirm]);

  const handleCropPrevious = useCallback(() => {
    if (cropCurrentIndex > 0) setCropCurrentIndex((i) => i - 1);
  }, [cropCurrentIndex]);

  const handleCropSkipAll = useCallback(() => {
    setIsCropOpen(false);
    void generateStory(cropQueue, []);
  }, [cropQueue, generateStory]);

  const handleCropCancel = useCallback(() => {
    setIsCropOpen(false);
    setCropQueue([]);
    setCropCurrentIndex(0);
    setCropParamsAccumulated([]);
  }, []);

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

  const { bottom: bottomInset } = useSafeAreaInsets();

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
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <Stack.Screen options={{ title: trip.title }} />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 260 + bottomInset }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={TravelColors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        {storyTemplate === 'navy' ? (
          <View style={styles.cardWrap}>
            <TripStoryCard trip={trip} legRoutes={legRoutes} />
          </View>
        ) : (
          <View style={styles.templatePreviewCard}>
            <View style={styles.templatePreviewIcon}>
              <Ionicons
                name={TEMPLATE_META.find((t) => t.key === storyTemplate)?.icon ?? 'image-outline'}
                size={32}
                color={TravelColors.primary}
              />
            </View>
            <Text style={styles.templatePreviewTitle}>
              {TEMPLATE_META.find((t) => t.key === storyTemplate)?.label}
            </Text>
            <Text style={styles.templatePreviewBody}>
              {TEMPLATE_META.find((t) => t.key === storyTemplate)?.description}
            </Text>
          </View>
        )}

        {showRoute && storyTemplate === 'navy' ? (
          <RoutePositionPicker
            routePosition={routePosition}
            onPositionChange={setRoutePosition}
            onReset={() => setRoutePosition(DEFAULT_ROUTE_POSITION)}
            onDragStart={() => scrollRef.current?.setNativeProps({ scrollEnabled: false })}
            onDragEnd={() => scrollRef.current?.setNativeProps({ scrollEnabled: true })}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + bottomInset }]}>
        <View style={styles.templateRow}>
          <Text style={styles.routeToggleLabel}>Story template</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.templateChips}
            contentContainerStyle={styles.templateChipsContent}
          >
            {TEMPLATE_META.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.templateChip, storyTemplate === t.key && styles.templateChipActive]}
                onPress={() => setStoryTemplate(t.key)}>
                <Ionicons
                  name={t.icon}
                  size={13}
                  color={storyTemplate === t.key ? '#ffffff' : TravelColors.primary}
                />
                <Text style={[styles.templateChipText, storyTemplate === t.key && styles.templateChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.routeToggleRow}>
          <Text style={styles.routeToggleLabel}>Include route drawing</Text>
          <Pressable
            style={[styles.routeToggle, showRoute && styles.routeToggleActive]}
            onPress={() => setShowRoute((v) => !v)}>
            <Text style={[styles.routeToggleText, showRoute && styles.routeToggleTextActive]}>
              {showRoute ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.photoStoryButton, isGeneratingPhotoStory && styles.buttonDisabled]}
          disabled={isGeneratingPhotoStory}
          onPress={handleOpenPhotoPicker}>
          {isGeneratingPhotoStory ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="images-outline" size={18} color="#ffffff" />
          )}
          <Text style={styles.photoStoryButtonText}>
            {isGeneratingPhotoStory ? 'Building collage…' : 'Share as photo collage'}
          </Text>
        </Pressable>
        <View style={styles.secondaryButtonRow}>
          <Pressable
            style={[styles.cardImageButton, isGeneratingPhotoStory && styles.buttonDisabled]}
            disabled={isGeneratingPhotoStory}
            onPress={handleShareCardAsImage}>
            {isGeneratingPhotoStory ? (
              <ActivityIndicator size="small" color={TravelColors.primary} />
            ) : (
              <Ionicons name="card-outline" size={16} color={TravelColors.primary} />
            )}
            <Text style={styles.cardImageButtonText}>Card only</Text>
          </Pressable>
          <Pressable style={styles.shareButton} onPress={() => void handleShare()}>
            <Ionicons name="text-outline" size={16} color={TravelColors.primary} />
            <Text style={styles.shareButtonText}>Share as text</Text>
          </Pressable>
        </View>
      </View>

      {photoStoryHtml ? (
        <View style={styles.hiddenRenderer}>
          <WebView
            ref={hiddenWebViewRef}
            source={{ html: photoStoryHtml }}
            onLoadEnd={handleHiddenWebViewLoad}
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
        minPhotos={minPhotos}
        maxPhotos={maxPhotos}
        onConfirm={handlePickerConfirm}
        onCancel={() => setIsPhotoPickerOpen(false)}
      />

      {isCropOpen && cropQueue[cropCurrentIndex] ? (
        <CropModal
          uri={cropQueue[cropCurrentIndex]}
          photoNumber={cropCurrentIndex + 1}
          totalPhotos={cropQueue.length}
          initialCrop={cropParamsAccumulated[cropCurrentIndex] ?? undefined}
          onConfirm={handleCropConfirm}
          onSkipThis={handleCropSkip}
          onSkipAll={handleCropSkipAll}
          onCancel={handleCropCancel}
          onPrevious={cropCurrentIndex > 0 ? handleCropPrevious : undefined}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── Photo picker ──────────────────────────────────────────────────────────────

function PhotoPickerModal({
  memories,
  visible,
  minPhotos,
  maxPhotos,
  onConfirm,
  onCancel,
}: {
  memories: PickerMemory[];
  visible: boolean;
  minPhotos: number;
  maxPhotos: number;
  onConfirm(selectedUris: string[]): void;
  onCancel(): void;
}) {
  const [selectedUris, setSelectedUris] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelectedUris([]);
  }, [visible]);

  // If the template's limit shrinks (e.g. switching to Sunset), trim selection.
  useEffect(() => {
    setSelectedUris((prev) => (prev.length > maxPhotos ? prev.slice(0, maxPhotos) : prev));
  }, [maxPhotos]);

  const exactCount = minPhotos === maxPhotos ? maxPhotos : null;
  const meetsMinimum = selectedUris.length >= minPhotos && selectedUris.length > 0;
  const canConfirm = meetsMinimum;
  // Templates that require photos (min > 0) shouldn't offer "share without photos".
  const allowSkip = minPhotos === 0;

  const subtitle = exactCount
    ? `${selectedUris.length} of ${exactCount} selected — this template needs exactly ${exactCount}`
    : selectedUris.length === 0
      ? `Select up to ${maxPhotos} for your story`
      : `${selectedUris.length} of ${maxPhotos} selected`;

  const toggle = (uri: string) => {
    setSelectedUris((prev) => {
      if (prev.includes(uri)) return prev.filter((u) => u !== uri);
      if (prev.length >= maxPhotos) return prev;
      return [...prev, uri];
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={pickerStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <View style={pickerStyles.headerCopy}>
              <Text style={pickerStyles.title}>Choose photos</Text>
              <Text style={pickerStyles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable style={pickerStyles.closeButton} onPress={onCancel}>
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={pickerStyles.grid}>
            {memories.map((mem) => {
              const orderIndex = selectedUris.indexOf(mem.imageUri);
              const isSelected = orderIndex !== -1;
              const isDisabled = !isSelected && selectedUris.length >= maxPhotos;

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
              style={[pickerStyles.confirmButton, !canConfirm && pickerStyles.confirmDisabled]}
              disabled={!canConfirm}
              onPress={() => onConfirm(selectedUris)}>
              <Ionicons name="images-outline" size={18} color="#ffffff" />
              <Text style={pickerStyles.confirmText}>
                {selectedUris.length === 0
                  ? 'Select photos first'
                  : exactCount && selectedUris.length < exactCount
                    ? `Select ${exactCount - selectedUris.length} more`
                    : 'Crop & create story'}
              </Text>
            </Pressable>
            {allowSkip ? (
              <Pressable style={pickerStyles.skipButton} onPress={() => onConfirm([])}>
                <Text style={pickerStyles.skipText}>Share without photos</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Crop modal ────────────────────────────────────────────────────────────────

const CROP_FRAME = 296;

function CropModal({
  uri,
  photoNumber,
  totalPhotos,
  initialCrop,
  onConfirm,
  onSkipThis,
  onSkipAll,
  onCancel,
  onPrevious,
}: {
  uri: string;
  photoNumber: number;
  totalPhotos: number;
  initialCrop?: PhotoCropParams;
  onConfirm(params: PhotoCropParams): void;
  onSkipThis(): void;
  onSkipAll(): void;
  onCancel(): void;
  onPrevious?(): void;
}) {
  const [cropState, setCropState] = useState<PhotoCropParams>(initialCrop ?? { normX: 0, normY: 0, scale: 1 });
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const cropRef = useRef(cropState);
  cropRef.current = cropState;
  const overflowRef = useRef({ x: 0, y: 0 });
  const panBase = useRef({ normX: 0, normY: 0, gDx: 0, gDy: 0 });
  const pinchRef = useRef<{ baseDist: number; baseScale: number } | null>(null);

  useEffect(() => {
    // The modal stays mounted across photos, so reset crop state + reload the
    // image size whenever the photo (uri) changes.
    setCropState(initialCrop ?? { normX: 0, normY: 0, scale: 1 });
    setImgNaturalSize(null);
    Image.getSize(uri, (w, h) => setImgNaturalSize({ w, h }), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  useEffect(() => {
    if (!imgNaturalSize) return;
    const coverBase = Math.max(CROP_FRAME / imgNaturalSize.w, CROP_FRAME / imgNaturalSize.h);
    const s = coverBase * cropState.scale;
    const dw = imgNaturalSize.w * s;
    const dh = imgNaturalSize.h * s;
    overflowRef.current = {
      x: Math.max(0, dw - CROP_FRAME),
      y: Math.max(0, dh - CROP_FRAME),
    };
  }, [imgNaturalSize, cropState.scale]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        pinchRef.current = null;
        panBase.current = {
          normX: cropRef.current.normX,
          normY: cropRef.current.normY,
          gDx: 0,
          gDy: 0,
        };
        // If gesture starts with 2 fingers, initialise pinch immediately
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          pinchRef.current = { baseDist: dist, baseScale: cropRef.current.scale };
        }
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          if (!pinchRef.current) {
            // Second finger added mid-gesture — start pinch from current state
            pinchRef.current = { baseDist: dist, baseScale: cropRef.current.scale };
            panBase.current = { normX: cropRef.current.normX, normY: cropRef.current.normY, gDx: g.dx, gDy: g.dy };
          } else {
            const newScale = Math.max(1, Math.min(3, pinchRef.current.baseScale * (dist / pinchRef.current.baseDist)));
            setCropState((prev) => ({ ...prev, scale: newScale, normX: 0, normY: 0 }));
          }
        } else {
          if (pinchRef.current) {
            // Finger lifted — reset pan base from current position so there's no jump
            pinchRef.current = null;
            panBase.current = { normX: cropRef.current.normX, normY: cropRef.current.normY, gDx: g.dx, gDy: g.dy };
            return;
          }
          const ox = overflowRef.current.x;
          const oy = overflowRef.current.y;
          const rdx = g.dx - panBase.current.gDx;
          const rdy = g.dy - panBase.current.gDy;
          setCropState((prev) => ({
            ...prev,
            normX: ox > 0 ? Math.max(-0.5, Math.min(0.5, panBase.current.normX + rdx / ox)) : 0,
            normY: oy > 0 ? Math.max(-0.5, Math.min(0.5, panBase.current.normY + rdy / oy)) : 0,
          }));
        }
      },
      onPanResponderRelease: () => { pinchRef.current = null; },
      onPanResponderTerminate: () => { pinchRef.current = null; },
    }),
  ).current;

  const displayMetrics = useMemo(() => {
    if (!imgNaturalSize) return null;
    const coverBase = Math.max(CROP_FRAME / imgNaturalSize.w, CROP_FRAME / imgNaturalSize.h);
    const s = coverBase * cropState.scale;
    const dw = imgNaturalSize.w * s;
    const dh = imgNaturalSize.h * s;
    const ox = Math.max(0, dw - CROP_FRAME);
    const oy = Math.max(0, dh - CROP_FRAME);
    return {
      left: (CROP_FRAME - dw) / 2 + cropState.normX * ox,
      top: (CROP_FRAME - dh) / 2 + cropState.normY * oy,
      width: dw,
      height: dh,
    };
  }, [imgNaturalSize, cropState]);

  const adjustScale = (delta: number) => {
    setCropState((prev) => ({
      normX: 0,
      normY: 0,
      scale: Math.max(1, Math.min(3, prev.scale + delta)),
    }));
  };

  // Swipe the top handle down to dismiss the sheet.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const dismissPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 70) onCancelRef.current();
      },
    }),
  ).current;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={cropStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
        <View style={cropStyles.sheet}>
          <View style={cropStyles.handleArea} {...dismissPan.panHandlers}>
            <View style={cropStyles.handleBar} />
          </View>
          <View style={cropStyles.header}>
            <Pressable
              style={cropStyles.cancelButton}
              onPress={onCancel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
            <View style={cropStyles.headerCopy}>
              <Text style={cropStyles.title}>Crop photo {photoNumber} of {totalPhotos}</Text>
              <Text style={cropStyles.subtitle}>Drag to reposition · Pinch or +/− to zoom</Text>
            </View>
            {totalPhotos > 1 ? (
              <Pressable onPress={onSkipAll} hitSlop={8}>
                <Text style={cropStyles.skipAllText}>Skip all</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={cropStyles.frameArea}>
            <View
              style={[cropStyles.frame, { width: CROP_FRAME, height: CROP_FRAME }]}
              {...panResponder.panHandlers}>
              {displayMetrics ? (
                <Image
                  source={{ uri }}
                  style={{
                    position: 'absolute',
                    width: displayMetrics.width,
                    height: displayMetrics.height,
                    left: displayMetrics.left,
                    top: displayMetrics.top,
                  }}
                  resizeMode="stretch"
                />
              ) : (
                <ActivityIndicator color={TravelColors.primary} />
              )}
              {/* Corner guide marks */}
              <View style={[cropStyles.corner, cropStyles.cornerTL]} />
              <View style={[cropStyles.corner, cropStyles.cornerTR]} />
              <View style={[cropStyles.corner, cropStyles.cornerBL]} />
              <View style={[cropStyles.corner, cropStyles.cornerBR]} />
            </View>
          </View>

          <View style={cropStyles.zoomRow}>
            <Pressable style={cropStyles.zoomButton} onPress={() => adjustScale(-0.15)}>
              <Ionicons name="remove" size={22} color={TravelColors.primary} />
            </Pressable>
            <Text style={cropStyles.zoomLabel}>{Math.round(cropState.scale * 100)}%</Text>
            <Pressable style={cropStyles.zoomButton} onPress={() => adjustScale(0.15)}>
              <Ionicons name="add" size={22} color={TravelColors.primary} />
            </Pressable>
          </View>

          <View style={cropStyles.footer}>
            {onPrevious ? (
              <Pressable style={cropStyles.prevButton} onPress={onPrevious}>
                <Ionicons name="arrow-back" size={16} color={TravelColors.primary} />
                <Text style={cropStyles.prevText}>Back</Text>
              </Pressable>
            ) : (
              <Pressable style={cropStyles.skipButton} onPress={onSkipThis}>
                <Text style={cropStyles.skipText}>No crop</Text>
              </Pressable>
            )}
            <View style={cropStyles.footerRight}>
              {onPrevious ? (
                <Pressable style={cropStyles.skipButton} onPress={onSkipThis}>
                  <Text style={cropStyles.skipText}>No crop</Text>
                </Pressable>
              ) : null}
              <Pressable style={cropStyles.confirmButton} onPress={() => onConfirm(cropState)}>
                <Text style={cropStyles.confirmText}>
                  {photoNumber < totalPhotos ? `Next →` : 'Create story'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Route position picker ─────────────────────────────────────────────────────

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const MAP_SIZE = 380;
const PREV_SCALE = 135 / CANVAS_W; // ≈ 0.125 — each canvas pixel = 0.125 preview pixels
const PREV_W = 135;
const PREV_H = Math.round(CANVAS_H * PREV_SCALE); // 240
const IND_SIZE = Math.round(MAP_SIZE * PREV_SCALE); // 48
const PHOTO_AREA_PREV_H = Math.round(850 * PREV_SCALE); // 106 — tint height for photo zone

function RoutePositionPicker({
  routePosition,
  onPositionChange,
  onReset,
  onDragStart,
  onDragEnd,
}: {
  routePosition: RoutePosition;
  onPositionChange(pos: RoutePosition): void;
  onReset(): void;
  onDragStart?(): void;
  onDragEnd?(): void;
}) {
  const basePos = useRef<RoutePosition>({ x: 0, y: 0 });
  // Keep latest callbacks in refs so the closure created once in useRef always calls the current version
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        onDragStartRef.current?.();
        const lx = evt.nativeEvent.locationX;
        const ly = evt.nativeEvent.locationY;
        const newPos = {
          x: Math.round(Math.max(0, Math.min(CANVAS_W - MAP_SIZE, lx / PREV_SCALE - MAP_SIZE / 2))),
          y: Math.round(Math.max(0, Math.min(CANVAS_H - MAP_SIZE, ly / PREV_SCALE - MAP_SIZE / 2))),
        };
        basePos.current = newPos;
        onPositionChangeRef.current(newPos);
      },
      onPanResponderMove: (_, g) => {
        onPositionChangeRef.current({
          x: Math.round(Math.max(0, Math.min(CANVAS_W - MAP_SIZE, basePos.current.x + g.dx / PREV_SCALE))),
          y: Math.round(Math.max(0, Math.min(CANVAS_H - MAP_SIZE, basePos.current.y + g.dy / PREV_SCALE))),
        });
      },
      onPanResponderRelease: () => { onDragEndRef.current?.(); },
      onPanResponderTerminate: () => { onDragEndRef.current?.(); },
    }),
  ).current;

  // Clamp display coords so indicator is always fully visible within preview bounds
  const indLeft = Math.max(0, Math.min(PREV_W - IND_SIZE, routePosition.x * PREV_SCALE));
  const indTop = Math.max(0, Math.min(PREV_H - IND_SIZE, routePosition.y * PREV_SCALE));

  return (
    <View style={rpStyles.container}>
      <View style={rpStyles.titleRow}>
        <Text style={rpStyles.label}>Route position</Text>
        <Pressable onPress={onReset} hitSlop={8}>
          <Text style={rpStyles.resetText}>Reset</Text>
        </Pressable>
      </View>
      <Text style={rpStyles.hint}>Tap or drag anywhere in the preview to reposition the route drawing</Text>
      <View
        style={[rpStyles.preview, { width: PREV_W, height: PREV_H }]}
        {...panResponder.panHandlers}
      >
        <View style={[rpStyles.photoAreaTint, { height: PHOTO_AREA_PREV_H }]} />
        <View
          style={[rpStyles.indicator, { width: IND_SIZE, height: IND_SIZE, left: indLeft, top: indTop }]}
          pointerEvents="none"
        >
          <Ionicons name="map-outline" size={Math.round(IND_SIZE * 0.55)} color="#74c0fc" />
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, alignItems: 'center' },
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
  backButtonText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  cardWrap: { paddingVertical: 12, alignItems: 'center' },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: { color: TravelColors.mutedText, fontSize: 14 },
  emptyTitle: { color: TravelColors.text, fontSize: 20, fontWeight: '700' },
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
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
  },
  routeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  routeToggleLabel: { color: TravelColors.secondaryText, fontSize: 13, fontWeight: '600' },
  routeToggle: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  routeToggleActive: {
    backgroundColor: TravelColors.primary,
    borderColor: TravelColors.primary,
  },
  routeToggleText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
  routeToggleTextActive: { color: '#ffffff' },
  photoStoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 15,
    backgroundColor: TravelColors.primary,
  },
  photoStoryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardImageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  cardImageButtonText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  shareButtonText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  templatePreviewCard: {
    width: 340,
    borderRadius: 28,
    padding: 28,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    alignItems: 'center',
    gap: 14,
  },
  templatePreviewIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  templatePreviewTitle: {
    color: TravelColors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  templatePreviewBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  hiddenRenderer: { position: 'absolute', left: -1200, top: -2100, width: 1080, height: 1920 },
  hiddenWebView: { flex: 1 },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  templateChips: {
    flexShrink: 1,
  },
  templateChipsContent: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  templateChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  templateChipActive: {
    backgroundColor: TravelColors.primary,
    borderColor: TravelColors.primary,
  },
  templateChipText: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  templateChipTextActive: {
    color: '#ffffff',
  },
});

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,23,34,0.55)', justifyContent: 'flex-end' },
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
  headerCopy: { flex: 1, gap: 2 },
  title: { color: TravelColors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: TravelColors.secondaryText, fontSize: 13 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
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
  thumbSelected: { borderColor: TravelColors.primary },
  thumbDisabled: { opacity: 0.4 },
  thumbImage: { width: '100%', height: '100%' },
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
  orderBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
    gap: 4,
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
  confirmDisabled: { opacity: 0.45 },
  confirmText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  skipButton: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: TravelColors.secondaryText, fontSize: 13, fontWeight: '600' },
});

const cropStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,30,0.82)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 8,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: TravelColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  cancelButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: TravelColors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: TravelColors.secondaryText, fontSize: 13 },
  skipAllText: { color: TravelColors.primary, fontSize: 14, fontWeight: '600' },
  frameArea: { alignItems: 'center', paddingVertical: 24 },
  frame: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    opacity: 0.9,
  },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 4 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 4 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 4 },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 4,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  zoomLabel: { color: TravelColors.text, fontSize: 15, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  footerRight: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: TravelColors.tintSurface,
  },
  prevText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: TravelColors.tintSurface,
  },
  skipText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: TravelColors.primary,
  },
  confirmText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});

const rpStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resetText: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: TravelColors.mutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  preview: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0d1e35',
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    position: 'relative',
  },
  photoAreaTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  indicator: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#74c0fc',
    backgroundColor: 'rgba(116,192,252,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
