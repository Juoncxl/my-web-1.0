/** Browser-safe transport. Owner credentials are intentionally never accepted here. */
import { isVercelOwnerAuth } from '../../../lib/auth/ownerAuthBackend';

export type GoogleActionRequest = { action: string; args: unknown[] };

export class GoogleBackendUnavailableError extends Error {
  constructor(message = 'Google backend API is not configured for this deployment') {
    super(message);
    this.name = 'GoogleBackendUnavailableError';
  }
}

export class GoogleBackendRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'GoogleBackendRequestError';
  }
}

export const OWNER_SESSION_EXPIRED_MESSAGE = 'การล็อกอินหมดอายุแล้ว — เปิดแท็บใหม่แล้วล็อกอินอีกครั้ง จากนั้นกลับมาที่หน้านี้แล้วกดบันทึกใหม่ งานที่กรอกไว้ยังอยู่ครบ';

function readCsrfCookie(): string {
  const csrfPrefix = '__Host-cxl_csrf=';
  const cookie = typeof document === 'undefined' ? '' : document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(csrfPrefix));
  return cookie ? decodeURIComponent(cookie.slice(csrfPrefix.length)) : '';
}

/** The CSRF cookie; when it is gone, the session check re-issues it if the Owner is still signed in. */
export async function ownerCsrfToken(): Promise<string> {
  let token = readCsrfCookie();
  if (!token && typeof fetch === 'function') {
    await fetch('/api/cxl/auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).catch(() => undefined);
    token = readCsrfCookie();
  }
  if (!token) throw new Error(OWNER_SESSION_EXPIRED_MESSAGE);
  return token;
}

export async function callGoogleBackend<T>(action: string, args: unknown[], useVercelOwnerAuth = isVercelOwnerAuth): Promise<T> {
  const endpoint = '/api/cxl/google';
  // The server derives Owner scope from its verified HttpOnly session. Keep the
  // legacy typed fetch(userId) signature, but never send that identity as authority.
  const requestArgs = useVercelOwnerAuth && action === 'folders.fetch' ? [] : args;
  if (typeof fetch !== 'function') throw new GoogleBackendUnavailableError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (useVercelOwnerAuth && ['works.create', 'works.update', 'works.softDelete', 'works.restore', 'works.permanentDelete', 'folders.create', 'folders.update', 'folders.delete', 'public.snapshot.rebuild', 'media.upload.begin', 'media.upload.chunk', 'media.upload.finalize'].includes(action)) {
    headers['X-CXL-CSRF'] = await ownerCsrfToken();
  }
  if (!useVercelOwnerAuth && ['works.fetch', 'works.create', 'works.update', 'folders.fetch', 'media.upload.begin', 'media.upload.chunk', 'media.upload.finalize'].includes(action)) {
    const { getSupabaseClient } = await import('../../../lib/supabaseClient');
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ action, args: requestArgs } satisfies GoogleActionRequest)
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: string; code?: string } | null;
  if (!response.ok || !result?.ok) {
    if (response.status === 401 && useVercelOwnerAuth) throw new GoogleBackendRequestError(OWNER_SESSION_EXPIRED_MESSAGE, 401, result?.code);
    throw new GoogleBackendRequestError(result?.error || `Google backend request failed (${response.status})`, response.status, result?.code);
  }
  return result.data as T;
}

