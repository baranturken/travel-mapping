type RawCityRecord = [cityName: string, countryCode: string, latitude: number, longitude: number, population: number];

export type CityOption = {
  id: string;
  cityName: string;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
  population: number;
};

type IndexedCityOption = CityOption & {
  cityLower: string;
  countryLower: string;
  searchLower: string;
};

const cityRecords = require('./world-cities-data.json') as RawCityRecord[];
const countryNames =
  typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

let indexedCities: IndexedCityOption[] | null = null;

function formatCountryName(countryCode: string) {
  return countryNames?.of(countryCode) ?? countryCode;
}

function getIndexedCities() {
  if (indexedCities) {
    return indexedCities;
  }

  indexedCities = cityRecords.map((record) => {
    const [cityName, countryCode, latitude, longitude, population] = record;
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    const countryName = formatCountryName(normalizedCountryCode);
    const trimmedCityName = cityName.trim();
    const id = `${trimmedCityName}|${normalizedCountryCode}|${latitude}|${longitude}`;

    return {
      id,
      cityName: trimmedCityName,
      countryCode: normalizedCountryCode,
      countryName,
      latitude,
      longitude,
      population,
      cityLower: trimmedCityName.toLowerCase(),
      countryLower: countryName.toLowerCase(),
      searchLower: `${trimmedCityName.toLowerCase()} ${countryName.toLowerCase()} ${normalizedCountryCode.toLowerCase()}`,
    };
  });

  return indexedCities;
}

function toCityOption(city: IndexedCityOption): CityOption {
  return {
    id: city.id,
    cityName: city.cityName,
    countryCode: city.countryCode,
    countryName: city.countryName,
    latitude: city.latitude,
    longitude: city.longitude,
    population: city.population,
  };
}

export function searchWorldCities(query: string, limit = 20): CityOption[] {
  const normalizedQuery = query.replaceAll(',', ' ').trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const exactPrefixMatches: IndexedCityOption[] = [];
  const inclusiveMatches: IndexedCityOption[] = [];

  for (const city of getIndexedCities()) {
    if (city.cityLower.startsWith(normalizedQuery) || city.searchLower.startsWith(normalizedQuery)) {
      exactPrefixMatches.push(city);
      continue;
    }

    if (
      city.cityLower.includes(normalizedQuery) ||
      city.countryLower.includes(normalizedQuery) ||
      city.searchLower.includes(normalizedQuery)
    ) {
      inclusiveMatches.push(city);
    }
  }

  const sortedMatches = [...exactPrefixMatches, ...inclusiveMatches]
    .sort((left, right) => {
      if (right.population !== left.population) {
        return right.population - left.population;
      }

      if (left.cityName !== right.cityName) {
        return left.cityName.localeCompare(right.cityName);
      }

      return left.countryName.localeCompare(right.countryName);
    })
    .slice(0, limit);

  return sortedMatches.map(toCityOption);
}
