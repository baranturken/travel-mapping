import type { SQLiteDatabase } from 'expo-sqlite';

import type { OsrmRouteResult, RouteCoordinate } from '@/features/trips/routing/osrm-route-fetcher';

type RouteCacheRow = {
  geometry_json: string;
  distance_meters: number | null;
  duration_seconds: number | null;
};

export type CachedRoute = {
  geometry: RouteCoordinate[];
  distanceMeters: number | null;
  durationSeconds: number | null;
};

export function buildRouteCacheKey(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  profile: string,
): string {
  return `${profile}:${fromLat.toFixed(4)},${fromLon.toFixed(4)}->${toLat.toFixed(4)},${toLon.toFixed(4)}`;
}

export async function getCachedRoute(
  db: SQLiteDatabase,
  cacheKey: string,
): Promise<CachedRoute | null> {
  const row = await db.getFirstAsync<RouteCacheRow>(
    `SELECT geometry_json, distance_meters, duration_seconds FROM route_cache WHERE cache_key = ?`,
    cacheKey,
  );

  if (!row) return null;

  try {
    return {
      geometry: JSON.parse(row.geometry_json) as RouteCoordinate[],
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
    };
  } catch {
    return null;
  }
}

export async function setCachedRoute(
  db: SQLiteDatabase,
  cacheKey: string,
  profile: string,
  source: string,
  result: OsrmRouteResult,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `
      INSERT INTO route_cache (cache_key, profile, source, geometry_json, distance_meters, duration_seconds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (cache_key) DO UPDATE SET
        geometry_json = excluded.geometry_json,
        distance_meters = excluded.distance_meters,
        duration_seconds = excluded.duration_seconds,
        updated_at = excluded.updated_at
    `,
    cacheKey,
    profile,
    source,
    JSON.stringify(result.geometry),
    result.distanceMeters,
    result.durationSeconds,
    now,
    now,
  );
}
