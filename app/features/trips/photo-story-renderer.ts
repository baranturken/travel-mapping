import { formatTripDateRange } from '@/features/trips/mappers';
import { formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripStats } from '@/features/trips/trip-stats';
import { getTransportDisplay, type TripDetail } from '@/features/trips/types';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';

export type PhotoCropParams = {
  normX: number;
  normY: number;
  scale: number;
};

export type RoutePosition = { x: number; y: number };

// Bottom-right of the canvas, opposite the stop list (which is left-aligned).
export const DEFAULT_ROUTE_POSITION: RoutePosition = {
  x: 1080 - 380 - 52,
  y: 1340,
};

export type StoryTemplate = 'navy' | 'journey' | 'filmstrip' | 'minimal' | 'sunset' | 'passport';

// How many photos each template is designed to display. `min` gates the photo
// picker (Sunset needs exactly 3 polaroids to look right); `max` caps both the
// picker selection and how many photos the canvas decodes. This is the single
// source of truth shared by the renderer and the photo picker UI.
export const TEMPLATE_PHOTO_LIMITS: Record<StoryTemplate, { min: number; max: number }> = {
  navy: { min: 0, max: 4 },
  journey: { min: 1, max: 4 },
  filmstrip: { min: 0, max: 4 },
  minimal: { min: 1, max: 4 },
  sunset: { min: 3, max: 3 },
  passport: { min: 0, max: 4 },
};

