import type { CacheOptions, SetOptions, WrapOptions, CacheStats, CacheEntry, SerializedCache } from './types.js';
import { parseDuration } from './duration.js';

export function createCache<V = unknown>(options: CacheOptions = {}) {
  const { maxItems = Infinity } = options;
  const defaultTTL = options.defaultTTL ? parseDuration(options.defaultTTL) : null;

  const store = new Map<string, CacheEntry<V>>();
  const tagIndex = new Map<string, Set<string>>();
  let hits = 0;
  let misses = 0;

  function evictLRU(): void {
    if (store.size <= maxItems) return;
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) {
      deleteEntry(firstKey);
    }
  }

  function deleteEntry(key: string): void {
    const entry = store.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        const keys = tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) tagIndex.delete(tag);
        }
      }
      store.delete(key);
    }
  }

  function isExpired(entry: CacheEntry<V>): boolean {
    if (entry.expiresAt === null) return false;
    return Date.now() > entry.expiresAt;
  }

  function isStale(entry: CacheEntry<V>): boolean {
    if (entry.staleAt === null) return false;
    return Date.now() > entry.staleAt;
  }

  function set(key: string, value: V, opts?: SetOptions): void {
    deleteEntry(key);

    const ttl = opts?.ttl ? parseDuration(opts.ttl) : defaultTTL;
    const swr = opts?.staleWhileRevalidate ? parseDuration(opts.staleWhileRevalidate) : null;
    const now = Date.now();
    const tags = opts?.tags ?? [];

    const entry: CacheEntry<V> = {
      value,
      expiresAt: ttl ? now + ttl : null,
      staleAt: ttl && swr ? now + ttl - swr : null,
      tags,
    };

    store.set(key, entry);

    for (const tag of tags) {
      let keys = tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        tagIndex.set(tag, keys);
      }
      keys.add(key);
    }

    evictLRU();
  }

  function get(key: string): V | undefined {
    const entry = store.get(key);
    if (!entry) {
      misses++;
      return undefined;
    }

    if (isExpired(entry)) {
      deleteEntry(key);
      misses++;
      return undefined;
    }

    hits++;
    // Move to end for LRU
    store.delete(key);
    store.set(key, entry);

    return entry.value;
  }

  function has(key: string): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      deleteEntry(key);
      return false;
    }
    return true;
  }

  function del(key: string): boolean {
    if (!store.has(key)) return false;
    deleteEntry(key);
    return true;
  }

  function clear(): void {
    store.clear();
    tagIndex.clear();
    hits = 0;
    misses = 0;
  }

  function invalidateTag(tag: string): number {
    const keys = tagIndex.get(tag);
    if (!keys) return 0;
    const count = keys.size;
    for (const key of [...keys]) {
      deleteEntry(key);
    }
    return count;
  }

  function wrap<TArgs extends unknown[], TReturn extends V>(
    keyPrefix: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    opts?: WrapOptions,
  ): (...args: TArgs) => Promise<TReturn> {
    const revalidating = new Set<string>();

    return async (...args: TArgs): Promise<TReturn> => {
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
      const entry = store.get(cacheKey);

      if (entry && !isExpired(entry)) {
        hits++;
        // Move to end for LRU
        store.delete(cacheKey);
        store.set(cacheKey, entry);

        // Stale-while-revalidate
        if (isStale(entry) && !revalidating.has(cacheKey)) {
          revalidating.add(cacheKey);
          fn(...args)
            .then((value) => set(cacheKey, value, opts))
            .catch(() => {})
            .finally(() => revalidating.delete(cacheKey));
        }

        return entry.value as TReturn;
      }

      misses++;
      const value = await fn(...args);
      set(cacheKey, value, opts);
      return value;
    };
  }

  function stats(): CacheStats {
    const total = hits + misses;
    return {
      hits,
      misses,
      hitRate: total === 0 ? 0 : hits / total,
      size: store.size,
    };
  }

  function dump(): SerializedCache {
    const entries: SerializedCache['entries'] = [];
    for (const [key, entry] of store) {
      entries.push([key, { ...entry, key }]);
    }
    return { entries };
  }

  function load(data: SerializedCache): void {
    clear();
    for (const [key, entry] of data.entries) {
      const { key: _key, ...rest } = entry;
      store.set(key, rest as CacheEntry<V>);
      for (const tag of rest.tags) {
        let keys = tagIndex.get(tag);
        if (!keys) {
          keys = new Set();
          tagIndex.set(tag, keys);
        }
        keys.add(key);
      }
    }
  }

  return { set, get, has, delete: del, clear, invalidateTag, wrap, stats, dump, load };
}
