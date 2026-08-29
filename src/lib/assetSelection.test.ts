import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { findAssetById } from './assetSelection';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    userId: 'owner-1',
    authorName: 'Owner',
    title: 'Original title',
    icon: { type: 'emoji', value: '✨' },
    category: 'character',
    content: 'content',
    isPublic: true,
    visibility: 'public',
    status: 'finished',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides
  };
}

describe('asset selection', () => {
  it('resolves the latest canonical asset object by ID', () => {
    const original = makeAsset();
    const updated = makeAsset({ title: 'Updated title', updatedAt: '2026-02-01T00:00:00.000Z' });

    expect(findAssetById([updated], original.id)).toBe(updated);
    expect(findAssetById([updated], original.id)?.title).toBe('Updated title');
  });

  it('returns null when a selected asset has disappeared', () => {
    expect(findAssetById([makeAsset({ id: 'other-asset' })], 'asset-1')).toBeNull();
    expect(findAssetById([], null)).toBeNull();
  });
});
