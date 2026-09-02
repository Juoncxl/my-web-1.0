import type { Asset, AssetIcon, AssetVisibility } from '../types';

const ASSET_VISIBILITIES: AssetVisibility[] = ['public', 'private', 'draft'];

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
  return /^(?:data:image\/[a-z0-9.+-]+;base64,|blob:|https?:\/\/)/i.test(icon.value.trim());
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
