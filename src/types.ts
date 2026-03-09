export interface CacheOptions {
  maxItems?: number;
  defaultTTL?: string | number;
}

export interface SetOptions {
  ttl?: string | number;
  tags?: string[];
  staleWhileRevalidate?: string | number;
}

export interface WrapOptions {
  ttl?: string | number;
  staleWhileRevalidate?: string | number;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
  staleAt: number | null;
  tags: string[];
}

export interface SerializedCache {
  entries: Array<[string, CacheEntry<unknown> & { key: string }]>;
}
