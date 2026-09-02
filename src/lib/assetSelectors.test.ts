import { describe, expect, it } from 'vitest';
import type { Asset, Folder } from '../types';
import {
  selectCategoryCounts,
  selectFilteredAssets,
  selectActiveAssetsInFolder,
  countActiveAssetsInFolder,
  selectFolderAssetCounts,
  selectVaultStats
} from './assetSelectors';
import { isPublicFeedAsset } from './accessPolicy';
import { isPublicFeedVisibility, isValidWorkIcon, normalizeAssetVisibility } from './assetVisibility';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    userId: 'owner-1',
    authorName: 'Owner',
    title: 'Asset',
    icon: { type: 'emoji', value: '✨' },
    category: 'character',
    content: 'content',
    isPublic: true,
    visibility: 'public',
    status: 'finished',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    tags: ['Prompt'],
    ...overrides
  };
}

const collection = {
  activeView: 'feed' as const,
  activeVaultTab: 'my_assets' as const,
  bookmarkedAssetIds: [],
  recentlyViewedIds: [],
  currentUserId: 'owner-1'
};

describe('asset visibility compatibility', () => {
  it('preserves the explicit legacy is_public value during normalization', () => {
    expect(normalizeAssetVisibility({ visibility: 'public', is_public: false })).toEqual({
      visibility: 'public',
      isPublic: false
    });
    expect(normalizeAssetVisibility({ visibility: 'private', is_public: true })).toEqual({
      visibility: 'private',
      isPublic: true
    });
  });

  it('uses the verified two-field Public Feed predicate for inconsistent records', () => {
    expect(isPublicFeedVisibility(makeAsset({ visibility: 'public', isPublic: true }))).toBe(true);
    expect(isPublicFeedVisibility(makeAsset({ visibility: 'public', isPublic: false }))).toBe(false);
    expect(isPublicFeedVisibility(makeAsset({ visibility: 'private', isPublic: true }))).toBe(false);
    expect(isPublicFeedVisibility(makeAsset({ visibility: 'private', isPublic: false }))).toBe(false);
    expect(isPublicFeedAsset(makeAsset({ deletedAt: '2026-02-01T00:00:00.000Z' }))).toBe(false);
  });

  it('falls back to visibility only when is_public is absent', () => {
    expect(normalizeAssetVisibility({ visibility: 'public' })).toEqual({
      visibility: 'public',
      isPublic: true
    });
    expect(normalizeAssetVisibility({ is_public: true })).toEqual({
      visibility: 'public',
      isPublic: true
    });
  });

  it('normalizes legacy draft visibility to private without changing workflow status', () => {
    expect(normalizeAssetVisibility({ visibility: 'draft', isPublic: true })).toEqual({
      visibility: 'private',
      isPublic: false
    });
  });

  it('accepts only valid persisted Work Icon values', () => {
    expect(isValidWorkIcon({ type: 'emoji', value: '🧪' })).toBe(true);
    expect(isValidWorkIcon({ type: 'image', value: 'data:image/png;base64,abc' })).toBe(true);
    expect(isValidWorkIcon({ type: 'image', value: 'https://cdn.example/icon.gif' })).toBe(true);
    expect(isValidWorkIcon({ type: 'image', value: 'not-a-media-url' })).toBe(false);
    expect(isValidWorkIcon({ type: 'image', value: '' })).toBe(false);
  });
});

