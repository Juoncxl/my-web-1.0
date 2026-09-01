import { describe, expect, it } from 'vitest';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { mapSupabaseAuthUser } from './authUserMapper';
import { getCanonicalProfilePath } from '../profileIdentity';

function makeAuthUser(overrides: Partial<SupabaseAuthUser> = {}): SupabaseAuthUser {
  return {
    id: 'user-1',
    email: 'creator@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as SupabaseAuthUser;
}

describe('mapSupabaseAuthUser', () => {
  it('prioritizes profile values over metadata and maps the provider', () => {
    const user = mapSupabaseAuthUser(
      makeAuthUser({
        app_metadata: { provider: 'google' },
        user_metadata: {
          display_name: 'Metadata name',
          username: 'stale-auth-username',
          bio: 'Metadata bio',
          avatar_url: 'https://example.com/metadata.png'
        }
      }),
      {
        displayName: 'Profile name',
        username: 'JuonCXL',
        bio: 'Profile bio',
        avatarUrl: 'https://example.com/profile.png',
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    );

    expect(user).toMatchObject({
      id: 'user-1',
      displayName: 'Profile name',
      username: 'juoncxl',
      bio: 'Profile bio',
      avatarUrl: 'https://example.com/profile.png',
      createdAt: '2026-02-01T00:00:00.000Z',
      provider: 'google'
    });
  });

  it('does not invent public Profile identity from Auth metadata during hydration', () => {
    const user = mapSupabaseAuthUser(makeAuthUser({
      user_metadata: { username: 'stale-or-generated-name' }
    }), { displayName: 'Profile without username', username: undefined });

    expect(user.username).toBeUndefined();
  });

  it('keeps the canonical Profile route stable across repeated Auth hydration', () => {
    const authUser = makeAuthUser({ user_metadata: { username: 'stale-name' } });
    const profile = { displayName: 'Profile name', username: 'JuonCXL' };

    const firstHydration = mapSupabaseAuthUser(authUser, profile);
    const remountHydration = mapSupabaseAuthUser(authUser, profile);

    expect(getCanonicalProfilePath(firstHydration)).toBe('/@juoncxl');
    expect(getCanonicalProfilePath(remountHydration)).toBe('/@juoncxl');
  });

  it('falls back from metadata to email and defaults without creating Guest state', () => {
    const metadataUser = mapSupabaseAuthUser(makeAuthUser({
      user_metadata: {
        displayName: 'Metadata name',
        bio: 'Metadata bio',
        avatarUrl: 'https://example.com/metadata.png'
      }
    }));
    expect(metadataUser).toMatchObject({
      displayName: 'Metadata name',
      bio: 'Metadata bio',
      avatarUrl: 'https://example.com/metadata.png',
      provider: 'email'
    });

    const emailUser = mapSupabaseAuthUser(makeAuthUser({
      email: 'email-name@example.com'
    }));
    expect(emailUser.displayName).toBe('email-name');
    expect(emailUser.bio).toBe('');
    expect(emailUser.avatarUrl).toBeUndefined();
    expect(Object.hasOwn(emailUser, 'isGuest')).toBe(false);
  });
});
