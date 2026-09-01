import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../../types';
import { normalizeProfileUsername } from '../profileIdentity';

export function mapSupabaseAuthUser(
  authUser: SupabaseAuthUser,
  profile?: Partial<User> | null
): User {
  return {
    id: authUser.id,
    email: authUser.email || '',
    displayName:
      profile?.displayName ||
      authUser.user_metadata?.display_name ||
      authUser.user_metadata?.displayName ||
      authUser.email?.split('@')[0] ||
      'Creator',
    // Public Profile identity comes from the Profile record (or its explicit
    // local QA overlay), never independently from mutable Auth metadata.
    username: normalizeProfileUsername(profile?.username),
    bio: profile?.bio || authUser.user_metadata?.bio || '',
    avatarUrl:
      profile?.avatarUrl ||
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.avatarUrl ||
      undefined,
    coverUrl: profile?.coverUrl || authUser.user_metadata?.cover_url || authUser.user_metadata?.coverUrl || undefined,
    socialLinks: profile?.socialLinks || [],
    createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
    provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
  };
}
