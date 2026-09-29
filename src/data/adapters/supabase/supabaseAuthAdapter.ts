import type { User } from '../../../types';
import { startAuthSessionBootstrap, type AuthSessionBootstrap } from '../../../lib/auth/authSessionBootstrap';
import { mapSupabaseAuthUser } from '../../../lib/auth/authUserMapper';
import { supabaseService } from '../../../lib/supabaseService';
import { getSupabaseClient, isLocalRuntime, supabaseConfigStatus } from '../../../lib/supabaseClient';

type SessionBootstrapCallbacks = {
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
};

/** Supabase Auth implementation, isolated from React and application flows. */
export const supabaseAuthAdapter = {
  isAvailable: () => Boolean(getSupabaseClient()),
  logFailure(operation: string, error: unknown) {
    if (!isLocalRuntime()) return;
    const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    const message = typeof record.message === 'string' ? record.message.replace(/[\r\n]+/g, ' ').slice(0, 300) : 'Unknown auth error';
    console.warn(`[supabase:auth:${operation}] failed`, {
      code: typeof record.code === 'string' ? record.code : undefined,
      status: typeof record.status === 'number' ? record.status : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      message
    });
  },
  logUnavailable(operation: string) {
    if (!isLocalRuntime()) return;
    console.warn(`[supabase:auth:${operation}] skipped because client is not configured`, {
      url: supabaseConfigStatus.urlConfigured ? 'configured' : 'missing',
      anonKey: supabaseConfigStatus.anonKeyConfigured ? 'configured' : 'missing'
    });
  },
  mapUser(authUser: Parameters<typeof mapSupabaseAuthUser>[0]): User {
    const profile = supabaseService.getProfileSnapshot(authUser.id);
    return mapSupabaseAuthUser(authUser, profile?.id === authUser.id ? profile : null);
  },
  createSessionBootstrap({ setCurrentUser, setLoading }: SessionBootstrapCallbacks): AuthSessionBootstrap | null {
    const client = getSupabaseClient();
    if (!client) return null;
    return startAuthSessionBootstrap({
      auth: client.auth,
      getProfileSnapshot: userId => supabaseService.getProfileSnapshot(userId),
      loadProfile: userId => supabaseService.getProfile(userId),
      setCurrentUser,
      setLoading
    });
  },
  async signUp(email: string, password: string) {
    const client = getSupabaseClient();
    return client ? client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: email.split('@')[0] } }
    }) : null;
  },
  async signInWithPassword(email: string, password: string) {
    const client = getSupabaseClient();
    return client ? client.auth.signInWithPassword({ email, password }) : null;
  },
  async signInWithGoogle() {
    const client = getSupabaseClient();
    return client ? client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }) : null;
  },
  async signOutLocal() {
    const client = getSupabaseClient();
    return client ? client.auth.signOut({ scope: 'local' }) : null;
  },
  async updatePassword(password: string) {
    const client = getSupabaseClient();
    return client ? client.auth.updateUser({ password }) : null;
  }
};
