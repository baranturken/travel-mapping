import type { TransportType } from '@/features/trips/types';

export type RouteCoordinate = [number, number]; // [lat, lon] for Leaflet

export type OsrmProfile = 'driving' | 'cycling' | 'foot';

export type OsrmRouteResult = {
  geometry: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
};

const OSRM_PROFILES: Partial<Record<TransportType, OsrmProfile>> = {
  bus: 'driving',
  car: 'driving',
  motorcycle: 'driving',
  train: 'driving',
  walking: 'foot',
  bicycle: 'cycling',
};

export function getOsrmProfile(transportType: TransportType): OsrmProfile | null {
  return OSRM_PROFILES[transportType] ?? null;
}

export async function fetchOsrmRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  profile: OsrmProfile,
): Promise<OsrmRouteResult | null> {
  const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: [number, number][] };
        distance?: number;
        duration?: number;
      }>;
    };
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coords) || coords.length === 0) return null;

    return {
      // OSRM returns [lon, lat]; Leaflet expects [lat, lon]
      geometry: coords.map(([lon, lat]) => [lat, lon] as RouteCoordinate),
      distanceMeters: route.distance ?? 0,
      durationSeconds: route.duration ?? 0,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
