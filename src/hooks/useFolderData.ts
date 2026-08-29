import { useCallback, useEffect, useState } from 'react';
import { Folder } from '../types';
import { supabaseService } from '../lib/supabaseService';

type ReportError = (message: string) => void;

export function useFolderData(currentUserId: string | undefined, reportError: ReportError) {
  const [folders, setFolders] = useState<Folder[]>([]);

  const refreshFolders = useCallback(async () => {
    if (!currentUserId) {
      setFolders([]);
      return;
    }

    try {
      const res = await supabaseService.fetchFolders(currentUserId);
      if (res.error) {
        setFolders([]);
        reportError(res.error);
      } else {
        setFolders(res.data);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      setFolders([]);
      reportError('โหลดโฟลเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }, [currentUserId, reportError]);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  return { folders, setFolders, refreshFolders };
}
