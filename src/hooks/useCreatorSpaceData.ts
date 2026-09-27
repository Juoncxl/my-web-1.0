import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Folder, User } from '../types';
import { cxlDataService } from '../data/cxlDataService';
import { isPublicFeedAsset } from '../lib/accessPolicy';
import { isPublicFeedVisibility } from '../lib/assetVisibility';
import { isGenuineProfileNotFound } from '../lib/profileIdentity';
import { resolvePublicCreatorKey } from '../lib/publicCreatorIdentity';

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

export type CreatorSpaceRenderState = 'session-loading' | 'profile-loading' | 'not-found' | 'profile-failed' | 'ready';

export function getCreatorSpaceRenderState(input: {
  authLoading: boolean;
  isProfileLoading: boolean;
  profile: User | null;
  isNotFound: boolean;
}): CreatorSpaceRenderState {
  if (input.authLoading) return 'session-loading';
  if (input.profile) return 'ready';
  if (input.isProfileLoading) return 'profile-loading';
  return input.isNotFound ? 'not-found' : 'profile-failed';
}

export function selectCreatorAssets(source: Asset[], profileId: string | undefined, isOwner: boolean): Asset[] {
  const normalizedProfileId = profileId?.trim();
  if (!normalizedProfileId) return [];
  return source.filter(asset => {
    const matchesCreator = isOwner
      ? asset.userId === normalizedProfileId
      : resolvePublicCreatorKey(asset) === normalizedProfileId;
    return matchesCreator && (isOwner || isPublicFeedAsset(asset));
  });
}

export function selectCreatorFolders(source: Folder[], profileId: string | undefined, isOwner: boolean): Folder[] {
  if (!profileId || !isOwner) return [];
  return source.filter(folder => folder.userId === profileId);
}

/** Saved is an ID-based relationship, but the card still needs the canonical asset source. */
export function selectCreatorSavedAssets(
  source: Asset[],
  bookmarkedAssetIds: readonly string[],
  currentUserId: string | undefined
): Asset[] {
  if (!currentUserId) return [];
  return source.filter(asset =>
    bookmarkedAssetIds.includes(asset.id) &&
    !asset.deletedAt &&
    (asset.userId === currentUserId || isPublicFeedVisibility(asset))
  );
}

export function resolveOwnerProfileEnrichmentFailure(ownerFallback: User | null): {
  profile: User | null;
  error: string | null;
  isNotFound: boolean;
} {
  return ownerFallback
    ? { profile: ownerFallback, error: null, isNotFound: false }
    : { profile: null, error: 'โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', isNotFound: false };
}

export function useCreatorSpaceData(
  slug: string,
  currentUserId: string | undefined,
  ownerFallback: User | null | undefined,
  sources: CreatorSpaceSources,
  authLoading = false
): CreatorSpaceData {
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug).trim();
    } catch {
      return '';
    }
  })();
  const normalizedSlug = decodedSlug.trim().replace(/^@+/, '').toLowerCase();
  const isOwnerSlug = Boolean(
    currentUserId && (
      decodedSlug.toLowerCase() === currentUserId.trim().toLowerCase() ||
      (ownerFallback?.id === currentUserId && ownerFallback.username?.trim().replace(/^@+/, '').toLowerCase() === normalizedSlug)
    )
  );
  const ownerProfileFallback = isOwnerSlug && ownerFallback?.id === currentUserId ? ownerFallback : null;
  const [profile, setProfile] = useState<User | null>(() =>
    authLoading ? null : cxlDataService.profiles.getCreatorSnapshot(slug) || ownerProfileFallback
  );
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const initializedSlug = useRef<string | null>(null);
  const blockingLoadActive = useRef(false);

  const refresh = useCallback(async (options: { background?: boolean } = {}) => {
    if (authLoading) return;
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
      setProfile(current => current || cxlDataService.profiles.getCreatorSnapshot(slug) || ownerProfileFallback);
      // Auth already contains the canonical owner identity and presentation.
      // Render it immediately while the cloud profile refresh continues in
      // the background instead of blocking the whole page on another lookup.
      if (!background) {
        blockingLoadActive.current = false;
        setIsProfileLoading(false);
      }
    }

    try {
      const profileResult = await cxlDataService.profiles.getCreator(slug);
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
      if (ownerProfileFallback) setError(null);
      setProfile(resolvedProfile);
    } catch (caughtError) {
      if (requestId !== requestSequence.current) return;
      setIsNotFound(false);
      if (ownerProfileFallback) {
        const fallbackResult = resolveOwnerProfileEnrichmentFailure(ownerProfileFallback);
        setProfile(current => current || fallbackResult.profile);
        setError(fallbackResult.error);
      } else if (!background) {
        console.error('Creator profile load error:', caughtError);
        setProfile(null);
        setError(resolveOwnerProfileEnrichmentFailure(null).error);
      } else {
        console.error('Creator profile refresh error:', caughtError);
        setError('อัปเดตข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      if (requestId === requestSequence.current && !background && blockingLoadActive.current) {
        blockingLoadActive.current = false;
        setIsProfileLoading(false);
      }
    }
  }, [authLoading, currentUserId, isOwnerSlug, ownerProfileFallback, slug]);

  useEffect(() => {
    if (authLoading) return;
    if (initializedSlug.current === slug) return;
    const identityChanged = initializedSlug.current !== null;
    initializedSlug.current = slug;
    if (identityChanged) {
      setProfile(current => {
        if (current && (
          decodedSlug === current.id ||
          current.username?.trim().toLowerCase() === decodedSlug.toLowerCase()
        )) return current;
        return cxlDataService.profiles.getCreatorSnapshot(slug) || ownerProfileFallback;
      });
    }
    void refresh();
  }, [authLoading, decodedSlug, ownerProfileFallback, refresh, slug]);

  const resolvedProfile = isOwnerSlug && ownerProfileFallback ? profile || ownerProfileFallback : profile;
  const isOwner = Boolean(resolvedProfile && (
    resolvedProfile.id === currentUserId ||
    (ownerFallback?.publicCreatorId && resolvedProfile.publicCreatorId === ownerFallback.publicCreatorId)
  ));
  const assets = useMemo(
    () => selectCreatorAssets(sources.assets, isOwner ? currentUserId : resolvedProfile?.publicCreatorId || resolvedProfile?.id, isOwner),
    [currentUserId, isOwner, resolvedProfile?.id, resolvedProfile?.publicCreatorId, sources.assets]
  );
  const folders = useMemo(
    () => selectCreatorFolders(sources.folders, isOwner ? currentUserId : resolvedProfile?.id, isOwner),
    [currentUserId, isOwner, resolvedProfile?.id, sources.folders]
  );

  return {
    profile: resolvedProfile,
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
  return isOwner ? assets.filter(asset => !asset.deletedAt) : assets.filter(isPublicFeedAsset);
}
