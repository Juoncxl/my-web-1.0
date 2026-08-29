import { useCallback, useState } from 'react';

const RECENTLY_VIEWED_STORAGE_KEY = 'creator_vault_recently_viewed';

function readRecentlyViewed(): string[] {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(readRecentlyViewed);

  const trackRecentlyViewed = useCallback((assetId: string) => {
    setRecentlyViewedIds(previousIds => {
      const filtered = previousIds.filter(id => id !== assetId);
      const updated = [assetId, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error(error);
      }
      return updated;
    });
  }, []);

  return { recentlyViewedIds, trackRecentlyViewed };
}