type StoryOptions = {
  showRoute?: boolean;
  cropParams?: PhotoCropParams[];
  routePosition?: RoutePosition;
  template?: StoryTemplate;
  // URL of a real basemap (Geoapify static map) framing the visited cities.
  // When provided, the route card shows this cropped map instead of drawn lines.
  // Loaded with crossOrigin=anonymous (Geoapify sends ACAO:*) so the canvas
  // stays exportable.
  mapUrl?: string | null;
};

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
  options?: StoryOptions,
): string {
  const showRoute = options?.showRoute ?? true;
  const cropParams = options?.cropParams ?? [];
  const template = options?.template ?? 'navy';
  const mapUrl = showRoute ? options?.mapUrl ?? null : null;
  // Never decode more photos than the template can place (also a safety net if
  // a caller forgets to cap the selection upstream).
  const maxPhotos = TEMPLATE_PHOTO_LIMITS[template].max;
  const photos = photoBase64s.slice(0, maxPhotos);

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

  type RouteSegment = { coords: [number, number][]; ferry: boolean };
  const stopById = new Map(trip.stops.map((s) => [s.id, s]));
  const routeSegments: RouteSegment[] = trip.legs
    .map((leg): RouteSegment | null => {
      const isFerry = leg.transportType === 'ferry';
      const routeData = legRoutes[leg.id];
      if (routeData && routeData.geometry.length >= 2) {
        return { coords: decimateCoords(routeData.geometry as [number, number][], 80), ferry: false };
      }
      const from = stopById.get(leg.fromStopId);
      const to = stopById.get(leg.toStopId);
      if (from && to)
        return {
          coords: [[from.latitude, from.longitude], [to.latitude, to.longitude]] as [number, number][],
          ferry: isFerry,
        };
      return null;
    })
    .filter((seg): seg is RouteSegment => seg !== null && seg.coords.length >= 2);

  const stopCoords: [number, number][] = trip.stops.map((s) => [s.latitude, s.longitude]);
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);

  const mapX = Math.round(options?.routePosition?.x ?? DEFAULT_ROUTE_POSITION.x);
  const mapY = Math.round(options?.routePosition?.y ?? DEFAULT_ROUTE_POSITION.y);

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
window.runStoryCanvas = async function() {
  // Idempotency guard — the canvas must only render once even if both the
  // in-HTML auto-trigger and the React Native injected trigger fire.
  if (window.__storyCanvasStarted) return;
  window.__storyCanvasStarted = true;

  // Single-post guard + watchdog. The hidden WebView renders off-screen, where
  // requestAnimationFrame can be paused (e.g. while the crop modal is still
  // animating out). setTimeout keeps firing, so a watchdog guarantees we always
  // post back within a bounded time — turning a silent 30s+ hang into either an
  // image or a precise 'error:watchdog:<stage>' that names where it stalled.
  var __stage = 'init';
  function post(msg) {
    if (window.__storyPosted) return;
    window.__storyPosted = true;
    clearTimeout(window.__storyWatchdog);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }
  window.__storyWatchdog = setTimeout(function () {
    post('error:watchdog:' + __stage);
  }, 14000);

  // A frame tick that resolves on the next animation frame OR after a short
  // timeout — so the export never blocks when rAF is paused off-screen.
  function nextFrame() {
    return new Promise(function (resolve) {
      var done = false;
      function fire() { if (!done) { done = true; resolve(); } }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fire);
      setTimeout(fire, 120);
    });
  }

  try {
  const PHOTOS      = ${ser(photos)};
  const TITLE       = ${ser(trip.title)};
  const STATS       = ${ser(statItems)};
  const STOPS       = ${ser(stopEntries)};
  const ROUTE_SEGS  = ${ser(showRoute ? routeSegments : [])};
  const STOP_COORDS = ${ser(showRoute ? stopCoords : [])};
  const CROP_PARAMS = ${ser(cropParams)};
  const DATE_RANGE  = ${ser(dateRange)};
  const TEMPLATE    = ${ser(template)};
  const MAP_URL     = ${ser(mapUrl ?? '')};

  const canvas = document.getElementById('c');
  const ctx    = canvas.getContext('2d');
  const W = 1080, H = 1920;
  const BG = '#0f2540';

  // ── helpers ──────────────────────────────────────────────────────────

  function clipRect(x, y, w, h, fn) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    fn();
    ctx.restore();
  }

  function coverImage(img, x, y, w, h, normX, normY, scale) {
    normX = normX || 0; normY = normY || 0; scale = scale || 1;
    const base = Math.max(w / img.width, h / img.height) * scale;
    const dw = img.width * base, dh = img.height * base;
    const overflowX = dw - w, overflowY = dh - h;
    ctx.drawImage(img,
      x + (w - dw) / 2 + normX * overflowX,
      y + (h - dh) / 2 + normY * overflowY,
      dw, dh);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function wrapText(text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' ');
    let line = '', lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + lines * lineH);
        lines++;
        if (lines >= maxLines) return lines;
        line = word;
      } else { line = test; }
    }
    if (line) { ctx.fillText(line, x, y + lines * lineH); lines++; }
    return lines;
  }

  function getCrop(idx) {
    const c = CROP_PARAMS[idx];
    return c ? c : { normX: 0, normY: 0, scale: 1 };
  }

  // Shared route minimap renderer — draw on any region of the canvas.
  function drawRoute(mapX, mapY, mapW, mapH, pad, passes, dotOuter, dotInner) {
    if (ROUTE_SEGS.length === 0) return;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const seg of ROUTE_SEGS) {
      for (const [lat, lon] of seg.coords) {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      }
    }
    const latRange = maxLat - minLat || 0.01, lonRange = maxLon - minLon || 0.01;
    const innerW = mapW - pad * 2, innerH = mapH - pad * 2;
    const scaleRaw = Math.min(innerW / lonRange, innerH / latRange);
    const drawW = lonRange * scaleRaw, drawH = latRange * scaleRaw;
    const offX = mapX + pad + (innerW - drawW) / 2;
    const offY = mapY + pad + (innerH - drawH) / 2;
    const scaleX = (lon) => offX + (lon - minLon) / lonRange * drawW;
    const scaleY = (lat) => offY + drawH - (lat - minLat) / latRange * drawH;

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const { width, style } of passes) {
      ctx.strokeStyle = style; ctx.lineWidth = width;
      for (const seg of ROUTE_SEGS) {
        if (seg.coords.length < 2) continue;
        if (seg.ferry && seg.coords.length === 2) {
          const x1 = scaleX(seg.coords[0][1]), y1 = scaleY(seg.coords[0][0]);
          const x2 = scaleX(seg.coords[1][1]), y2 = scaleY(seg.coords[1][0]);
          const mx = (x1+x2)/2, my = (y1+y2)/2, dx = x2-x1, dy = y2-y1;
          const dash = Math.max(4, width * 2);
          ctx.setLineDash([dash, dash]);
          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx - dy*0.28, my + dx*0.28, x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.beginPath();
          ctx.moveTo(scaleX(seg.coords[0][1]), scaleY(seg.coords[0][0]));
          for (let i = 1; i < seg.coords.length; i++) {
            ctx.lineTo(scaleX(seg.coords[i][1]), scaleY(seg.coords[i][0]));
          }
          ctx.stroke();
        }
      }
    }
    for (const [lat, lon] of STOP_COORDS) {
      const cx = scaleX(lon), cy = scaleY(lat);
      ctx.fillStyle = dotOuter;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = dotInner;
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI*2); ctx.fill();
    }
  }

  // Cover-fit the Geoapify basemap into a rounded card. Returns true when it
  // actually painted (MAP_IMG loaded), so each template can fall back to its
  // drawn polyline when the map is unavailable.
  function drawBasemap(x, y, w, h, r) {
    if (!MAP_IMG) return false;
    ctx.save();
    roundRect(x, y, w, h, r); ctx.clip();
    coverImage(MAP_IMG, x, y, w, h, 0, 0, 1);
    ctx.restore();
    return true;
  }

  // ── background ───────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── load photos ──────────────────────────────────────────────────────
  // One shared deadline across all photos: whatever has decoded by then is used,
  // so a single slow/broken image can't stall the whole story.
  __stage = 'photos';
  const photoDeadline = new Promise(resolve => setTimeout(() => resolve('deadline'), 9000));
  const images = await Promise.all(
    PHOTOS.slice(0, ${maxPhotos}).map((b64, origIdx) => Promise.race([
      new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve({ img, origIdx });
        img.onerror = () => resolve(null);
        img.src = 'data:image/jpeg;base64,' + b64;
      }),
      photoDeadline.then(() => null),
    ])),
  );
  const validEntries = images.filter(Boolean);
  const valid = validEntries.map(e => e.img);

  // ── load route basemap (optional) ────────────────────────────────────
  // Every template paints this Geoapify basemap into its route card (falling
  // back to the drawn polyline if it fails to load). Bounded by a timeout so a
  // slow/blocked map never stalls the whole story. Geoapify sends
  // access-control-allow-origin:* and we request it with crossOrigin=anonymous,
  // so the canvas stays exportable (toDataURL won't taint).
  __stage = 'map';
  let MAP_IMG = null;
  if (MAP_URL) {
    MAP_IMG = await new Promise(resolve => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      const t = setTimeout(() => resolve(null), 6000);
      im.onload  = () => { clearTimeout(t); resolve(im); };
      im.onerror = () => { clearTimeout(t); resolve(null); };
      im.src = MAP_URL;
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: NAVY (classic)
  // ════════════════════════════════════════════════════════════════════
  if (TEMPLATE === 'navy') {
    const PHOTO_H = PHOTOS.length ? 850 : 300;
    const INFO_Y  = PHOTO_H;
    const GAP = 6;

    if (valid.length === 1) {
      const c = getCrop(validEntries[0].origIdx);
      clipRect(0, 0, W, PHOTO_H, () => coverImage(valid[0], 0, 0, W, PHOTO_H, c.normX, c.normY, c.scale));
    } else if (valid.length === 2) {
      const hw = (W - GAP) / 2;
      const c0 = getCrop(validEntries[0].origIdx), c1 = getCrop(validEntries[1].origIdx);
      clipRect(0,      0, hw, PHOTO_H, () => coverImage(valid[0], 0,      0, hw, PHOTO_H, c0.normX, c0.normY, c0.scale));
      clipRect(hw+GAP, 0, hw, PHOTO_H, () => coverImage(valid[1], hw+GAP, 0, hw, PHOTO_H, c1.normX, c1.normY, c1.scale));
    } else if (valid.length === 3) {
      const hw = (W - GAP) / 2, hh = (PHOTO_H - GAP) / 2;
      const c0 = getCrop(validEntries[0].origIdx), c1 = getCrop(validEntries[1].origIdx), c2 = getCrop(validEntries[2].origIdx);
      clipRect(0,      0,      hw, PHOTO_H, () => coverImage(valid[0], 0,      0,      hw, PHOTO_H, c0.normX, c0.normY, c0.scale));
      clipRect(hw+GAP, 0,      hw, hh,      () => coverImage(valid[1], hw+GAP, 0,      hw, hh,      c1.normX, c1.normY, c1.scale));
      clipRect(hw+GAP, hh+GAP, hw, hh,      () => coverImage(valid[2], hw+GAP, hh+GAP, hw, hh,      c2.normX, c2.normY, c2.scale));
    } else if (valid.length >= 4) {
      const hw = (W - GAP) / 2, hh = (PHOTO_H - GAP) / 2;
      const c0 = getCrop(validEntries[0].origIdx), c1 = getCrop(validEntries[1].origIdx);
      const c2 = getCrop(validEntries[2].origIdx), c3 = getCrop(validEntries[3].origIdx);
      clipRect(0,      0,      hw, hh, () => coverImage(valid[0], 0,      0,      hw, hh, c0.normX, c0.normY, c0.scale));
      clipRect(hw+GAP, 0,      hw, hh, () => coverImage(valid[1], hw+GAP, 0,      hw, hh, c1.normX, c1.normY, c1.scale));
      clipRect(0,      hh+GAP, hw, hh, () => coverImage(valid[2], 0,      hh+GAP, hw, hh, c2.normX, c2.normY, c2.scale));
      clipRect(hw+GAP, hh+GAP, hw, hh, () => coverImage(valid[3], hw+GAP, hh+GAP, hw, hh, c3.normX, c3.normY, c3.scale));
    }

    if (valid.length) {
      const fadeH = Math.floor(PHOTO_H * 0.55);
      const fadeY = PHOTO_H - fadeH;
      const grad  = ctx.createLinearGradient(0, fadeY, 0, PHOTO_H);
      grad.addColorStop(0, 'rgba(15,37,64,0)');
      grad.addColorStop(1, 'rgba(15,37,64,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, fadeY, W, fadeH);
    }

    ctx.fillStyle = BG;
    ctx.fillRect(0, INFO_Y, W, H - INFO_Y);

    let y = INFO_Y + 58;
    const PAD = 72;

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = 'rgba(127,180,240,0.85)';
    ctx.letterSpacing = '3px';
    ctx.fillText('✈  TRAVEL MAPPING', PAD, y);
    ctx.letterSpacing = '0px';
    y += 20;

    ctx.font = 'bold 86px sans-serif';
    ctx.fillStyle = '#ffffff';
    const titleLines = wrapText(TITLE, PAD, y + 84, W - PAD * 2, 100, 2);
    y += 84 + titleLines * 100 + 20;

    if (DATE_RANGE) {
      ctx.font = '30px sans-serif';
      ctx.fillStyle = '#7fb4f0';
      ctx.fillText('📅 ' + DATE_RANGE, PAD, y);
      y += 48;
    }

    ctx.font = 'bold 33px sans-serif';
    let sx = PAD;
    for (const stat of STATS) {
      const tw = ctx.measureText(stat).width;
      const ph = 48, pr = 24, pv = 8, pw = tw + pr * 2;
      if (sx + pw > W - PAD) break;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(sx, y - ph + pv, pw, ph, 24);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat, sx + pr, y);
      sx += pw + 16;
    }
    y += 72;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 40;

    {
      const n = STOPS.length;
      const availH = H - 80 - y;
      const idealH = n * 86 + Math.max(0, n - 1) * 52;
      const sc = idealH > availH ? Math.max(0.52, availH / idealH) : 1;
      const rowH = Math.round(86 * sc), conH = Math.round(52 * sc);
      const cityF = Math.max(20, Math.round(38 * sc)), ctryF = Math.max(15, Math.round(29 * sc));
      const dotR = Math.max(12, Math.round(20 * sc));
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        const cy = y + Math.round(rowH * 0.42);
        ctx.fillStyle = '#2f6db8';
        ctx.beginPath(); ctx.arc(PAD + dotR, cy, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(dotR * 1.1) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), PAD + dotR, cy + Math.round(dotR * 0.38));
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + cityF + 'px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stop.city, PAD + dotR * 2 + 14, y + Math.round(rowH * 0.38));
        ctx.font = ctryF + 'px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(stop.country, PAD + dotR * 2 + 14, y + Math.round(rowH * 0.76));
        y += rowH;
        if (stop.transport && i < n - 1) {
          const lineH = Math.max(14, Math.round(conH * 0.55));
          ctx.fillStyle = 'rgba(127,180,240,0.35)';
          ctx.fillRect(PAD + dotR - 2, y - 2, 4, lineH);
          ctx.font = 'bold ' + Math.max(14, Math.round(28 * sc)) + 'px sans-serif';
          ctx.fillStyle = '#7fb4f0';
          ctx.fillText(stop.transport, PAD + dotR * 2 + 14, y + Math.round(conH * 0.6));
          y += conH;
        }
      }
    }

    ctx.font = '24px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'right';
    ctx.fillText('Made with Travel Mapping', W - PAD, H - 72);
    ctx.textAlign = 'left';

    // Route minimap drawn LAST so it always renders on top.
    // Rendered as a frosted-glass card so it reads as a deliberate design
    // element over both photos and the navy background.
    if (ROUTE_SEGS.length > 0 || MAP_IMG) {
      const MAP_W = 380, MAP_H = 380, MAP_PAD = 40;
      const MAP_X = ${mapX};
      const MAP_Y = ${mapY};

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 38;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = 'rgba(7,18,36,0.62)';
      roundRect(MAP_X, MAP_Y, MAP_W, MAP_H, 28); ctx.fill();
      ctx.restore();

      if (MAP_IMG) {
        // Real cropped basemap (its own labels show the visited cities).
        ctx.save();
        roundRect(MAP_X, MAP_Y, MAP_W, MAP_H, 28); ctx.clip();
        coverImage(MAP_IMG, MAP_X, MAP_Y, MAP_W, MAP_H, 0, 0, 1);
        ctx.restore();
      } else {
        // Dot grid inside the card (map-paper effect)
        ctx.save();
        roundRect(MAP_X, MAP_Y, MAP_W, MAP_H, 28); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let gx = MAP_X + 20; gx < MAP_X + MAP_W - 8; gx += 28) {
          for (let gy = MAP_Y + 20; gy < MAP_Y + MAP_H - 8; gy += 28) {
            ctx.beginPath(); ctx.arc(gx, gy, 2, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();

        drawRoute(MAP_X, MAP_Y, MAP_W, MAP_H, MAP_PAD, [
          { width: 11, style: 'rgba(2,8,20,0.7)' },
          { width: 6,  style: 'rgba(30,90,170,0.75)' },
          { width: 3,  style: '#74c0fc' },
        ], 'rgba(2,8,20,0.85)', '#4dabf7');
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      roundRect(MAP_X, MAP_Y, MAP_W, MAP_H, 28); ctx.stroke();

      // Label chip so "ROUTE" stays legible over the map imagery.
      ctx.font = 'bold 19px sans-serif';
      const labelW = ctx.measureText('ROUTE').width + 24;
      ctx.fillStyle = 'rgba(7,18,36,0.66)';
      roundRect(MAP_X + 14, MAP_Y + 14, labelW + 12, 34, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.letterSpacing = '2px';
      ctx.fillText('ROUTE', MAP_X + 26, MAP_Y + 37);
      ctx.letterSpacing = '0px';
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: JOURNEY
  // Full-bleed photo background, title at top, centered route card.
  // ════════════════════════════════════════════════════════════════════
  else if (TEMPLATE === 'journey') {
    const PAD = 72;

    // Background photo (full-bleed)
    if (valid.length > 0) {
      const c = getCrop(validEntries[0].origIdx);
      clipRect(0, 0, W, H, () => coverImage(valid[0], 0, 0, W, H, c.normX, c.normY, c.scale));
    }

    // Top overlay — darker near top for title legibility, fades to clear
    const topFade = ctx.createLinearGradient(0, 0, 0, 940);
    topFade.addColorStop(0, 'rgba(4,12,26,0.92)');
    topFade.addColorStop(0.5, 'rgba(4,12,26,0.38)');
    topFade.addColorStop(1, 'rgba(4,12,26,0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, W, 940);

    // Bottom overlay — fades in for stop list legibility
    const botFade = ctx.createLinearGradient(0, H - 850, 0, H);
    botFade.addColorStop(0, 'rgba(4,12,26,0)');
    botFade.addColorStop(0.28, 'rgba(4,12,26,0.62)');
    botFade.addColorStop(1, 'rgba(4,12,26,0.94)');
    ctx.fillStyle = botFade;
    ctx.fillRect(0, H - 850, W, 850);

    // ── Title section ──
    let y = 108;

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = 'rgba(116,192,252,0.85)';
    ctx.letterSpacing = '4px';
    ctx.fillText('✈  TRAVEL MAPPING', PAD, y);
    ctx.letterSpacing = '0px';
    y += 52;

    ctx.font = 'bold 92px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 6;
    const titleLines = wrapText(TITLE, PAD, y + 88, W - PAD * 2, 104, 2);
    ctx.shadowBlur = 0;
    y += 88 + titleLines * 104 + 22;

    if (DATE_RANGE) {
      ctx.font = '34px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.fillText('📅 ' + DATE_RANGE, PAD, y);
      y += 54;
    }

    if (STOPS.length >= 2) {
      ctx.font = '40px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(STOPS[0].city + ' → ' + STOPS[STOPS.length - 1].city, PAD, y);
      y += 64;
    }

    ctx.font = 'bold 30px sans-serif';
    let sx = PAD;
    for (const stat of STATS) {
      const tw = ctx.measureText(stat).width;
      const ph = 46, pr = 22, pv = 8, pw = tw + pr * 2;
      if (sx + pw > W - PAD) break;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      roundRect(sx, y - ph + pv, pw, ph, 23); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      roundRect(sx, y - ph + pv, pw, ph, 23); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat, sx + pr, y);
      sx += pw + 14;
    }
    y += 52;

    // ── Extra photos ──
    // Journey uses the first photo as the full-bleed background; the remaining
    // selected photos appear here as rounded thumbnails so every picked photo
    // is actually shown (not just the first).
    if (valid.length > 1) {
      const THUMB = 158, TGAP = 16;
      for (let i = 1; i < valid.length; i++) {
        const tx = PAD + (i - 1) * (THUMB + TGAP);
        if (tx + THUMB > W - PAD) break;
        const c = getCrop(validEntries[i].origIdx);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        roundRect(tx, y, THUMB, THUMB, 18); ctx.fill();
        ctx.restore();
        ctx.save();
        roundRect(tx, y, THUMB, THUMB, 18); ctx.clip();
        coverImage(valid[i], tx, y, THUMB, THUMB, c.normX, c.normY, c.scale);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        roundRect(tx, y, THUMB, THUMB, 18); ctx.stroke();
      }
      y += THUMB + 40;
    }

    // ── Route card (white sticker floating over photo) ──
    if (ROUTE_SEGS.length > 0 || MAP_IMG) {
      const MC_SIZE = 580;
      const MC_X = (W - MC_SIZE) / 2;
      const MC_Y = Math.max(710, y + 56);

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = '#edf2fa';
      roundRect(MC_X, MC_Y, MC_SIZE, MC_SIZE, 30); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // Prefer the real basemap; fall back to the drawn route + dot grid.
      if (!drawBasemap(MC_X, MC_Y, MC_SIZE, MC_SIZE, 30)) {
        ctx.save();
        roundRect(MC_X, MC_Y, MC_SIZE, MC_SIZE, 30); ctx.clip();

        ctx.fillStyle = '#edf2fa';
        ctx.fillRect(MC_X, MC_Y, MC_SIZE, MC_SIZE);

        // Dot grid (map-paper effect)
        ctx.fillStyle = 'rgba(60,100,165,0.13)';
        for (let gx = MC_X + 22; gx < MC_X + MC_SIZE - 10; gx += 30) {
          for (let gy = MC_Y + 22; gy < MC_Y + MC_SIZE - 10; gy += 30) {
            ctx.beginPath(); ctx.arc(gx, gy, 2.5, 0, Math.PI * 2); ctx.fill();
          }
        }

        drawRoute(MC_X, MC_Y, MC_SIZE, MC_SIZE, 38, [
          { width: 11, style: 'rgba(15,37,64,0.18)' },
          { width: 5.5, style: 'rgba(15,50,110,0.62)' },
          { width: 2.5, style: '#2159a8' },
        ], '#1a4d96', '#2159a8');

        ctx.restore();
      }

      ctx.font = 'bold 21px sans-serif';
      ctx.fillStyle = 'rgba(30,80,165,0.42)';
      ctx.textAlign = 'right';
      ctx.fillText('route map', MC_X + MC_SIZE - 20, MC_Y + MC_SIZE - 20);
      ctx.textAlign = 'left';

      y = MC_Y + MC_SIZE + 50;
    } else {
      y += 80;
    }

    // ── Stop list ──
    {
      const n = STOPS.length;
      const availH = H - 66 - y;
      const idealH = n * 92 + Math.max(0, n - 1) * 40;
      const sc = idealH > availH ? Math.max(0.50, availH / idealH) : 1;
      const rowH = Math.round(92 * sc), conH = Math.round(40 * sc);
      const cardH = Math.round(80 * sc), dotR = Math.round(24 * sc);
      const cityF = Math.max(18, Math.round(35 * sc)), ctryF = Math.max(14, Math.round(27 * sc));
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        roundRect(PAD, y, W - PAD * 2, cardH, Math.round(22 * sc)); ctx.fill();
        ctx.fillStyle = '#2f6db8';
        ctx.beginPath(); ctx.arc(PAD + dotR + 6, y + Math.round(cardH / 2), dotR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(dotR * 0.92) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), PAD + dotR + 6, y + Math.round(cardH / 2) + Math.round(dotR * 0.36));
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + cityF + 'px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stop.city, PAD + dotR * 2 + 20, y + Math.round(cardH * 0.42));
        ctx.font = ctryF + 'px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.fillText(stop.country, PAD + dotR * 2 + 20, y + Math.round(cardH * 0.76));
        y += rowH;
        if (stop.transport && i < n - 1) {
          ctx.font = 'bold ' + Math.max(13, Math.round(25 * sc)) + 'px sans-serif';
          ctx.fillStyle = 'rgba(116,192,252,0.82)';
          ctx.fillText('  ' + stop.transport, PAD + dotR * 2 + 20, y + Math.round(conH * 0.55));
          y += conH;
        }
      }
    }

    ctx.font = '22px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'right';
    ctx.fillText('Made with Travel Mapping', W - PAD, H - 58);
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: FILMSTRIP
  // Left: vertical film strip with photos. Right: trip info panel.
  // ════════════════════════════════════════════════════════════════════
  else if (TEMPLATE === 'filmstrip') {
    const STRIP_W = 292;
    const L = STRIP_W + 32;   // content left on right panel
    const R = W - 28;          // content right
    const CONTENT_W = R - L;

    // Left strip
    ctx.fillStyle = '#060c16';
    ctx.fillRect(0, 0, STRIP_W, H);

    // Right panel gradient
    const panelGrad = ctx.createLinearGradient(STRIP_W, 0, W, H);
    panelGrad.addColorStop(0, '#0a1e3c');
    panelGrad.addColorStop(1, '#0d2c56');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(STRIP_W, 0, W - STRIP_W, H);

    // Soft separator
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(STRIP_W, 0, 1, H);

    // Film frames
    const FRAME_W = 252, FRAME_H = 396;
    const FRAME_X = (STRIP_W - FRAME_W) / 2;
    const FRAME_GAP = 38;
    const totalStrip = 4 * FRAME_H + 3 * FRAME_GAP;
    const frameStartY = (H - totalStrip) / 2;

    for (let i = 0; i < 4; i++) {
      const fy = frameStartY + i * (FRAME_H + FRAME_GAP);
      if (i < valid.length) {
        const c = getCrop(validEntries[i].origIdx);
        clipRect(FRAME_X, fy, FRAME_W, FRAME_H, () =>
          coverImage(valid[i], FRAME_X, fy, FRAME_W, FRAME_H, c.normX, c.normY, c.scale));
        // Subtle vignette on each frame
        const vg = ctx.createLinearGradient(FRAME_X, fy, FRAME_X, fy + FRAME_H);
        vg.addColorStop(0, 'rgba(0,0,0,0.2)');
        vg.addColorStop(0.5, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = vg;
        ctx.fillRect(FRAME_X, fy, FRAME_W, FRAME_H);
      }
      // Frame border
      ctx.strokeStyle = i < valid.length ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(FRAME_X, fy, FRAME_W, FRAME_H);
    }

    // Sprocket holes (film perforations)
    ctx.fillStyle = '#020408';
    for (let sy = 14; sy < H - 6; sy += 68) {
      roundRect(4, sy, 15, 24, 3); ctx.fill();
      roundRect(STRIP_W - 19, sy, 15, 24, 3); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5;
    for (let sy = 14; sy < H - 6; sy += 68) {
      roundRect(4, sy, 15, 24, 3); ctx.stroke();
      roundRect(STRIP_W - 19, sy, 15, 24, 3); ctx.stroke();
    }

    // ── Right panel content ──
    let y = 88;

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = 'rgba(116,192,252,0.8)';
    ctx.letterSpacing = '4px';
    ctx.fillText('✈  TRAVEL MAPPING', L, y);
    ctx.letterSpacing = '0px';
    y += 52;

    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = '#ffffff';
    const titleLines = wrapText(TITLE, L, y + 76, CONTENT_W, 92, 2);
    y += 76 + titleLines * 92 + 20;

    if (DATE_RANGE) {
      ctx.font = '30px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.fillText('📅 ' + DATE_RANGE, L, y);
      y += 48;
    }

    ctx.font = 'bold 27px sans-serif';
    let fsx = L;
    for (const stat of STATS) {
      const tw = ctx.measureText(stat).width;
      const ph = 42, pr = 20, pv = 7, pw = tw + pr * 2;
      if (fsx + pw > R) { fsx = L; y += 52; }
      ctx.fillStyle = 'rgba(255,255,255,0.11)';
      roundRect(fsx, y - ph + pv, pw, ph, 21); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat, fsx + pr, y);
      fsx += pw + 12;
    }
    y += 52;

    // Route minimap on right panel
    const MAP_H_val = Math.min(420, H - y - 510);
    if ((ROUTE_SEGS.length > 0 || MAP_IMG) && MAP_H_val > 80) {
      if (drawBasemap(L, y, CONTENT_W, MAP_H_val, 18)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
        roundRect(L, y, CONTENT_W, MAP_H_val, 18); ctx.stroke();
      } else {
        drawRoute(L, y, CONTENT_W, MAP_H_val, 22, [
          { width: 10, style: 'rgba(2,8,20,0.85)' },
          { width: 5, style: 'rgba(15,60,120,0.6)' },
          { width: 2.5, style: '#74c0fc' },
        ], 'rgba(2,8,20,0.85)', '#4dabf7');
      }
      y += MAP_H_val + 32;
    } else {
      y += 18;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(L, y, CONTENT_W, 1);
    y += 28;

    {
      const n = STOPS.length;
      const availH = H - 66 - y;
      const idealH = n * 76 + Math.max(0, n - 1) * 42;
      const sc = idealH > availH ? Math.max(0.48, availH / idealH) : 1;
      const rowH = Math.round(76 * sc), conH = Math.round(42 * sc);
      const dotR = Math.max(11, Math.round(20 * sc));
      const cityF = Math.max(17, Math.round(34 * sc)), ctryF = Math.max(13, Math.round(26 * sc));
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        const cy = y + Math.round(rowH * 0.38);
        ctx.fillStyle = '#2f6db8';
        ctx.beginPath(); ctx.arc(L + dotR, cy, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(dotR * 0.9) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), L + dotR, cy + Math.round(dotR * 0.35));
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + cityF + 'px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stop.city, L + dotR * 2 + 8, y + Math.round(rowH * 0.35));
        ctx.font = ctryF + 'px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(stop.country, L + dotR * 2 + 8, y + Math.round(rowH * 0.72));
        y += rowH;
        if (stop.transport && i < n - 1) {
          const lineH = Math.round(conH * 0.57);
          ctx.fillStyle = 'rgba(127,180,240,0.35)';
          ctx.fillRect(L + dotR - 1, y - 1, 3, lineH);
          ctx.font = 'bold ' + Math.max(13, Math.round(25 * sc)) + 'px sans-serif';
          ctx.fillStyle = '#7fb4f0';
          ctx.fillText(stop.transport, L + dotR * 2 + 8, y + Math.round(conH * 0.56));
          y += conH;
        }
      }
    }

    ctx.font = '22px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.textAlign = 'right';
    ctx.fillText('Made with Travel Mapping', W - 28, H - 58);
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: MINIMAL
  // Light editorial layout — paper background, serif title, photo strip,
  // large route card, clean numbered stop list.
  // ════════════════════════════════════════════════════════════════════
  else if (TEMPLATE === 'minimal') {
    const PAPER = '#f6f3ee', INK = '#1d2935', SUB = 'rgba(29,41,53,0.55)', ACCENT = '#2159a8';
    const PAD = 84;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    let y = 130;
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = SUB;
    ctx.letterSpacing = '6px';
    ctx.fillText('T R A V E L  M A P P I N G', W / 2, y);
    ctx.letterSpacing = '0px';
    y += 44;

    ctx.fillStyle = ACCENT;
    ctx.fillRect(W / 2 - 30, y, 60, 3);
    y += 66;

    ctx.font = 'bold 84px Georgia, serif';
    ctx.fillStyle = INK;
    {
      const words = TITLE.split(' ');
      let line = '', lines = [];
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > W - PAD * 2 && line) { lines.push(line); line = word; }
        else line = test;
        if (lines.length >= 2) break;
      }
      if (line && lines.length < 2) lines.push(line);
      for (const l of lines) { ctx.fillText(l, W / 2, y); y += 96; }
    }
    y += 4;

    if (DATE_RANGE) {
      ctx.font = 'italic 32px Georgia, serif';
      ctx.fillStyle = SUB;
      ctx.fillText(DATE_RANGE, W / 2, y);
      y += 56;
    }

    ctx.font = '30px sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(STATS.join('   ·   '), W / 2, y);
    ctx.textAlign = 'left';
    y += 52;

    // Photo strip
    if (valid.length > 0) {
      const STRIP_H = 430, GAP = 10;
      const pw = (W - PAD * 2 - GAP * (valid.length - 1)) / valid.length;
      let px = PAD;
      for (let i = 0; i < valid.length; i++) {
        const c = getCrop(validEntries[i].origIdx);
        clipRect(px, y, pw, STRIP_H, () => coverImage(valid[i], px, y, pw, STRIP_H, c.normX, c.normY, c.scale));
        px += pw + GAP;
      }
      y += STRIP_H + 48;
    } else {
      y += 16;
    }

    // Route card
    if (ROUTE_SEGS.length > 0 || MAP_IMG) {
      const MC = 470;
      const MC_X = (W - MC) / 2;
      ctx.fillStyle = '#eee9e0';
      roundRect(MC_X, y, MC, MC, 24); ctx.fill();
      if (!drawBasemap(MC_X, y, MC, MC, 24)) {
        drawRoute(MC_X, y, MC, MC, 42, [
          { width: 10, style: 'rgba(29,41,53,0.10)' },
          { width: 5,  style: 'rgba(33,89,168,0.55)' },
          { width: 2.5, style: ACCENT },
        ], '#1a4d96', ACCENT);
      }
      ctx.strokeStyle = 'rgba(29,41,53,0.16)';
      ctx.lineWidth = 1.5;
      roundRect(MC_X, y, MC, MC, 24); ctx.stroke();
      y += MC + 52;
    }

    // Stop list — clean numbered rows with a left-aligned transport connector
    {
      const n = STOPS.length;
      const hasTransport = STOPS.some((s, i) => s.transport && i < n - 1);
      const availH = H - 120 - y;
      const idealH = n * 70 + (hasTransport ? (n - 1) * 34 : 0);
      const sc = idealH > availH ? Math.max(0.46, availH / idealH) : 1;
      const rowH = Math.round(70 * sc), conH = Math.round(34 * sc);
      const numF = Math.max(15, Math.round(26 * sc)), cityF = Math.max(18, Math.round(36 * sc));
      const ctryF = Math.max(14, Math.round(26 * sc));
      const cityX = PAD + Math.round(66 * Math.max(0.7, sc));
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        const baseY = y + Math.round(rowH * 0.62);
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + numF + 'px sans-serif';
        ctx.fillStyle = ACCENT;
        ctx.fillText(String(i + 1).padStart(2, '0'), PAD, baseY);
        ctx.font = 'bold ' + cityF + 'px Georgia, serif';
        ctx.fillStyle = INK;
        const cityMaxW = W - PAD - cityX;
        ctx.fillText(stop.city, cityX, baseY, cityMaxW);
        const cw = Math.min(ctx.measureText(stop.city).width, cityMaxW);
        ctx.font = ctryF + 'px sans-serif';
        ctx.fillStyle = SUB;
        const ctryX = cityX + cw + 18;
        if (ctryX < W - PAD - 40) {
          ctx.fillText('— ' + stop.country, ctryX, baseY, W - PAD - ctryX);
        }
        y += rowH;
        if (stop.transport && i < n - 1) {
          ctx.strokeStyle = 'rgba(33,89,168,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(PAD + 8, y - Math.round(conH * 0.2));
          ctx.lineTo(PAD + 8, y + Math.round(conH * 0.5));
          ctx.stroke();
          ctx.font = 'bold ' + Math.max(13, Math.round(23 * sc)) + 'px sans-serif';
          ctx.fillStyle = 'rgba(33,89,168,0.7)';
          ctx.fillText(stop.transport, cityX, y + Math.round(conH * 0.5), W - PAD - cityX);
          y += conH;
        }
      }
    }

    ctx.font = '24px sans-serif';
    ctx.fillStyle = 'rgba(29,41,53,0.32)';
    ctx.textAlign = 'center';
    ctx.fillText('Made with Travel Mapping', W / 2, H - 64);
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: SUNSET
  // Warm gradient background, polaroid-style photos, glass route card.
  // ════════════════════════════════════════════════════════════════════
  else if (TEMPLATE === 'sunset') {
    const PAD = 72;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#241139');
    grad.addColorStop(0.45, '#6d2a52');
    grad.addColorStop(0.8, '#c75643');
    grad.addColorStop(1, '#e89254');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Polaroid photos — up to 3, slightly rotated
    if (valid.length > 0) {
      const count = Math.min(3, valid.length);
      const PW = count === 1 ? 560 : 420, PH = PW + 86;
      const angles = [-0.055, 0.045, -0.03];
      const xs = count === 1 ? [(W - PW) / 2]
        : count === 2 ? [W * 0.12, W * 0.5]
        : [W * 0.06, W * 0.37, W * 0.62];
      const ys = count === 1 ? [120] : count === 2 ? [130, 210] : [120, 250, 150];
      for (let i = 0; i < count; i++) {
        const c = getCrop(validEntries[i].origIdx);
        ctx.save();
        ctx.translate(xs[i] + PW / 2, ys[i] + PH / 2);
        ctx.rotate(angles[i]);
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 34;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = '#fdfaf4';
        ctx.fillRect(-PW / 2, -PH / 2, PW, PH);
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        const inner = PW - 36;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-inner / 2, -PH / 2 + 18, inner, inner);
        ctx.clip();
        coverImage(valid[i], -inner / 2, -PH / 2 + 18, inner, inner, c.normX, c.normY, c.scale);
        ctx.restore();
        ctx.restore();
      }
    }

    let y = valid.length > 0 ? 950 : 220;

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = 'rgba(255,225,190,0.85)';
    ctx.letterSpacing = '4px';
    ctx.fillText('✈  TRAVEL MAPPING', PAD, y);
    ctx.letterSpacing = '0px';
    y += 24;

    ctx.font = 'bold 92px sans-serif';
    ctx.fillStyle = '#fff6ec';
    ctx.shadowColor = 'rgba(40,10,30,0.5)';
    ctx.shadowBlur = 8;
    const titleLines = wrapText(TITLE, PAD, y + 88, W - PAD * 2, 104, 2);
    ctx.shadowBlur = 0;
    y += 88 + titleLines * 104 + 18;

    if (DATE_RANGE) {
      ctx.font = '32px sans-serif';
      ctx.fillStyle = 'rgba(255,240,220,0.8)';
      ctx.fillText('📅 ' + DATE_RANGE, PAD, y);
      y += 54;
    }

    ctx.font = 'bold 30px sans-serif';
    let sx = PAD;
    for (const stat of STATS) {
      const tw = ctx.measureText(stat).width;
      const ph = 46, pr = 22, pv = 8, pw = tw + pr * 2;
      if (sx + pw > W - PAD) break;
      ctx.fillStyle = 'rgba(255,250,244,0.16)';
      roundRect(sx, y - ph + pv, pw, ph, 23); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,244,0.35)';
      ctx.lineWidth = 1;
      roundRect(sx, y - ph + pv, pw, ph, 23); ctx.stroke();
      ctx.fillStyle = '#fff6ec';
      ctx.fillText(stat, sx + pr, y);
      sx += pw + 14;
    }
    y += 58;

    // Route — warm glass card on the right; stops on the left
    const listRight = (ROUTE_SEGS.length > 0 || MAP_IMG) ? W - PAD - 360 - 36 : W - PAD;
    if (ROUTE_SEGS.length > 0 || MAP_IMG) {
      const MC = 360, MC_X = W - PAD - MC, MC_Y = y;
      ctx.save();
      ctx.shadowColor = 'rgba(30,8,25,0.5)';
      ctx.shadowBlur = 34;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = 'rgba(40,12,35,0.45)';
      roundRect(MC_X, MC_Y, MC, MC, 26); ctx.fill();
      ctx.restore();
      if (!drawBasemap(MC_X, MC_Y, MC, MC, 26)) {
        drawRoute(MC_X, MC_Y, MC, MC, 38, [
          { width: 10, style: 'rgba(30,8,25,0.6)' },
          { width: 5,  style: 'rgba(255,180,120,0.55)' },
          { width: 2.5, style: '#ffd9a8' },
        ], 'rgba(40,12,35,0.8)', '#ffb066');
      }
      ctx.strokeStyle = 'rgba(255,235,210,0.3)';
      ctx.lineWidth = 1.5;
      roundRect(MC_X, MC_Y, MC, MC, 26); ctx.stroke();
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = 'rgba(255,235,210,0.5)';
      ctx.letterSpacing = '2px';
      ctx.fillText('ROUTE', MC_X + 20, MC_Y + 32);
      ctx.letterSpacing = '0px';
    }

    // Stop list
    {
      const n = STOPS.length;
      const availH = H - 100 - y;
      const idealH = n * 80 + Math.max(0, n - 1) * 38;
      const sc = idealH > availH ? Math.max(0.48, availH / idealH) : 1;
      const rowH = Math.round(80 * sc), conH = Math.round(38 * sc);
      const dotR = Math.max(11, Math.round(19 * sc));
      const cityF = Math.max(17, Math.round(34 * sc)), ctryF = Math.max(13, Math.round(26 * sc));
      const maxW = listRight - PAD - dotR * 2 - 14;
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        const cy = y + Math.round(rowH * 0.42);
        ctx.fillStyle = '#ffb066';
        ctx.beginPath(); ctx.arc(PAD + dotR, cy, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a1228';
        ctx.font = 'bold ' + Math.round(dotR * 1.05) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), PAD + dotR, cy + Math.round(dotR * 0.38));
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + cityF + 'px sans-serif';
        ctx.fillStyle = '#fff6ec';
        ctx.fillText(stop.city, PAD + dotR * 2 + 14, y + Math.round(rowH * 0.38), maxW);
        ctx.font = ctryF + 'px sans-serif';
        ctx.fillStyle = 'rgba(255,240,220,0.6)';
        ctx.fillText(stop.country, PAD + dotR * 2 + 14, y + Math.round(rowH * 0.76), maxW);
        y += rowH;
        if (stop.transport && i < n - 1) {
          ctx.fillStyle = 'rgba(255,217,168,0.4)';
          ctx.fillRect(PAD + dotR - 2, y - 2, 4, Math.round(conH * 0.55));
          ctx.font = 'bold ' + Math.max(13, Math.round(25 * sc)) + 'px sans-serif';
          ctx.fillStyle = 'rgba(255,217,168,0.95)';
          ctx.fillText(stop.transport, PAD + dotR * 2 + 14, y + Math.round(conH * 0.58), maxW);
          y += conH;
        }
      }
    }

    ctx.font = '22px sans-serif';
    ctx.fillStyle = 'rgba(255,246,236,0.35)';
    ctx.textAlign = 'right';
    ctx.fillText('Made with Travel Mapping', W - PAD, H - 56);
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════════════════════
  // TEMPLATE: PASSPORT (boarding pass)
  // Ticket aesthetic — dashed frame, mono type, perforation, barcode.
  // ════════════════════════════════════════════════════════════════════
  else if (TEMPLATE === 'passport') {
    const BG2 = '#10283f', CARD = '#f4efe6', INK = '#22324a', ACCENT = '#b3541e';
    const MONO = '"Courier New", monospace';
    ctx.fillStyle = BG2;
    ctx.fillRect(0, 0, W, H);

    // Ticket card
    const TX = 52, TY = 96, TW = W - 104, TH = H - 192;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = CARD;
    roundRect(TX, TY, TW, TH, 22); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(34,50,74,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    roundRect(TX + 22, TY + 22, TW - 44, TH - 44, 14); ctx.stroke();
    ctx.setLineDash([]);

    const L2 = TX + 64, R2 = TX + TW - 64;
    let y = TY + 130;

    ctx.font = 'bold 30px ' + MONO;
    ctx.fillStyle = ACCENT;
    ctx.fillText('★ TRAVEL MAPPING — BOARDING PASS', L2, y);
    y += 64;

    ctx.font = 'bold 76px ' + MONO;
    ctx.fillStyle = INK;
    const titleLines = wrapText(TITLE.toUpperCase(), L2, y + 70, R2 - L2, 88, 2);
    y += 70 + titleLines * 88 + 8;

    if (DATE_RANGE) {
      ctx.font = '30px ' + MONO;
      ctx.fillStyle = 'rgba(34,50,74,0.65)';
      ctx.fillText('DATE: ' + DATE_RANGE, L2, y);
      y += 50;
    }

    // FROM → TO airport style
    if (STOPS.length >= 2) {
      y += 30;
      const fromCity = STOPS[0].city.slice(0, 12).toUpperCase();
      const toCity = STOPS[STOPS.length - 1].city.slice(0, 12).toUpperCase();
      ctx.font = '26px ' + MONO;
      ctx.fillStyle = 'rgba(34,50,74,0.55)';
      ctx.fillText('FROM', L2, y);
      ctx.textAlign = 'right';
      ctx.fillText('TO', R2, y);
      ctx.textAlign = 'left';
      y += 56;
      ctx.font = 'bold 60px ' + MONO;
      ctx.fillStyle = INK;
      ctx.fillText(fromCity, L2, y);
      ctx.textAlign = 'right';
      ctx.fillText(toCity, R2, y);
      ctx.textAlign = 'left';
      ctx.textAlign = 'center';
      ctx.font = '46px sans-serif';
      ctx.fillStyle = ACCENT;
      ctx.fillText('✈', (L2 + R2) / 2, y - 6);
      ctx.textAlign = 'left';
      y += 44;
    }

    ctx.font = 'bold 27px ' + MONO;
    ctx.fillStyle = 'rgba(34,50,74,0.8)';
    ctx.fillText(STATS.join('  |  '), L2, y);
    y += 36;

    // Perforation divider
    {
      ctx.strokeStyle = 'rgba(34,50,74,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 9]);
      ctx.beginPath();
      ctx.moveTo(TX + 30, y); ctx.lineTo(TX + TW - 30, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = BG2;
      ctx.beginPath(); ctx.arc(TX, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(TX + TW, y, 26, 0, Math.PI * 2); ctx.fill();
      y += 56;
    }

    // Route map + photos row
    const segTop = y;
    const hasRouteCard = ROUTE_SEGS.length > 0 || MAP_IMG;
    if (hasRouteCard) {
      const MC = 350;
      ctx.fillStyle = '#ece5d8';
      roundRect(R2 - MC, segTop, MC, MC, 18); ctx.fill();
      if (!drawBasemap(R2 - MC, segTop, MC, MC, 18)) {
        drawRoute(R2 - MC, segTop, MC, MC, 34, [
          { width: 9, style: 'rgba(34,50,74,0.12)' },
          { width: 4.5, style: 'rgba(179,84,30,0.5)' },
          { width: 2.5, style: ACCENT },
        ], INK, ACCENT);
      }
      ctx.strokeStyle = 'rgba(34,50,74,0.25)';
      ctx.lineWidth = 1.5;
      roundRect(R2 - MC, segTop, MC, MC, 18); ctx.stroke();
    }

    // Stop manifest (left of map)
    {
      const n = STOPS.length;
      const listW = hasRouteCard ? (R2 - L2) - 350 - 40 : R2 - L2;
      const availH = TY + TH - 320 - segTop;
      const idealH = n * 64;
      const sc = idealH > availH ? Math.max(0.5, availH / idealH) : 1;
      const rowH = Math.round(64 * sc);
      const f = Math.max(15, Math.round(28 * sc));
      let ly = segTop + 16;
      ctx.font = 'bold ' + Math.max(16, Math.round(24 * sc)) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(34,50,74,0.5)';
      ctx.fillText('ITINERARY', L2, ly);
      ly += Math.round(rowH * 0.8);
      for (let i = 0; i < n; i++) {
        const stop = STOPS[i];
        ctx.font = 'bold ' + f + 'px ' + MONO;
        ctx.fillStyle = ACCENT;
        ctx.fillText(String(i + 1).padStart(2, '0'), L2, ly);
        ctx.fillStyle = INK;
        ctx.fillText(stop.city.toUpperCase(), L2 + f * 2.2, ly, listW - f * 2.2);
        ly += rowH;
      }
    }

    // Photos strip near bottom
    let stripBottom = TY + TH - 150;
    if (valid.length > 0) {
      const PH2 = 290, GAP = 12;
      const py = stripBottom - PH2;
      const pw = ((R2 - L2) - GAP * (valid.length - 1)) / valid.length;
      let px = L2;
      for (let i = 0; i < valid.length; i++) {
        const c = getCrop(validEntries[i].origIdx);
        ctx.save();
        roundRect(px, py, pw, PH2, 14); ctx.clip();
        coverImage(valid[i], px, py, pw, PH2, c.normX, c.normY, c.scale);
        ctx.restore();
        ctx.strokeStyle = 'rgba(34,50,74,0.3)';
        ctx.lineWidth = 1.5;
        roundRect(px, py, pw, PH2, 14); ctx.stroke();
        px += pw + GAP;
      }
    }

    // Barcode
    {
      const by = TY + TH - 118, bh = 64;
      let bx = L2;
      let seed = 7;
      while (bx < R2 - 8) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        const bw = 3 + (seed % 9);
        seed = (seed * 1103515245 + 12345) % 2147483648;
        if (seed % 3 !== 0) {
          ctx.fillStyle = INK;
          ctx.fillRect(bx, by, bw, bh);
        }
        bx += bw + 4;
      }
      ctx.font = '20px ' + MONO;
      ctx.fillStyle = 'rgba(34,50,74,0.5)';
      ctx.fillText('MADE WITH TRAVEL MAPPING', L2, by + bh + 30);
    }
  }

  // ── export ───────────────────────────────────────────────────────────
  // Two frame ticks so the canvas backing store is fully committed before we
  // read it back; nextFrame falls back to a timer so this never hangs when rAF
  // is paused off-screen (the cause of the 1-photo / "skip all" timeout).
  __stage = 'export';
  await nextFrame();
  await nextFrame();
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  } catch (e) {
    post('error:canvas_export:' + String(e));
    return;
  }
  post(dataUrl);
  } catch (outerErr) {
    post('error:uncaught:' + String(outerErr));
  }
};

// Self-trigger as soon as the document is ready, independent of the React
// Native injected trigger. The idempotency guard keeps it to one render.
(function () {
  function start() {
    if (window.runStoryCanvas) {
      window.runStoryCanvas().catch(function (e) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('error:' + String(e));
      });
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    window.addEventListener('DOMContentLoaded', start);
    window.addEventListener('load', start);
  }
})();
</script>
</body>
</html>`;
}
