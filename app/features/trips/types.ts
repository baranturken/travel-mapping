export const TRANSPORT_TYPES = ['plane', 'bus', 'ferry', 'train', 'car', 'custom'] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];

export type TripStop = {
  id: string;
  tripId: string;
  orderIndex: number;
  cityName: string;
  countryName: string;
  stayLabel: string | null;
  latitude: number;
  longitude: number;
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

export type CreateTripStopInput = {
  cityName: string;
  countryName: string;
  stayLabel?: string | null;
  latitude: number;
  longitude: number;
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

export function getTransportDisplay(transportType: TransportType, transportLabel?: string | null) {
  const meta = TRANSPORT_META[transportType];
  const normalizedLabel = transportLabel?.trim();

  return {
    ...meta,
    label: normalizedLabel ? normalizedLabel : meta.label,
  };
}
