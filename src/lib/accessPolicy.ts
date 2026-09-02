import type { Asset, User } from '../types';
import { isPublicFeedVisibility } from './assetVisibility';

export function hasAuthenticatedUser(user: User | null | undefined): user is User {
  return Boolean(user?.id);
}

export function isGuestUser(user: User | null | undefined): boolean {
  return !hasAuthenticatedUser(user);
}

export function isLegacyGuestUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && userId.startsWith('guest_');
}

// Phase 1 uses a read-only visitor model. Persisted Guest assets are therefore
// disabled instead of relying on a browser-only two-item limit.
export function canCreateOwnedAsset(user: User | null | undefined): boolean {
  return hasAuthenticatedUser(user);
}

export function canForkAsset(user: User | null | undefined, asset: Asset): boolean {
  if (!hasAuthenticatedUser(user) || asset.deletedAt) return false;
  return asset.userId === user.id || isPublicFeedVisibility(asset);
}

/** A canonical Work Detail may expose private/draft data only in owner context. */
export function canViewAssetDetail(asset: Pick<Asset, 'visibility' | 'isPublic' | 'deletedAt'>, isOwner: boolean): boolean {
  // Owners may open their own trashed Work to restore or permanently delete it;
  // visitors must never resolve a trashed Work, even if it was previously public.
  if (!isOwner && asset.deletedAt) return false;
  return isOwner || isPublicFeedVisibility(asset);
}

export function isPublicFeedAsset(asset: Asset): boolean {
  return !asset.deletedAt && isPublicFeedVisibility(asset);
}

export function isOwnedActiveAsset(asset: Asset, userId: string | undefined): boolean {
  return Boolean(userId) && asset.userId === userId && !asset.deletedAt;
}

export function isTrashAssetForUser(asset: Asset, userId: string | undefined): boolean {
  return Boolean(userId) && asset.userId === userId && Boolean(asset.deletedAt);
}
