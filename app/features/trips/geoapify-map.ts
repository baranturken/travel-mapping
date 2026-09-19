const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY ?? '';

// A clean, muted basemap whose own labels show the city/place names — exactly
// the "blank map that only has the names of the cities visited" look, with a
// marker dropped on each stop. (No drawn Strava-style route lines.)
const MAP_STYLE = 'osm-bright-grey';
const MARKER_COLOR = '%231f5ea8'; // #1f5ea8, URL-encoded
const MAP_SIZE = 500;

type MapStop = { latitude: number; longitude: number };

function isValid(stop: MapStop): boolean {
  return (
    Number.isFinite(stop.latitude) &&
    Number.isFinite(stop.longitude) &&
    !(stop.latitude === 0 && stop.longitude === 0)
  );
}

// Builds a Geoapify Static Maps URL framing all stops with a marker on each.
export function buildStaticRouteMapUrl(stops: MapStop[]): string | null {
  if (!GEOAPIFY_KEY) return null;
  const valid = stops.filter(isValid);
  if (valid.length === 0) return null;

  const lons = valid.map((s) => s.longitude);
  const lats = valid.map((s) => s.latitude);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);

  // Pad the bounds so markers aren't flush against the edge, with a floor so a
  // single-stop or tightly-clustered trip still gets a sensible zoom.
  const lonPad = Math.max((maxLon - minLon) * 0.25, 0.08);
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.08);
  minLon -= lonPad;
  maxLon += lonPad;
  minLat -= latPad;
  maxLat += latPad;

  const capped = valid.slice(0, 24);

  const markers = capped
    .map(
      (s) =>
        `lonlat:${s.longitude.toFixed(5)},${s.latitude.toFixed(5)};type:material;color:${MARKER_COLOR};size:medium`,
    )
    .join('|');

  // Straight route line connecting the stops in order (lon,lat pairs).
  const geometry =
    capped.length >= 2
      ? `&geometry=polyline:${capped
          .map((s) => `${s.longitude.toFixed(5)},${s.latitude.toFixed(5)}`)
          .join(',')};linecolor:${MARKER_COLOR};linewidth:4;lineopacity:0.85`
      : '';

  const area = `rect:${minLon.toFixed(5)},${minLat.toFixed(5)},${maxLon.toFixed(5)},${maxLat.toFixed(5)}`;

  return (
    `https://maps.geoapify.com/v1/staticmap?style=${MAP_STYLE}&format=jpeg` +
    `&width=${MAP_SIZE}&height=${MAP_SIZE}&area=${area}` +
    `&marker=${markers}${geometry}&apiKey=${GEOAPIFY_KEY}`
  );
}
