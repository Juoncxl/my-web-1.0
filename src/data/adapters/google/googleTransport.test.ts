import { afterEach, describe, expect, it, vi } from 'vitest';
import { callGoogleBackend, GoogleBackendUnavailableError } from './googleTransport';

vi.mock('../../../lib/supabaseClient', () => ({ getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'user-session-token' } } }) } }) }));

describe('Google server transport boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a same-origin action request without an owner credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: ['ok'] }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(callGoogleBackend('works.fetch', [{}])).resolves.toEqual(['ok']);
    const [, request] = fetchMock.mock.calls[0];
    expect(request.credentials).toBe('same-origin');
    expect(JSON.parse(request.body)).toEqual({ action: 'works.fetch', args: [{}] });
    expect(request.body).not.toContain('authorization');
    expect(request.headers.Authorization).toBe('Bearer user-session-token');
  });

  it('fails closed when browser fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    await expect(callGoogleBackend('works.fetch', [])).rejects.toBeInstanceOf(GoogleBackendUnavailableError);
  });
});
