import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';
import type { StopSummary } from '@/features/social/types';

function ser(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildSharedTripMapHtml(stops: StopSummary[]): string {
  const points = stops.map((s, i) => ({
    lat: s.latitude,
    lon: s.longitude,
    city: s.cityName,
    country: s.countryName,
    isHomeBase: s.isHomeBase,
    order: i + 1,
  }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
    .stop-marker {
      background: #2f6db8;
      color: #fff;
      border: 2.5px solid #fff;
      border-radius: 50%;
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      font: 700 12px/1 sans-serif;
      box-shadow: 0 1px 5px rgba(0,0,0,0.4);
    }
    .stop-marker.home { background: #11833b; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""></script>
  <script>
    const POINTS = ${ser(points)};
    const map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

    const latlngs = POINTS.map(p => [p.lat, p.lon]);
    if (latlngs.length >= 2) {
      L.polyline(latlngs, { color: '#1d4f8c', weight: 4.5, opacity: 0.35 }).addTo(map);
      L.polyline(latlngs, { color: '#2f6db8', weight: 2.5, opacity: 0.95 }).addTo(map);
    }

    POINTS.forEach(p => {
      const icon = L.divIcon({
        className: '',
        html: '<div class="stop-marker' + (p.isHomeBase ? ' home' : '') + '">' + (p.isHomeBase ? '🏠' : p.order) + '</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([p.lat, p.lon], { icon })
        .addTo(map)
        .bindPopup('<b>' + p.city + '</b><br>' + p.country);
    });

    if (latlngs.length > 0) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [36, 36] });
    } else {
      map.setView([30, 10], 2);
    }
  </script>
</body>
</html>`;
}

export function SharedTripMap({ stops }: { stops: StopSummary[] }) {
  const html = useMemo(() => buildSharedTripMapHtml(stops), [stops]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: TravelColors.border,
    backgroundColor: TravelColors.tintSurface,
  },
  webview: { flex: 1 },
});
