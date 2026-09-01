import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Folder, User } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { isPublicFeedVisibility } from '../lib/assetVisibility';
import { isGenuineProfileNotFound } from '../lib/profileIdentity';

export interface CreatorSpaceSources {
  assets: Asset[];
  folders: Folder[];
  isAssetsLoading: boolean;
  isFoldersLoading: boolean;
}

export interface CreatorSpaceData {
  profile: User | null;
  assets: Asset[];
  folders: Folder[];
  isProfileLoading: boolean;
  isAssetsLoading: boolean;
  isFoldersLoading: boolean;
  isNotFound: boolean;
  error: string | null;
  refresh: (options?: { background?: boolean }) => Promise<void>;
}

export function selectCreatorAssets(source: Asset[], profileId: string | undefined, isOwner: boolean): Asset[] {
  if (!profileId) return [];
  return source.filter(asset => asset.userId === profileId && (isOwner || isPublicFeedVisibility(asset)));
}

export function selectCreatorFolders(source: Folder[], profileId: string | undefined, isOwner: boolean): Folder[] {
  if (!profileId || !isOwner) return [];
  return source.filter(folder => folder.userId === profileId);
}

export function useCreatorSpaceData(
  slug: string,
  currentUserId: string | undefined,
  ownerFallback: User | null | undefined,
  sources: CreatorSpaceSources
): CreatorSpaceData {
  const [profile, setProfile] = useState<User | null>(() => supabaseService.getCreatorProfileSnapshot(slug));
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const initializedSlug = useRef<string | null>(null);
  const blockingLoadActive = useRef(false);

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

  const refresh = useCallback(async (options: { background?: boolean } = {}) => {
    const background = options.background === true;
    if (background && blockingLoadActive.current) return;
    const requestId = ++requestSequence.current;
    if (!background) {
      blockingLoadActive.current = true;
      setIsProfileLoading(true);
      setIsNotFound(false);
      setError(null);
    }
    if (ownerProfileFallback) {
      setProfile(current => current || supabaseService.getCreatorProfileSnapshot(slug) || ownerProfileFallback);
    }

    try {
      const profileResult = await supabaseService.getCreatorProfile(slug);
      if (requestId !== requestSequence.current) return;

      // The restored owner session is a safe fallback while the profile row
      // is being provisioned or temporarily unavailable.
      const resolvedProfile = profileResult.data || ownerProfileFallback;
      if (!resolvedProfile) {
        if (!background) {
          setProfile(null);
        }
        setError(isOwnerSlug
          ? 'บัญชีของคุณยังไม่มี Creator Profile กรุณาลองใหม่หลังการ provision โปรไฟล์'
          : profileResult.error || 'ไม่พบ Creator ที่ต้องการ');
        setIsNotFound(!isOwnerSlug && isGenuineProfileNotFound(profileResult));
        return;
      }

      setIsNotFound(false);
      setProfile(resolvedProfile);
    } catch (caughtError) {
      if (requestId !== requestSequence.current) return;
      console.error('Creator profile load error:', caughtError);
      setIsNotFound(false);
      if (ownerProfileFallback) {
        setProfile(ownerProfileFallback);
        setError('โหลดโปรไฟล์ของคุณไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } else if (!background) {
        setProfile(null);
        setError('โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } else {
        setError('อัปเดตข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      if (requestId === requestSequence.current && !background) {
        blockingLoadActive.current = false;
        setIsProfileLoading(false);
      }
    }
  }, [currentUserId, isOwnerSlug, ownerProfileFallback, slug]);

  useEffect(() => {
    if (initializedSlug.current === slug) return;
    const identityChanged = initializedSlug.current !== null;
    initializedSlug.current = slug;
    if (identityChanged) {
      setProfile(current => {
        if (current && (
          decodedSlug === current.id ||
          current.username?.trim().toLowerCase() === decodedSlug.toLowerCase()
        )) return current;
        return supabaseService.getCreatorProfileSnapshot(slug) || ownerProfileFallback;
      });
    }
    void refresh();
  }, [decodedSlug, ownerProfileFallback, refresh, slug]);

  const isOwner = Boolean(profile && profile.id === currentUserId);
  const assets = useMemo(
    () => selectCreatorAssets(sources.assets, profile?.id, isOwner),
    [isOwner, profile?.id, sources.assets]
  );
  const folders = useMemo(
    () => selectCreatorFolders(sources.folders, profile?.id, isOwner),
    [isOwner, profile?.id, sources.folders]
  );

  return {
    profile,
    assets,
    folders,
    isProfileLoading,
    isAssetsLoading: sources.isAssetsLoading,
    isFoldersLoading: isOwner ? sources.isFoldersLoading : false,
    isNotFound,
    error,
    refresh
  };
}

export function getCreatorVisibleAssets(assets: Asset[], isOwner: boolean): Asset[] {
  return isOwner ? assets.filter(asset => !asset.deletedAt) : assets.filter(isPublicFeedVisibility);
}
