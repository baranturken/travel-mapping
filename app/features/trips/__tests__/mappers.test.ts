import { toCreateTripInput, toDuplicatedTripInput, toTripFormValues } from '@/features/trips/mappers';
import type { CreateTripFormValues } from '@/features/trips/schemas';
import type { TripDetail } from '@/features/trips/types';

describe('trip mappers', () => {
  it('clears first-stop story content when the start city is marked as home base', () => {
    const values: CreateTripFormValues = {
      title: 'Greece trip',
      startDate: '2026-07-03',
      endDate: '2026-07-09',
      stops: [
        {
          cityName: 'Istanbul',
          countryName: 'Turkey',
          isHomeBase: true,
          stayLabel: '2 nights',
          accommodationName: 'Home',
          accommodationType: 'custom',
          accommodationNote: 'Pack bags here',
          latitude: '41.0082',
          longitude: '28.9784',
          places: [{ title: 'Galata', note: 'Morning walk' }],
          memories: [
            {
              imageUri: 'file://istanbul.jpg',
              caption: 'Before leaving',
              latitude: 41.0082,
              longitude: 28.9784,
            },
          ],
        },
        {
          cityName: 'Athens',
          countryName: 'Greece',
          isHomeBase: false,
          stayLabel: '3 nights',
          accommodationName: 'Hotel',
          accommodationType: 'hotel',
          accommodationNote: 'Near the center',
          latitude: '37.9838',
          longitude: '23.7275',
          places: [{ title: 'Acropolis', note: '' }],
          memories: [],
        },
      ],
      legs: [{ transportType: 'plane', transportLabel: '' }],
      returnToStart: true,
      returnLeg: { transportType: 'plane', transportLabel: 'Back home' },
    };

    expect(toCreateTripInput(values)).toEqual({
      title: 'Greece trip',
      startDate: '2026-07-03',
      endDate: '2026-07-09',
      stops: [
        {
          cityName: 'Istanbul',
          countryName: 'Turkey',
          isHomeBase: true,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 41.0082,
          longitude: 28.9784,
          places: [],
          memories: [],
        },
        {
          cityName: 'Athens',
          countryName: 'Greece',
          isHomeBase: false,
          stayLabel: '3 nights',
          accommodationName: 'Hotel',
          accommodationType: 'hotel',
          accommodationNote: 'Near the center',
          latitude: 37.9838,
          longitude: 23.7275,
          places: [{ title: 'Acropolis', note: null }],
          memories: [],
        },
      ],
      legs: [
        { transportType: 'plane', transportLabel: null },
        { transportType: 'plane', transportLabel: 'Back home' },
      ],
    });
  });

  it('preserves isHomeBase when mapping detail data back into forms and duplicates', () => {
    const trip: TripDetail = {
      id: 'trip-1',
      title: 'Adventure',
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      isPublic: false,
      supabaseId: null,
      publishedAt: null,
      stops: [
        {
          id: 'stop-1',
          tripId: 'trip-1',
          orderIndex: 0,
          cityName: 'Istanbul',
          countryName: 'Turkey',
          isHomeBase: true,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 41.0082,
          longitude: 28.9784,
          places: [],
          memories: [],
        },
        {
          id: 'stop-2',
          tripId: 'trip-1',
          orderIndex: 1,
          cityName: 'Athens',
          countryName: 'Greece',
          isHomeBase: false,
          stayLabel: '3 nights',
          accommodationName: 'Blue Harbor Hotel',
          accommodationType: 'hotel',
          accommodationNote: null,
          latitude: 37.9838,
          longitude: 23.7275,
          places: [],
          memories: [],
        },
      ],
      legs: [
        {
          id: 'leg-1',
          tripId: 'trip-1',
          fromStopId: 'stop-1',
          toStopId: 'stop-2',
          orderIndex: 0,
          transportType: 'plane',
          transportLabel: null,
        },
        {
          id: 'leg-2',
          tripId: 'trip-1',
          fromStopId: 'stop-2',
          toStopId: 'stop-1',
          orderIndex: 1,
          transportType: 'plane',
          transportLabel: 'Return flight',
        },
      ],
    };

    const formValues = toTripFormValues(trip);

    expect(formValues.startDate).toBe('2026-04-01');
    expect(formValues.endDate).toBe('2026-04-05');
    expect(formValues.stops[0].isHomeBase).toBe(true);
    expect(formValues.returnToStart).toBe(true);
    expect(formValues.returnLeg).toEqual({ transportType: 'plane', transportLabel: 'Return flight' });
    expect(formValues.legs).toEqual([{ transportType: 'plane', transportLabel: '' }]);
    expect(toDuplicatedTripInput(trip).startDate).toBe('2026-04-01');
    expect(toDuplicatedTripInput(trip).stops[0].isHomeBase).toBe(true);
  });

  it('does not mark return-to-start when the closing leg count is out of sync with stops', () => {
    const trip: TripDetail = {
      id: 'trip-2',
      title: 'Open-jaw trip',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      isPublic: false,
      supabaseId: null,
      publishedAt: null,
      stops: [
        {
          id: 'stop-1',
          tripId: 'trip-2',
          orderIndex: 0,
          cityName: 'Istanbul',
          countryName: 'Turkey',
          isHomeBase: false,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 41.0082,
          longitude: 28.9784,
          places: [],
          memories: [],
        },
        {
          id: 'stop-2',
          tripId: 'trip-2',
          orderIndex: 1,
          cityName: 'Athens',
          countryName: 'Greece',
          isHomeBase: false,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 37.9838,
          longitude: 23.7275,
          places: [],
          memories: [],
        },
      ],
      legs: [
        {
          id: 'leg-1',
          tripId: 'trip-2',
          fromStopId: 'stop-1',
          toStopId: 'stop-2',
          orderIndex: 0,
          transportType: 'plane',
          transportLabel: null,
        },
        {
          id: 'leg-2',
          tripId: 'trip-2',
          fromStopId: 'stop-2',
          toStopId: 'stop-1',
          orderIndex: 1,
          transportType: 'plane',
          transportLabel: 'Return',
        },
        {
          id: 'leg-3',
          tripId: 'trip-2',
          fromStopId: 'stop-1',
          toStopId: 'stop-2',
          orderIndex: 2,
          transportType: 'plane',
          transportLabel: 'Extra hop',
        },
      ],
    };

    const formValues = toTripFormValues(trip);

    expect(formValues.returnToStart).toBe(false);
    expect(formValues.legs).toHaveLength(3);
    expect(formValues.returnLeg).toEqual({ transportType: 'plane', transportLabel: '' });
  });

  it('preserves expanded transport modes when saving, editing, and duplicating trips', () => {
    const values: CreateTripFormValues = {
      title: 'Active coast hop',
      startDate: '',
      endDate: '',
      stops: [
        {
          cityName: 'Barcelona',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: '',
          accommodationName: '',
          accommodationType: '',
          accommodationNote: '',
          latitude: '41.3851',
          longitude: '2.1734',
          places: [],
          memories: [],
        },
        {
          cityName: 'Sitges',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: '',
          accommodationName: '',
          accommodationType: '',
          accommodationNote: '',
          latitude: '41.2360',
          longitude: '1.8059',
          places: [],
          memories: [],
        },
      ],
      legs: [{ transportType: 'walking', transportLabel: 'Seafront walk' }],
      returnToStart: true,
      returnLeg: { transportType: 'motorcycle', transportLabel: 'Coastal ride back' },
    };

    expect(toCreateTripInput(values).legs).toEqual([
      { transportType: 'walking', transportLabel: 'Seafront walk' },
      { transportType: 'motorcycle', transportLabel: 'Coastal ride back' },
    ]);

    const trip: TripDetail = {
      id: 'trip-transport',
      title: 'Expanded transport',
      startDate: null,
      endDate: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      isPublic: false,
      supabaseId: null,
      publishedAt: null,
      stops: [
        {
          id: 'stop-1',
          tripId: 'trip-transport',
          orderIndex: 0,
          cityName: 'Barcelona',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 41.3851,
          longitude: 2.1734,
          places: [],
          memories: [],
        },
        {
          id: 'stop-2',
          tripId: 'trip-transport',
          orderIndex: 1,
          cityName: 'Girona',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: null,
          accommodationName: null,
          accommodationType: null,
          accommodationNote: null,
          latitude: 41.9794,
          longitude: 2.8214,
          places: [],
          memories: [],
        },
      ],
      legs: [
        {
          id: 'leg-1',
          tripId: 'trip-transport',
          fromStopId: 'stop-1',
          toStopId: 'stop-2',
          orderIndex: 0,
          transportType: 'bicycle',
          transportLabel: 'Coastal cycling day',
        },
        {
          id: 'leg-2',
          tripId: 'trip-transport',
          fromStopId: 'stop-2',
          toStopId: 'stop-1',
          orderIndex: 1,
          transportType: 'motorcycle',
          transportLabel: 'Ride south',
        },
      ],
    };

    expect(toTripFormValues(trip).legs).toEqual([
      { transportType: 'bicycle', transportLabel: 'Coastal cycling day' },
    ]);
    expect(toTripFormValues(trip).returnLeg).toEqual({
      transportType: 'motorcycle',
      transportLabel: 'Ride south',
    });
    expect(toDuplicatedTripInput(trip).legs).toEqual([
      { transportType: 'bicycle', transportLabel: 'Coastal cycling day' },
      { transportType: 'motorcycle', transportLabel: 'Ride south' },
    ]);
  });
});
