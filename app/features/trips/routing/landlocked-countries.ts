export const HIGH_CONFIDENCE_LANDLOCKED_COUNTRIES = new Set([
  'andorra',
  'austria',
  'czech republic',
  'czechia',
  'hungary',
  'kosovo',
  'liechtenstein',
  'luxembourg',
  'north macedonia',
  'san marino',
  'serbia',
  'slovakia',
  'switzerland',
  'vatican city',
]);

export function normalizeTripLocationText(value: string) {
  return value.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

export function isHighConfidenceLandlockedCountry(countryName: string) {
  return HIGH_CONFIDENCE_LANDLOCKED_COUNTRIES.has(normalizeTripLocationText(countryName));
}
