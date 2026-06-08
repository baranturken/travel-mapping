import type { LegRouteData } from '@/features/trips/components/trip-map-webview';
import type { TripDetail, TripLeg, TripStop } from '@/features/trips/types';

export type TripStats = {
  countryCount: number;
  cityCount: number;
  dayCount: number | null;
  totalDistanceKm: number | null;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLegStraightLineKm(leg: TripLeg, stops: TripStop[]): number {
  const from = stops.find((s) => s.id === leg.fromStopId);
  const to = stops.find((s) => s.id === leg.toStopId);
  if (!from || !to) return 0;
  return haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
}

export function computeTripStats(
  trip: TripDetail,
  legRoutes?: Record<string, LegRouteData>,
): TripStats {
  const countries = new Set(trip.stops.map((s) => s.countryName.trim().toLowerCase()));
  const cities = new Set(trip.stops.map((s) => `${s.cityName.trim().toLowerCase()}:${s.countryName.trim().toLowerCase()}`));

  let dayCount: number | null = null;
  if (trip.startDate && trip.endDate) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0) dayCount = diff + 1;
  }

  let totalDistanceKm: number | null = null;
  if (trip.legs.length > 0) {
    let sum = 0;
    for (const leg of trip.legs) {
      const routeData = legRoutes?.[leg.id];
      if (routeData?.distanceMeters != null) {
        sum += routeData.distanceMeters / 1000;
      } else {
        sum += getLegStraightLineKm(leg, trip.stops);
      }
    }
    totalDistanceKm = Math.round(sum);
  }

  return {
    countryCount: countries.size,
    cityCount: cities.size,
    dayCount,
    totalDistanceKm,
  };
}

export function formatDistanceKm(km: number): string {
  if (km >= 1000) {
    return `${km.toLocaleString('en-US', { maximumFractionDigits: 0 })} km`;
  }
  return `${km} km`;
}

export function formatLegDistance(distanceMeters: number | null): string | null {
  if (distanceMeters === null) return null;
  const km = distanceMeters / 1000;
  if (km < 1) return `${Math.round(distanceMeters)} m`;
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${Math.round(km)} km`;
}

export function formatLegDuration(durationSeconds: number | null): string | null {
  if (durationSeconds === null) return null;
  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
