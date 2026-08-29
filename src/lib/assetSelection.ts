import type { Asset } from '../types';

/**
 * Resolve a selected asset from the current canonical collection.
 * Keeping the selection as an ID means callers always receive the latest
 * version of an asset after an update, engagement change, or folder move.
 */
export function findAssetById(
  assets: readonly Asset[],
  assetId: string | null | undefined
): Asset | null {
  if (!assetId) return null;
  return assets.find(asset => asset.id === assetId) || null;
}
