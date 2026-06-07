import type { TripDetail, TripLeg, TripStop } from '@/features/trips/types';

type TripRouteShape = Pick<TripDetail, 'stops' | 'legs'>;

function getTripLoopEndpoints(trip: TripRouteShape) {
  const firstStop = trip.stops[0];
  const lastStop = trip.stops[trip.stops.length - 1];
  const lastLeg = trip.legs[trip.legs.length - 1];

  return {
    firstStop,
    lastStop,
    lastLeg,
  };
}

export function getTripReturnLeg(trip: TripRouteShape): TripLeg | null {
  const { firstStop, lastStop, lastLeg } = getTripLoopEndpoints(trip);

  if (!firstStop || !lastStop || !lastLeg) {
    return null;
  }

  return lastLeg.fromStopId === lastStop.id && lastLeg.toStopId === firstStop.id ? lastLeg : null;
}

export function doesTripReturnToStart(
  trip: TripRouteShape,
  options?: {
    requireMatchingLegCount?: boolean;
  },
) {
  const returnLeg = getTripReturnLeg(trip);

  if (!returnLeg) {
    return false;
  }

  if (options?.requireMatchingLegCount) {
    return trip.legs.length === trip.stops.length;
  }

  return true;
}

export function getTripTerminalStops(trip: TripRouteShape): {
  firstStop: TripStop | null;
  lastStop: TripStop | null;
} {
  return {
    firstStop: trip.stops[0] ?? null,
    lastStop: trip.stops[trip.stops.length - 1] ?? null,
  };
}
