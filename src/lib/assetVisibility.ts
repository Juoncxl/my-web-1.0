import type { Asset, AssetVisibility } from '../types';

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
  const visibility = isAssetVisibility(input.visibility)
    ? input.visibility
    : legacyFlag === true
      ? 'public'
      : 'private';

  return {
    visibility,
    isPublic: legacyFlag ?? visibility === 'public'
  };
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
