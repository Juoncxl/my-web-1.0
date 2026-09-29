import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Folder } from '../types';
import { cxlDataService } from '../data/cxlDataService';
import { ScopedReadLifecycle } from './scopedReadLifecycle';
import { isVercelOwnerAuth } from '../lib/auth/ownerAuthBackend';
import { readWithBoundedRetry } from './boundedReadRetry';

type ReportError = (message: string) => void;

export function useFolderData(currentUserId: string | undefined, reportError: ReportError) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(Boolean(currentUserId));
  const requestSequence = useRef(0);
  const readLifecycle = useRef(new ScopedReadLifecycle());
  const requestScopeKey = currentUserId || '__anonymous__';
  const hasLoadedFolders = useRef(false);

  const refreshFolders = useCallback(async () => {
    if (!currentUserId) return;

    const requestId = ++requestSequence.current;
    const ticket = readLifecycle.current.capture(requestScopeKey);
    if (!ticket) return;
    const isCurrentRequest = () => requestId === requestSequence.current && readLifecycle.current.isCurrent(ticket);
    const isInitialLoad = !hasLoadedFolders.current;
    if (isInitialLoad) setIsLoadingFolders(true);
    try {
      const res = await readWithBoundedRetry<Awaited<ReturnType<typeof cxlDataService.folders.fetch>>>(() => cxlDataService.folders.fetch(currentUserId), {
        enabled: isInitialLoad && isVercelOwnerAuth,
        isCurrent: isCurrentRequest,
        getError: value => value.error
      });
      if (!isCurrentRequest()) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setFolders(res.data);
      hasLoadedFolders.current = true;
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error('Error loading folders:', error);
      reportError('โหลดโฟลเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (isCurrentRequest() && isInitialLoad) {
        setIsLoadingFolders(false);
      }
    }
  }, [currentUserId, reportError, requestScopeKey]);

  useLayoutEffect(() => {
    if (readLifecycle.current.transition(requestScopeKey)) {
      requestSequence.current += 1;
      hasLoadedFolders.current = false;
      setFolders([]);
      setIsLoadingFolders(Boolean(currentUserId));
    }
  }, [currentUserId, requestScopeKey]);

  useEffect(() => {
    if (!currentUserId || !readLifecycle.current.claimAutomaticLoad(requestScopeKey)) return;
    void refreshFolders();
  }, [currentUserId, refreshFolders, requestScopeKey]);

  const createFolder = useCallback(async (name: string, icon = '📁', color = 'purple') => {
    if (!currentUserId) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.folders.create({ userId: currentUserId, name, icon, color });
    if (result.data) setFolders(previous => [...previous, result.data!]);
    return result;
  }, [currentUserId]);

  const updateFolder = useCallback(async (id: string, name: string, icon?: string, color?: string) => {
    if (!currentUserId) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.folders.update(id, currentUserId, { name, icon, color });
    if (result.data) setFolders(previous => previous.map(folder => folder.id === id ? result.data! : folder));
    return result;
  }, [currentUserId]);

  const deleteFolder = useCallback(async (id: string) => {
    if (!currentUserId) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await cxlDataService.folders.delete(id, currentUserId);
    if (result.success) setFolders(previous => previous.filter(folder => folder.id !== id));
    return result;
  }, [currentUserId]);

  const isChangingAccountScope = readLifecycle.current.capture(requestScopeKey) === null;
  return {
    folders,
    isLoadingFolders: isLoadingFolders || isChangingAccountScope,
    refreshFolders,
    createFolder,
    updateFolder,
    deleteFolder
  };
}
