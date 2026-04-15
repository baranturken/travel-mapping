export const TRANSPORT_TYPES = ['plane', 'bus', 'ferry', 'train', 'car', 'custom'] as const;
export const ACCOMMODATION_TYPES = ['hotel', 'airbnb', 'hostel', 'guesthouse', 'custom'] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export type TripPlace = {
  id: string;
  stopId: string;
  orderIndex: number;
  title: string;
  note: string | null;
};

export type TripMemory = {
  id: string;
  stopId: string;
  orderIndex: number;
  imageUri: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type TripStop = {
  id: string;
  tripId: string;
  orderIndex: number;
  cityName: string;
  countryName: string;
  stayLabel: string | null;
  accommodationName: string | null;
  accommodationType: AccommodationType | null;
  accommodationNote: string | null;
  latitude: number;
  longitude: number;
  places: TripPlace[];
  memories: TripMemory[];
};

export type TripLeg = {
  id: string;
  tripId: string;
  fromStopId: string;
  toStopId: string;
  orderIndex: number;
  transportType: TransportType;
  transportLabel: string | null;
};

export type TripSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type TripDetail = TripSummary & {
  stops: TripStop[];
  legs: TripLeg[];
};

export type TripListItem = TripSummary & {
  stopCount: number;
  firstStopLabel: string;
  lastStopLabel: string;
};

export type CreateTripPlaceInput = {
  title: string;
  note?: string | null;
};

export type CreateTripMemoryInput = {
  imageUri: string;
  caption?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CreateTripStopInput = {
  cityName: string;
  countryName: string;
  stayLabel?: string | null;
  accommodationName?: string | null;
  accommodationType?: AccommodationType | null;
  accommodationNote?: string | null;
  latitude: number;
  longitude: number;
  places: CreateTripPlaceInput[];
  memories: CreateTripMemoryInput[];
};

export type CreateTripLegInput = {
  transportType: TransportType;
  transportLabel?: string | null;
};

export type CreateTripInput = {
  title: string;
  stops: CreateTripStopInput[];
  legs: CreateTripLegInput[];
};

export const TRANSPORT_META: Record<
  TransportType,
  {
    label: string;
    emoji: string;
    dashed: boolean;
  }
> = {
  plane: { label: 'Plane', emoji: '✈️', dashed: true },
  bus: { label: 'Bus', emoji: '🚌', dashed: false },
  ferry: { label: 'Ferry', emoji: '⛴️', dashed: false },
  train: { label: 'Train', emoji: '🚆', dashed: false },
  car: { label: 'Car', emoji: '🚗', dashed: false },
  custom: { label: 'Custom', emoji: '🧭', dashed: false },
};

export const ACCOMMODATION_META: Record<
  AccommodationType,
  {
    label: string;
    emoji: string;
  }
> = {
  hotel: { label: 'Hotel', emoji: '🏨' },
  airbnb: { label: 'Airbnb', emoji: '🏠' },
  hostel: { label: 'Hostel', emoji: '🛏️' },
  guesthouse: { label: 'Guesthouse', emoji: '🗝️' },
  custom: { label: 'Stay', emoji: '📍' },
};

export function getTransportDisplay(transportType: TransportType, transportLabel?: string | null) {
  const meta = TRANSPORT_META[transportType];
  const normalizedLabel = transportLabel?.trim();

  return {
    ...meta,
    label: normalizedLabel ? normalizedLabel : meta.label,
  };
}

export function getAccommodationDisplay(
  accommodationType?: AccommodationType | null,
  accommodationName?: string | null,
) {
  const meta = accommodationType ? ACCOMMODATION_META[accommodationType] : ACCOMMODATION_META.custom;
  const normalizedName = accommodationName?.trim();

  return {
    ...meta,
    label: normalizedName ? normalizedName : meta.label,
  };
}
