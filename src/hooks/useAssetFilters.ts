import { useMemo } from 'react';
import type { Asset, AssetCategory, AssetStatus } from '../types';
import { isOwnedActiveAsset, isPublicFeedAsset, isTrashAssetForUser } from '../lib/accessPolicy';
import type { VaultTabType } from '../components/PersonalVaultHeader';

type ActiveView = 'feed' | 'vault';
type VisibilityFilter = 'all' | 'public' | 'private';

interface UseAssetFiltersOptions {
  assets: Asset[];
  activeView: ActiveView;
  activeVaultTab: VaultTabType;
  selectedCategory: AssetCategory | 'all';
  selectedTag: string | null;
  selectedFolderId: string | 'all' | 'unassigned';
  selectedStatusFilter: AssetStatus | 'all';
  visibilityFilter: VisibilityFilter;
  searchQuery: string;
  bookmarkedAssetIds: string[];
  recentlyViewedIds: string[];
  currentUserId: string | undefined;
}

function isInCurrentCollection(
  asset: Asset,
  activeView: ActiveView,
  activeVaultTab: VaultTabType,
  bookmarkedAssetIds: string[],
  recentlyViewedIds: string[],
  currentUserId: string | undefined
): boolean {
  if (activeView === 'feed') return isPublicFeedAsset(asset);
  if (activeVaultTab === 'my_assets') return isOwnedActiveAsset(asset, currentUserId);
  if (activeVaultTab === 'bookmarks') return bookmarkedAssetIds.includes(asset.id) && !asset.deletedAt;
  if (activeVaultTab === 'recent') return recentlyViewedIds.includes(asset.id) && !asset.deletedAt;
  if (activeVaultTab === 'trash') return isTrashAssetForUser(asset, currentUserId);
  return true;
}

export function useAssetFilters(options: UseAssetFiltersOptions) {
  const {
    assets,
    activeView,
    activeVaultTab,
    selectedCategory,
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    searchQuery,
    bookmarkedAssetIds,
    recentlyViewedIds,
    currentUserId
  } = options;

  const filteredAssets = useMemo(() => assets.filter(asset => {
    if (!isInCurrentCollection(asset, activeView, activeVaultTab, bookmarkedAssetIds, recentlyViewedIds, currentUserId)) return false;

    if (activeView === 'vault' && activeVaultTab === 'my_assets') {
      if (selectedFolderId === 'unassigned' && asset.folderId) return false;
      if (selectedFolderId !== 'all' && selectedFolderId !== 'unassigned' && asset.folderId !== selectedFolderId) return false;
      if (selectedStatusFilter !== 'all' && asset.status !== selectedStatusFilter) return false;
      if (visibilityFilter === 'public' && asset.visibility !== 'public' && !asset.isPublic) return false;
      if (visibilityFilter === 'private' && (asset.visibility === 'public' || asset.isPublic)) return false;
    }

    if (selectedCategory !== 'all' && asset.category !== selectedCategory) return false;

    if (selectedTag) {
      const matchesTag = asset.tags?.some(tag => tag.toLowerCase() === selectedTag.toLowerCase());
      if (!matchesTag) return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = asset.title.toLowerCase().includes(query);
      const matchesContent = asset.content.toLowerCase().includes(query);
      const matchesAuthor = asset.authorName.toLowerCase().includes(query);
      const matchesTags = asset.tags?.some(tag => tag.toLowerCase().includes(query));
      const matchesCode = asset.uiCodeSnippet?.toLowerCase().includes(query);
      return matchesTitle || matchesContent || matchesAuthor || matchesTags || matchesCode;
    }

    return true;
  }), [
    assets,
    activeView,
    activeVaultTab,
    selectedCategory,
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    searchQuery,
    bookmarkedAssetIds,
    recentlyViewedIds,
    currentUserId
  ]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const baseAssets = assets.filter(asset =>
      isInCurrentCollection(asset, activeView, activeVaultTab, bookmarkedAssetIds, recentlyViewedIds, currentUserId)
    );
    counts.all = baseAssets.length;
    baseAssets.forEach(asset => {
      counts[asset.category] = (counts[asset.category] || 0) + 1;
    });
    return counts;
  }, [assets, activeView, activeVaultTab, bookmarkedAssetIds, recentlyViewedIds, currentUserId]);

  const vaultStats = useMemo(() => {
    const userAssets = assets.filter(asset => asset.userId === currentUserId && !asset.deletedAt);
    return {
      total: userAssets.length,
      publicCount: userAssets.filter(asset => asset.visibility === 'public' || asset.isPublic).length,
      privateCount: userAssets.filter(asset => asset.visibility === 'private' || !asset.isPublic).length,
      trashCount: assets.filter(asset => asset.userId === currentUserId && !!asset.deletedAt).length,
      bookmarksCount: bookmarkedAssetIds.length
    };
  }, [assets, bookmarkedAssetIds, currentUserId]);

  return { filteredAssets, categoryCounts, vaultStats };
}
