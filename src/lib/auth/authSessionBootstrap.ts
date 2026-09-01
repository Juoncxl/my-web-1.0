import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../../types';
import { mapSupabaseAuthUser } from './authUserMapper';

type ScheduledWork = ReturnType<typeof setTimeout>;
type SessionRestoreResult = {
  data: { session: Session | null };
  error: unknown;
};

export interface AuthClientForBootstrap {
  getSession: () => Promise<SessionRestoreResult>;
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) => { data: { subscription: { unsubscribe: () => void } } };
}

interface StartAuthSessionBootstrapOptions {
  auth: AuthClientForBootstrap;
  getProfileSnapshot?: (userId: string) => Partial<User> | null;
  loadProfile: (userId: string) => Promise<Partial<User> | null>;
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  schedule?: (work: () => void) => ScheduledWork;
  cancelScheduled?: (work: ScheduledWork) => void;
  logWarning?: (message: string, error: unknown) => void;
}

export interface AuthSessionBootstrap {
  ready: Promise<void>;
  transitionToGuest: () => void;
  dispose: () => void;
}

// React StrictMode intentionally mounts, cleans up, and mounts effects again
// in development. Share only the concurrent getSession promise so the disposed
// probe cannot start a second Auth restore request. The result is removed as
// soon as it settles; this is request deduplication, not a session cache/store.
const pendingSessionRestorations = new WeakMap<AuthClientForBootstrap, Promise<SessionRestoreResult>>();

function restoreSessionOnce(auth: AuthClientForBootstrap): Promise<SessionRestoreResult> {
  const pending = pendingSessionRestorations.get(auth);
  if (pending) return pending;

  const request = auth.getSession();
  pendingSessionRestorations.set(auth, request);
  const clearRequest = () => {
    if (pendingSessionRestorations.get(auth) === request) pendingSessionRestorations.delete(auth);
  };
  void request.then(clearRequest, clearRequest);
  return request;
}

/**
 * Restores the persisted Auth session without making optional Profile data a
 * prerequisite for recognizing the authenticated user.
 *
 * Supabase Auth callbacks must stay synchronous. Profile hydration is deferred
 * until after the callback releases the Auth lock, and stale hydration results
 * are ignored after an account transition.
 */
export function startAuthSessionBootstrap({
  auth,
  getProfileSnapshot = () => null,
  loadProfile,
  setCurrentUser,
  setLoading,
  schedule = work => setTimeout(work, 0),
  cancelScheduled = work => clearTimeout(work),
  logWarning = (message, error) => console.warn(message, error)
}: StartAuthSessionBootstrapOptions): AuthSessionBootstrap {
  let disposed = false;
  let authEventRevision = 0;
  let userRevision = 0;
  let activeUserId: string | null | undefined;
  const scheduledWork = new Set<ScheduledWork>();

  const defer = (work: () => void) => {
    const scheduled = schedule(() => {
      scheduledWork.delete(scheduled);
      work();
    });
    scheduledWork.add(scheduled);
  };

  const applyAuthUser = (authUser: SupabaseAuthUser | null, force = false) => {
    if (disposed) return;

    const nextUserId = authUser?.id || null;
    if (!force && activeUserId === nextUserId) return;

    activeUserId = nextUserId;
    const requestRevision = ++userRevision;

    if (!authUser) {
      setCurrentUser(null);
      return;
    }

    const profileSnapshot = getProfileSnapshot(authUser.id);
    const sameUserSnapshot = profileSnapshot?.id === authUser.id ? profileSnapshot : null;

    // Auth identity is sufficient for account state. When a canonical QA
    // Profile already exists for this exact user ID, render that snapshot
    // immediately instead of visually regressing to an email-based fallback.
    setCurrentUser(mapSupabaseAuthUser(authUser, sameUserSnapshot));

    defer(() => {
      void loadProfile(authUser.id)
        .then(profile => {
          if (disposed || requestRevision !== userRevision || activeUserId !== authUser.id) return;
          const latestSnapshot = getProfileSnapshot(authUser.id);
          const preferredProfile = latestSnapshot?.id === authUser.id
            ? latestSnapshot
            : profile && (!profile.id || profile.id === authUser.id)
              ? profile
              : null;
          if (preferredProfile) setCurrentUser(mapSupabaseAuthUser(authUser, preferredProfile));
        })
        .catch(error => {
          logWarning('Optional Profile hydration failed; keeping the Auth user.', error);
        });
    });
  };

  const authListener = auth.onAuthStateChange((event, session) => {
    // getSession() is the one bootstrap source. Handling INITIAL_SESSION here
    // as well would duplicate Profile hydration and compete for the Auth lock.
    if (event === 'INITIAL_SESSION') return;

    authEventRevision += 1;

    // A token rotation does not change the rendered identity. Avoid another
    // Profile request when the same account refreshes its token.
    if (event === 'TOKEN_REFRESHED' && activeUserId === (session?.user.id || null)) return;

    applyAuthUser(session?.user || null, event === 'USER_UPDATED');
  });

  setLoading(true);
  const bootstrapRevision = authEventRevision;
  const ready = restoreSessionOnce(auth)
    .then(({ data, error }) => {
      if (error) throw error;
      // A newer SIGNED_IN/SIGNED_OUT event wins over a stale getSession result.
      if (!disposed && bootstrapRevision === authEventRevision) {
        applyAuthUser(data.session?.user || null);
      }
    })
    .catch(error => {
      logWarning('Auth session restoration failed:', error);
      if (!disposed && bootstrapRevision === authEventRevision) {
        applyAuthUser(null, true);
      }
    })
    .finally(() => {
      if (!disposed) setLoading(false);
    });

  return {
    ready,
    transitionToGuest: () => {
      applyAuthUser(null, true);
    },
    dispose: () => {
      disposed = true;
      userRevision += 1;
      scheduledWork.forEach(cancelScheduled);
      scheduledWork.clear();
      authListener.data.subscription.unsubscribe();
    }
  };
}
