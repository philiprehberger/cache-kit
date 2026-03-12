import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { createCache, parseDuration } = await import('../../dist/index.js');

describe('parseDuration', () => {
  it('parses milliseconds', () => assert.equal(parseDuration('100ms'), 100));
  it('parses seconds', () => assert.equal(parseDuration('5s'), 5000));
  it('parses minutes', () => assert.equal(parseDuration('5m'), 300000));
  it('parses hours', () => assert.equal(parseDuration('1h'), 3600000));
  it('parses days', () => assert.equal(parseDuration('1d'), 86400000));
  it('passes through numbers', () => assert.equal(parseDuration(5000), 5000));
  it('throws on invalid format', () => {
    assert.throws(() => parseDuration('5x'), /Invalid duration/);
  });
});

describe('basic operations', () => {
  it('set and get', () => {
    const cache = createCache();
    cache.set('key', 'value');
    assert.equal(cache.get('key'), 'value');
  });

  it('returns undefined for missing key', () => {
    const cache = createCache();
    assert.equal(cache.get('missing'), undefined);
  });

  it('has returns true for existing key', () => {
    const cache = createCache();
    cache.set('key', 1);
    assert.equal(cache.has('key'), true);
  });

  it('has returns false for missing key', () => {
    const cache = createCache();
    assert.equal(cache.has('missing'), false);
  });

  it('delete removes an entry', () => {
    const cache = createCache();
    cache.set('key', 1);
    assert.equal(cache.delete('key'), true);
    assert.equal(cache.get('key'), undefined);
  });

  it('delete returns false for missing key', () => {
    const cache = createCache();
    assert.equal(cache.delete('missing'), false);
  });

  it('clear removes all entries', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), undefined);
  });
});

describe('TTL expiration', () => {
  it('expires entries after TTL', async () => {
    const cache = createCache();
    cache.set('key', 'value', { ttl: '100ms' });
    assert.equal(cache.get('key'), 'value');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(cache.get('key'), undefined);
  });

  it('uses default TTL', async () => {
    const cache = createCache({ defaultTTL: '100ms' });
    cache.set('key', 'value');
    assert.equal(cache.get('key'), 'value');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(cache.get('key'), undefined);
  });

  it('has returns false for expired entries', async () => {
    const cache = createCache();
    cache.set('key', 'value', { ttl: '50ms' });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(cache.has('key'), false);
  });
});

describe('LRU eviction', () => {
  it('evicts oldest entry when maxItems exceeded', () => {
    const cache = createCache({ maxItems: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
  });

  it('accessing an entry moves it to end', () => {
    const cache = createCache({ maxItems: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // move 'a' to end
    cache.set('c', 3); // should evict 'b'
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('c'), 3);
  });
});

describe('tag invalidation', () => {
  it('invalidates entries by tag', () => {
    const cache = createCache();
    cache.set('u1', 'user1', { tags: ['users'] });
    cache.set('u2', 'user2', { tags: ['users'] });
    cache.set('p1', 'post1', { tags: ['posts'] });
    const count = cache.invalidateTag('users');
    assert.equal(count, 2);
    assert.equal(cache.get('u1'), undefined);
    assert.equal(cache.get('u2'), undefined);
    assert.equal(cache.get('p1'), 'post1');
  });

  it('returns 0 for unknown tag', () => {
    const cache = createCache();
    assert.equal(cache.invalidateTag('unknown'), 0);
  });
});

describe('wrap (memoize)', () => {
  it('caches function results', async () => {
    const cache = createCache();
    let calls = 0;
    const fn = cache.wrap('test', async (n) => {
      calls++;
      return n * 2;
    }, { ttl: '5m' });

    assert.equal(await fn(5), 10);
    assert.equal(await fn(5), 10);
    assert.equal(calls, 1);
  });

  it('different args produce different cache keys', async () => {
    const cache = createCache();
    let calls = 0;
    const fn = cache.wrap('test', async (n) => {
      calls++;
      return n * 2;
    }, { ttl: '5m' });

    assert.equal(await fn(1), 2);
    assert.equal(await fn(2), 4);
    assert.equal(calls, 2);
  });
});

describe('stats', () => {
  it('tracks hits and misses', () => {
    const cache = createCache();
    cache.set('key', 'value');
    cache.get('key');    // hit
    cache.get('key');    // hit
    cache.get('miss');   // miss
    const s = cache.stats();
    assert.equal(s.hits, 2);
    assert.equal(s.misses, 1);
    assert.ok(s.hitRate > 0.6);
    assert.equal(s.size, 1);
  });

  it('resets stats on clear', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.get('a');
    cache.clear();
    const s = cache.stats();
    assert.equal(s.hits, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.size, 0);
  });
});

describe('persistence', () => {
  it('dump and load round-trips', () => {
    const cache = createCache();
    cache.set('a', 1, { tags: ['t'] });
    cache.set('b', 2);
    const data = cache.dump();
    cache.clear();
    cache.load(data);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), 2);
  });
});
