import { describe, expect, it } from 'vitest';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { mapSupabaseAuthUser } from './authUserMapper';

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
          bio: 'Metadata bio',
          avatar_url: 'https://example.com/metadata.png'
        }
      }),
      {
        displayName: 'Profile name',
        bio: 'Profile bio',
        avatarUrl: 'https://example.com/profile.png',
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    );

    expect(user).toMatchObject({
      id: 'user-1',
      displayName: 'Profile name',
      bio: 'Profile bio',
      avatarUrl: 'https://example.com/profile.png',
      createdAt: '2026-02-01T00:00:00.000Z',
      provider: 'google'
    });
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
