import type { Asset, User } from '../types';
import { resolvePublicCreatorKey } from './publicCreatorIdentity';

export interface WorkCreatorPresentation {
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

/** Current Profile wins for the matching owner; old Work snapshots are fallback only. */
export function resolveWorkCreator(asset: Pick<Asset, 'authorName' | 'authorAvatar'> & {
  userId?: string | null;
  publicCreatorId?: string | null;
}, profile?: User | null): WorkCreatorPresentation {
  if (profile && profile.id === resolvePublicCreatorKey(asset)) {
    return { displayName: profile.displayName, username: profile.username, avatarUrl: profile.avatarUrl };
  }
  return { displayName: asset.authorName, avatarUrl: asset.authorAvatar };
}
