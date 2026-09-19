import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSQLiteContext } from 'expo-sqlite';

import { MapExpandButton, MapFullscreenModal } from '@/components/map-fullscreen-modal';
import { TravelColors } from '@/constants/theme';
import { buildLeafletHtml } from '@/features/trips/map/build-leaflet-html';
import {
  fetchOsrmRoute,
  getOsrmProfile,
  type RouteCoordinate,
} from '@/features/trips/routing/osrm-route-fetcher';
import {
  buildRouteCacheKey,
  getCachedRoute,
  setCachedRoute,
  type CachedRoute,
} from '@/features/trips/routing/route-cache';
import type { TripDetail } from '@/features/trips/types';

export type LegRouteData = {
  geometry: RouteCoordinate[];
  distanceMeters: number | null;
  durationSeconds: number | null;
};

type TripMapWebViewProps = {
  trip: TripDetail;
  onRoutesLoaded?: (routes: Record<string, LegRouteData>) => void;
};

export function TripMapWebView({ trip, onRoutesLoaded }: TripMapWebViewProps) {
  const db = useSQLiteContext();
  const [routeGeometries, setRouteGeometries] = useState<Record<string, RouteCoordinate[]>>({});
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchAbortRef.current?.abort();
    const abort = new AbortController();
    fetchAbortRef.current = abort;

    const stopLookup = Object.fromEntries(trip.stops.map((s) => [s.id, s]));
    const routableLegs = trip.legs.filter((leg) => getOsrmProfile(leg.transportType) !== null);

    if (routableLegs.length === 0) return;

    setIsRoutingLoading(true);

    void (async () => {
      const geometryResult: Record<string, RouteCoordinate[]> = {};
      const fullResult: Record<string, LegRouteData> = {};

      await Promise.all(
        routableLegs.map(async (leg) => {
          if (abort.signal.aborted) return;

          const from = stopLookup[leg.fromStopId];
          const to = stopLookup[leg.toStopId];
          if (!from || !to) return;

          const profile = getOsrmProfile(leg.transportType)!;
          const cacheKey = buildRouteCacheKey(
            from.latitude,
            from.longitude,
            to.latitude,
            to.longitude,
            profile,
          );

          let cached: CachedRoute | null = await getCachedRoute(db, cacheKey);

          if (!cached && !abort.signal.aborted) {
            const fetched = await fetchOsrmRoute(
              from.latitude,
              from.longitude,
              to.latitude,
              to.longitude,
              profile,
            );

            if (fetched && !abort.signal.aborted) {
              await setCachedRoute(db, cacheKey, profile, 'osrm', fetched);
              cached = {
                geometry: fetched.geometry,
                distanceMeters: fetched.distanceMeters,
                durationSeconds: fetched.durationSeconds,
              };
            }
          }

          if (cached && !abort.signal.aborted) {
            geometryResult[leg.id] = cached.geometry;
            fullResult[leg.id] = {
              geometry: cached.geometry,
              distanceMeters: cached.distanceMeters,
              durationSeconds: cached.durationSeconds,
            };
          }
        }),
      );

      if (!abort.signal.aborted) {
        setRouteGeometries(geometryResult);
        setIsRoutingLoading(false);
        onRoutesLoaded?.(fullResult);
      }
    })();

    return () => abort.abort();
  }, [db, trip.id, trip.legs, trip.stops, onRoutesLoaded]);

  const html = useMemo(
    () => buildLeafletHtml(trip, routeGeometries),
    [trip, routeGeometries],
  );

  const [hasLoadError, setHasLoadError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [showNetworkHint, setShowNetworkHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const showFallbackState = hasLoadError;
  const showSlowLoadNotice = showNetworkHint && !isMapReady && !hasLoadError;

  useEffect(() => {
    setHasLoadError(false);
    setIsMapReady(false);
    setShowNetworkHint(false);

    const timeoutId = setTimeout(() => {
      setShowNetworkHint(true);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [trip.id, html]);

  return (
    <View style={styles.stack}>
      {showFallbackState ? (
        <View style={[styles.container, styles.fallbackState]}>
          <Text style={styles.fallbackTitle}>Map unavailable right now</Text>
          <Text style={styles.fallbackBody}>
            Your trip is still saved locally. The itinerary summary below remains available even if
            the WebView could not load the online map assets right now.
          </Text>
        </View>
      ) : (
        <View style={styles.container}>
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.webview}
            startInLoadingState
            setSupportMultipleWindows={false}
            onError={() => setHasLoadError(true)}
            onHttpError={() => setHasLoadError(true)}
            onMessage={(event) => {
              if (event.nativeEvent.data === 'map-ready') {
                setIsMapReady(true);
                setShowNetworkHint(false);
              }
            }}
          />
          <MapExpandButton onPress={() => setIsFullscreen(true)} />
        </View>
      )}

      <MapFullscreenModal
        visible={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        html={html}
        title={trip.title}
      />

      {(showFallbackState || showSlowLoadNotice || isRoutingLoading) ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            {showFallbackState
              ? 'Map unavailable'
              : showSlowLoadNotice
                ? 'Map still loading'
                : 'Fetching routes…'}
          </Text>
          <Text style={styles.noticeBody}>
            {showFallbackState
              ? 'Could not load map tiles. Your trip is still saved — the itinerary summary below remains available.'
              : showSlowLoadNotice
                ? 'Map tiles are still loading. Keep this screen open for a moment or check your connection.'
                : 'Loading real road and path routes from OpenStreetMap. The map updates automatically when ready.'}
          </Text>
        </View>
      ) : null}

      <Text style={styles.attributionText}>Map: © OpenStreetMap contributors · Routes: OSRM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: TravelColors.border,
    backgroundColor: TravelColors.surface,
    minHeight: 360,
  },
  webview: {
    flex: 1,
    minHeight: 360,
    backgroundColor: TravelColors.surface,
  },
  fallbackState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  fallbackTitle: {
    color: TravelColors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  fallbackBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  noticeCard: {
    borderRadius: 18,
    backgroundColor: TravelColors.tintSurface,
    padding: 14,
    gap: 4,
  },
  noticeTitle: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  attributionText: {
    color: TravelColors.mutedText,
    fontSize: 12,
    textAlign: 'right',
  },
});
