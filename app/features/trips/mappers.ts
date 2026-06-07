import type { CreateTripFormValues } from '@/features/trips/schemas';
import { doesTripReturnToStart, getTripReturnLeg } from '@/features/trips/route-helpers';
import type { CreateTripInput, TripDetail, TripStop } from '@/features/trips/types';

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatTripDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function toCreateTripInput(values: CreateTripFormValues): CreateTripInput {
  const baseLegs = values.legs.map((leg) => ({
    transportType: leg.transportType,
    transportLabel: normalizeOptionalText(leg.transportLabel),
  }));

  return {
    title: values.title.trim(),
    startDate: normalizeOptionalDate(values.startDate),
    endDate: normalizeOptionalDate(values.endDate),
    stops: values.stops.map((stop, index) => {
      const isHomeBase = index === 0 && stop.isHomeBase;

      return {
        cityName: stop.cityName.trim(),
        countryName: stop.countryName.trim(),
        isHomeBase,
        stayLabel: index === 0 ? null : normalizeOptionalText(stop.stayLabel),
        accommodationName: isHomeBase ? null : normalizeOptionalText(stop.accommodationName),
        accommodationType: isHomeBase ? null : stop.accommodationType || null,
        accommodationNote: isHomeBase ? null : normalizeOptionalText(stop.accommodationNote),
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        places: isHomeBase
          ? []
          : stop.places.map((place) => ({
              title: place.title.trim(),
              note: normalizeOptionalText(place.note),
            })),
        memories: isHomeBase
          ? []
          : stop.memories.map((memory) => ({
              imageUri: memory.imageUri.trim(),
              caption: normalizeOptionalText(memory.caption),
              latitude: memory.latitude ?? null,
              longitude: memory.longitude ?? null,
        })),
      };
    }),
    legs: values.returnToStart
      ? [
          ...baseLegs,
          {
            transportType: values.returnLeg.transportType,
            transportLabel: normalizeOptionalText(values.returnLeg.transportLabel),
          },
        ]
      : baseLegs,
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

export function formatTripDateRange(startDate?: string | null, endDate?: string | null) {
  if (startDate && endDate) {
    return `${formatTripDate(startDate)} - ${formatTripDate(endDate)}`;
  }

  if (startDate) {
    return formatTripDate(startDate);
  }

  if (endDate) {
    return formatTripDate(endDate);
  }

  return null;
}

export function toTripFormValues(trip: TripDetail): CreateTripFormValues {
  const returnToStart = doesTripReturnToStart(trip, { requireMatchingLegCount: true });
  const lastLeg = getTripReturnLeg(trip);
  const baseLegs = returnToStart ? trip.legs.slice(0, -1) : trip.legs;

  return {
    title: trip.title,
    startDate: trip.startDate ?? '',
    endDate: trip.endDate ?? '',
    stops: trip.stops.map((stop) => ({
      cityName: stop.cityName,
      countryName: stop.countryName,
      isHomeBase: stop.isHomeBase,
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
    legs: baseLegs.map((leg) => ({
      transportType: leg.transportType,
      transportLabel: leg.transportLabel ?? '',
    })),
    returnToStart,
    returnLeg: returnToStart && lastLeg
      ? {
          transportType: lastLeg.transportType,
          transportLabel: lastLeg.transportLabel ?? '',
        }
      : {
          transportType: 'plane',
          transportLabel: '',
        },
  };
}

export function toDuplicatedTripInput(trip: TripDetail): CreateTripInput {
  return {
    title: `${trip.title} (copy)`,
    startDate: trip.startDate,
    endDate: trip.endDate,
    stops: trip.stops.map((stop) => ({
      cityName: stop.cityName,
      countryName: stop.countryName,
      isHomeBase: stop.isHomeBase,
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
