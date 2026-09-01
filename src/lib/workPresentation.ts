import type { Asset, User } from '../types';

export interface WorkCreatorPresentation {
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

/** Current Profile wins for the matching owner; old Work snapshots are fallback only. */
export function resolveWorkCreator(asset: Pick<Asset, 'userId' | 'authorName' | 'authorAvatar'>, profile?: User | null): WorkCreatorPresentation {
  if (profile && profile.id === asset.userId) {
    return { displayName: profile.displayName, username: profile.username, avatarUrl: profile.avatarUrl };
  }
  return { displayName: asset.authorName, avatarUrl: asset.authorAvatar };
}
