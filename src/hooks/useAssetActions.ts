import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { Asset, User } from '../types';
import { canForkAsset } from '../lib/accessPolicy';
import { normalizeAssetVisibility } from '../lib/assetVisibility';

type ReportError = (message: string) => void;
type ClearError = () => void;
type NewAssetData = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'authorName'>;

interface AssetMutationResult {
  data: Asset | null;
  error?: string;
}

interface AssetStatusResult {
  success: boolean;
  error?: string;
}

interface BookmarkResult extends AssetStatusResult {
  isBookmarked: boolean;
}

interface LikeResult extends AssetStatusResult {
  isLiked: boolean;
  likesCount: number | null;
}

interface ForkResult {
  data: Asset | null;
  sourceForkCount: number | null;
  error?: string;
}

export interface AssetActionOptions {
  currentUser: User | null;
  editingAssetId: string | null;
  bookmarkedAssetIds: readonly string[];
  openAuthModal: (tab?: 'login' | 'signup') => void;
  reportOperationError: ReportError;
  clearOperationError: ClearError;
  createAsset: (assetData: NewAssetData) => Promise<AssetMutationResult>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<AssetMutationResult>;
  softDeleteAsset: (id: string) => Promise<AssetStatusResult>;
  restoreAsset: (id: string) => Promise<AssetStatusResult>;
  permanentDeleteAsset: (id: string) => Promise<AssetStatusResult>;
  forkAsset: (sourceAsset: Asset) => Promise<ForkResult>;
  moveAsset: (id: string, folderId: string | null) => Promise<AssetMutationResult>;
  toggleBookmark: (assetId: string) => Promise<BookmarkResult>;
  toggleLike: (assetId: string) => Promise<LikeResult>;
  updateAssetLikeCount: (id: string, likesCount: number) => void;
  onAssetDeleted: (assetId: string) => void;
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onForkSuccess: () => void;
  onBookmarkSuccess: () => void;
}

