import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, Folder, User } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { isPublicFeedVisibility } from '../lib/assetVisibility';

export interface CreatorSpaceData {
  profile: User | null;
  assets: Asset[];
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCreatorSpaceData(slug: string, currentUserId?: string): CreatorSpaceData {
  const [profile, setProfile] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const isOwnerSlug = (() => {
    if (!currentUserId) return false;
    try {
      return decodeURIComponent(slug).trim() === currentUserId;
    } catch {
      return false;
    }
  })();

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    const profileResult = await supabaseService.getCreatorProfile(slug);
    if (requestId !== requestSequence.current) return;
    if (!profileResult.data) {
      setProfile(null);
      setAssets([]);
      setFolders([]);
      setError(isOwnerSlug
        ? 'บัญชีของคุณยังไม่มี Creator Profile กรุณาลองใหม่หลังการ provision โปรไฟล์'
        : profileResult.error || 'ไม่พบ Creator ที่ต้องการ');
      setIsLoading(false);
      return;
    }

    setProfile(profileResult.data);
    const isOwner = profileResult.data.id === currentUserId;
    const [assetResult, folderResult] = await Promise.all([
      supabaseService.fetchAssets({
        userId: profileResult.data.id,
        currentUserId,
        includeDeleted: isOwner
      }),
      isOwner ? supabaseService.fetchFolders(profileResult.data.id) : Promise.resolve({ data: [], error: null })
    ]);
    if (requestId !== requestSequence.current) return;

    if (assetResult.error) {
      setAssets([]);
      setFolders([]);
      setError(assetResult.error);
      setIsLoading(false);
      return;
    }
    setAssets(assetResult.data);
    setFolders(folderResult.data);
    if (folderResult.error) setError(folderResult.error);
    setIsLoading(false);
  }, [currentUserId, isOwnerSlug, slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, assets, folders, isLoading, error, refresh };
}

export function getCreatorSlug(pathname: string): string | null {
  const match = pathname.match(/^\/creator\/([^/]+)\/?$/i);
  return match ? match[1] : null;
}

export function getCreatorVisibleAssets(assets: Asset[], isOwner: boolean): Asset[] {
  return isOwner ? assets.filter(asset => !asset.deletedAt) : assets.filter(isPublicFeedVisibility);
}
