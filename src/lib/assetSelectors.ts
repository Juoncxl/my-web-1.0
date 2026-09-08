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
  selectedPlatform?: string | null;
  selectedTag: string | null;
  selectedFolderId: string | 'all' | 'unassigned';
  selectedStatusFilter: AssetStatus | 'all';
  visibilityFilter: VisibilityFilter;
  searchQuery: string;
}

export interface PlatformCount {
  platform: string;
  count: number;
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

/**
 * The platform view combines Composer metadata with the public Collab identity.
 * It deliberately does not read the owner-only `collaboration` draft.
 */
export function getAssetPlatforms(asset: Asset): string[] {
  const values = [
    ...(asset.presentationMetadata?.appPlatforms || []),
    ...(asset.publicCollaboration?.platforms || [])
  ];
  const seen = new Set<string>();
  return values.reduce<string[]>((platforms, value) => {
    const clean = value.trim();
    const key = clean.toLocaleLowerCase();
    if (!clean || seen.has(key)) return platforms;
    seen.add(key);
    platforms.push(clean);
    return platforms;
  }, []);
}

export function isAppPlatformAsset(asset: Asset): boolean {
  return asset.category === 'app_data' || getAssetPlatforms(asset).length > 0;
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

function matchesNonCategoryFilters(asset: Asset, options: AssetFilterOptions): boolean {
  if (options.activeView === 'vault' && (options.activeVaultTab === 'my_assets' || options.activeVaultTab === 'folders')) {
    if (options.selectedFolderId === 'unassigned' && asset.folderId) return false;
    if (
      options.selectedFolderId !== 'all' &&
      options.selectedFolderId !== 'unassigned' &&
      asset.folderId !== options.selectedFolderId
    ) return false;
    if (options.selectedStatusFilter !== 'all' && asset.status !== options.selectedStatusFilter) return false;
    if (options.visibilityFilter === 'public' && !isPublicVaultAsset(asset)) return false;
    if (options.visibilityFilter === 'private' && !isPrivateVaultAsset(asset)) return false;
  }

  if (options.selectedTag) {
    const tag = options.selectedTag.toLowerCase();
    if (!asset.tags?.some(item => item.toLowerCase() === tag)) return false;
  }
  return matchesSearch(asset, options.searchQuery);
}

export function selectFilteredAssets(
  assets: readonly Asset[],
  options: AssetFilterOptions
): Asset[] {
  return selectCollectionAssets(assets, options).filter(asset => {
    if (!matchesNonCategoryFilters(asset, options)) return false;
    if (options.selectedCategory === 'app_data') {
      if (!isAppPlatformAsset(asset)) return false;
      if (options.selectedPlatform) {
        const selected = options.selectedPlatform.toLocaleLowerCase();
        if (!getAssetPlatforms(asset).some(platform => platform.toLocaleLowerCase() === selected)) return false;
      }
      return true;
    }
    return options.selectedCategory === 'all' || asset.category === options.selectedCategory;
  });
}

export function selectPlatformCounts(
  assets: readonly Asset[],
  options: AssetFilterOptions
): PlatformCount[] {
  const counts = new Map<string, PlatformCount>();
  for (const asset of selectCollectionAssets(assets, options)) {
    if (!matchesNonCategoryFilters(asset, options)) continue;
    for (const platform of getAssetPlatforms(asset)) {
      const key = platform.toLocaleLowerCase();
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { platform, count: 1 });
    }
  }
  return Array.from(counts.values()).sort((left, right) => left.platform.localeCompare(right.platform, 'th'));
}

export function selectCategoryCounts(
  assets: readonly Asset[],
  options: AssetCollectionOptions
): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const asset of selectCollectionAssets(assets, options)) {
    counts.all += 1;
    counts[asset.category] = (counts[asset.category] || 0) + 1;
    if (asset.category !== 'app_data' && isAppPlatformAsset(asset)) {
      counts.app_data = (counts.app_data || 0) + 1;
    }
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
  const ownedActiveAssets = assets.filter(asset => isOwnedActiveAsset(asset, currentUserId));
  for (const folder of folders) counts[folder.id] = countActiveAssetsInFolder(ownedActiveAssets, folder.id);
  return counts;
}

/** Canonical Folder membership selection shared by every Folder surface. */
export function selectActiveAssetsInFolder(assets: readonly Asset[], folderId: string): Asset[] {
  return assets.filter(asset => asset.folderId === folderId && !asset.deletedAt);
}

/** Canonical Folder membership count shared by every Folder surface. */
export function countActiveAssetsInFolder(assets: readonly Asset[], folderId: string): number {
  return selectActiveAssetsInFolder(assets, folderId).length;
}
