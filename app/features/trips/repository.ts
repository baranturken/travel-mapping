import type { CreateTripInput, TripDetail, TripListItem } from '@/features/trips/types';

export interface TripRepository {
  listTrips(): Promise<TripListItem[]>;
  getTripDetail(tripId: string): Promise<TripDetail | null>;
  createTrip(input: CreateTripInput): Promise<string>;
}
