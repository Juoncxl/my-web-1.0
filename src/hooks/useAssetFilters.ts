import { useMemo } from 'react';
import type { Asset, AssetCategory, AssetStatus, Folder } from '../types';
import type { VaultTabType } from '../components/PersonalVaultHeader';
import {
  selectCategoryCounts,
  selectFilteredAssets,
  selectFolderAssetCounts,
  selectVaultStats
} from '../lib/assetSelectors';

interface UseAssetFiltersOptions {
  assets: Asset[];
  folders: Folder[];
  activeView: 'feed' | 'vault';
  activeVaultTab: VaultTabType;
  selectedCategory: AssetCategory | 'all';
  selectedTag: string | null;
  selectedFolderId: string | 'all' | 'unassigned';
  selectedStatusFilter: AssetStatus | 'all';
  visibilityFilter: 'all' | 'public' | 'private';
  searchQuery: string;
  bookmarkedAssetIds: string[];
  recentlyViewedIds: string[];
  currentUserId: string | undefined;
}

export function useAssetFilters(options: UseAssetFiltersOptions) {
  const collectionOptions = useMemo(() => ({
    activeView: options.activeView,
    activeVaultTab: options.activeVaultTab,
    bookmarkedAssetIds: options.bookmarkedAssetIds,
    recentlyViewedIds: options.recentlyViewedIds,
    currentUserId: options.currentUserId
  }), [
    options.activeView,
    options.activeVaultTab,
    options.bookmarkedAssetIds,
    options.recentlyViewedIds,
    options.currentUserId
  ]);

  const filteredAssets = useMemo(
    () => selectFilteredAssets(options.assets, options),
    [options]
  );

  const categoryCounts = useMemo(
    () => selectCategoryCounts(options.assets, collectionOptions),
    [options.assets, collectionOptions]
  );

  const vaultStats = useMemo(
    () => selectVaultStats(options.assets, options.currentUserId, options.bookmarkedAssetIds),
    [options.assets, options.currentUserId, options.bookmarkedAssetIds]
  );

  const folderAssetCounts = useMemo(
    () => selectFolderAssetCounts(options.assets, options.folders, options.currentUserId),
    [options.assets, options.folders, options.currentUserId]
  );

  return { filteredAssets, categoryCounts, vaultStats, folderAssetCounts };
}
