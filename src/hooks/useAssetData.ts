import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, User } from '../types';
import { supabaseService, type FetchAssetsOptions } from '../lib/supabaseService';
import { removeAssetFromCreatorSpaceSettings } from '../lib/creatorPersistence';

type ReportError = (message: string | null) => void;
type NewAssetData = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'authorName'>;

export function useAssetData(
  currentUser: User | null,
  reportError: ReportError,
  enabled = true,
  loadOptions: Omit<FetchAssetsOptions, 'currentUserId'> = {}
) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  // A public feed query is identical before and after Auth restoration. Keep
  // it independent from the session identity to avoid downloading the same
  // public rows twice during application boot.
  const loadIdentityUserId = loadOptions.publicOnly ? undefined : currentUser?.id;
  const requestSequence = useRef(0);
  const scopeSequence = useRef(0);
  const previousUserId = useRef<string | undefined>(loadIdentityUserId);
  const loadScopeKey = [
    loadOptions.assetId || '',
    loadOptions.creatorSlug || '',
    loadOptions.detail || '',
    loadOptions.userId || '',
    loadOptions.publicOnly ? 'public' : '',
    loadOptions.onlyDeleted ? 'deleted' : '',
    loadOptions.includeDeleted ? 'with-deleted' : '',
    loadOptions.category || '',
    loadOptions.folderId === null ? 'unassigned' : loadOptions.folderId || '',
    loadOptions.search || '',
    loadOptions.limit || ''
  ].join('|');
  const previousLoadScopeKey = useRef(loadScopeKey);
  const hasLoadedAssets = useRef(false);

  const refreshAssets = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++requestSequence.current;
    const requestScope = scopeSequence.current;
    const isInitialLoad = !hasLoadedAssets.current;

    if (isInitialLoad) setIsLoadingAssets(true);

    try {
      const res = await supabaseService.fetchAssets({
        ...loadOptions,
        currentUserId: loadIdentityUserId,
      });
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setAssets(res.data);
      hasLoadedAssets.current = true;
      // A successful retry supersedes an earlier request failure. Keeping the
      // old message visible after the cards have rendered is misleading.
      reportError(null);
    } catch (error) {
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      console.error('Error loading assets:', error);
      reportError('โหลดคลังผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (requestId === requestSequence.current && requestScope === scopeSequence.current && isInitialLoad) {
        setIsLoadingAssets(false);
      }
    }
  }, [
    loadIdentityUserId,
    enabled,
    loadOptions.assetId,
    loadOptions.category,
    loadOptions.creatorSlug,
    loadOptions.detail,
    loadOptions.folderId,
    loadOptions.includeDeleted,
    loadOptions.limit,
    loadOptions.onlyDeleted,
    loadOptions.publicOnly,
    loadOptions.search,
    loadOptions.userId,
    reportError
  ]);

  useEffect(() => {
    if (!enabled) return;

    const userId = loadIdentityUserId;
    if (previousUserId.current !== userId || previousLoadScopeKey.current !== loadScopeKey) {
      previousUserId.current = userId;
      previousLoadScopeKey.current = loadScopeKey;
      scopeSequence.current += 1;
      hasLoadedAssets.current = false;
      setAssets([]);
      setIsLoadingAssets(true);
    }
    void refreshAssets();
  }, [enabled, loadIdentityUserId, loadScopeKey, refreshAssets]);

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

  const loadAssetDetail = useCallback(async (assetId: string): Promise<Asset | null> => {
    const result = await supabaseService.fetchAssets({
      assetId,
      currentUserId: currentUser?.id,
      detail: 'full',
      limit: 1
    });
    if (result.error || !result.data[0]) {
      if (result.error) reportError(result.error);
      return null;
    }
    const detailedAsset = result.data[0];
    setAssets(previous => previous.some(asset => asset.id === detailedAsset.id)
      ? previous.map(asset => asset.id === detailedAsset.id ? detailedAsset : asset)
      : [detailedAsset, ...previous]
    );
    return detailedAsset;
  }, [currentUser?.id, reportError]);

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
    if (result.success) {
      removeAssetFromCreatorSpaceSettings(currentUser.id, id);
      setAssets(previous => previous.filter(asset => asset.id !== id));
    }
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
  const isChangingAccountScope = previousUserId.current !== loadIdentityUserId;

  return {
    assets,
    isLoadingAssets: isLoadingAssets || isChangingAccountScope,
    refreshAssets,
    loadAssetDetail,
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
