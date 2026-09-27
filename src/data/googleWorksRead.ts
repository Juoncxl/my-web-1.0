import type { Asset } from '../types';
import type { FetchAssetsOptions } from '../lib/supabaseService';

export type GoogleReadScope = { currentUserId?: string; ownerUserId?: string };

const isPublic = (asset: Asset) => asset.visibility === 'public' && asset.isPublic === true && !asset.deletedAt;

/** Public summary search intentionally excludes full Work content, blocks, and UI code. */
function matchesPublicSummarySearch(asset: Asset, needle: string): boolean {
  const collaboration = asset.publicCollaboration;
  const values = [asset.title, asset.shortDescription, asset.authorName, asset.category,
    ...(asset.tags || []), ...(asset.contentTypeLabels || []), ...(asset.contentTypes || []),
    ...(asset.presentationMetadata?.appPlatforms || []), collaboration?.name, collaboration?.sharedTag,
    ...(collaboration?.platforms || []), ...(collaboration?.deadlines || []).flatMap(item => [item.label, item.date])];
  return values.filter((value): value is string => typeof value === 'string').join('\n').toLocaleLowerCase().includes(needle);
}

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
    result = result.filter(asset => options.publicOnly || !currentUserId
      ? matchesPublicSummarySearch(asset, needle)
      : asset.title.toLocaleLowerCase().includes(needle)
        || asset.content.toLocaleLowerCase().includes(needle)
        || (asset.tags || []).some(tag => tag.toLocaleLowerCase().includes(needle)));
  }
  if (options.detail === 'summary') result = result.map(toSummaryAsset);
  return result;
}

function toSummaryAsset(asset: Asset): Asset {
  const coverId = asset.previewImage?.startsWith('media:') ? asset.previewImage.slice(6) : null;
  const media = (asset.media || []).filter(item => item.purpose === 'icon' || item.isCover || item.id === coverId);
  const iconMedia = asset.icon?.mediaId
    ? media.find(item => item.id === asset.icon?.mediaId && item.purpose === 'icon')
    : undefined;
  const iconValue = asset.icon?.value || '';
  const iconRef = asset.icon?.mediaId
    ? `media:${asset.icon.mediaId}`
    : /^media:[A-Za-z0-9_-]{1,128}$/.test(iconValue) || /^cxl-media:[a-f0-9]{64}$/.test(iconValue)
      ? iconValue
      : '';
  const parsedUpdatedAt = asset.updatedAt ? Date.parse(asset.updatedAt) : Number.NaN;
  const cacheVersion = Number.isFinite(parsedUpdatedAt) ? String(parsedUpdatedAt) : undefined;
  const proxyIcon = Boolean(iconMedia?.delivery === 'vercel_proxy');
  const iconUrl = iconRef
    ? `/api/cxl/media?${new URLSearchParams({ workId: asset.id, ref: iconRef,
      ...(proxyIcon ? { scope: isPublic(asset) ? 'public' : 'owner' } : {}),
      ...(cacheVersion !== undefined ? { v: cacheVersion } : {}) }).toString()}`
    : '';
  const safeIcon = asset.icon?.type === 'image' && iconMedia?.signedUrl
    ? { ...asset.icon, value: iconMedia.signedUrl }
    : asset.icon?.type === 'image' && /^data:/i.test(iconValue)
      ? { type: 'emoji' as const, value: '✨' }
      : asset.icon && (asset.icon.type === 'emoji' || asset.icon.type === 'kaomoji') && iconValue.length <= 96
        ? asset.icon
        : asset.icon?.type === 'image' && iconUrl
          ? { ...asset.icon, value: iconUrl }
          : asset.icon?.type === 'image' && /^https:\/\//i.test(iconValue)
            ? asset.icon
          : { type: 'emoji' as const, value: '✨' };
  return { ...asset, authorAvatar: undefined, icon: safeIcon, collaboration: null,
    content: '', contentBlocks: [], uiCodeSnippet: '', previewImages: asset.previewImage ? [asset.previewImage] : [],
    media, versions: [] };
}
