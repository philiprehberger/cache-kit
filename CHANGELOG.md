# Changelog

## 0.3.3

- Add Development section to README
- Fix CI badge to reference publish.yml

## 0.3.0

- Add `onRevalidateError` option to `wrap()` for handling stale-while-revalidate failures
- Add `keys()` method that returns all non-expired keys with lazy cleanup of expired entries
- Add `size()` method that returns the number of entries in the store

## 0.2.3

- Fix npm package name references in README

## 0.2.2

- Fix npm package name (restore original name without ts- prefix)

## 0.2.1

- Update repository URLs to new ts-prefixed GitHub repo

## 0.2.0

- Add comprehensive test suite (26 tests covering LRU eviction, TTL, tags, wrap, stats, persistence)
- Add CI workflow for push/PR testing
- Add test step to publish workflow
- Add API reference and duration format docs to README

## 0.1.0
- Initial release
