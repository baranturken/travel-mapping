import { getTransportDisplay, type TripDetail } from '@/features/trips/types';

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildLeafletHtml(trip: TripDetail) {
  const stopLookup = Object.fromEntries(trip.stops.map((stop) => [stop.id, stop]));

  const mapPayload = {
    title: trip.title,
    stops: trip.stops,
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
      html, body, #map {
        height: 100%;
        margin: 0;
      }

      body {
        font-family: Arial, sans-serif;
        background: #f6fbff;
      }

      .transport-pill {
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid #c7dbf2;
        border-radius: 999px;
        color: #15304b;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        white-space: nowrap;
        box-shadow: 0 8px 18px rgba(21, 48, 75, 0.1);
      }

      .stop-dot {
        align-items: center;
        background: #1f5ea8;
        border-radius: 999px;
        color: white;
        display: flex;
        font-size: 12px;
        font-weight: 700;
        height: 24px;
        justify-content: center;
        width: 24px;
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

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      const bounds = [];

      trip.stops.forEach((stop, index) => {
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: L.divIcon({
            className: '',
            html: '<div class="stop-dot">' + (index + 1) + '</div>',
            iconAnchor: [12, 12],
          }),
        }).addTo(map);

        const stayLine = stop.stayLabel ? '<br />' + escapeHtml(stop.stayLabel) : '';
        marker.bindPopup(
          '<strong>' +
            escapeHtml((index + 1) + '. ' + stop.cityName + ', ' + stop.countryName) +
            '</strong>' +
            stayLine
        );
        bounds.push([stop.latitude, stop.longitude]);
      });

      trip.legs.forEach((leg) => {
        const points = [
          [leg.from.latitude, leg.from.longitude],
          [leg.to.latitude, leg.to.longitude],
        ];

        L.polyline(points, {
          color: '#1f5ea8',
          weight: 4,
          opacity: 0.85,
          dashArray: leg.dashed ? '10 8' : undefined,
        }).addTo(map);

        const midpoint = [
          (leg.from.latitude + leg.to.latitude) / 2,
          (leg.from.longitude + leg.to.longitude) / 2,
        ];

        L.marker(midpoint, {
          icon: L.divIcon({
            className: '',
            html:
              '<div class="transport-pill">' +
              escapeHtml(leg.transportEmoji + ' ' + leg.transportLabel) +
              '</div>',
          }),
        }).addTo(map);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, {
          padding: [30, 30],
        });
      }

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('map-ready');
      }
    </script>
  </body>
</html>`;
}