describe('asset selectors', () => {
  it('filters the verified Public Feed without broadening legacy compatibility', () => {
    const assets = [
      makeAsset({ id: 'public' }),
      makeAsset({ id: 'legacy-private', visibility: 'public', isPublic: false }),
      makeAsset({ id: 'legacy-public', visibility: 'private', isPublic: true }),
      makeAsset({ id: 'deleted', deletedAt: '2026-02-01T00:00:00.000Z' })
    ];

    expect(selectFilteredAssets(assets, {
      ...collection,
      selectedCategory: 'all',
      selectedTag: null,
      selectedFolderId: 'all',
      selectedStatusFilter: 'all',
      visibilityFilter: 'all',
      searchQuery: ''
    }).map(asset => asset.id)).toEqual(['public']);
  });

  it('applies owned, folder, status, visibility, tag, and search filters', () => {
    const assets = [
      makeAsset({ id: 'matching', userId: 'owner-1', folderId: 'folder-1', tags: ['Prompt'], content: 'system prompt' }),
      makeAsset({ id: 'other-folder', userId: 'owner-1', folderId: 'folder-2' }),
      makeAsset({ id: 'other-owner', userId: 'owner-2', folderId: 'folder-1' }),
      makeAsset({ id: 'private', userId: 'owner-1', visibility: 'private', isPublic: false, folderId: 'folder-1' })
    ];

    expect(selectFilteredAssets(assets, {
      activeView: 'vault',
      activeVaultTab: 'my_assets',
      bookmarkedAssetIds: [],
      recentlyViewedIds: [],
      currentUserId: 'owner-1',
      selectedCategory: 'character',
      selectedTag: 'prompt',
      selectedFolderId: 'folder-1',
      selectedStatusFilter: 'finished',
      visibilityFilter: 'public',
      searchQuery: 'system'
    }).map(asset => asset.id)).toEqual(['matching']);
  });

  it('maps the folders tab to owned assets and opens the selected folder', () => {
    const assets = [
      makeAsset({ id: 'inside', folderId: 'folder-1' }),
      makeAsset({ id: 'outside', folderId: 'folder-2' }),
      makeAsset({ id: 'other-owner', userId: 'owner-2', folderId: 'folder-1' })
    ];

    const folderTabOptions = {
      activeView: 'vault' as const,
      activeVaultTab: 'folders' as const,
      bookmarkedAssetIds: [],
      recentlyViewedIds: [],
      currentUserId: 'owner-1',
      selectedCategory: 'all' as const,
      selectedTag: null,
      selectedFolderId: 'folder-1',
      selectedStatusFilter: 'all' as const,
      visibilityFilter: 'all' as const,
      searchQuery: ''
    };

    expect(selectFilteredAssets(assets, folderTabOptions).map(asset => asset.id)).toEqual(['inside']);
  });

  it('derives category counts, vault stats, and folder counts from canonical assets', () => {
    const assets = [
      makeAsset({ id: 'one', userId: 'owner-1', category: 'character', folderId: 'folder-1' }),
      makeAsset({ id: 'two', userId: 'owner-1', category: 'prompts', visibility: 'private', isPublic: false }),
      makeAsset({ id: 'trash', userId: 'owner-1', deletedAt: '2026-02-01T00:00:00.000Z', folderId: 'folder-1' }),
      makeAsset({ id: 'other', userId: 'owner-2', category: 'lore' })
    ];
    const folders: Folder[] = [
      { id: 'folder-1', userId: 'owner-1', name: 'One', createdAt: '', updatedAt: '' },
      { id: 'folder-2', userId: 'owner-1', name: 'Two', createdAt: '', updatedAt: '' }
    ];

    expect(selectCategoryCounts(assets, {
      ...collection,
      activeView: 'vault',
      activeVaultTab: 'my_assets'
    })).toEqual({ all: 2, character: 1, prompts: 1 });
    expect(selectVaultStats(assets, 'owner-1', ['one', 'one', 'two'])).toEqual({
      total: 2,
      publicCount: 1,
      privateCount: 1,
      trashCount: 1,
      bookmarksCount: 2
    });
    expect(selectFolderAssetCounts(assets, folders, 'owner-1')).toEqual({
      'folder-1': 1,
      'folder-2': 0
    });
    expect(selectActiveAssetsInFolder(assets, 'folder-1').map(asset => asset.id)).toEqual(['one']);
    expect(countActiveAssetsInFolder(assets, 'folder-1')).toBe(1);
    expect(countActiveAssetsInFolder(assets, 'folder-2')).toBe(0);
    expect(countActiveAssetsInFolder([
      makeAsset({ id: 'moved-a', folderId: 'folder-2' }),
      makeAsset({ id: 'moved-b', folderId: 'folder-2' }),
      makeAsset({ id: 'removed', folderId: 'folder-2', deletedAt: '2026-03-01T00:00:00.000Z' })
    ], 'folder-2')).toBe(2);
  });

  it('keeps every folderId count synchronized through move, unassign, trash, restore, and permanent removal', () => {
    const folders: Folder[] = [
      { id: 'folder-a', userId: 'owner-1', name: 'A', createdAt: '', updatedAt: '' },
      { id: 'folder-b', userId: 'owner-1', name: 'B', createdAt: '', updatedAt: '' }
    ];
    const initial = makeAsset({ id: 'moving-work', folderId: 'folder-a' });
    const counts = (assets: Asset[]) => selectFolderAssetCounts(assets, folders, 'owner-1');

    expect(counts([initial])).toEqual({ 'folder-a': 1, 'folder-b': 0 });
    const moved = { ...initial, folderId: 'folder-b' };
    expect(counts([moved])).toEqual({ 'folder-a': 0, 'folder-b': 1 });
    const unassigned = { ...moved, folderId: null };
    expect(counts([unassigned])).toEqual({ 'folder-a': 0, 'folder-b': 0 });
    const trashed = { ...moved, deletedAt: '2026-03-01T00:00:00.000Z' };
    expect(counts([trashed])).toEqual({ 'folder-a': 0, 'folder-b': 0 });
    const restored = { ...trashed, deletedAt: null };
    expect(counts([restored])).toEqual({ 'folder-a': 0, 'folder-b': 1 });
    expect(counts([])).toEqual({ 'folder-a': 0, 'folder-b': 0 });
  });
});
