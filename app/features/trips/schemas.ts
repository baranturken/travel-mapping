import { z } from 'zod';

import {
  ACCOMMODATION_TYPES,
  TRANSPORT_TYPES,
  type AccommodationType,
  type TransportType,
} from '@/features/trips/types';

const REQUIRED_MESSAGE = 'This field is required.';

function isFiniteCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

const placeSchema = z.object({
  title: z.string().trim().min(1, 'Enter a place name.'),
  note: z.string(),
});

const memorySchema = z.object({
  imageUri: z.string().trim().min(1, 'Pick a photo.'),
  caption: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

const stopSchema = z.object({
  cityName: z.string().trim().min(1, REQUIRED_MESSAGE),
  countryName: z.string().trim().min(1, REQUIRED_MESSAGE),
  stayLabel: z.string(),
  accommodationName: z.string(),
  accommodationType: z.enum(ACCOMMODATION_TYPES).or(z.literal('')),
  accommodationNote: z.string(),
  latitude: z
    .string()
    .trim()
    .min(1, REQUIRED_MESSAGE)
    .refine(isFiniteCoordinate, 'Enter a valid latitude.')
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= -90 && parsed <= 90;
    }, 'Latitude must be between -90 and 90.'),
  longitude: z
    .string()
    .trim()
    .min(1, REQUIRED_MESSAGE)
    .refine(isFiniteCoordinate, 'Enter a valid longitude.')
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= -180 && parsed <= 180;
    }, 'Longitude must be between -180 and 180.'),
  places: z.array(placeSchema),
  memories: z.array(memorySchema),
});

const legSchema = z.object({
  transportType: z.enum(TRANSPORT_TYPES),
  transportLabel: z.string(),
});

export const createTripSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a trip title.'),
    stops: z.array(stopSchema).min(2, 'Add at least two stops.'),
    legs: z.array(legSchema).min(1, 'Add at least one transport leg.'),
  })
  .superRefine((value, context) => {
    if (value.legs.length !== value.stops.length - 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Every gap between stops needs one transport choice.',
        path: ['legs'],
      });
    }

    value.legs.forEach((leg, index) => {
      if (leg.transportType === 'custom' && !leg.transportLabel.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Add a custom transport label.',
          path: ['legs', index, 'transportLabel'],
        });
      }
    });
  });

export type CreateTripFormValues = z.infer<typeof createTripSchema>;

export function createEmptyStop() {
  return {
    cityName: '',
    countryName: '',
    stayLabel: '',
    accommodationName: '',
    accommodationType: '' as '' | AccommodationType,
    accommodationNote: '',
    latitude: '',
    longitude: '',
    places: [],
    memories: [],
  } satisfies CreateTripFormValues['stops'][number];
}

export function createEmptyLeg(transportType: TransportType = 'train') {
  return {
    transportType,
    transportLabel: '',
  } satisfies CreateTripFormValues['legs'][number];
}

export function createEmptyPlace() {
  return {
    title: '',
    note: '',
  } satisfies CreateTripFormValues['stops'][number]['places'][number];
}
