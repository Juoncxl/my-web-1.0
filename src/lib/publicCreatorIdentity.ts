export interface PublicCreatorIdentitySource {
  publicCreatorId?: string | null;
  userId?: string | null;
}

/** Resolves the public profile lookup key without requiring a legacy internal user ID. */
export function resolvePublicCreatorKey(asset: PublicCreatorIdentitySource): string {
  const publicCreatorId = asset.publicCreatorId?.trim();
  if (publicCreatorId) return publicCreatorId;
  return asset.userId?.trim() || '';
}

/** Public feed Works have no internal userId, so the Owner is also matched by public creator identity. */
export function isWorkOwnedBy(
  asset: PublicCreatorIdentitySource,
  user: { id?: string | null; publicCreatorId?: string | null } | null | undefined
): boolean {
  if (!user) return false;
  const userId = user.id?.trim();
  if (userId && asset.userId === userId) return true;
  const publicCreatorId = user.publicCreatorId?.trim();
  return Boolean(publicCreatorId && resolvePublicCreatorKey(asset) === publicCreatorId);
}

/** Returns unique, stable batch lookup keys and skips records without creator identity. */
export function collectPublicCreatorKeys(assets: readonly PublicCreatorIdentitySource[]): string[] {
  return [...new Set(assets.map(resolvePublicCreatorKey).filter(Boolean))].sort();
}
