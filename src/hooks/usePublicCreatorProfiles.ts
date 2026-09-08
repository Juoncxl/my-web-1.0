import { useEffect, useMemo, useState } from 'react';
import type { Asset, User } from '../types';
import { supabaseService } from '../lib/supabaseService';

/** Keeps list-card identity current without restoring legacy avatar blobs to Work queries. */
export function usePublicCreatorProfiles(assets: readonly Asset[], currentUser: User | null): Map<string, User> {
  const creatorIds = useMemo(
    () => [...new Set(assets.map(asset => asset.userId.trim()).filter(Boolean))].sort(),
    [assets]
  );
  const creatorIdsKey = creatorIds.join('\u0001');
  const [profilesById, setProfilesById] = useState<Map<string, User>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const ownProfile = currentUser && creatorIds.includes(currentUser.id) ? currentUser : null;
    const applyProfiles = (profiles: readonly User[]) => {
      if (cancelled) return;
      const next = new Map(profiles.map(profile => [profile.id, profile]));
      if (ownProfile) next.set(ownProfile.id, ownProfile);
      setProfilesById(next);
    };

    if (creatorIds.length === 0) {
      applyProfiles([]);
      return () => { cancelled = true; };
    }

    void supabaseService.getPublicProfiles(creatorIds).then(result => applyProfiles(result.data));
    return () => { cancelled = true; };
  }, [creatorIds, creatorIdsKey, currentUser]);

  return profilesById;
}
