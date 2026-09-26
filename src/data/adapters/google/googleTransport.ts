/** Browser-safe transport. Owner credentials are intentionally never accepted here. */
import { getSupabaseClient } from '../../../lib/supabaseClient';

export type GoogleActionRequest = { action: string; args: unknown[] };

export class GoogleBackendUnavailableError extends Error {
  constructor(message = 'Google backend API is not configured for this deployment') {
    super(message);
    this.name = 'GoogleBackendUnavailableError';
  }
}

export async function callGoogleBackend<T>(action: string, args: unknown[]): Promise<T> {
  const endpoint = '/api/cxl/google';
  if (typeof fetch !== 'function') throw new GoogleBackendUnavailableError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (['works.fetch', 'works.create', 'works.update', 'folders.fetch'].includes(action)) {
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
