import {
  buildPhotoStoryHtml,
  TEMPLATE_PHOTO_LIMITS,
  type StoryTemplate,
} from '@/features/trips/photo-story-renderer';
import type { TripDetail, TripStop } from '@/features/trips/types';
import type { TripStats } from '@/features/trips/trip-stats';

function makeStop(id: string, city: string, lat: number, lon: number): TripStop {
  return {
    id,
    tripId: 'trip-1',
    orderIndex: 0,
    cityName: city,
    countryName: 'Testland',
    isHomeBase: false,
    stayLabel: null,
    accommodationName: null,
    accommodationType: null,
    accommodationNote: null,
    latitude: lat,
    longitude: lon,
    places: [],
    memories: [],
  };
}

function makeTrip(): TripDetail {
  return {
    id: 'trip-1',
    title: 'Aegean Hop',
    startDate: '2026-05-01',
    endDate: '2026-05-08',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    isPublic: false,
    supabaseId: null,
    publishedAt: null,
    stops: [
      makeStop('s1', 'Athens', 37.98, 23.72),
      makeStop('s2', 'Naxos', 37.1, 25.37),
      makeStop('s3', 'Santorini', 36.39, 25.46),
    ],
    legs: [
      { id: 'l1', tripId: 'trip-1', fromStopId: 's1', toStopId: 's2', orderIndex: 0, transportType: 'ferry', transportLabel: null },
      { id: 'l2', tripId: 'trip-1', fromStopId: 's2', toStopId: 's3', orderIndex: 1, transportType: 'ferry', transportLabel: null },
    ],
  };
}

const STATS: TripStats = { countryCount: 1, cityCount: 3, dayCount: 7, totalDistanceKm: 250 };

// Pull the serialized `const PHOTOS = [...]` array literal back out of the HTML
// so we can assert how many photos a template actually decodes.
function decodedPhotoCount(html: string): number {
  const match = html.match(/const PHOTOS\s+=\s+(\[[^\]]*\]);/);
  if (!match) throw new Error('PHOTOS literal not found in generated HTML');
  return (JSON.parse(match[1]) as string[]).length;
}

describe('TEMPLATE_PHOTO_LIMITS', () => {
  const templates = Object.keys(TEMPLATE_PHOTO_LIMITS) as StoryTemplate[];

  it('keeps every template within a sane, consistent range', () => {
    for (const t of templates) {
      const { min, max } = TEMPLATE_PHOTO_LIMITS[t];
      expect(min).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThanOrEqual(max);
      expect(max).toBeLessThanOrEqual(4);
    }
  });

  it('requires exactly three photos for the sunset template', () => {
    expect(TEMPLATE_PHOTO_LIMITS.sunset).toEqual({ min: 3, max: 3 });
  });
});

describe('buildPhotoStoryHtml photo capping', () => {
  const photos = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'];

  it('never decodes more photos than the template allows', () => {
    const templates = Object.keys(TEMPLATE_PHOTO_LIMITS) as StoryTemplate[];
    for (const template of templates) {
      const html = buildPhotoStoryHtml(makeTrip(), STATS, {}, photos, { template });
      expect(decodedPhotoCount(html)).toBe(TEMPLATE_PHOTO_LIMITS[template].max);
    }
  });

  it('keeps every selected photo for journey (multi-photo, not just the first)', () => {
    const html = buildPhotoStoryHtml(makeTrip(), STATS, {}, ['AAA', 'BBB', 'CCC'], {
      template: 'journey',
    });
    expect(decodedPhotoCount(html)).toBe(3);
  });

  it('produces a self-contained HTML document for a single photo', () => {
    const html = buildPhotoStoryHtml(makeTrip(), STATS, {}, ['AAA'], { template: 'minimal' });
    expect(html).toContain('<canvas id="c"');
    expect(decodedPhotoCount(html)).toBe(1);
  });
});

describe('generated canvas script validity', () => {
  // A syntax error in the in-HTML canvas script silently breaks every story, so
  // compile (not run) the script body for each template and photo count.
  const templates = Object.keys(TEMPLATE_PHOTO_LIMITS) as StoryTemplate[];

  it.each(templates)('emits syntactically valid JS for the %s template', (template) => {
    for (const count of [0, 1, 2, 3, 4]) {
      const photos = Array.from({ length: count }, (_, i) => `P${i}`);
      const html = buildPhotoStoryHtml(makeTrip(), STATS, {}, photos, { template });
      const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
      expect(script).toBeTruthy();
      // Throws SyntaxError if the script body does not parse.
      expect(() => new Function(script as string)).not.toThrow();
    }
  });
});
