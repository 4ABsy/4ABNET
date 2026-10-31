import "server-only";

/**
 * Short-lived in-process cache for storefront reads.
 *
 * Why: the app is deployed on Netlify, whose free plan pins functions to a
 * single region (us-east-2), while the Supabase database lives in eu-central-1.
 * Every database round trip therefore costs ~200 ms, and a storefront page needs
 * several. Caching the public read models for a minute removes that cost from
 * almost every request on a warm instance.
 *
 * Rules:
 * - Only public, non-personal data may be cached (settings, catalog, banners).
 * - Never cache anything derived from a session, cookie, or request header.
 * - Checkout, stock reservation, and every mutation read the database directly.
 *
 * Invalidation is best-effort: serverless instances do not share memory, so the
 * TTL is the real contract. Admin writes call `invalidateStoreCache()` to refresh
 * the instance that served them immediately.
 */

type Entry = {
  value: unknown;
  expiresAt: number;
  storedAt: number;
};

/** Fresh window: after this the entry is refreshed. */
export const STORE_CACHE_TTL_MS = 60_000;

/**
 * Hard limit: past this age a stale entry is never served, even if the refresh
 * keeps failing. Bounds how old a cached page can ever be.
 */
export const STORE_CACHE_MAX_STALE_MS = 10 * 60_000;

const MAX_ENTRIES = 300;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function prune(now: number) {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
  // Still too many (all fresh): drop the oldest inserts.
  if (entries.size > MAX_ENTRIES) {
    const ordered = [...entries.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
    for (const [key] of ordered.slice(0, entries.size - MAX_ENTRIES)) entries.delete(key);
  }
}

function refresh<T>(key: string, load: () => Promise<T>, ttlMs: number): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const pending = load()
    .then((value) => {
      const now = Date.now();
      entries.set(key, { value, expiresAt: now + ttlMs, storedAt: now });
      if (entries.size > MAX_ENTRIES) prune(now);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}

/**
 * Return a cached value, refreshing it when stale.
 *
 * When an entry is stale but still within `STORE_CACHE_MAX_STALE_MS`, the stale
 * value is returned immediately and refreshed in the background, so a user never
 * waits for the refresh.
 */
export function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs: number = STORE_CACHE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key);

  if (entry) {
    if (entry.expiresAt > now) return Promise.resolve(entry.value as T);
    if (now - entry.storedAt < STORE_CACHE_MAX_STALE_MS) {
      void refresh(key, load, ttlMs).catch(() => undefined);
      return Promise.resolve(entry.value as T);
    }
  }

  return refresh(key, load, ttlMs);
}

/** Drop every cached storefront read on this instance. */
export function invalidateStoreCache(): void {
  entries.clear();
  inflight.clear();
}

/** Test helper: current number of cached keys. */
export function storeCacheSize(): number {
  return entries.size;
}
