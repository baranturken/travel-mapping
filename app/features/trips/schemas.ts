import { z } from 'zod';

import {
  ACCOMMODATION_TYPES,
  TRANSPORT_TYPES,
  type AccommodationType,
  type TransportType,
} from '@/features/trips/types';

const REQUIRED_MESSAGE = 'This field is required.';
const DATE_FORMAT_MESSAGE = 'Use YYYY-MM-DD.';

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
  isHomeBase: z.boolean(),
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
    startDate: z.string().trim(),
    endDate: z.string().trim(),
    stops: z.array(stopSchema).min(2, 'Add at least two stops.'),
    legs: z.array(legSchema).min(1, 'Add at least one transport leg.'),
    returnToStart: z.boolean(),
    returnLeg: legSchema,
  })
  .superRefine((value, context) => {
    const hasStartDate = value.startDate.length > 0;
    const hasEndDate = value.endDate.length > 0;

    if (hasStartDate && !isValidCalendarDate(value.startDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: DATE_FORMAT_MESSAGE,
        path: ['startDate'],
      });
    }

    if (hasEndDate && !isValidCalendarDate(value.endDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: DATE_FORMAT_MESSAGE,
        path: ['endDate'],
      });
    }

    if (hasStartDate !== hasEndDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: hasStartDate ? 'Add an end date too.' : 'Add a start date too.',
        path: [hasStartDate ? 'endDate' : 'startDate'],
      });
    }

    if (
      hasStartDate &&
      hasEndDate &&
      isValidCalendarDate(value.startDate) &&
      isValidCalendarDate(value.endDate) &&
      value.endDate < value.startDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after the start date.',
        path: ['endDate'],
      });
    }

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

    if (value.returnToStart && value.returnLeg.transportType === 'custom' && !value.returnLeg.transportLabel.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add a custom transport label.',
        path: ['returnLeg', 'transportLabel'],
      });
    }
  });

export type CreateTripFormValues = z.infer<typeof createTripSchema>;

export function createEmptyStop() {
  return {
    cityName: '',
    countryName: '',
    isHomeBase: false,
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

export function createDefaultReturnLeg() {
  return {
    transportType: 'plane' as TransportType,
    transportLabel: '',
  } satisfies CreateTripFormValues['returnLeg'];
}

export function createEmptyPlace() {
  return {
    title: '',
    note: '',
  } satisfies CreateTripFormValues['stops'][number]['places'][number];
}
