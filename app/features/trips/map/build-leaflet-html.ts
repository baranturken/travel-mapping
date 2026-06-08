import type { RouteCoordinate } from '@/features/trips/routing/osrm-route-fetcher';
import { getAccommodationDisplay, getTransportDisplay, type TripDetail } from '@/features/trips/types';

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildLeafletHtml(
  trip: TripDetail,
  routeGeometries?: Record<string, RouteCoordinate[]>,
) {
  const stopLookup = Object.fromEntries(trip.stops.map((stop) => [stop.id, stop]));

  const mapPayload = {
    title: trip.title,
    routeGeometries: routeGeometries ?? {},
    stops: trip.stops.map((stop) => {
      const hasAccommodation = Boolean(stop.accommodationName?.trim() || stop.accommodationType);
      const accommodation = hasAccommodation
        ? getAccommodationDisplay(stop.accommodationType, stop.accommodationName)
        : null;

      const locatedMemories = stop.memories
        .filter((m) => m.latitude !== null && m.longitude !== null)
        .map((m) => ({ lat: m.latitude!, lon: m.longitude!, caption: m.caption ?? '' }));

      return {
        id: stop.id,
        cityName: stop.cityName,
        countryName: stop.countryName,
        isHomeBase: stop.isHomeBase,
        stayLabel: stop.stayLabel,
        latitude: stop.latitude,
        longitude: stop.longitude,
        placeTitles: stop.places.slice(0, 3).map((place) => place.title),
        accommodationLabel: accommodation?.label ?? null,
        accommodationEmoji: accommodation?.emoji ?? null,
        accommodationNote: stop.accommodationNote,
        memoryCount: stop.memories.length,
        locatedMemories,
      };
    }),
    legs: trip.legs
      .map((leg) => {
        const from = stopLookup[leg.fromStopId];
        const to = stopLookup[leg.toStopId];

        if (!from || !to) {
          return null;
        }

        const transport = getTransportDisplay(leg.transportType, leg.transportLabel);

        return {
          id: leg.id,
          orderIndex: leg.orderIndex,
          transportType: leg.transportType,
          from,
          to,
          transportLabel: transport.label,
          transportEmoji: transport.emoji,
          dashed: transport.dashed,
        };
      })
      .filter(Boolean),
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; margin: 0; }
      body { font-family: Arial, sans-serif; background: #f6fbff; }

      .transport-chip {
        align-items: center;
        background: rgba(255,255,255,0.95);
        border-radius: 999px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        color: #15304b;
        display: inline-flex;
        font-size: 11px;
        font-weight: 700;
        gap: 5px;
        padding: 3px 9px 3px 3px;
        white-space: nowrap;
        border: 1.5px solid;
      }

      .transport-icon {
        align-items: center;
        border-radius: 999px;
        display: inline-flex;
        flex-shrink: 0;
        font-size: 11px;
        height: 20px;
        justify-content: center;
        line-height: 1;
        width: 20px;
      }

      .stop-dot {
        align-items: center;
        background: #1f5ea8;
        border: 2.5px solid #fff;
        border-radius: 999px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        color: white;
        display: flex;
        font-size: 11px;
        font-weight: 800;
        height: 26px;
        justify-content: center;
        width: 26px;
      }

      .stop-dot.home-base {
        background: #f59f00;
      }

      .memory-pin {
        align-items: center;
        background: #7950f2;
        border: 2px solid #fff;
        border-radius: 999px;
        box-shadow: 0 1px 5px rgba(0,0,0,0.25);
        color: white;
        display: flex;
        font-size: 9px;
        height: 18px;
        justify-content: center;
        width: 18px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const trip = ${serializeForInlineScript(mapPayload)};
      const routeGeometries = trip.routeGeometries;

      // Per-transport visual config
      const TRANSPORT_STYLE = {
        plane:      { color: '#4dabf7', dashArray: '12 7', weight: 3, chipBorder: '#74c0fc', iconBg: '#e7f5ff' },
        ferry:      { color: '#0ca678', dashArray: '8 5',  weight: 3.5, chipBorder: '#63e6be', iconBg: '#e6fcf5' },
        train:      { color: '#f76707', dashArray: null,   weight: 3.5, chipBorder: '#ffa94d', iconBg: '#fff4e6' },
        bus:        { color: '#7950f2', dashArray: null,   weight: 3.5, chipBorder: '#b197fc', iconBg: '#f3f0ff' },
        car:        { color: '#1c7ed6', dashArray: null,   weight: 3.5, chipBorder: '#74c0fc', iconBg: '#e7f5ff' },
        motorcycle: { color: '#1971c2', dashArray: null,   weight: 3,   chipBorder: '#74c0fc', iconBg: '#e7f5ff' },
        walking:    { color: '#2f9e44', dashArray: '4 7',  weight: 3,   chipBorder: '#8ce99a', iconBg: '#ebfbee' },
        bicycle:    { color: '#5c940d', dashArray: '6 6',  weight: 3,   chipBorder: '#a9e34b', iconBg: '#f4fce3' },
        custom:     { color: '#868e96', dashArray: '8 6',  weight: 3,   chipBorder: '#ced4da', iconBg: '#f8f9fa' },
      };

      function escapeHtml(v) {
        return String(v)
          .replaceAll('&','&amp;').replaceAll('<','&lt;')
          .replaceAll('>','&gt;').replaceAll('"','&quot;')
          .replaceAll("'","&#39;");
      }

      const map = L.map('map', { zoomControl: false, attributionControl: false });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

      const bounds = [];

      // Draw route legs first (below markers)
      trip.legs.forEach((leg) => {
        const style = TRANSPORT_STYLE[leg.transportType] || TRANSPORT_STYLE.custom;
        const routePoints = routeGeometries[leg.id];
        const points = routePoints && routePoints.length >= 2
          ? routePoints
          : [[leg.from.latitude, leg.from.longitude], [leg.to.latitude, leg.to.longitude]];

        L.polyline(points, {
          color: style.color,
          weight: style.weight,
          opacity: 0.9,
          dashArray: style.dashArray || undefined,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);

        // Transport chip at the true geometric midpoint of the polyline
        let midpoint;
        if (points.length <= 2) {
          const p0 = points[0], p1 = points[points.length - 1];
          midpoint = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        } else {
          midpoint = points[Math.floor(points.length / 2)];
        }

        L.marker(midpoint, {
          icon: L.divIcon({
            className: '',
            html: '<div class="transport-chip" style="border-color:' + style.chipBorder + '">' +
              '<span class="transport-icon" style="background:' + style.iconBg + '">' +
              escapeHtml(leg.transportEmoji) + '</span>' +
              '<span>' + escapeHtml(leg.transportLabel) + '</span></div>',
            iconAnchor: [0, 0],
          }),
          zIndexOffset: 100,
        }).addTo(map);
      });

      // Draw stop markers
      trip.stops.forEach((stop, index) => {
        const dotClass = 'stop-dot' + (stop.isHomeBase ? ' home-base' : '');
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: L.divIcon({
            className: '',
            html: '<div class="' + dotClass + '">' + (index + 1) + '</div>',
            iconAnchor: [13, 13],
          }),
          zIndexOffset: 500,
        }).addTo(map);

        let popupHtml = '<strong>' + escapeHtml((index + 1) + '. ' + stop.cityName + ', ' + stop.countryName) + '</strong>';
        if (stop.isHomeBase) popupHtml += '<br/><em>Home base</em>';
        if (stop.stayLabel) popupHtml += '<br/>' + escapeHtml(stop.stayLabel);
        if (stop.accommodationLabel) popupHtml += '<br/>' + escapeHtml(stop.accommodationEmoji + ' ' + stop.accommodationLabel);
        if (stop.accommodationNote) popupHtml += '<br/><small>' + escapeHtml(stop.accommodationNote) + '</small>';
        if (stop.placeTitles.length) popupHtml += '<br/>📍 ' + escapeHtml(stop.placeTitles.join(', '));
        if (stop.memoryCount) popupHtml += '<br/>📷 ' + stop.memoryCount + ' photo' + (stop.memoryCount > 1 ? 's' : '');

        marker.bindPopup(popupHtml);
        bounds.push([stop.latitude, stop.longitude]);

        // Memory photo pins
        stop.locatedMemories.forEach((mem) => {
          const pin = L.marker([mem.lat, mem.lon], {
            icon: L.divIcon({
              className: '',
              html: '<div class="memory-pin">📷</div>',
              iconAnchor: [9, 9],
            }),
            zIndexOffset: 300,
          }).addTo(map);

          if (mem.caption) {
            pin.bindPopup('<small>' + escapeHtml(mem.caption) + '</small>');
          }
        });
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [36, 36] });
      }

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('map-ready');
      }
    </script>
  </body>
</html>`;
}
