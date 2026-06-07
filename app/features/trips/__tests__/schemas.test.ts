import { createTripSchema } from '@/features/trips/schemas';

const baseValues = {
  title: 'Aegean circle',
  startDate: '',
  endDate: '',
  stops: [
    {
      cityName: 'Istanbul',
      countryName: 'Turkey',
      isHomeBase: true,
      stayLabel: '',
      accommodationName: '',
      accommodationType: '',
      accommodationNote: '',
      latitude: '41.0082',
      longitude: '28.9784',
      places: [],
      memories: [],
    },
    {
      cityName: 'Athens',
      countryName: 'Greece',
      isHomeBase: false,
      stayLabel: '3 nights',
      accommodationName: 'Blue Harbor Hotel',
      accommodationType: 'hotel',
      accommodationNote: '',
      latitude: '37.9838',
      longitude: '23.7275',
      places: [],
      memories: [],
    },
  ],
  legs: [{ transportType: 'plane', transportLabel: '' }],
  returnToStart: false,
  returnLeg: { transportType: 'plane', transportLabel: '' },
} as const;

describe('createTripSchema', () => {
  it('accepts a trip without a return leg when the toggle is off', () => {
    const result = createTripSchema.safeParse(baseValues);

    expect(result.success).toBe(true);
  });

  it('requires a label for a custom return transport', () => {
    const result = createTripSchema.safeParse({
      ...baseValues,
      returnToStart: true,
      returnLeg: {
        transportType: 'custom',
        transportLabel: '',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['returnLeg', 'transportLabel']);
  });

  it('requires the trip dates to be entered as a pair', () => {
    const result = createTripSchema.safeParse({
      ...baseValues,
      startDate: '2026-07-03',
      endDate: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('rejects an end date before the start date', () => {
    const result = createTripSchema.safeParse({
      ...baseValues,
      startDate: '2026-07-09',
      endDate: '2026-07-03',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('accepts walking, bicycle, and motorcycle legs including the return leg', () => {
    const result = createTripSchema.safeParse({
      ...baseValues,
      legs: [{ transportType: 'walking', transportLabel: '' }],
      returnToStart: true,
      returnLeg: { transportType: 'motorcycle', transportLabel: '' },
    });

    expect(result.success).toBe(true);

    const bicycleResult = createTripSchema.safeParse({
      ...baseValues,
      legs: [{ transportType: 'bicycle', transportLabel: '' }],
    });

    expect(bicycleResult.success).toBe(true);
  });
});
