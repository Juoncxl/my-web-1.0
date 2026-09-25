import type { Asset } from '../types';
import type { FetchAssetsOptions } from '../lib/supabaseService';

export type GoogleReadScope = { currentUserId?: string; ownerUserId?: string };

const isPublic = (asset: Asset) => asset.visibility === 'public' && asset.isPublic === true && !asset.deletedAt;

/** Mirrors the filtering performed by supabaseService.fetchAssets after its database query. */
export function filterGoogleWorks(works: Asset[], options: FetchAssetsOptions = {}, scope: GoogleReadScope = {}): Asset[] {
  const currentUserId = scope.currentUserId;
  let scopedUserId = options.userId;
  if (!scopedUserId && options.creatorSlug && /^[0-9a-f-]{36}$/i.test(options.creatorSlug)) scopedUserId = options.creatorSlug;

  let result = works.filter(asset => {
    if (options.assetId && asset.id !== options.assetId) return false;
    if (options.publicOnly) return isPublic(asset);
    if (options.onlyDeleted) return Boolean(currentUserId && asset.userId === currentUserId && asset.deletedAt);
    if (scopedUserId) {
      if (scopedUserId === currentUserId) return asset.userId === currentUserId && (Boolean(options.includeDeleted) || !asset.deletedAt);
      return asset.userId === scopedUserId && isPublic(asset);
    }
    if (currentUserId) return isPublic(asset) || (asset.userId === currentUserId && (Boolean(options.includeDeleted) || !asset.deletedAt));
    return isPublic(asset);
  });

  if (options.category && options.category !== 'all') result = result.filter(asset => asset.category === options.category);
  if (options.userId !== undefined && options.folderId !== undefined) result = result.filter(asset => asset.folderId === options.folderId);
  result = [...result].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  const limit = Number.isFinite(options.limit) ? Math.min(100, Math.max(1, Math.trunc(options.limit!))) : undefined;
  if (limit) result = result.slice(0, limit);
  if (options.search?.trim()) {
    const needle = options.search.trim().toLocaleLowerCase();
    result = result.filter(asset => asset.title.toLocaleLowerCase().includes(needle)
      || asset.content.toLocaleLowerCase().includes(needle)
      || (asset.tags || []).some(tag => tag.toLocaleLowerCase().includes(needle)));
  }
  if (options.detail === 'summary') result = result.map(toSummaryAsset);
  return result;
}

function toSummaryAsset(asset: Asset): Asset {
  const coverId = asset.previewImage?.startsWith('media:') ? asset.previewImage.slice(6) : null;
  const media = (asset.media || []).filter(item => item.purpose === 'icon' || item.isCover || item.id === coverId);
  return { ...asset, authorAvatar: undefined, icon: { type: 'emoji', value: '✨' }, collaboration: null,
    content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: asset.previewImage ? [asset.previewImage] : [],
    media, versions: [] };
}
