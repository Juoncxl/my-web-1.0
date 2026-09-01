import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getProfileSnapshot: vi.fn()
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

vi.mock('../supabaseService', () => ({
  supabaseService: {
    getProfileSnapshot: authMocks.getProfileSnapshot
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

function makeSession(user = makeAuthUser()): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user
  } as Session;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('email login session stability', () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
    authMocks.signOut.mockReset();
    authMocks.getProfileSnapshot.mockReset();
    authMocks.getProfileSnapshot.mockReturnValue(null);
  });

  it('returns the authenticated user without requiring Profile or username data', async () => {
    const user = makeAuthUser();
    const session = makeSession(user);
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
    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('returns the same-user canonical Profile snapshot instead of an Auth fallback', async () => {
    const user = makeAuthUser();
    authMocks.getProfileSnapshot.mockReturnValue({
      id: 'user-1',
      displayName: 'Juon',
      username: 'juoncxl',
      avatarUrl: 'data:image/png;base64,real-avatar'
    });
    authMocks.signInWithPassword.mockResolvedValue({ data: { user, session: makeSession(user) }, error: null });

    const result = await loginWithEmail('creator@example.com', 'password');

    expect(result.user).toMatchObject({
      id: 'user-1',
      displayName: 'Juon',
      username: 'juoncxl',
      avatarUrl: 'data:image/png;base64,real-avatar'
    });
    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('waits for stale logout cleanup before issuing exactly one fresh sign-in', async () => {
    const signOutResult = deferred<{ error: null }>();
    authMocks.signOut.mockReturnValue(signOutResult.promise);
    const user = makeAuthUser();
    authMocks.signInWithPassword.mockResolvedValue({ data: { user, session: makeSession(user) }, error: null });

    const logoutPromise = logout();
    const loginPromise = loginWithEmail('creator@example.com', 'password');
    await Promise.resolve();

    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();

    signOutResult.resolve({ error: null });
    await logoutPromise;
    const result = await loginPromise;

    expect(result.success).toBe(true);
    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('attributes a 504 to temporary Auth service availability without retrying credentials', async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 504, code: 'request_timeout', message: 'HTTP 504' }
    });

    const result = await loginWithEmail('creator@example.com', 'password');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ระบบยืนยันตัวตนไม่พร้อมใช้งานชั่วคราว');
    expect(result.error).toContain('HTTP 504');
    expect(result.error).not.toContain('รหัสผ่าน');
    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('ends the Supabase session on logout', async () => {
    authMocks.signOut.mockResolvedValue({ error: null });

    await logout();

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
