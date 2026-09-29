import { useEffect, useMemo, useState } from 'react';
import type { Asset, User } from '../types';
import { cxlDataService } from '../data/cxlDataService';
import { collectPublicCreatorKeys, type PublicCreatorIdentitySource } from '../lib/publicCreatorIdentity';

export function getPublicCreatorProfileLookupKey(assets: readonly PublicCreatorIdentitySource[]): string {
  return collectPublicCreatorKeys(assets).join('\u0001');
}

/** Keeps list-card identity current without restoring legacy avatar blobs to Work queries. */
export function usePublicCreatorProfiles(assets: readonly Asset[], currentUser: User | null): Map<string, User> {
  const creatorIdsKey = getPublicCreatorProfileLookupKey(assets);
  const creatorIds = useMemo(() => creatorIdsKey ? creatorIdsKey.split('\u0001') : [], [creatorIdsKey]);
  const [profilesById, setProfilesById] = useState<Map<string, User>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const ownKey = currentUser?.publicCreatorId || currentUser?.id;
    const ownProfile = currentUser && ownKey && creatorIds.includes(ownKey) ? currentUser : null;
    const applyProfiles = (profiles: readonly User[]) => {
      if (cancelled) return;
      const next = new Map(profiles.map(profile => [profile.publicCreatorId || profile.id, profile]));
      if (ownProfile && ownKey) next.set(ownKey, ownProfile);
      setProfilesById(next);
    };

    if (creatorIds.length === 0) {
      applyProfiles([]);
      return () => { cancelled = true; };
    }

    void cxlDataService.profiles.getPublic(creatorIds).then(result => applyProfiles(result.data));
    return () => { cancelled = true; };
  }, [creatorIdsKey, currentUser]);

  return profilesById;
}
