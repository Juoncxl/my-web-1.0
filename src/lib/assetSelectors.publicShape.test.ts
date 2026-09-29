import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { getAssetPlatforms, selectFilteredAssets, selectPlatformCounts } from './assetSelectors';

const publicWork = (metadata: unknown): Asset => ({
  id: 'asset_public', userId: '', title: 'Public Work', icon: { type: 'emoji', value: '✨' }, category: 'character', status: 'finished',
  visibility: 'public', isPublic: true, tags: [], content: '', contentBlocks: [], previewImages: [], media: [],
  authorName: 'Creator', createdAt: '', updatedAt: '',
  presentationMetadata: metadata as Asset['presentationMetadata']
});

const options = {
  activeView: 'feed' as const, activeVaultTab: 'my_assets' as const,
  bookmarkedAssetIds: [], recentlyViewedIds: [], currentUserId: undefined,
  selectedCategory: 'all' as const, selectedTag: null, selectedFolderId: 'all' as const,
  selectedStatusFilter: 'all' as const, visibilityFilter: 'all' as const, searchQuery: ''
};

describe('public Work presentation shape', () => {
  it('ignores malformed nested platform metadata instead of throwing during feed filtering', () => {
    const asset = publicWork({ appPlatforms: [null, 42, { name: 'Rubii' }, ' Rubii ', ''] });
    expect(getAssetPlatforms(asset)).toEqual(['Rubii']);
    expect(selectPlatformCounts([asset], options)).toEqual([{ platform: 'Rubii', count: 1 }]);
    expect(selectFilteredAssets([asset], options)).toEqual([asset]);
  });

  it('accepts a malformed platform collection as empty', () => {
    expect(getAssetPlatforms(publicWork({ appPlatforms: { invalid: true } }))).toEqual([]);
  });
});

