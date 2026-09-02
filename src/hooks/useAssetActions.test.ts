import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../types';
import { useAssetActions, type AssetActionOptions } from './useAssetActions';

vi.mock('react', () => ({
  useCallback: <T,>(callback: T) => callback
}));

const asset: Asset = {
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
  deletedAt: null
};

function makeOptions(overrides: Partial<AssetActionOptions> = {}): AssetActionOptions {
  return {
    currentUser: {
      id: 'owner-1',
      displayName: 'Owner',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    editingAssetId: null,
    bookmarkedAssetIds: [],
    openAuthModal: vi.fn(),
    reportOperationError: vi.fn(),
    clearOperationError: vi.fn(),
    createAsset: vi.fn(async () => ({ data: asset })),
    updateAsset: vi.fn(async () => ({ data: asset })),
    softDeleteAsset: vi.fn(async () => ({ success: true })),
    restoreAsset: vi.fn(async () => ({ success: true })),
    permanentDeleteAsset: vi.fn(async () => ({ success: true })),
    forkAsset: vi.fn(async () => ({ data: asset, sourceForkCount: 1 })),
    moveAsset: vi.fn(async () => ({ data: asset })),
    toggleBookmark: vi.fn(async () => ({ success: true, isBookmarked: true })),
    toggleLike: vi.fn(async () => ({ success: true, isLiked: true, likesCount: 1 })),
    updateAssetLikeCount: vi.fn(),
    onAssetDeleted: vi.fn(),
    onCreateSuccess: vi.fn(),
    onUpdateSuccess: vi.fn(),
    onForkSuccess: vi.fn(),
    onBookmarkSuccess: vi.fn(),
    ...overrides
  };
}

describe('asset action coordination', () => {
  it('does not clear selection or trigger success coordination when deletion fails', async () => {
    const options = makeOptions({
      permanentDeleteAsset: vi.fn(async () => ({ success: false, error: 'delete failed' }))
    });
    const actions = useAssetActions(options);

    await actions.handlePermanentDeleteAsset(asset.id);

    expect(options.onAssetDeleted).not.toHaveBeenCalled();
    expect(options.clearOperationError).not.toHaveBeenCalled();
    expect(options.reportOperationError).toHaveBeenCalledWith('delete failed');
  });

  it('clears the selected asset only after permanent deletion succeeds', async () => {
    const options = makeOptions();
    const actions = useAssetActions(options);

    await actions.handlePermanentDeleteAsset(asset.id);

    expect(options.onAssetDeleted).toHaveBeenCalledWith(asset.id);
    expect(options.clearOperationError).toHaveBeenCalledOnce();
  });

  it('synchronizes a successful Like aggregate into the shared Asset source', async () => {
    const options = makeOptions({
      toggleLike: vi.fn(async () => ({ success: true, isLiked: true, likesCount: 1 }))
    });
    const actions = useAssetActions(options);

    await actions.handleLikeAsset(asset.id);

    expect(options.toggleLike).toHaveBeenCalledWith(asset.id);
    expect(options.updateAssetLikeCount).toHaveBeenCalledWith(asset.id, 1);
    expect(options.clearOperationError).toHaveBeenCalledOnce();
  });

  it('does not overwrite a displayed Like count when the canonical mutation fails', async () => {
    const options = makeOptions({
      toggleLike: vi.fn(async () => ({ success: false, isLiked: false, likesCount: null, error: 'like failed' }))
    });
    const actions = useAssetActions(options);

    await actions.handleLikeAsset(asset.id);

    expect(options.updateAssetLikeCount).not.toHaveBeenCalled();
    expect(options.reportOperationError).toHaveBeenCalledWith('like failed');
  });
});