export function useAssetActions({
  currentUser,
  editingAssetId,
  bookmarkedAssetIds,
  openAuthModal,
  reportOperationError,
  clearOperationError,
  createAsset,
  updateAsset,
  softDeleteAsset,
  restoreAsset,
  permanentDeleteAsset,
  forkAsset,
  moveAsset,
  toggleBookmark,
  toggleLike,
  updateAssetLikeCount,
  onAssetDeleted,
  onCreateSuccess,
  onUpdateSuccess,
  onForkSuccess,
  onBookmarkSuccess
}: AssetActionOptions) {
  const handleSaveAsset = useCallback(async (assetData: Partial<Asset>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };

    try {
      if (editingAssetId) {
        const result = await updateAsset(editingAssetId, assetData);
        if (result.error) return { success: false, error: result.error };
        if (result.data) {
          onUpdateSuccess();
          return { success: true };
        }
      } else {
        const normalizedVisibility = normalizeAssetVisibility({
          visibility: assetData.visibility,
          isPublic: assetData.isPublic
        });
        const result = await createAsset({
          title: assetData.title || 'Untitled Asset',
          icon: assetData.icon || { type: 'emoji', value: '✨' },
          category: assetData.category || 'character',
          content: assetData.content || '',
          uiCodeSnippet: assetData.uiCodeSnippet || '',
          previewImages: assetData.previewImages || (assetData.previewImage ? [assetData.previewImage] : []),
          folderId: assetData.folderId || null,
          isPublic: normalizedVisibility.isPublic,
          visibility: normalizedVisibility.visibility,
          status: assetData.status || 'finished',
          linkedAssetIds: assetData.linkedAssetIds || [],
          tags: assetData.tags || []
        });
        if (result.error) return { success: false, error: result.error };
        if (result.data) {
          onCreateSuccess();
          return { success: true };
        }
      }
    } catch (error: unknown) {
      console.error('Save asset error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการบันทึกผลงาน' };
    }
    return { success: false, error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง' };
  }, [createAsset, currentUser, editingAssetId, onCreateSuccess, onUpdateSuccess, updateAsset]);

  const handleSoftDeleteAsset = useCallback(async (assetId: string) => {
    if (!currentUser) return;
    try {
      const result = await softDeleteAsset(assetId);
      if (result.success) {
        clearOperationError();
        onAssetDeleted(assetId);
      } else {
        reportOperationError(result.error || 'ย้ายผลงานไปถังขยะไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Soft delete error:', error);
      reportOperationError('ย้ายผลงานไปถังขยะไม่สำเร็จ');
    }
  }, [clearOperationError, currentUser, onAssetDeleted, reportOperationError, softDeleteAsset]);

  const handleRestoreAsset = useCallback(async (assetId: string) => {
    if (!currentUser) return;
    try {
      const result = await restoreAsset(assetId);
      if (result.success) {
        clearOperationError();
      } else {
        reportOperationError(result.error || 'กู้คืนผลงานไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Restore error:', error);
      reportOperationError('กู้คืนผลงานไม่สำเร็จ');
    }
  }, [clearOperationError, currentUser, reportOperationError, restoreAsset]);

  const handlePermanentDeleteAsset = useCallback(async (assetId: string) => {
    if (!currentUser) return;
    try {
      const result = await permanentDeleteAsset(assetId);
      if (result.success) {
        clearOperationError();
        onAssetDeleted(assetId);
      } else {
        reportOperationError(result.error || 'ลบผลงานถาวรไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Delete asset error:', error);
      reportOperationError('ลบผลงานถาวรไม่สำเร็จ');
    }
  }, [clearOperationError, currentUser, onAssetDeleted, permanentDeleteAsset, reportOperationError]);

  const handleToggleBookmark = useCallback(async (assetId: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    try {
      const wasBookmarked = bookmarkedAssetIds.includes(assetId);
      const result = await toggleBookmark(assetId);
      if (!result.success) {
        reportOperationError(result.error || 'อัปเดตบุ๊กมาร์กไม่สำเร็จ');
        return;
      }

      clearOperationError();
      if (result.isBookmarked && !wasBookmarked) {
        onBookmarkSuccess();
      }
    } catch (error) {
      console.error('Bookmark error:', error);
      reportOperationError('อัปเดตบุ๊กมาร์กไม่สำเร็จ');
    }
  }, [bookmarkedAssetIds, clearOperationError, currentUser, onBookmarkSuccess, openAuthModal, reportOperationError, toggleBookmark]);

  const handleForkAsset = useCallback(async (sourceAsset: Asset) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    if (!canForkAsset(currentUser, sourceAsset)) {
      reportOperationError('ผลงานนี้เป็นส่วนตัว ถูกลบ หรือไม่สามารถสร้างสำเนาได้');
      return;
    }

    try {
      const result = await forkAsset(sourceAsset);
      if (result.data) {
        clearOperationError();
        onForkSuccess();
      } else {
        reportOperationError(result.error || 'สร้างสำเนาผลงานไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Fork asset error:', error);
      reportOperationError('สร้างสำเนาผลงานไม่สำเร็จ');
    }
  }, [clearOperationError, currentUser, forkAsset, onForkSuccess, openAuthModal, reportOperationError]);

  const handleMoveToFolder = useCallback(async (assetId: string, folderId: string | null): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const result = await moveAsset(assetId, folderId);
      if (result.data) {
        clearOperationError();
        return true;
      }
      reportOperationError(result.error || 'ย้ายผลงานเข้าโฟลเดอร์ไม่สำเร็จ');
    } catch (error) {
      console.error('Move to folder error:', error);
      reportOperationError('ย้ายผลงานเข้าโฟลเดอร์ไม่สำเร็จ');
    }
    return false;
  }, [clearOperationError, currentUser, moveAsset, reportOperationError]);

  const handleLikeAsset = useCallback(async (assetId: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    try {
      const result = await toggleLike(assetId);
      if (!result.success) {
        reportOperationError(result.error || 'อัปเดตสถานะถูกใจไม่สำเร็จ');
        return;
      }

      clearOperationError();
      if (result.likesCount !== null) updateAssetLikeCount(assetId, result.likesCount);
    } catch (error) {
      console.error('Like error:', error);
      reportOperationError('อัปเดตสถานะถูกใจไม่สำเร็จ');
    }
  }, [clearOperationError, currentUser, openAuthModal, reportOperationError, toggleLike, updateAssetLikeCount]);

  return {
    handleSaveAsset,
    handleSoftDeleteAsset,
    handleRestoreAsset,
    handlePermanentDeleteAsset,
    handleToggleBookmark,
    handleForkAsset,
    handleMoveToFolder,
    handleLikeAsset
  };
}
