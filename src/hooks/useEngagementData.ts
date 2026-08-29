import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseService } from '../lib/supabaseService';
import { uniqueAssetIds } from '../lib/assetSelectors';

type ReportError = (message: string) => void;

export function useEngagementData(currentUserId: string | undefined, reportError: ReportError) {
  const [bookmarkedAssetIds, setBookmarkedAssetIds] = useState<string[]>([]);
  const [likedAssetIds, setLikedAssetIds] = useState<string[]>([]);
  const scopeSequence = useRef(0);
  const previousUserId = useRef(currentUserId);
  const bookmarkRequestSequence = useRef(0);
  const likeRequestSequence = useRef(0);

  const refreshBookmarks = useCallback(async () => {
    if (!currentUserId) return;

    const requestId = ++bookmarkRequestSequence.current;
    const requestScope = scopeSequence.current;
    try {
      const res = await supabaseService.fetchBookmarks(currentUserId);
      if (requestId !== bookmarkRequestSequence.current || requestScope !== scopeSequence.current) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setBookmarkedAssetIds(uniqueAssetIds(res.data));
    } catch (error) {
      if (requestId !== bookmarkRequestSequence.current || requestScope !== scopeSequence.current) return;
      console.error('Error loading bookmarks:', error);
      reportError('โหลดบุ๊กมาร์กไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }, [currentUserId, reportError]);

  const refreshLikes = useCallback(async () => {
    if (!currentUserId) return;

    const requestId = ++likeRequestSequence.current;
    const requestScope = scopeSequence.current;
    try {
      const res = await supabaseService.fetchLikedAssetIds(currentUserId);
      if (requestId !== likeRequestSequence.current || requestScope !== scopeSequence.current) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setLikedAssetIds(uniqueAssetIds(res.data));
    } catch (error) {
      if (requestId !== likeRequestSequence.current || requestScope !== scopeSequence.current) return;
      console.error('Error loading likes:', error);
      reportError('โหลดรายการถูกใจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }, [currentUserId, reportError]);

  useEffect(() => {
    if (previousUserId.current !== currentUserId) {
      previousUserId.current = currentUserId;
      scopeSequence.current += 1;
      setBookmarkedAssetIds([]);
      setLikedAssetIds([]);
    }
    if (currentUserId) {
      void refreshBookmarks();
      void refreshLikes();
    }
  }, [currentUserId, refreshBookmarks, refreshLikes]);

  const toggleBookmark = useCallback(async (assetId: string) => {
    if (!currentUserId) {
      return { success: false, isBookmarked: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    }
    const shouldBookmark = !bookmarkedAssetIds.includes(assetId);
    const result = await supabaseService.setBookmark(currentUserId, assetId, shouldBookmark);
    if (result.success) {
      setBookmarkedAssetIds(previous => result.isBookmarked
        ? uniqueAssetIds([...previous, assetId])
        : previous.filter(id => id !== assetId)
      );
    }
    return result;
  }, [bookmarkedAssetIds, currentUserId]);

  const toggleLike = useCallback(async (assetId: string) => {
    if (!currentUserId) {
      return { success: false, isLiked: false, likesCount: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    }
    const shouldLike = !likedAssetIds.includes(assetId);
    const result = await supabaseService.setAssetLike(currentUserId, assetId, shouldLike);
    if (result.success) {
      setLikedAssetIds(previous => result.isLiked
        ? uniqueAssetIds([...previous, assetId])
        : previous.filter(id => id !== assetId)
      );
    }
    return result;
  }, [currentUserId, likedAssetIds]);

  return {
    bookmarkedAssetIds,
    likedAssetIds,
    refreshBookmarks,
    refreshLikes,
    toggleBookmark,
    toggleLike
  };
}
