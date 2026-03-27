# @philiprehberger/cache-kit

[![CI](https://github.com/philiprehberger/ts-cache-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/ts-cache-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/cache-kit.svg)](https://www.npmjs.com/package/@philiprehberger/cache-kit)
[![License](https://img.shields.io/github/license/philiprehberger/ts-cache-kit)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ec6cb9)](https://github.com/sponsors/philiprehberger)

In-memory LRU cache with TTL, stale-while-revalidate, and tag invalidation

## Installation

```bash
npm install @philiprehberger/cache-kit
```

## Usage

### Basic

```ts
import { createCache } from '@philiprehberger/cache-kit';

const cache = createCache({ maxItems: 1000, defaultTTL: '5m' });

cache.set('user:123', userData);
cache.set('user:456', otherUser, { ttl: '10m' });

const user = cache.get('user:123'); // T | undefined
cache.has('user:123');              // boolean
cache.delete('user:123');           // boolean
cache.clear();
```

### TTL Durations

Supports string durations or milliseconds:

```ts
cache.set('key', value, { ttl: '30s' });  // 30 seconds
cache.set('key', value, { ttl: '5m' });   // 5 minutes
cache.set('key', value, { ttl: '1h' });   // 1 hour
cache.set('key', value, { ttl: '1d' });   // 1 day
cache.set('key', value, { ttl: 60000 });  // 60000ms
```

### Tag-Based Invalidation

```ts
cache.set('user:1', user1, { tags: ['users'] });
cache.set('user:2', user2, { tags: ['users'] });
cache.set('post:1', post1, { tags: ['posts'] });

cache.invalidateTag('users'); // removes user:1 and user:2
```

### Wrap (Memoize)

```ts
const getUser = cache.wrap(
  'user',
  (id: string) => db.users.findById(id),
  { ttl: '5m' },
);

const user = await getUser('123'); // fetches from DB
const same = await getUser('123'); // served from cache
```

### Stale-While-Revalidate

```ts
const getUser = cache.wrap(
  'user',
  (id: string) => db.users.findById(id),
  {
    ttl: '5m',
    staleWhileRevalidate: '1m',
    onRevalidateError: (err, key) => console.error(`SWR failed for ${key}:`, err),
  },
);
// Serves stale data immediately while refreshing in the background
// If revalidation fails, onRevalidateError is called instead of silently swallowing the error
```

### Keys & Size

```ts
cache.keys();  // ['user:1', 'user:2'] — all non-expired keys (lazy-cleans expired entries)
cache.size();  // 2 — number of entries in the store
```

### Stats

```ts
cache.stats();
// { hits: 150, misses: 23, hitRate: 0.867, size: 42 }
```

### Persistence

```ts
const data = cache.dump();   // serialize to JSON
cache.load(data);            // restore from JSON
```

## API

### `createCache<V>(options?: CacheOptions): Cache<V>`

| Method | Signature | Description |
|--------|-----------|-------------|
| `set` | `(key: string, value: V, opts?: SetOptions) => void` | Store a value. |
| `get` | `(key: string) => V \| undefined` | Retrieve a value. Returns `undefined` if missing or expired. |
| `has` | `(key: string) => boolean` | Check if a key exists and is not expired. |
| `delete` | `(key: string) => boolean` | Remove a key. Returns `true` if it existed. |
| `clear` | `() => void` | Remove all entries and reset stats. |
| `invalidateTag` | `(tag: string) => number` | Remove all entries with the given tag. Returns count removed. |
| `wrap` | `(keyPrefix, fn, opts?) => (...args) => Promise` | Memoize an async function with cache. |
| `stats` | `() => CacheStats` | Get hit/miss/size statistics. |
| `keys` | `() => string[]` | Return all non-expired keys. Lazy-cleans expired entries. |
| `size` | `() => number` | Return the number of entries in the store. |
| `dump` | `() => SerializedCache` | Serialize cache contents for persistence. |
| `load` | `(data: SerializedCache) => void` | Restore cache from serialized data. |

### `CacheOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxItems` | `number` | `Infinity` | Max entries before LRU eviction. |
| `defaultTTL` | `string \| number` | None | Default TTL for all entries. |

### `SetOptions`

| Property | Type | Description |
|----------|------|-------------|
| `ttl` | `string \| number` | Time-to-live (e.g. `"5m"`, `60000`). |
| `tags` | `string[]` | Tags for group invalidation. |
| `staleWhileRevalidate` | `string \| number` | Window before expiry where stale data is served while refreshing. |

### `WrapOptions`

Extends `SetOptions` with:

| Property | Type | Description |
|----------|------|-------------|
| `onRevalidateError` | `(error: Error, key: string) => void` | Called when a stale-while-revalidate background refresh fails. If omitted, errors are silently swallowed. |

### Duration Strings

`"100ms"`, `"30s"`, `"5m"`, `"1h"`, `"1d"` — or pass milliseconds as a number


## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
