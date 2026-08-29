import { useCallback, useEffect, useState } from 'react';
import { supabaseService } from '../lib/supabaseService';

type ReportError = (message: string) => void;

export function useEngagementData(currentUserId: string | undefined, reportError: ReportError) {
  const [bookmarkedAssetIds, setBookmarkedAssetIds] = useState<string[]>([]);
  const [likedAssetIds, setLikedAssetIds] = useState<string[]>([]);

  const refreshBookmarks = useCallback(async () => {
    if (!currentUserId) {
      setBookmarkedAssetIds([]);
      return;
    }

    try {
      const res = await supabaseService.fetchBookmarks(currentUserId);
      if (res.error) {
        setBookmarkedAssetIds([]);
        reportError(res.error);
      } else {
        setBookmarkedAssetIds(res.data);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setBookmarkedAssetIds([]);
      reportError('โหลดบุ๊กมาร์กไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }, [currentUserId, reportError]);

  const refreshLikes = useCallback(async () => {
    if (!currentUserId) {
      setLikedAssetIds([]);
      return;
    }

    try {
      const res = await supabaseService.fetchLikedAssetIds(currentUserId);
      if (res.error) {
        setLikedAssetIds([]);
        reportError(res.error);
      } else {
        setLikedAssetIds(res.data);
      }
    } catch (error) {
      console.error('Error loading likes:', error);
      setLikedAssetIds([]);
      reportError('โหลดรายการถูกใจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }, [currentUserId, reportError]);

  useEffect(() => {
    void refreshBookmarks();
    void refreshLikes();
  }, [refreshBookmarks, refreshLikes]);

  return {
    bookmarkedAssetIds,
    setBookmarkedAssetIds,
    likedAssetIds,
    setLikedAssetIds,
    refreshBookmarks,
    refreshLikes
  };
}
