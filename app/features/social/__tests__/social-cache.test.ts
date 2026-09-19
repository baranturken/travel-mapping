import {
  cacheKey,
  cacheSize,
  clearCache,
  invalidateCache,
  isStale,
  readCache,
  writeCache,
} from '@/features/social/social-cache';

describe('social cache', () => {
  beforeEach(() => clearCache());

  it('returns null for a key it has never seen', () => {
    expect(readCache('profile:nobody')).toBeNull();
  });

  it('round-trips a value', () => {
    writeCache('profile:a', { id: 'a', displayName: 'Admin' });
    expect(readCache('profile:a')).toEqual({ id: 'a', displayName: 'Admin' });
  });

  it('namespaces keys by kind so trips and profiles cannot collide', () => {
    writeCache(cacheKey('profile', 'a'), 'the profile');
    writeCache(cacheKey('userTrips', 'a'), 'the trips');
    expect(readCache(cacheKey('profile', 'a'))).toBe('the profile');
    expect(readCache(cacheKey('userTrips', 'a'))).toBe('the trips');
  });

  it('overwrites rather than duplicating on rewrite', () => {
    writeCache('profile:a', 1);
    writeCache('profile:a', 2);
    expect(readCache('profile:a')).toBe(2);
    expect(cacheSize()).toBe(1);
  });

  describe('staleness', () => {
    it('treats a missing key as stale', () => {
      expect(isStale('profile:missing')).toBe(true);
    });

    it('treats a fresh write as not stale', () => {
      writeCache('profile:a', 1, 1_000);
      expect(isStale('profile:a', 1_000)).toBe(false);
    });

    it('goes stale after the window', () => {
      writeCache('profile:a', 1, 1_000);
      expect(isStale('profile:a', 1_000 + 29_000)).toBe(false);
      expect(isStale('profile:a', 1_000 + 31_000)).toBe(true);
    });

    it('still returns a stale value — stale content beats no content', () => {
      writeCache('profile:a', 'old', 1_000);
      expect(isStale('profile:a', 999_999)).toBe(true);
      expect(readCache('profile:a')).toBe('old');
    });
  });

  describe('eviction', () => {
    it('stays bounded', () => {
      for (let i = 0; i < 200; i++) writeCache(`profile:${i}`, i);
      expect(cacheSize()).toBeLessThanOrEqual(60);
    });

    it('evicts the oldest first', () => {
      for (let i = 0; i < 61; i++) writeCache(`profile:${i}`, i);
      expect(readCache('profile:0')).toBeNull();
      expect(readCache('profile:60')).toBe(60);
    });

    it('rewriting an entry saves it from being evicted next', () => {
      for (let i = 0; i < 60; i++) writeCache(`profile:${i}`, i);
      // Touch the oldest, so something else should go instead.
      writeCache('profile:0', 'touched');
      writeCache('profile:new', 'new');
      expect(readCache('profile:0')).toBe('touched');
      expect(readCache('profile:1')).toBeNull();
    });
  });

  describe('invalidation', () => {
    it('drops an exact key', () => {
      writeCache('profile:a', 1);
      writeCache('profile:b', 2);
      invalidateCache('profile:a');
      expect(readCache('profile:a')).toBeNull();
      expect(readCache('profile:b')).toBe(2);
    });

    it('drops every key under a prefix', () => {
      writeCache('profile:a', 1);
      writeCache('profile:b', 2);
      writeCache('userTrips:a', 3);
      invalidateCache('profile:');
      expect(readCache('profile:a')).toBeNull();
      expect(readCache('profile:b')).toBeNull();
      expect(readCache('userTrips:a')).toBe(3);
    });

    it('clears everything on sign-out', () => {
      writeCache('profile:a', 1);
      writeCache('userTrips:a', 2);
      clearCache();
      expect(cacheSize()).toBe(0);
    });
  });
});
