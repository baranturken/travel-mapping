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

export const DEFAULT_ROUTE_POSITION: RoutePosition = {
  x: 1080 - 380 - 52,
  y: 52,
};

export type StoryTemplate = 'navy' | 'journey' | 'filmstrip';

type StoryOptions = {
  showRoute?: boolean;
  cropParams?: PhotoCropParams[];
  routePosition?: RoutePosition;
  template?: StoryTemplate;
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
  const PHOTOS      = ${ser(photoBase64s)};
  const TITLE       = ${ser(trip.title)};
  const STATS       = ${ser(statItems)};
  const STOPS       = ${ser(stopEntries)};
  const ROUTE_SEGS  = ${ser(showRoute ? routeSegments : [])};
  const STOP_COORDS = ${ser(showRoute ? stopCoords : [])};
  const CROP_PARAMS = ${ser(cropParams)};
  const DATE_RANGE  = ${ser(dateRange)};
  const TEMPLATE    = ${ser(template)};

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

  // ── background ───────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── load photos ──────────────────────────────────────────────────────
  const images = await Promise.all(
    PHOTOS.slice(0, 4).map((b64, origIdx) => new Promise(resolve => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 12000);
      img.onload  = () => { clearTimeout(timer); resolve({ img, origIdx }); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = 'data:image/jpeg;base64,' + b64;
    })),
  );
  const validEntries = images.filter(Boolean);
  const valid = validEntries.map(e => e.img);

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

    // Route minimap drawn LAST so it always renders on top
    if (ROUTE_SEGS.length > 0) {
      const MAP_W = 380, MAP_H = 380, MAP_PAD = 26;
      const MAP_X = ${mapX};
      const MAP_Y = ${mapY};
      const hasPhotos = valid.length > 0;
      const routePasses = hasPhotos ? [
        { width: 12, style: 'rgba(2,5,15,0.9)' },
        { width: 7,  style: 'rgba(5,20,50,0.7)' },
        { width: 3,  style: 'rgba(15,37,64,0.95)' },
      ] : [
        { width: 12, style: 'rgba(2,8,20,0.85)' },
        { width: 7,  style: 'rgba(15,60,120,0.6)' },
        { width: 3,  style: '#74c0fc' },
      ];
      const dotInner = hasPhotos ? 'rgba(15,37,64,0.9)' : '#4dabf7';
      drawRoute(MAP_X, MAP_Y, MAP_W, MAP_H, MAP_PAD, routePasses, 'rgba(2,8,20,0.85)', dotInner);
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

    // ── Route card (white sticker floating over photo) ──
    if (ROUTE_SEGS.length > 0) {
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

      // Clip route + grid to card
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
    if (ROUTE_SEGS.length > 0 && MAP_H_val > 80) {
      drawRoute(L, y, CONTENT_W, MAP_H_val, 22, [
        { width: 10, style: 'rgba(2,8,20,0.85)' },
        { width: 5, style: 'rgba(15,60,120,0.6)' },
        { width: 2.5, style: '#74c0fc' },
      ], 'rgba(2,8,20,0.85)', '#4dabf7');
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

  // ── export ───────────────────────────────────────────────────────────
  await new Promise(r => requestAnimationFrame(r));
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  } catch (e) {
    window.ReactNativeWebView.postMessage('error:canvas_export:' + String(e));
    return;
  }
  window.ReactNativeWebView.postMessage(dataUrl);
};
</script>
</body>
</html>`;
}
