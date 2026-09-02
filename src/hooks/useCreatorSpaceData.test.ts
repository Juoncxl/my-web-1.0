import { describe, expect, it } from 'vitest';
import type { Asset, Folder } from '../types';
import { selectCreatorAssets, selectCreatorFolders, selectCreatorSavedAssets } from './useCreatorSpaceData';

function makeAsset(id: string, userId: string, visibility: Asset['visibility']): Asset {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id, userId, authorName: 'Creator', title: id, icon: { type: 'emoji', value: '🧪' },
    category: 'lore', content: '', uiCodeSnippet: '', previewImage: '', previewImages: [],
    folderId: null, isPublic: visibility === 'public', visibility, status: 'finished',
    deletedAt: null, createdAt: now, updatedAt: now, likesCount: 0, forkCount: 0,
    forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
  };
}

describe('Creator Space shared data selection', () => {
  it('reuses the App asset source while preserving owner and visitor visibility', () => {
    const publicWork = makeAsset('public', 'owner-1', 'public');
    const privateWork = makeAsset('private', 'owner-1', 'private');
    const otherWork = makeAsset('other', 'owner-2', 'public');
    const source = [publicWork, privateWork, otherWork];
    const deletedPublic = makeAsset('deleted-public', 'owner-1', 'public');
    deletedPublic.deletedAt = '2026-01-02T00:00:00.000Z';

    expect(selectCreatorAssets(source, 'owner-1', true)).toEqual([publicWork, privateWork]);
    expect(selectCreatorAssets([...source, deletedPublic], 'owner-1', false)).toEqual([publicWork]);
  });

  it('exposes folders only to the matching owner from the shared folder source', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const ownFolder: Folder = { id: 'folder-1', userId: 'owner-1', name: 'Own', createdAt: now, updatedAt: now };
    const otherFolder: Folder = { id: 'folder-2', userId: 'owner-2', name: 'Other', createdAt: now, updatedAt: now };

    expect(selectCreatorFolders([ownFolder, otherFolder], 'owner-1', true)).toEqual([ownFolder]);
    expect(selectCreatorFolders([ownFolder, otherFolder], 'owner-1', false)).toEqual([]);
  });

  it('resolves Saved by bookmarked IDs against the shared asset source', () => {
    const ownPrivate = makeAsset('own-private', 'owner-1', 'private');
    const ownPublic = makeAsset('own-public', 'owner-1', 'public');
    const publicWork = makeAsset('public', 'owner-2', 'public');
    const privateWork = makeAsset('private', 'owner-2', 'private');
    const deletedWork = makeAsset('deleted', 'owner-2', 'public');
    deletedWork.deletedAt = '2026-01-02T00:00:00.000Z';

    expect(selectCreatorSavedAssets(
      [ownPrivate, ownPublic, publicWork, privateWork, deletedWork],
      ['own-private', 'public', 'private', 'deleted'],
      'owner-1'
    ).map(asset => asset.id)).toEqual(['own-private', 'public']);
    expect(selectCreatorSavedAssets([ownPrivate], ['own-private'], undefined)).toEqual([]);
  });
});
