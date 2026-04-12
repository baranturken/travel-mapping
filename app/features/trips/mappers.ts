import type { CreateTripInput } from '@/features/trips/types';
import type { CreateTripFormValues } from '@/features/trips/schemas';
import type { TripStop } from '@/features/trips/types';

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toCreateTripInput(values: CreateTripFormValues): CreateTripInput {
  return {
    title: values.title.trim(),
    stops: values.stops.map((stop) => ({
      cityName: stop.cityName.trim(),
      countryName: stop.countryName.trim(),
      stayLabel: normalizeOptionalText(stop.stayLabel),
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    })),
    legs: values.legs.map((leg) => ({
      transportType: leg.transportType,
      transportLabel: normalizeOptionalText(leg.transportLabel),
    })),
  };
}

export function formatTripStopLabel(stop: Pick<TripStop, 'cityName' | 'countryName'>) {
  return `${stop.cityName}, ${stop.countryName}`;
}

export function formatTripUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
