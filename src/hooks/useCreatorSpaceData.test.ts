import { describe, expect, it } from 'vitest';
import type { Asset, Folder } from '../types';
import { selectCreatorAssets, selectCreatorFolders } from './useCreatorSpaceData';

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

    expect(selectCreatorAssets(source, 'owner-1', true)).toEqual([publicWork, privateWork]);
    expect(selectCreatorAssets(source, 'owner-1', false)).toEqual([publicWork]);
  });

  it('exposes folders only to the matching owner from the shared folder source', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const ownFolder: Folder = { id: 'folder-1', userId: 'owner-1', name: 'Own', createdAt: now, updatedAt: now };
    const otherFolder: Folder = { id: 'folder-2', userId: 'owner-2', name: 'Other', createdAt: now, updatedAt: now };

    expect(selectCreatorFolders([ownFolder, otherFolder], 'owner-1', true)).toEqual([ownFolder]);
    expect(selectCreatorFolders([ownFolder, otherFolder], 'owner-1', false)).toEqual([]);
  });
});
