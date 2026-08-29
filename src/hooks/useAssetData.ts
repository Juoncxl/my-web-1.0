import { useCallback, useEffect, useState } from 'react';
import { Asset } from '../types';
import { supabaseService } from '../lib/supabaseService';

type ReportError = (message: string) => void;

export function useAssetData(currentUserId: string | undefined, reportError: ReportError) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  const refreshAssets = useCallback(async () => {
    try {
      setIsLoadingAssets(true);
      const res = await supabaseService.fetchAssets({
        currentUserId,
        includeDeleted: true
      });
      if (res.error) {
        setAssets([]);
        reportError(res.error);
      } else {
        setAssets(res.data);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
      setAssets([]);
      reportError('โหลดคลังผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoadingAssets(false);
    }
  }, [currentUserId, reportError]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  return { assets, setAssets, isLoadingAssets, refreshAssets };
}
