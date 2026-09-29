import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Asset, User } from '../types';
import { cxlDataService, type FetchAssetsOptions, type WorkCreateOptions, type WorkUpdateOptions } from '../data/cxlDataService';
import { ScopedReadLifecycle } from './scopedReadLifecycle';
import { isVercelOwnerAuth } from '../lib/auth/ownerAuthBackend';
import { resolvePublicCreatorKey } from '../lib/publicCreatorIdentity';
import { readWithBoundedRetry } from './boundedReadRetry';
import { loadAssetDetailWithBoundedRetry, shouldRetryOwnerDetailRead } from './assetDetailRead';

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
  const detailRequestSequence = useRef(0);
  const readLifecycle = useRef(new ScopedReadLifecycle());
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
  const requestScopeKey = JSON.stringify([loadIdentityUserId || '', loadScopeKey]);
  const hasLoadedAssets = useRef(false);
  const ownerPublicCreatorId = currentUser?.publicCreatorId?.trim() || '';
  const canRecoverOwnerSummaryFromPublicSnapshot = isVercelOwnerAuth
    && loadOptions.userId === currentUser?.id
    && Boolean(ownerPublicCreatorId)
    && loadOptions.detail === 'summary'
    && !loadOptions.publicOnly
    && !loadOptions.includeDeleted
    && !loadOptions.onlyDeleted
    && loadOptions.folderId === undefined;

  const refreshAssets = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++requestSequence.current;
    const ticket = readLifecycle.current.capture(requestScopeKey);
    if (!ticket) return;
    const isInitialLoad = !hasLoadedAssets.current;
    const isCurrentRequest = () => requestId === requestSequence.current && readLifecycle.current.isCurrent(ticket);
    const retryOwnerInitialRead = isInitialLoad && isVercelOwnerAuth && Boolean(loadIdentityUserId)
      && !loadOptions.publicOnly && !canRecoverOwnerSummaryFromPublicSnapshot;
    const retryPublicInitialSummaryRead = isInitialLoad && loadOptions.publicOnly === true
      && !loadOptions.assetId && loadOptions.detail !== 'full';
    let ownerReadSucceeded = false;

    if (isInitialLoad) setIsLoadingAssets(true);

    // The Owner summary reader can be slower than the Vercel function budget.
    // Keep the public cards usable from the already established snapshot while
    // the private Owner read continues in the background. A successful Owner
    // response still replaces this recovery data with the complete collection.
    const publicRecovery = canRecoverOwnerSummaryFromPublicSnapshot
      ? cxlDataService.works.fetch({
          publicOnly: true,
          detail: 'summary',
          search: loadOptions.search,
          limit: 100
        }).then(result => {
          if (!isCurrentRequest() || ownerReadSucceeded || result.error) return false;
          const ownerPublicAssets = result.data.filter(asset => resolvePublicCreatorKey(asset) === ownerPublicCreatorId);
          setAssets(ownerPublicAssets);
          hasLoadedAssets.current = true;
          setIsLoadingAssets(false);
          reportError(null);
          return true;
        }).catch(() => false)
      : Promise.resolve(false);

    try {
      const res = await readWithBoundedRetry<Awaited<ReturnType<typeof cxlDataService.works.fetch>>>(() => cxlDataService.works.fetch({
        ...loadOptions,
        currentUserId: loadIdentityUserId,
      }), {
        enabled: retryOwnerInitialRead || retryPublicInitialSummaryRead,
        isCurrent: isCurrentRequest,
        getError: value => value.error,
        onRetry: () => reportError(null)
      });
      if (!isCurrentRequest()) return;
      if (res.error) {
        if (await publicRecovery) return;
        if (!isCurrentRequest()) return;
        reportError(res.error);
        return;
      }
      ownerReadSucceeded = true;
      setAssets(res.data);
      hasLoadedAssets.current = true;
      // A successful retry supersedes an earlier request failure. Keeping the
      // old message visible after the cards have rendered is misleading.
      reportError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error('Error loading assets:', error);
      reportError('โหลดคลังผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (isCurrentRequest() && isInitialLoad) {
        setIsLoadingAssets(false);
      }
    }
  }, [
    loadIdentityUserId,
    enabled,
    requestScopeKey,
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
    canRecoverOwnerSummaryFromPublicSnapshot,
    ownerPublicCreatorId,
    reportError
  ]);

  useLayoutEffect(() => {
    if (readLifecycle.current.transition(requestScopeKey)) {
      requestSequence.current += 1;
      hasLoadedAssets.current = false;
      setAssets([]);
      setIsLoadingAssets(true);
    }
  }, [requestScopeKey]);

  useEffect(() => {
    if (!enabled || !readLifecycle.current.claimAutomaticLoad(requestScopeKey)) return;
    void refreshAssets();
  }, [enabled, requestScopeKey, refreshAssets]);

  const createAsset = useCallback(async (assetData: NewAssetData, options?: WorkCreateOptions) => {
    if (!currentUser) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };
    const result = await cxlDataService.works.create({
      ...assetData,
      userId: currentUser.id,
      authorName: currentUser.displayName,
      authorAvatar: currentUser.avatarUrl
    }, options);
    if (result.data) setAssets(previous => [result.data!, ...previous]);
    return result;
  }, [currentUser]);

  const loadAssetDetail = useCallback(async (assetId: string, options?: { suppressError?: boolean }): Promise<Asset | null> => {
    const ticket = readLifecycle.current.capture(requestScopeKey);
    return loadAssetDetailWithBoundedRetry<Asset>({
      sequence: detailRequestSequence,
      isScopeCurrent: () => Boolean(ticket && readLifecycle.current.isCurrent(ticket)),
      retryOwnerTransient: shouldRetryOwnerDetailRead({
        vercelOwnerAuth: isVercelOwnerAuth,
        currentUserId: currentUser?.id,
        publicOnly: loadOptions.publicOnly,
        creatorSlug: loadOptions.creatorSlug,
        scopedUserId: loadOptions.userId
      }),
      read: () => cxlDataService.works.fetch({
        assetId,
        currentUserId: currentUser?.id,
        detail: 'full',
        limit: 1
      }),
      reportError: options?.suppressError ? () => undefined : reportError,
      commit: (detailedAsset, isCurrent) => setAssets(previous => {
        if (!isCurrent()) return previous;
        return previous.some(asset => asset.id === detailedAsset.id)
          ? previous.map(asset => asset.id === detailedAsset.id ? detailedAsset : asset)
          : [detailedAsset, ...previous];
      })
    });
  }, [currentUser?.id, loadOptions.publicOnly, reportError, requestScopeKey]);

  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>, options?: WorkUpdateOptions) => {
    if (!currentUser) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };
    const result = await cxlDataService.works.update(id, updates, options);
    if (result.data) setAssets(previous => previous.map(asset => asset.id === id ? result.data! : asset));
    return result;
  }, [currentUser]);

  const softDeleteAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.works.softDelete(id);
    if (result.success) {
      const deletedAt = new Date().toISOString();
      setAssets(previous => previous.map(asset => asset.id === id ? { ...asset, deletedAt } : asset));
    }
    return result;
  }, [currentUser]);

  const restoreAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.works.restore(id);
    if (result.success) setAssets(previous => previous.map(asset => asset.id === id ? { ...asset, deletedAt: null } : asset));
    return result;
  }, [currentUser]);

  const permanentDeleteAsset = useCallback(async (id: string) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.works.permanentDelete(id);
    if (result.success) {
      cxlDataService.settings.removeWorkFromCreatorSpace(currentUser.id, id);
      setAssets(previous => previous.filter(asset => asset.id !== id));
    }
    return result;
  }, [currentUser]);

  const forkAsset = useCallback(async (sourceAsset: Asset) => {
    if (!currentUser) return { data: null, sourceForkCount: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.works.fork(
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
  const isChangingAccountScope = readLifecycle.current.capture(requestScopeKey) === null;

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
