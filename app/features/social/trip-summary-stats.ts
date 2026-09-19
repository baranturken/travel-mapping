import type { StopSummary } from './types';

export type TripSummaryStats = {
  travelStops: StopSummary[];
  cityCount: number;
  countryCount: number;
};

export function summarizeStops(stops: StopSummary[]): TripSummaryStats {
  const travelStops = stops.filter((s) => !s.isHomeBase);
  const cities = new Set(
    travelStops.map(
      (s) => `${s.cityName.trim().toLowerCase()}:${s.countryName.trim().toLowerCase()}`,
    ),
  );
  const countries = new Set(travelStops.map((s) => s.countryName.trim().toLowerCase()));
  return {
    travelStops,
    cityCount: cities.size,
    countryCount: countries.size,
  };
}
