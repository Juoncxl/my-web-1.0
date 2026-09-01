import { describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../../types';
import { startAuthSessionBootstrap, type AuthClientForBootstrap } from './authSessionBootstrap';

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
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createAuthClient(session: Session | null, sessionError: unknown = null) {
  const listeners = new Set<(event: AuthChangeEvent, nextSession: Session | null) => void>();
  const getSession = vi.fn(async () => ({ data: { session }, error: sessionError }));
  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn((callback: (event: AuthChangeEvent, nextSession: Session | null) => void) => {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
            unsubscribe();
          }
        }
      }
    };
  });
  const auth: AuthClientForBootstrap = {
    getSession,
    onAuthStateChange
  };

  return {
    auth,
    getSession,
    onAuthStateChange,
    unsubscribe,
    activeSubscriptions: () => listeners.size,
    emit: (event: AuthChangeEvent, nextSession: Session | null) => {
      listeners.forEach(listener => listener(event, nextSession));
    }
  };
}

function createScheduler() {
  const work: Array<() => void> = [];
  return {
    work,
    schedule: (next: () => void) => {
      work.push(next);
      return work.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: vi.fn()
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Auth session bootstrap regression coverage', () => {
  it('renders a same-user local Profile snapshot before async hydration and never regresses it', async () => {
    const session = makeSession(makeAuthUser({
      email: 'fahmemomusic@example.com',
      user_metadata: {}
    }));
    const client = createAuthClient(session);
    const profile = deferred<Partial<User> | null>();
    const scheduler = createScheduler();
    const users: Array<User | null> = [];
    const canonicalProfile: Partial<User> = {
      id: 'user-1',
      displayName: 'Juon',
      username: 'juoncxl',
      avatarUrl: 'data:image/png;base64,real-avatar'
    };

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      getProfileSnapshot: () => canonicalProfile,
      loadProfile: () => profile.promise,
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    await bootstrap.ready;

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      displayName: 'Juon',
      username: 'juoncxl',
      avatarUrl: 'data:image/png;base64,real-avatar'
    });

    scheduler.work.shift()?.();
    profile.resolve({ id: 'user-1', displayName: 'Lower quality persisted value' });
    await flushPromises();

    expect(users.at(-1)).toMatchObject({
      displayName: 'Juon',
      username: 'juoncxl',
      avatarUrl: 'data:image/png;base64,real-avatar'
    });
    bootstrap.dispose();
  });

  it('never renders a cached Profile that belongs to another authenticated user', async () => {
    const client = createAuthClient(makeSession());
    const scheduler = createScheduler();
    const users: Array<User | null> = [];

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      getProfileSnapshot: () => ({
        id: 'different-user',
        displayName: 'Wrong account',
        username: 'wrong-account'
      }),
      loadProfile: vi.fn(async () => null),
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    await bootstrap.ready;

    expect(users.at(-1)).toMatchObject({ id: 'user-1', displayName: 'creator' });
    expect(users.at(-1)?.username).toBeUndefined();
    bootstrap.dispose();
  });

  it('recognizes a persisted Auth user and ends loading without waiting for Profile', async () => {
    const session = makeSession();
    const client = createAuthClient(session);
    const profile = deferred<Partial<User> | null>();
    const loadProfile = vi.fn(() => profile.promise);
    const users: Array<User | null> = [];
    const loading: boolean[] = [];
    const scheduler = createScheduler();

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile,
      setCurrentUser: user => users.push(user),
      setLoading: value => loading.push(value),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    await bootstrap.ready;

    expect(client.getSession).toHaveBeenCalledTimes(1);
    expect(client.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(client.activeSubscriptions()).toBe(1);
    expect(loading).toEqual([true, false]);
    expect(users.at(-1)).toMatchObject({ id: 'user-1', email: 'creator@example.com' });
    expect(users.at(-1)?.username).toBeUndefined();
    expect(loadProfile).not.toHaveBeenCalled();
    expect(scheduler.work).toHaveLength(1);

    // Supabase emits INITIAL_SESSION during client initialization. It must not
    // create a second hydration path beside getSession().
    client.emit('INITIAL_SESSION', session);
    expect(scheduler.work).toHaveLength(1);

    scheduler.work.shift()?.();
    expect(loadProfile).toHaveBeenCalledTimes(1);
    expect(loading).toEqual([true, false]);

    profile.resolve({ displayName: 'Profile name', username: 'CreatorSlug' });
    await flushPromises();
    expect(users.at(-1)).toMatchObject({ displayName: 'Profile name', username: 'creatorslug' });

    client.emit('TOKEN_REFRESHED', session);
    expect(scheduler.work).toHaveLength(0);

    bootstrap.dispose();
    expect(client.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.activeSubscriptions()).toBe(0);
  });

  it('deduplicates the concurrent getSession probe created by React StrictMode', async () => {
    const sessionResult = deferred<{ data: { session: Session | null }; error: unknown }>();
    const client = createAuthClient(null);
    client.getSession.mockImplementation(() => sessionResult.promise);
    const scheduler = createScheduler();

    const first = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: vi.fn(),
      setCurrentUser: vi.fn(),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });
    first.dispose();

    const finalMountUsers: Array<User | null> = [];
    const second = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: vi.fn(async () => null),
      setCurrentUser: user => finalMountUsers.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    expect(client.getSession).toHaveBeenCalledTimes(1);
    expect(client.onAuthStateChange).toHaveBeenCalledTimes(2);
    expect(client.activeSubscriptions()).toBe(1);

    sessionResult.resolve({ data: { session: makeSession() }, error: null });
    await Promise.all([first.ready, second.ready]);

    expect(finalMountUsers.at(-1)).toMatchObject({ id: 'user-1' });
    expect(scheduler.work).toHaveLength(1);
    second.dispose();
    expect(client.activeSubscriptions()).toBe(0);
  });

  it('lets a successful sign-in event win over a stale guest bootstrap result', async () => {
    const sessionResult = deferred<{ data: { session: Session | null }; error: unknown }>();
    const client = createAuthClient(null);
    client.getSession.mockImplementation(() => sessionResult.promise);
    const scheduler = createScheduler();
    const users: Array<User | null> = [];
    const session = makeSession();

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: vi.fn(async () => null),
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    client.emit('SIGNED_IN', session);
    expect(users.at(-1)).toMatchObject({ id: 'user-1' });

    sessionResult.resolve({ data: { session: null }, error: null });
    await bootstrap.ready;

    expect(users.at(-1)).toMatchObject({ id: 'user-1' });
    expect(users).not.toContain(null);
    bootstrap.dispose();
  });

  it('keeps the Auth user when optional Profile hydration fails', async () => {
    const client = createAuthClient(null);
    const scheduler = createScheduler();
    const users: Array<User | null> = [];
    const logWarning = vi.fn();
    const session = makeSession();

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: async () => {
        throw new Error('profile unavailable');
      },
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel,
      logWarning
    });

    await bootstrap.ready;
    client.emit('SIGNED_IN', session);
    expect(users.at(-1)).toMatchObject({ id: 'user-1' });
    scheduler.work.shift()?.();
    await flushPromises();

    expect(users.at(-1)).toMatchObject({ id: 'user-1' });
    expect(logWarning).toHaveBeenCalledWith(
      'Optional Profile hydration failed; keeping the Auth user.',
      expect.any(Error)
    );
    bootstrap.dispose();
  });

  it('does not let stale Profile hydration restore a user after sign-out', async () => {
    const client = createAuthClient(null);
    const scheduler = createScheduler();
    const profile = deferred<Partial<User> | null>();
    const users: Array<User | null> = [];
    const session = makeSession();

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: () => profile.promise,
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    await bootstrap.ready;
    expect(users.at(-1)).toBeNull();

    client.emit('SIGNED_IN', session);
    expect(users.at(-1)).toMatchObject({ id: 'user-1' });
    scheduler.work.shift()?.();

    client.emit('SIGNED_OUT', null);
    expect(users.at(-1)).toBeNull();

    profile.resolve({ displayName: 'Late profile' });
    await flushPromises();
    expect(users.at(-1)).toBeNull();
    bootstrap.dispose();
  });

  it('invalidates stale Profile hydration as soon as an optimistic logout starts', async () => {
    const client = createAuthClient(makeSession());
    const scheduler = createScheduler();
    const profile = deferred<Partial<User> | null>();
    const users: Array<User | null> = [];

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: () => profile.promise,
      setCurrentUser: user => users.push(user),
      setLoading: vi.fn(),
      schedule: scheduler.schedule,
      cancelScheduled: scheduler.cancel
    });

    await bootstrap.ready;
    scheduler.work.shift()?.();

    // AuthContext invokes this before the remote /logout request resolves.
    bootstrap.transitionToGuest();
    expect(users.at(-1)).toBeNull();

    profile.resolve({ id: 'user-1', displayName: 'Late old profile' });
    await flushPromises();
    expect(users.at(-1)).toBeNull();

    client.emit('SIGNED_IN', makeSession());
    expect(users.at(-1)).toMatchObject({ id: 'user-1' });
    bootstrap.dispose();
  });

  it('terminates loading in a recoverable guest state when session restoration errors', async () => {
    const client = createAuthClient(null, new Error('storage read failed'));
    const users: Array<User | null> = [];
    const loading: boolean[] = [];
    const logWarning = vi.fn();

    const bootstrap = startAuthSessionBootstrap({
      auth: client.auth,
      loadProfile: vi.fn(),
      setCurrentUser: user => users.push(user),
      setLoading: value => loading.push(value),
      logWarning
    });

    await bootstrap.ready;

    expect(loading).toEqual([true, false]);
    expect(users.at(-1)).toBeNull();
    expect(logWarning).toHaveBeenCalledWith('Auth session restoration failed:', expect.any(Error));
    bootstrap.dispose();
  });
});
