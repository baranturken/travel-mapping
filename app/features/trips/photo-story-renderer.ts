import { formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripStats } from '@/features/trips/trip-stats';
import { getTransportDisplay, type TripDetail } from '@/features/trips/types';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';

function ser(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

type StopEntry = { city: string; country: string; transport: string | null };

function decimateCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const result: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) result.push(coords[i]);
  const last = coords[coords.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

export function buildPhotoStoryHtml(
  trip: TripDetail,
  stats: TripStats,
  legRoutes: Record<string, LegRouteData>,
  photoBase64s: string[],
): string {
  const statItems: string[] = [
    `🌍 ${stats.countryCount} ${stats.countryCount === 1 ? 'country' : 'countries'}`,
    `📍 ${stats.cityCount} ${stats.cityCount === 1 ? 'city' : 'cities'}`,
    ...(stats.dayCount !== null
      ? [`🗓️ ${stats.dayCount} ${stats.dayCount === 1 ? 'day' : 'days'}`]
      : []),
    ...(stats.totalDistanceKm !== null ? [`🛣️ ${formatDistanceKm(stats.totalDistanceKm)}`] : []),
  ];

  const legByFromId = new Map(trip.legs.map((l) => [l.fromStopId, l]));
  const stopEntries: StopEntry[] = trip.stops.map((stop) => {
    const leg = legByFromId.get(stop.id);
    const transport = leg ? getTransportDisplay(leg.transportType, leg.transportLabel) : null;
    return {
      city: stop.cityName,
      country: stop.countryName,
      transport: transport ? `${transport.emoji} ${transport.label}` : null,
    };
  });

  // Build simplified route segments for the minimap
  const stopById = new Map(trip.stops.map((s) => [s.id, s]));
  const routeSegments: [number, number][][] = trip.legs
    .map((leg) => {
      const routeData = legRoutes[leg.id];
      if (routeData && routeData.geometry.length >= 2) {
        return decimateCoords(routeData.geometry as [number, number][], 80);
      }
      const from = stopById.get(leg.fromStopId);
      const to = stopById.get(leg.toStopId);
      if (from && to)
        return [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ] as [number, number][];
      return null;
    })
    .filter((seg): seg is [number, number][] => seg !== null && seg.length >= 2);

  const stopCoords: [number, number][] = trip.stops.map((s) => [s.latitude, s.longitude]);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; }
  body { width: 1080px; height: 1920px; overflow: hidden; background: #0f2540; }
</style>
</head>
<body>
<canvas id="c" width="1080" height="1920"></canvas>
<script>
(async function () {
  const PHOTOS  = ${ser(photoBase64s)};
  const TITLE   = ${ser(trip.title)};
  const STATS   = ${ser(statItems)};
  const STOPS   = ${ser(stopEntries)};
  const ROUTE_SEGS   = ${ser(routeSegments)};
  const STOP_COORDS  = ${ser(stopCoords)};

  const canvas = document.getElementById('c');
  const ctx    = canvas.getContext('2d');
  const W = 1080, H = 1920;
  const BG = '#0f2540';

  const PHOTO_H   = PHOTOS.length ? 1090 : 300;
  const INFO_Y    = PHOTO_H;
  const INFO_H    = H - INFO_Y;

  // ── helpers ──────────────────────────────────────────────────────────

  function clipRect(x, y, w, h, fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function coverImage(img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width  * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function wrapText(text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' ');
    let line = '';
    let lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + lines * lineH);
        lines++;
        if (lines >= maxLines) return lines;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) { ctx.fillText(line, x, y + lines * lineH); lines++; }
    return lines;
  }

  // ── background ───────────────────────────────────────────────────────

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── load photos ──────────────────────────────────────────────────────

  const images = await Promise.all(
    PHOTOS.slice(0, 4).map(
      b64 => new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = 'data:image/jpeg;base64,' + b64;
      }),
    ),
  );
  const valid = images.filter(Boolean);

  // ── photo grid ───────────────────────────────────────────────────────

  const GAP = 6;
  if (valid.length === 1) {
    clipRect(0, 0, W, PHOTO_H, () => coverImage(valid[0], 0, 0, W, PHOTO_H));
  } else if (valid.length === 2) {
    const hw = (W - GAP) / 2;
    clipRect(0,      0, hw, PHOTO_H, () => coverImage(valid[0], 0,      0, hw, PHOTO_H));
    clipRect(hw+GAP, 0, hw, PHOTO_H, () => coverImage(valid[1], hw+GAP, 0, hw, PHOTO_H));
  } else if (valid.length === 3) {
    const hw = (W - GAP) / 2;
    const hh = (PHOTO_H - GAP) / 2;
    clipRect(0,      0,      hw, PHOTO_H, () => coverImage(valid[0], 0,      0,      hw, PHOTO_H));
    clipRect(hw+GAP, 0,      hw, hh,      () => coverImage(valid[1], hw+GAP, 0,      hw, hh));
    clipRect(hw+GAP, hh+GAP, hw, hh,      () => coverImage(valid[2], hw+GAP, hh+GAP, hw, hh));
  } else if (valid.length >= 4) {
    const hw = (W - GAP) / 2;
    const hh = (PHOTO_H - GAP) / 2;
    clipRect(0,      0,      hw, hh, () => coverImage(valid[0], 0,      0,      hw, hh));
    clipRect(hw+GAP, 0,      hw, hh, () => coverImage(valid[1], hw+GAP, 0,      hw, hh));
    clipRect(0,      hh+GAP, hw, hh, () => coverImage(valid[2], 0,      hh+GAP, hw, hh));
    clipRect(hw+GAP, hh+GAP, hw, hh, () => coverImage(valid[3], hw+GAP, hh+GAP, hw, hh));
  }

  // ── photo → info gradient ────────────────────────────────────────────

  if (valid.length) {
    const fadeH = Math.floor(PHOTO_H * 0.55);
    const fadeY = PHOTO_H - fadeH;
    const grad  = ctx.createLinearGradient(0, fadeY, 0, PHOTO_H);
    grad.addColorStop(0, 'rgba(15,37,64,0)');
    grad.addColorStop(1, 'rgba(15,37,64,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, fadeY, W, fadeH);
  }

  // ── route minimap ────────────────────────────────────────────────────

  if (ROUTE_SEGS.length > 0) {
    const MAP_W = 310, MAP_H = 310, MAP_PAD = 24;
    const MAP_X = W - MAP_W - 52;
    const MAP_Y = 52;

    // Collect bounds via loop (spread on large arrays risks stack overflow)
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    for (const seg of ROUTE_SEGS) {
      for (const [lat, lon] of seg) {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      }
    }
    const latRange = maxLat - minLat || 0.01;
    const lonRange = maxLon - minLon || 0.01;
    const innerW = MAP_W - MAP_PAD * 2;
    const innerH = MAP_H - MAP_PAD * 2;

    // Preserve aspect ratio
    const scaleRaw = Math.min(innerW / lonRange, innerH / latRange);
    const drawW = lonRange * scaleRaw;
    const drawH = latRange * scaleRaw;
    const offX  = MAP_X + MAP_PAD + (innerW - drawW) / 2;
    const offY  = MAP_Y + MAP_PAD + (innerH - drawH) / 2;

    const scaleX = (lon) => offX + (lon - minLon) / lonRange * drawW;
    const scaleY = (lat) => offY + drawH - (lat - minLat) / latRange * drawH;

    // Three-pass route rendering — dark outline → mid halo → bright fill
    // (same technique as subtitle text: dark outside, bright inside)
    const passes = [
      { width: 14, style: 'rgba(2, 8, 20, 0.85)' },
      { width: 9,  style: 'rgba(15, 60, 120, 0.6)' },
      { width: 4,  style: '#74c0fc' },
    ];
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    for (const { width, style } of passes) {
      ctx.strokeStyle = style;
      ctx.lineWidth   = width;
      for (const seg of ROUTE_SEGS) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(scaleX(seg[0][1]), scaleY(seg[0][0]));
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(scaleX(seg[i][1]), scaleY(seg[i][0]));
        }
        ctx.stroke();
      }
    }

    // Stop dots — dark ring → white ring → blue centre
    for (const [lat, lon] of STOP_COORDS) {
      const cx = scaleX(lon), cy = scaleY(lat);
      ctx.fillStyle = 'rgba(2,8,20,0.85)';
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4dabf7';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── info area ────────────────────────────────────────────────────────

  ctx.fillStyle = BG;
  ctx.fillRect(0, INFO_Y, W, INFO_H);

  let y = INFO_Y + 58;
  const PAD = 72;

  // eyebrow
  ctx.font        = 'bold 28px sans-serif';
  ctx.fillStyle   = 'rgba(127,180,240,0.85)';
  ctx.letterSpacing = '3px';
  ctx.fillText('✈  TRAVEL MAPPING', PAD, y);
  ctx.letterSpacing = '0px';
  y += 20;

  // title
  ctx.font      = 'bold 86px sans-serif';
  ctx.fillStyle = '#ffffff';
  const titleLines = wrapText(TITLE, PAD, y + 84, W - PAD * 2, 100, 2);
  y += 84 + titleLines * 100 + 28;

  // stat pills
  ctx.font = 'bold 33px sans-serif';
  let sx = PAD;
  for (const stat of STATS) {
    const tw  = ctx.measureText(stat).width;
    const ph  = 48, pr = 24, pv = 8;
    const pw  = tw + pr * 2;
    if (sx + pw > W - PAD) break;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(sx, y - ph + pv, pw, ph, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stat, sx + pr, y);
    sx += pw + 16;
  }
  y += 72;

  // divider
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
  y += 40;

  // route stops
  const maxVisible = Math.min(STOPS.length, 4);
  for (let i = 0; i < maxVisible; i++) {
    const stop = STOPS[i];

    // badge
    ctx.fillStyle = '#2f6db8';
    ctx.beginPath();
    ctx.arc(PAD + 20, y + 8, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 24px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(String(i + 1), PAD + 20, y + 18);
    ctx.textAlign   = 'left';

    // city + country
    ctx.font      = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stop.city, PAD + 58, y + 10);
    ctx.font      = '29px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(stop.country, PAD + 58, y + 48);
    y += 86;

    // connector + transport label
    if (stop.transport && i < maxVisible - 1) {
      ctx.fillStyle = 'rgba(127,180,240,0.35)';
      ctx.fillRect(PAD + 18, y - 4, 4, 30);
      ctx.font      = 'bold 28px sans-serif';
      ctx.fillStyle = '#7fb4f0';
      ctx.fillText(stop.transport, PAD + 46, y + 22);
      y += 52;
    }
  }

  if (STOPS.length > 4) {
    ctx.font      = '28px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('+' + (STOPS.length - 4) + ' more stops', PAD + 58, y + 8);
  }

  // watermark — bottom-right
  ctx.font      = '24px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.textAlign = 'right';
  ctx.fillText('Made with Travel Mapping', W - PAD, H - 72);
  ctx.textAlign = 'left';

  // ── export ───────────────────────────────────────────────────────────

  let payload;
  try {
    payload = canvas.toDataURL('image/jpeg', 0.88);
  } catch (err) {
    payload = 'error:' + String(err);
  }

  // Poll until the RN WebView bridge is injected — fast renders finish
  // before the bridge is ready, causing postMessage to silently fail.
  (function send(retries) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (retries > 0) {
      setTimeout(() => send(retries - 1), 80);
    }
  })(40); // up to ~3.2 s
})();
</script>
</body>
</html>`;
}
