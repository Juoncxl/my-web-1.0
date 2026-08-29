export const RECENTLY_VIEWED_STORAGE_KEY = 'creator_vault_recently_viewed';
export const RECENTLY_VIEWED_LIMIT = 30;

export function normalizeRecentlyViewed(value: unknown, limit = RECENTLY_VIEWED_LIMIT): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function recordRecentlyViewed(
  currentIds: readonly string[],
  assetId: string,
  limit = RECENTLY_VIEWED_LIMIT
): string[] {
  if (!assetId.trim()) return normalizeRecentlyViewed(currentIds, limit);
  return normalizeRecentlyViewed([assetId, ...currentIds], limit);
}

export function readRecentlyViewed(storage: Pick<Storage, 'getItem'> | undefined): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    return normalizeRecentlyViewed(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function writeRecentlyViewed(
  storage: Pick<Storage, 'setItem'> | undefined,
  ids: readonly string[]
): void {
  if (!storage) return;
  try {
    storage.setItem(
      RECENTLY_VIEWED_STORAGE_KEY,
      JSON.stringify(normalizeRecentlyViewed(ids))
    );
  } catch {
    // Storage can be unavailable or full; Recently Viewed is best-effort.
  }
}
