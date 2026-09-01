import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, User } from '../types';
import { supabaseService } from '../lib/supabaseService';

type ReportError = (message: string) => void;
type NewAssetData = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'authorName'>;

export function useAssetData(currentUser: User | null, reportError: ReportError, enabled = true) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const requestSequence = useRef(0);
  const scopeSequence = useRef(0);
  const previousUserId = useRef<string | undefined>(currentUser?.id);
  const hasLoadedAssets = useRef(false);

  const refreshAssets = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++requestSequence.current;
    const requestScope = scopeSequence.current;
    const isInitialLoad = !hasLoadedAssets.current;

    if (isInitialLoad) setIsLoadingAssets(true);

    try {
      const res = await supabaseService.fetchAssets({
        currentUserId: currentUser?.id,
        includeDeleted: true
      });
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setAssets(res.data);
      hasLoadedAssets.current = true;
    } catch (error) {
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      console.error('Error loading assets:', error);
      reportError('โหลดคลังผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (requestId === requestSequence.current && requestScope === scopeSequence.current && isInitialLoad) {
        setIsLoadingAssets(false);
      }
    }
  }, [currentUser?.id, enabled, reportError]);

  useEffect(() => {
    if (!enabled) return;

    const userId = currentUser?.id;
    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      scopeSequence.current += 1;
      hasLoadedAssets.current = false;
      setAssets([]);
    }
    void refreshAssets();
  }, [currentUser?.id, enabled, refreshAssets]);

  const createAsset = useCallback(async (assetData: NewAssetData) => {
    if (!currentUser) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };
    const result = await supabaseService.createAsset({
      ...assetData,
      userId: currentUser.id,
      authorName: currentUser.displayName,
      authorAvatar: currentUser.avatarUrl
    });
    if (result.data) setAssets(previous => [result.data!, ...previous]);
    return result;
  }, [currentUser]);

  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>) => {
    if (!currentUser) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };
    const result = await supabaseService.updateAsset(id, updates);
    if (result.data) setAssets(previous => previous.map(asset => asset.id === id ? result.data! : asset));
    return result;
  }, [currentUser]);

  const softDeleteAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.softDeleteAsset(id);
    if (result.success) {
      const deletedAt = new Date().toISOString();
      setAssets(previous => previous.map(asset => asset.id === id ? { ...asset, deletedAt } : asset));
    }
    return result;
  }, [currentUser]);

  const restoreAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.restoreAsset(id);
    if (result.success) setAssets(previous => previous.map(asset => asset.id === id ? { ...asset, deletedAt: null } : asset));
    return result;
  }, [currentUser]);

  const permanentDeleteAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.permanentDeleteAsset(id);
    if (result.success) setAssets(previous => previous.filter(asset => asset.id !== id));
    return result;
  }, [currentUser]);

  const forkAsset = useCallback(async (sourceAsset: Asset) => {
    if (!currentUser) return { data: null, sourceForkCount: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.forkAsset(
      sourceAsset,
      currentUser.id,
      currentUser.displayName,
      currentUser.avatarUrl
    );
    if (result.data) {
      setAssets(previous => {
        const withUpdatedSource = previous.map(asset =>
          asset.id === sourceAsset.id && result.sourceForkCount !== null
            ? { ...asset, forkCount: result.sourceForkCount }
            : asset
        );
        return [result.data!, ...withUpdatedSource];
      });
    }
    return result;
  }, [currentUser]);

  const moveAsset = useCallback((id: string, folderId: string | null) => {
    return updateAsset(id, { folderId });
  }, [updateAsset]);

  const updateAssetLikeCount = useCallback((id: string, likesCount: number) => {
    setAssets(previous => previous.map(asset => asset.id === id ? { ...asset, likesCount } : asset));
  }, []);

  const clearFolderAssignments = useCallback((folderId: string) => {
    setAssets(previous => previous.map(asset => asset.folderId === folderId ? { ...asset, folderId: null } : asset));
  }, []);

  // Render the next account scope as loading immediately. Effects run after
  // paint, so relying only on setIsLoadingAssets inside the effect can flash a
  // stale/empty result for one frame during session restoration or re-login.
  const isChangingAccountScope = previousUserId.current !== currentUser?.id;

  return {
    assets,
    isLoadingAssets: isLoadingAssets || isChangingAccountScope,
    refreshAssets,
    createAsset,
    updateAsset,
    softDeleteAsset,
    restoreAsset,
    permanentDeleteAsset,
    forkAsset,
    moveAsset,
    updateAssetLikeCount,
    clearFolderAssignments
  };
}
