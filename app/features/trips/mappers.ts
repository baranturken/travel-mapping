import type { CreateTripFormValues } from '@/features/trips/schemas';
import type { CreateTripInput, TripDetail, TripStop } from '@/features/trips/types';

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
      accommodationName: normalizeOptionalText(stop.accommodationName),
      accommodationType: stop.accommodationType || null,
      accommodationNote: normalizeOptionalText(stop.accommodationNote),
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      places: stop.places.map((place) => ({
        title: place.title.trim(),
        note: normalizeOptionalText(place.note),
      })),
      memories: stop.memories.map((memory) => ({
        imageUri: memory.imageUri.trim(),
        caption: normalizeOptionalText(memory.caption),
        latitude: memory.latitude ?? null,
        longitude: memory.longitude ?? null,
      })),
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

export function toTripFormValues(trip: TripDetail): CreateTripFormValues {
  return {
    title: trip.title,
    stops: trip.stops.map((stop) => ({
      cityName: stop.cityName,
      countryName: stop.countryName,
      stayLabel: stop.stayLabel ?? '',
      accommodationName: stop.accommodationName ?? '',
      accommodationType: stop.accommodationType ?? '',
      accommodationNote: stop.accommodationNote ?? '',
      latitude: stop.latitude.toString(),
      longitude: stop.longitude.toString(),
      places: stop.places.map((place) => ({
        title: place.title,
        note: place.note ?? '',
      })),
      memories: stop.memories.map((memory) => ({
        imageUri: memory.imageUri,
        caption: memory.caption ?? '',
        latitude: memory.latitude ?? null,
        longitude: memory.longitude ?? null,
      })),
    })),
    legs: trip.legs.map((leg) => ({
      transportType: leg.transportType,
      transportLabel: leg.transportLabel ?? '',
    })),
  };
}

export function toDuplicatedTripInput(trip: TripDetail): CreateTripInput {
  return {
    title: `${trip.title} (copy)`,
    stops: trip.stops.map((stop) => ({
      cityName: stop.cityName,
      countryName: stop.countryName,
      stayLabel: stop.stayLabel ?? '',
      accommodationName: stop.accommodationName ?? '',
      accommodationType: stop.accommodationType ?? null,
      accommodationNote: stop.accommodationNote ?? '',
      latitude: stop.latitude,
      longitude: stop.longitude,
      places: stop.places.map((place) => ({
        title: place.title,
        note: place.note ?? '',
      })),
      memories: stop.memories.map((memory) => ({
        imageUri: memory.imageUri,
        caption: memory.caption ?? '',
        latitude: memory.latitude,
        longitude: memory.longitude,
      })),
    })),
    legs: trip.legs.map((leg) => ({
      transportType: leg.transportType,
      transportLabel: leg.transportLabel ?? '',
    })),
  };
}
