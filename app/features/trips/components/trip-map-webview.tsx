import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';
import { buildLeafletHtml } from '@/features/trips/map/build-leaflet-html';
import type { TripDetail } from '@/features/trips/types';

type TripMapWebViewProps = {
  trip: TripDetail;
};

export function TripMapWebView({ trip }: TripMapWebViewProps) {
  const html = useMemo(() => buildLeafletHtml(trip), [trip]);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [showNetworkHint, setShowNetworkHint] = useState(false);
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
        </View>
      )}

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>
          {showFallbackState ? 'Map fallback active' : showSlowLoadNotice ? 'Map still loading' : 'Map note'}
        </Text>
        <Text style={styles.noticeBody}>
          {showFallbackState
            ? 'The itinerary summary below remains available even if the online map assets fail to load.'
            : showSlowLoadNotice
              ? 'The trip is still trying to load map assets. Keep this screen open for a moment before falling back to the itinerary summary.'
              : 'This MVP map uses Leaflet and OpenStreetMap tiles. If the network is weak, the itinerary summary below remains the reliable local fallback.'}
        </Text>
      </View>

      <Text style={styles.attributionText}>Map tiles © OpenStreetMap contributors</Text>
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
