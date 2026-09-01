import type { Asset, AssetCategory, AssetStatus, Folder } from '../types';
import type { VaultTabType } from '../components/PersonalVaultHeader';
import { isOwnedActiveAsset, isPublicFeedAsset, isTrashAssetForUser } from './accessPolicy';
import {
  isPrivateVaultAsset,
  isPublicVaultAsset
} from './assetVisibility';

export type ActiveView = 'feed' | 'vault';
export type VisibilityFilter = 'all' | 'public' | 'private';

export interface AssetCollectionOptions {
  activeView: ActiveView;
  activeVaultTab: VaultTabType;
  bookmarkedAssetIds: readonly string[];
  recentlyViewedIds: readonly string[];
  currentUserId: string | undefined;
}

export interface AssetFilterOptions extends AssetCollectionOptions {
  selectedCategory: AssetCategory | 'all';
  selectedTag: string | null;
  selectedFolderId: string | 'all' | 'unassigned';
  selectedStatusFilter: AssetStatus | 'all';
  visibilityFilter: VisibilityFilter;
  searchQuery: string;
}

export interface VaultStats {
  total: number;
  publicCount: number;
  privateCount: number;
  trashCount: number;
  bookmarksCount: number;
}

export function uniqueAssetIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0)));
}

export function isInAssetCollection(asset: Asset, options: AssetCollectionOptions): boolean {
  if (options.activeView === 'feed') {
    return isPublicFeedAsset(asset);
  }

  if (options.activeVaultTab === 'my_assets') {
    return isOwnedActiveAsset(asset, options.currentUserId);
  }
  if (options.activeVaultTab === 'folders') {
    return isOwnedActiveAsset(asset, options.currentUserId);
  }
  if (options.activeVaultTab === 'bookmarks') {
    return options.bookmarkedAssetIds.includes(asset.id) && !asset.deletedAt;
  }
  if (options.activeVaultTab === 'recent') {
    return options.recentlyViewedIds.includes(asset.id) && !asset.deletedAt;
  }
  if (options.activeVaultTab === 'trash') {
    return isTrashAssetForUser(asset, options.currentUserId);
  }
  return false;
}

export function selectCollectionAssets(
  assets: readonly Asset[],
  options: AssetCollectionOptions
): Asset[] {
  return assets.filter(asset => isInAssetCollection(asset, options));
}

function matchesSearch(asset: Asset, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  return Boolean(
    asset.title.toLowerCase().includes(query) ||
      asset.shortDescription?.toLowerCase().includes(query) ||
      asset.content.toLowerCase().includes(query) ||
      asset.contentBlocks?.some(block => block.title.toLowerCase().includes(query) || block.body.toLowerCase().includes(query)) ||
      asset.authorName.toLowerCase().includes(query) ||
      asset.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      asset.uiCodeSnippet?.toLowerCase().includes(query)
  );
}

export function selectFilteredAssets(
  assets: readonly Asset[],
  options: AssetFilterOptions
): Asset[] {
  return selectCollectionAssets(assets, options).filter(asset => {
    if (options.activeView === 'vault' && (options.activeVaultTab === 'my_assets' || options.activeVaultTab === 'folders')) {
      if (options.selectedFolderId === 'unassigned' && asset.folderId) return false;
      if (
        options.selectedFolderId !== 'all' &&
        options.selectedFolderId !== 'unassigned' &&
        asset.folderId !== options.selectedFolderId
      ) return false;
      if (
        options.selectedStatusFilter !== 'all' &&
        asset.status !== options.selectedStatusFilter
      ) return false;
      if (options.visibilityFilter === 'public' && !isPublicVaultAsset(asset)) return false;
      if (options.visibilityFilter === 'private' && !isPrivateVaultAsset(asset)) return false;
    }

    if (options.selectedCategory !== 'all' && asset.category !== options.selectedCategory) {
      return false;
    }
    if (options.selectedTag) {
      const tag = options.selectedTag.toLowerCase();
      if (!asset.tags?.some(item => item.toLowerCase() === tag)) return false;
    }
    return matchesSearch(asset, options.searchQuery);
  });
}

export function selectCategoryCounts(
  assets: readonly Asset[],
  options: AssetCollectionOptions
): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const asset of selectCollectionAssets(assets, options)) {
    counts.all += 1;
    counts[asset.category] = (counts[asset.category] || 0) + 1;
  }
  return counts;
}

export function selectVaultStats(
  assets: readonly Asset[],
  currentUserId: string | undefined,
  bookmarkedAssetIds: readonly string[]
): VaultStats {
  const userAssets = assets.filter(asset => isOwnedActiveAsset(asset, currentUserId));
  return {
    total: userAssets.length,
    publicCount: userAssets.filter(isPublicVaultAsset).length,
    privateCount: userAssets.filter(isPrivateVaultAsset).length,
    trashCount: assets.filter(asset => isTrashAssetForUser(asset, currentUserId)).length,
    bookmarksCount: uniqueAssetIds(bookmarkedAssetIds).length
  };
}

export function selectFolderAssetCounts(
  assets: readonly Asset[],
  folders: readonly Folder[],
  currentUserId: string | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const folder of folders) counts[folder.id] = 0;
  for (const asset of assets) {
    if (!isOwnedActiveAsset(asset, currentUserId) || !asset.folderId) continue;
    if (counts[asset.folderId] !== undefined) counts[asset.folderId] += 1;
  }
  return counts;
}
