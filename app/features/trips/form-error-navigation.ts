import type { FieldErrors } from 'react-hook-form';

import type { CreateTripFormValues } from '@/features/trips/schemas';

export type TripFormScrollSection = 'title' | 'dates' | 'stops' | 'legs';

function hasNestedErrors(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasNestedErrors(item));
  }

  if (typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.message === 'string' || typeof record.type === 'string') {
    return true;
  }

  return Object.values(record).some((entry) => hasNestedErrors(entry));
}

export function getFirstTripFormErrorSection(
  errors: FieldErrors<CreateTripFormValues>,
): TripFormScrollSection | null {
  if (hasNestedErrors(errors.title)) {
    return 'title';
  }

  if (hasNestedErrors(errors.startDate) || hasNestedErrors(errors.endDate)) {
    return 'dates';
  }

  if (hasNestedErrors(errors.stops)) {
    return 'stops';
  }

  if (hasNestedErrors(errors.returnToStart) || hasNestedErrors(errors.returnLeg) || hasNestedErrors(errors.legs)) {
    return 'legs';
  }

  return null;
}
