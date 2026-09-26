import type { User } from '../../../types';
import type { AuthSessionBootstrap } from '../../../lib/auth/authSessionBootstrap';

type SessionResponse = { ok?: boolean; authenticated?: boolean; user?: User | null; csrfToken?: string };
type BootstrapCallbacks = { setCurrentUser: (user: User | null) => void; setLoading: (loading: boolean) => void };

function csrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const prefix = '__Host-cxl_csrf=';
  const value = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : '';
}

async function requestSession(): Promise<SessionResponse> {
  const response = await fetch('/api/cxl/auth/session', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
  const body = await response.json().catch(() => null) as SessionResponse | null;
  if (!response.ok || !body?.ok) throw new Error('ไม่สามารถตรวจสอบ Owner session ได้');
  return body;
}

export const vercelOwnerAuthAdapter = {
  isAvailable: () => typeof window !== 'undefined' && typeof fetch === 'function',
  logFailure(operation: string, error: unknown) {
    console.warn(`[owner-auth:${operation}] failed`, error instanceof Error ? error.message : 'Unknown error');
  },
  logUnavailable(operation: string) { console.warn(`[owner-auth:${operation}] unavailable`); },
  mapUser(user: User): User { return user; },
  createSessionBootstrap({ setCurrentUser, setLoading }: BootstrapCallbacks): AuthSessionBootstrap {
    let disposed = false;
    setLoading(true);
    const ready = requestSession().then(result => {
      if (!disposed) setCurrentUser(result.authenticated && result.user ? result.user : null);
    }).catch(error => {
      if (!disposed) {
        setCurrentUser(null);
        console.warn('Owner session restoration failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }).finally(() => { if (!disposed) setLoading(false); });
    return {
      ready,
      transitionToGuest: () => { if (!disposed) setCurrentUser(null); },
      dispose: () => { disposed = true; }
    };
  },
  async signUp() { return null; },
  async signInWithPassword() { return null; },
  async signInWithGoogle() {
    if (typeof window === 'undefined') return null;
    window.location.assign('/api/cxl/auth/login');
    return { error: null };
  },
  async signOutLocal() {
    const csrf = csrfCookie();
    if (!csrf) return { error: new Error('Owner logout could not verify request origin/CSRF token') };
    const response = await fetch('/api/cxl/auth/logout', {
      method: 'POST', credentials: 'same-origin', headers: { 'X-CXL-CSRF': csrf, Accept: 'application/json' }
    });
    return { error: response.ok ? null : new Error('Owner logout request failed') };
  },
  async updatePassword() { return null; },
  async updateProfile() { return { error: new Error('Profile editing is not available in Vercel Owner auth mode') }; }
};
