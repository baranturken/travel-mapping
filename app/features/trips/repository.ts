import type { CreateTripInput, TripDetail, TripListItem } from '@/features/trips/types';

export interface TripRepository {
  listTrips(): Promise<TripListItem[]>;
  getTripDetail(tripId: string): Promise<TripDetail | null>;
  createTrip(input: CreateTripInput): Promise<string>;
  updateTrip(tripId: string, input: CreateTripInput): Promise<void>;
  deleteTrip(tripId: string): Promise<void>;
  setTripPublishStatus(
    tripId: string,
    supabaseId: string | null,
    isPublic: boolean,
    publishedAt: string | null,
  ): Promise<void>;
}
