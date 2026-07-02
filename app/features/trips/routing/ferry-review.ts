import type { TransportType } from '@/features/trips/types';
import {
  HIGH_CONFIDENCE_LANDLOCKED_COUNTRIES,
  normalizeTripLocationText,
} from '@/features/trips/routing/landlocked-countries';

type FerryReviewStop = {
  cityName: string;
  countryName: string;
  latitude: number | string;
  longitude: number | string;
};

type FerryReviewLeg = {
  transportType: TransportType;
  transportLabel?: string | null;
};

type FerryReviewInput = {
  stops: FerryReviewStop[];
  legs: FerryReviewLeg[];
  returnToStart: boolean;
  returnLeg: FerryReviewLeg;
};

export type SuspiciousFerryReview = {
  key: string;
  segmentKind: 'leg' | 'return';
  index: number;
  routeLabel: string;
  question: string;
  explanation: string;
};

const MIN_LANDLOCKED_FERRY_DISTANCE_KM = 120;

function normalizeText(value: string) {
  return normalizeTripLocationText(value);
}

function formatStopLabel(stop: Pick<FerryReviewStop, 'cityName' | 'countryName'>) {
  return `${stop.cityName.trim()}, ${stop.countryName.trim()}`;
}

function toCoordinateNumber(value: number | string) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKilometers(from: FerryReviewStop, to: FerryReviewStop) {
  const fromLatitude = toCoordinateNumber(from.latitude);
  const fromLongitude = toCoordinateNumber(from.longitude);
  const toLatitude = toCoordinateNumber(to.latitude);
  const toLongitude = toCoordinateNumber(to.longitude);

  if (
    fromLatitude === null ||
    fromLongitude === null ||
    toLatitude === null ||
    toLongitude === null
  ) {
    return null;
  }

  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function roundDistanceKilometers(value: number) {
  if (value < 20) {
    return Math.round(value);
  }

  return Math.round(value / 10) * 10;
}

function buildStopSignature(stop: FerryReviewStop) {
  const latitude = toCoordinateNumber(stop.latitude);
  const longitude = toCoordinateNumber(stop.longitude);

  return [
    normalizeText(stop.cityName),
    normalizeText(stop.countryName),
    latitude === null ? 'na' : latitude.toFixed(4),
    longitude === null ? 'na' : longitude.toFixed(4),
  ].join('|');
}

function createSuspiciousFerryReview(
  segmentKind: SuspiciousFerryReview['segmentKind'],
  index: number,
  leg: FerryReviewLeg,
  fromStop: FerryReviewStop | undefined,
  toStop: FerryReviewStop | undefined,
) {
  if (leg.transportType !== 'ferry' || !fromStop || !toStop) {
    return null;
  }

  const fromCountry = normalizeText(fromStop.countryName);
  const toCountry = normalizeText(toStop.countryName);
  const landlockedStop = HIGH_CONFIDENCE_LANDLOCKED_COUNTRIES.has(fromCountry)
    ? fromStop
    : HIGH_CONFIDENCE_LANDLOCKED_COUNTRIES.has(toCountry)
      ? toStop
      : null;

  if (!landlockedStop) {
    return null;
  }

  const distanceKilometers = getDistanceKilometers(fromStop, toStop);

  if (distanceKilometers === null || distanceKilometers < MIN_LANDLOCKED_FERRY_DISTANCE_KM) {
    return null;
  }

  const routeLabel = `${formatStopLabel(fromStop)} → ${formatStopLabel(toStop)}`;
  const fromCityName = fromStop.cityName.trim() || `Stop ${index + 1}`;
  const toCityName = toStop.cityName.trim() || `Stop ${index + 2}`;
  const distanceLabel = roundDistanceKilometers(distanceKilometers);

  return {
    key: [
      'ferry-review',
      segmentKind,
      index.toString(),
      leg.transportType,
      buildStopSignature(fromStop),
      buildStopSignature(toStop),
    ].join(':'),
    segmentKind,
    index,
    routeLabel,
    question: `Are you sure you traveled by ferry from ${fromCityName} to ${toCityName}?`,
    explanation: `${landlockedStop.cityName.trim()} is in landlocked ${landlockedStop.countryName.trim()}, and this leg is about ${distanceLabel} km as the crow flies.`,
  } satisfies SuspiciousFerryReview;
}

export function getSuspiciousFerryReviews(input: FerryReviewInput) {
  const reviews = input.legs.flatMap((leg, index) => {
    const review = createSuspiciousFerryReview('leg', index, leg, input.stops[index], input.stops[index + 1]);
    return review ? [review] : [];
  });

  if (!input.returnToStart || input.stops.length < 2) {
    return reviews;
  }

  const returnReview = createSuspiciousFerryReview(
    'return',
    input.legs.length,
    input.returnLeg,
    input.stops[input.stops.length - 1],
    input.stops[0],
  );

  return returnReview ? [...reviews, returnReview] : reviews;
}

export function buildSuspiciousFerryConfirmationMessage(reviews: SuspiciousFerryReview[]) {
  const lines = reviews.flatMap((review) => [`• ${review.question}`, review.explanation, '']);

  return [
    'These ferry legs look unlikely. Please double-check them before saving.',
    '',
    ...lines.slice(0, -1),
    '',
    'Tap "Keep ferry" only if this was intentional.',
  ].join('\n');
}

export function getUnresolvedSuspiciousFerryReviews(
  input: FerryReviewInput,
  confirmedReviewKeys: Iterable<string>,
) {
  const confirmedKeys = new Set(confirmedReviewKeys);
  return getSuspiciousFerryReviews(input).filter((review) => !confirmedKeys.has(review.key));
}

export function buildFerryReviewStateSignature(input: FerryReviewInput) {
  return [
    input.stops.map(buildStopSignature).join('>'),
    input.legs
      .map(
        (leg, index) =>
          `${index}:${leg.transportType}:${normalizeText(leg.transportLabel ?? '')}`,
      )
      .join('|'),
    input.returnToStart
      ? `return:${input.returnLeg.transportType}:${normalizeText(input.returnLeg.transportLabel ?? '')}`
      : 'return:off',
  ].join('||');
}
