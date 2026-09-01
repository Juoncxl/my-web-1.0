import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('../supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
      signOut: authMocks.signOut
    }
  }),
  isLocalRuntime: () => false,
  supabaseConfigStatus: {
    urlConfigured: true,
    anonKeyConfigured: true
  }
}));

import { loginWithEmail, logout } from './authActions';

function makeAuthUser(): SupabaseAuthUser {
  return {
    id: 'user-1',
    email: 'creator@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z'
  } as SupabaseAuthUser;
}

describe('email login session stability', () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
    authMocks.signOut.mockReset();
  });

  it('returns the authenticated user without requiring Profile or username data', async () => {
    const user = makeAuthUser();
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user
    } as Session;
    authMocks.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null });

    const result = await loginWithEmail(' CREATOR@EXAMPLE.COM ', 'password');

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'password'
    });
    expect(result).toMatchObject({
      success: true,
      isNewUser: false,
      user: {
        id: 'user-1',
        email: 'creator@example.com',
        displayName: 'creator'
      }
    });
    expect(result.user?.username).toBeUndefined();
  });

  it('ends the Supabase session on logout', async () => {
    authMocks.signOut.mockResolvedValue({ error: null });

    await logout();

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });
});
