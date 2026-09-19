// A small in-memory cache for social reads, so revisiting a screen paints
// immediately instead of showing a skeleton while the network answers again.
//
// The pattern is stale-while-revalidate: render whatever is cached at once,
// fetch in the background, and swap in the fresh copy if it differs. A profile
// you looked at ten seconds ago is almost certainly still accurate, and showing
// it instantly is far better than showing nothing accurately.
//
// Deliberately in memory only. This is a latency cache, not offline support —
// trips are already offline-first in SQLite, and persisting social data would
// mean inventing an invalidation story for likes, follows and comments that
// change from other devices.

type Entry = { value: unknown; at: number };

// Past this age an entry is still returned (so the screen paints) but is
// treated as stale by callers that care.
const STALE_AFTER_MS = 30_000;

// Bounded so a long browsing session cannot grow it without limit. Eviction is
// oldest-inserted-first, which for a browse-and-return pattern is close enough
// to least-recently-used.
const MAX_ENTRIES = 60;

const store = new Map<string, Entry>();

export function cacheKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function readCache<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.value as T) : null;
}

/** True when the entry is missing or old enough to be worth refetching eagerly. */
export function isStale(key: string, now = Date.now()): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  return now - entry.at > STALE_AFTER_MS;
}

export function writeCache(key: string, value: unknown, now = Date.now()): void {
  // Re-inserting moves the key to the end of the iteration order, so a
  // frequently-revisited entry is not the first one evicted.
  store.delete(key);
  store.set(key, { value, at: now });

  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

/** Drop one entry, or every entry whose key starts with `prefix`. */
export function invalidateCache(prefix: string): void {
  if (store.has(prefix)) {
    store.delete(prefix);
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Exposed for tests; also the right thing to call on sign-out. */
export function clearCache(): void {
  store.clear();
}

export function cacheSize(): number {
  return store.size;
}
