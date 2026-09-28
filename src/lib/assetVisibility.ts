import type { Asset, AssetIcon, AssetVisibility } from '../types';

const ASSET_VISIBILITIES: AssetVisibility[] = ['public', 'private', 'draft'];
const CXL_MEDIA_PROXY_ORIGIN = 'https://cxl.invalid';
const CXL_MEDIA_PROXY_QUERY_KEYS = new Set(['scope', 'workId', 'ref', 'v']);

/** Accept only the canonical same-origin media proxy path used by Google Work. */
export function isCxlMediaProxyPath(value: string): boolean {
  if (!value.startsWith('/api/cxl/media?')) return false;

  try {
    const url = new URL(value, CXL_MEDIA_PROXY_ORIGIN);
    if (url.origin !== CXL_MEDIA_PROXY_ORIGIN || url.pathname !== '/api/cxl/media' || url.hash) return false;
    if ([...url.searchParams.keys()].some(key => !CXL_MEDIA_PROXY_QUERY_KEYS.has(key))) return false;

    const scopes = url.searchParams.getAll('scope');
    const workIds = url.searchParams.getAll('workId');
    const refs = url.searchParams.getAll('ref');
    const cacheVersions = url.searchParams.getAll('v');
    return scopes.length === 1 && ['owner', 'public'].includes(scopes[0])
      && workIds.length === 1 && /^asset_[A-Za-z0-9_-]{1,96}$/.test(workIds[0])
      && refs.length === 1 && /^media:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(refs[0])
      && (cacheVersions.length === 0 || cacheVersions.length === 1 && /^\d+$/.test(cacheVersions[0]));
  } catch {
    return false;
  }
}

/** Work Detail Image blocks support the existing sources plus the CXL proxy. */
export function isValidWorkImageSource(value: string): boolean {
  const source = value.trim();
  return /^(?:data:image\/|blob:|https?:\/\/)/i.test(source) || isCxlMediaProxyPath(source);
}

function isAssetVisibility(value: unknown): value is AssetVisibility {
  return typeof value === 'string' && ASSET_VISIBILITIES.includes(value as AssetVisibility);
}

function coerceLegacyPublicFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

export interface AssetVisibilityInput {
  visibility?: unknown;
  isPublic?: unknown;
  is_public?: unknown;
}

export interface NormalizedAssetVisibility {
  visibility: AssetVisibility;
  isPublic: boolean;
}

/**
 * Preserve an explicit legacy is_public value when it exists. Only rows that
 * truly lack that field fall back to the visibility value.
 */
export function normalizeAssetVisibility(input: AssetVisibilityInput): NormalizedAssetVisibility {
  const legacyFlag = coerceLegacyPublicFlag(
    input.isPublic !== undefined ? input.isPublic : input.is_public
  );
  const rawVisibility = isAssetVisibility(input.visibility)
    ? input.visibility
    : legacyFlag === true
      ? 'public'
      : 'private';

  // `draft` was historically stored as a visibility value, but it never had
  // distinct access-policy semantics from a private Work. Keep accepting it
  // for old records while exposing the canonical two-axis model as private
  // visibility + the existing workflow status.
  const visibility = rawVisibility === 'draft' ? 'private' : rawVisibility;

  return {
    visibility,
    isPublic: rawVisibility === 'draft' ? false : legacyFlag ?? visibility === 'public'
  };
}

export function isValidWorkIcon(icon?: AssetIcon | null): boolean {
  if (!icon || typeof icon.value !== 'string' || !icon.value.trim()) return false;
  if (icon.type === 'emoji' || icon.type === 'kaomoji') return true;
  const source = icon.value.trim();
  return /^(?:data:image\/[a-z0-9.+-]+;base64,|blob:|https?:\/\/)/i.test(source)
    || isCxlMediaProxyPath(source);
}

export function isPublicFeedVisibility(asset: Pick<Asset, 'visibility' | 'isPublic'>): boolean {
  return asset.visibility === 'public' && asset.isPublic === true;
}

export function isPublicVaultAsset(asset: Pick<Asset, 'visibility' | 'isPublic'>): boolean {
  return asset.visibility === 'public' || asset.isPublic === true;
}

export function isPrivateVaultAsset(asset: Pick<Asset, 'visibility' | 'isPublic'>): boolean {
  return !isPublicVaultAsset(asset);
}
