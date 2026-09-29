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

export async function callGoogleBackend<T>(action: string, args: unknown[], useVercelOwnerAuth = isVercelOwnerAuth): Promise<T> {
  const endpoint = '/api/cxl/google';
  // The server derives Owner scope from its verified HttpOnly session. Keep the
  // legacy typed fetch(userId) signature, but never send that identity as authority.
  const requestArgs = useVercelOwnerAuth && action === 'folders.fetch' ? [] : args;
  if (typeof fetch !== 'function') throw new GoogleBackendUnavailableError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (useVercelOwnerAuth && ['works.create', 'works.update', 'works.softDelete', 'works.restore', 'works.permanentDelete', 'folders.create', 'folders.update', 'folders.delete', 'public.snapshot.rebuild', 'media.upload.begin', 'media.upload.chunk', 'media.upload.finalize'].includes(action)) {
    const csrfPrefix = '__Host-cxl_csrf=';
    const cookie = typeof document === 'undefined' ? '' : document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(csrfPrefix));
    if (!cookie) throw new Error('Owner write request is missing its CSRF token');
    headers['X-CXL-CSRF'] = decodeURIComponent(cookie.slice(csrfPrefix.length));
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
    throw new GoogleBackendRequestError(result?.error || `Google backend request failed (${response.status})`, response.status, result?.code);
  }
  return result.data as T;
}

