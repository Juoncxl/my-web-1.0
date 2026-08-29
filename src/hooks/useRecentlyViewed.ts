import { useCallback, useEffect, useState } from 'react';
import {
  readRecentlyViewed,
  recordRecentlyViewed,
  writeRecentlyViewed
} from '../lib/recentlyViewedStorage';

function getStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function useRecentlyViewed() {
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    readRecentlyViewed(getStorage())
  );

  useEffect(() => {
    writeRecentlyViewed(getStorage(), recentlyViewedIds);
  }, [recentlyViewedIds]);

  const trackRecentlyViewed = useCallback((assetId: string) => {
    setRecentlyViewedIds(previousIds => recordRecentlyViewed(previousIds, assetId));
  }, []);

  return { recentlyViewedIds, trackRecentlyViewed };
}
