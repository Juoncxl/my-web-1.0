/** Browser-safe transport. Owner credentials are intentionally never accepted here. */
import { isVercelOwnerAuth } from '../../../lib/auth/ownerAuthBackend';

export type GoogleActionRequest = { action: string; args: unknown[] };

export class GoogleBackendUnavailableError extends Error {
  constructor(message = 'Google backend API is not configured for this deployment') {
    super(message);
    this.name = 'GoogleBackendUnavailableError';
  }
}

export async function callGoogleBackend<T>(action: string, args: unknown[], useVercelOwnerAuth = isVercelOwnerAuth): Promise<T> {
  const endpoint = '/api/cxl/google';
  if (typeof fetch !== 'function') throw new GoogleBackendUnavailableError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (useVercelOwnerAuth && ['works.create', 'works.update'].includes(action)) {
    const csrfPrefix = '__Host-cxl_csrf=';
    const cookie = typeof document === 'undefined' ? '' : document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(csrfPrefix));
    if (!cookie) throw new Error('Owner write request is missing its CSRF token');
    headers['X-CXL-CSRF'] = decodeURIComponent(cookie.slice(csrfPrefix.length));
  }
  if (!useVercelOwnerAuth && ['works.fetch', 'works.create', 'works.update', 'folders.fetch'].includes(action)) {
    const { getSupabaseClient } = await import('../../../lib/supabaseClient');
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ action, args } satisfies GoogleActionRequest)
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: string } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `Google backend request failed (${response.status})`);
  }
  return result.data as T;
}
