import { formatDistanceKm } from '@/features/trips/trip-stats';
import type { TripStats } from '@/features/trips/trip-stats';
import { getTransportDisplay, type TripDetail } from '@/features/trips/types';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';

function ser(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

type StopEntry = { city: string; country: string; transport: string | null };

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
  y += 64;

  // divider
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
  y += 32;

  // route stops
  const maxVisible = Math.min(STOPS.length, 4);
  for (let i = 0; i < maxVisible; i++) {
    const stop = STOPS[i];

    // badge
    ctx.fillStyle = '#2f6db8';
    ctx.beginPath();
    ctx.arc(PAD + 20, y + 4, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 24px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(String(i + 1), PAD + 20, y + 14);
    ctx.textAlign   = 'left';

    // city + country
    ctx.font      = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stop.city, PAD + 56, y + 8);
    ctx.font      = '28px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(stop.country, PAD + 56, y + 42);
    y += 72;

    // connector + transport label
    if (stop.transport && i < maxVisible - 1) {
      ctx.fillStyle = 'rgba(127,180,240,0.35)';
      ctx.fillRect(PAD + 18, y - 2, 4, 26);
      ctx.font      = 'bold 27px sans-serif';
      ctx.fillStyle = '#7fb4f0';
      ctx.fillText(stop.transport, PAD + 44, y + 20);
      y += 38;
    }
  }

  if (STOPS.length > 4) {
    ctx.font      = '28px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('+' + (STOPS.length - 4) + ' more stops', PAD + 56, y + 8);
  }

  // watermark
  ctx.font      = '24px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillText('Made with Travel Mapping', PAD, H - 72);

  // ── export ───────────────────────────────────────────────────────────

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    window.ReactNativeWebView.postMessage(dataUrl);
  } catch (err) {
    window.ReactNativeWebView.postMessage('error:' + String(err));
  }
})();
</script>
</body>
</html>`;
}
