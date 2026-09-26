import type { User } from '../types';
import type { AuthSessionBootstrap } from '../lib/auth/authSessionBootstrap';
import { mapSupabaseAuthUser } from '../lib/auth/authUserMapper';
import { isVercelOwnerAuth } from '../lib/auth/ownerAuthBackend';
import { vercelOwnerAuthAdapter } from './adapters/vercel/vercelOwnerAuthAdapter';

type SessionBootstrapCallbacks = {
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
};

async function loadSupabaseAuthAdapter() {
  return (await import('./adapters/supabase/supabaseAuthAdapter')).supabaseAuthAdapter;
}

/** Auth boundary. Supabase Auth is loaded lazily and is never imported by the Vercel auth path. */
export const cxlAuthService = {
  isAvailable: () => isVercelOwnerAuth
    ? vercelOwnerAuthAdapter.isAvailable()
    : Boolean(String((import.meta as any).env?.VITE_SUPABASE_URL || '').trim() && String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim()),
  logFailure(operation: string, error: unknown) {
    if (isVercelOwnerAuth) vercelOwnerAuthAdapter.logFailure(operation, error);
    else void loadSupabaseAuthAdapter().then(adapter => adapter.logFailure(operation, error));
  },
  logUnavailable(operation: string) {
    if (isVercelOwnerAuth) vercelOwnerAuthAdapter.logUnavailable(operation);
    else void loadSupabaseAuthAdapter().then(adapter => adapter.logUnavailable(operation));
  },
  async mapUser(authUser: Parameters<typeof mapSupabaseAuthUser>[0]): Promise<User> {
    if (isVercelOwnerAuth) throw new Error('Supabase users are not accepted in Vercel Owner auth mode');
    return (await loadSupabaseAuthAdapter()).mapUser(authUser);
  },
  createSessionBootstrap(callbacks: SessionBootstrapCallbacks): AuthSessionBootstrap | null {
    if (isVercelOwnerAuth) return vercelOwnerAuthAdapter.createSessionBootstrap(callbacks);
    let disposed = false;
    let inner: AuthSessionBootstrap | null = null;
    callbacks.setLoading(true);
    const ready = loadSupabaseAuthAdapter().then(adapter => {
      if (disposed) return;
      inner = adapter.createSessionBootstrap(callbacks);
      if (inner) return inner.ready;
      callbacks.setCurrentUser(null);
      callbacks.setLoading(false);
    }).catch(error => {
      if (!disposed) {
        console.warn('Supabase auth bootstrap could not start:', error);
        callbacks.setCurrentUser(null);
        callbacks.setLoading(false);
      }
    });
    return {
      ready,
      transitionToGuest: () => inner ? inner.transitionToGuest() : callbacks.setCurrentUser(null),
      dispose: () => { disposed = true; inner?.dispose(); }
    };
  },
  async signUp(email: string, password: string) {
    return isVercelOwnerAuth ? null : (await loadSupabaseAuthAdapter()).signUp(email, password);
  },
  async signInWithPassword(email: string, password: string) {
    return isVercelOwnerAuth ? null : (await loadSupabaseAuthAdapter()).signInWithPassword(email, password);
  },
  async signInWithGoogle() {
    return isVercelOwnerAuth ? vercelOwnerAuthAdapter.signInWithGoogle() : (await loadSupabaseAuthAdapter()).signInWithGoogle();
  },
  async signOutLocal() {
    return isVercelOwnerAuth ? vercelOwnerAuthAdapter.signOutLocal() : (await loadSupabaseAuthAdapter()).signOutLocal();
  },
  async updatePassword(password: string) {
    return isVercelOwnerAuth ? null : (await loadSupabaseAuthAdapter()).updatePassword(password);
  }
};
