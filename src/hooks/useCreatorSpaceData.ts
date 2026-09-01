import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, Folder, User } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { isPublicFeedVisibility } from '../lib/assetVisibility';

const CREATOR_PROFILE_LOAD_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${operation} timed out`)), CREATOR_PROFILE_LOAD_TIMEOUT_MS);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

export interface CreatorSpaceData {
  profile: User | null;
  assets: Asset[];
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCreatorSpaceData(slug: string, currentUserId?: string, ownerFallback?: User | null): CreatorSpaceData {
  const [profile, setProfile] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug).trim();
    } catch {
      return '';
    }
  })();
  const isOwnerSlug = Boolean(
    currentUserId && (
      decodedSlug === currentUserId ||
      (ownerFallback?.id === currentUserId && ownerFallback.username === decodedSlug)
    )
  );
  const ownerProfileFallback = isOwnerSlug && ownerFallback?.id === currentUserId ? ownerFallback : null;

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    try {
      const profileResult = await withTimeout(
        supabaseService.getCreatorProfile(slug),
        'Creator profile lookup'
      );
      if (requestId !== requestSequence.current) return;

      // The restored owner session is a safe fallback while the profile row
      // is being provisioned or temporarily unavailable.
      const resolvedProfile = profileResult.data || ownerProfileFallback;
      if (!resolvedProfile) {
        setProfile(null);
        setAssets([]);
        setFolders([]);
        setError(isOwnerSlug
          ? 'บัญชีของคุณยังไม่มี Creator Profile กรุณาลองใหม่หลังการ provision โปรไฟล์'
          : profileResult.error || 'ไม่พบ Creator ที่ต้องการ');
        return;
      }

      setProfile(resolvedProfile);
      const isOwner = resolvedProfile.id === currentUserId;
      const [assetResult, folderResult] = await withTimeout(
        Promise.all([
          supabaseService.fetchAssets({
            userId: resolvedProfile.id,
            currentUserId,
            includeDeleted: isOwner
          }),
          isOwner ? supabaseService.fetchFolders(resolvedProfile.id) : Promise.resolve({ data: [], error: null })
        ]),
        'Creator profile content lookup'
      );
      if (requestId !== requestSequence.current) return;

      if (assetResult.error) {
        setAssets([]);
        setFolders([]);
        setError(assetResult.error);
        return;
      }
      setAssets(assetResult.data);
      setFolders(folderResult.data);
      if (folderResult.error) setError(folderResult.error);
    } catch (caughtError) {
      if (requestId !== requestSequence.current) return;
      console.error('Creator profile load error:', caughtError);
      if (ownerProfileFallback) {
        setProfile(ownerProfileFallback);
        setAssets([]);
        setFolders([]);
        setError('โหลดผลงานของคุณไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } else {
        setProfile(null);
        setAssets([]);
        setFolders([]);
        setError('โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [currentUserId, isOwnerSlug, ownerProfileFallback, slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleDataChanged = () => { void refresh(); };
    window.addEventListener('creator-vault-qa-data-changed', handleDataChanged);
    window.addEventListener('creator-vault-cloud-data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('creator-vault-qa-data-changed', handleDataChanged);
      window.removeEventListener('creator-vault-cloud-data-changed', handleDataChanged);
    };
  }, [refresh]);

  return { profile, assets, folders, isLoading, error, refresh };
}

export function getCreatorSlug(pathname: string): string | null {
  const match = pathname.match(/^\/@([^/]+)\/?$/i);
  return match ? match[1] : null;
}

export function getCreatorVisibleAssets(assets: Asset[], isOwner: boolean): Asset[] {
  return isOwner ? assets.filter(asset => !asset.deletedAt) : assets.filter(isPublicFeedVisibility);
}
