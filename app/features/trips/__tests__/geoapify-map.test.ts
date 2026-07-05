// The Geoapify key is read from the environment at module load, so set it
// before importing the module under test.
process.env.EXPO_PUBLIC_GEOAPIFY_KEY = 'test-key';

 
const { buildStaticRouteMapUrl } = require('@/features/trips/geoapify-map') as typeof import('@/features/trips/geoapify-map');

const stop = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('buildStaticRouteMapUrl', () => {
  it('returns null when there are no valid stops', () => {
    expect(buildStaticRouteMapUrl([])).toBeNull();
    expect(buildStaticRouteMapUrl([stop(0, 0)])).toBeNull();
  });

  it('drops a marker for a single valid stop without a route line', () => {
    const url = buildStaticRouteMapUrl([stop(37.98, 23.72)]);
    expect(url).toContain('marker=');
    expect(url).not.toContain('geometry=polyline');
  });

  it('draws a connecting route line when there are two or more stops', () => {
    const url = buildStaticRouteMapUrl([stop(37.98, 23.72), stop(36.39, 25.46)]);
    expect(url).toContain('geometry=polyline:');
    // lon,lat pairs in order, comma-joined.
    expect(url).toContain('23.72000,37.98000,25.46000,36.39000');
    expect(url).toContain('apiKey=test-key');
  });
});
