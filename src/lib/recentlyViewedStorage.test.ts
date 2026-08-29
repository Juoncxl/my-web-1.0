import { describe, expect, it } from 'vitest';
import {
  normalizeRecentlyViewed,
  readRecentlyViewed,
  recordRecentlyViewed,
  writeRecentlyViewed
} from './recentlyViewedStorage';

describe('recently viewed storage', () => {
  it('safely normalizes malformed and invalid stored values', () => {
    expect(normalizeRecentlyViewed(null)).toEqual([]);
    expect(normalizeRecentlyViewed(['asset-1', 42, '', 'asset-1', 'asset-2'])).toEqual([
      'asset-1',
      'asset-2'
    ]);
    expect(readRecentlyViewed({ getItem: () => '{invalid json' })).toEqual([]);
    expect(readRecentlyViewed({ getItem: () => JSON.stringify({ ids: ['asset-1'] }) })).toEqual([]);
  });

  it('moves the viewed asset to the front and keeps the list bounded', () => {
    expect(recordRecentlyViewed(['asset-2', 'asset-1', 'asset-2'], 'asset-1')).toEqual([
      'asset-1',
      'asset-2'
    ]);
    expect(recordRecentlyViewed(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    expect(recordRecentlyViewed(['a'], '   ')).toEqual(['a']);
  });

  it('writes normalized values and treats storage failures as best effort', () => {
    let saved = '';
    writeRecentlyViewed({ setItem: (_key, value) => { saved = value; } }, ['a', 'a', 1 as unknown as string]);
    expect(JSON.parse(saved)).toEqual(['a']);

    expect(() => writeRecentlyViewed({ setItem: () => { throw new Error('storage full'); } }, ['a'])).not.toThrow();
  });
});
