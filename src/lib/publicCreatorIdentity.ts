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

/** Returns unique, stable batch lookup keys and skips records without creator identity. */
export function collectPublicCreatorKeys(assets: readonly PublicCreatorIdentitySource[]): string[] {
  return [...new Set(assets.map(resolvePublicCreatorKey).filter(Boolean))].sort();
}
