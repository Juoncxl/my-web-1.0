import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder } from '../types';
import { supabaseService } from '../lib/supabaseService';

type ReportError = (message: string) => void;

export function useFolderData(currentUserId: string | undefined, reportError: ReportError) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(Boolean(currentUserId));
  const requestSequence = useRef(0);
  const scopeSequence = useRef(0);
  const previousUserId = useRef(currentUserId);
  const hasLoadedFolders = useRef(false);

  const refreshFolders = useCallback(async () => {
    if (!currentUserId) return;

    const requestId = ++requestSequence.current;
    const requestScope = scopeSequence.current;
    const isInitialLoad = !hasLoadedFolders.current;
    if (isInitialLoad) setIsLoadingFolders(true);
    try {
      const res = await supabaseService.fetchFolders(currentUserId);
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      if (res.error) {
        reportError(res.error);
        return;
      }
      setFolders(res.data);
      hasLoadedFolders.current = true;
    } catch (error) {
      if (requestId !== requestSequence.current || requestScope !== scopeSequence.current) return;
      console.error('Error loading folders:', error);
      reportError('โหลดโฟลเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (requestId === requestSequence.current && requestScope === scopeSequence.current && isInitialLoad) {
        setIsLoadingFolders(false);
      }
    }
  }, [currentUserId, reportError]);

  useEffect(() => {
    if (previousUserId.current !== currentUserId) {
      previousUserId.current = currentUserId;
      scopeSequence.current += 1;
      hasLoadedFolders.current = false;
      setFolders([]);
    }
    if (currentUserId) void refreshFolders();
  }, [currentUserId, refreshFolders]);

  const createFolder = useCallback(async (name: string, icon = '📁', color = 'purple') => {
    if (!currentUserId) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.createFolder({ userId: currentUserId, name, icon, color });
    if (result.data) setFolders(previous => [...previous, result.data!]);
    return result;
  }, [currentUserId]);

  const updateFolder = useCallback(async (id: string, name: string, icon?: string, color?: string) => {
    if (!currentUserId) return { data: null, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.updateFolder(id, currentUserId, { name, icon, color });
    if (result.data) setFolders(previous => previous.map(folder => folder.id === id ? result.data! : folder));
    return result;
  }, [currentUserId]);

  const deleteFolder = useCallback(async (id: string) => {
    if (!currentUserId) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
    const result = await supabaseService.deleteFolder(id, currentUserId);
    if (result.success) setFolders(previous => previous.filter(folder => folder.id !== id));
    return result;
  }, [currentUserId]);

  const isChangingAccountScope = previousUserId.current !== currentUserId;
  return {
    folders,
    isLoadingFolders: isLoadingFolders || isChangingAccountScope,
    refreshFolders,
    createFolder,
    updateFolder,
    deleteFolder
  };
}
