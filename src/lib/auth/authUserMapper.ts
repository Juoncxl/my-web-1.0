import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../../types';

export const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

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
    bio: profile?.bio || authUser.user_metadata?.bio || 'นักสร้างสรรค์ผลงาน 🌸',
    avatarUrl:
      profile?.avatarUrl ||
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.avatarUrl ||
      DEFAULT_AVATAR,
    createdAt: profile?.createdAt || authUser.created_at || new Date().toISOString(),
    provider: authUser.app_metadata?.provider === 'google' ? 'google' : 'email'
  };
}
