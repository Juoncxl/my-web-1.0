import { afterEach, describe, expect, it, vi } from 'vitest';
import { callGoogleBackend, GoogleBackendUnavailableError } from './googleTransport';
import { googleDataAdapter } from './googleDataAdapter';

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

  it('keeps public profile and settings reads anonymous at the browser boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { data: null, error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    await callGoogleBackend('profiles.getCreator', ['creator-one']);
    await callGoogleBackend('profiles.getPublic', [['public-id']]);
    await callGoogleBackend('settings.readCreatorSpace', ['cxlc_0123456789abcdef0123456789abcdef']);
    expect(fetchMock.mock.calls.map(call => JSON.parse(call[1].body).action)).toEqual([
      'profiles.getCreator', 'profiles.getPublic', 'settings.readCreatorSpace'
    ]);
    expect(fetchMock.mock.calls.every(call => call[1].headers.Authorization === undefined)).toBe(true);
  });

  it('exposes public creator Works lookup through the existing Works fetch contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { data: [], error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    await googleDataAdapter.works.fetch({ creatorSlug: 'creator-one', publicOnly: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'works.fetch', args: [{ creatorSlug: 'creator-one', publicOnly: true }]
    });
  });

  it('sends Owner write and folder requests with the current session token but no server secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { data: null, error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    await callGoogleBackend('works.create', [{ title: 'New' }, { requestId: '123e4567-e89b-42d3-a456-426614174000' }]);
    await callGoogleBackend('works.update', ['asset_test', { title: 'Changed' }, { requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1 }]);
    await callGoogleBackend('folders.fetch', ['owner-1']);
    expect(fetchMock.mock.calls.map(call => JSON.parse(call[1].body).action)).toEqual(['works.create', 'works.update', 'folders.fetch']);
    expect(fetchMock.mock.calls.every(call => call[1].headers.Authorization === 'Bearer user-session-token')).toBe(true);
    expect(fetchMock.mock.calls.every(call => !call[1].body.includes('server-only-secret') && !call[1].body.includes('authorization'))).toBe(true);
  });

  it('uses same-origin Owner cookies in Vercel auth mode without reading a Supabase token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { data: [] } }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: '__Host-cxl_csrf=csrf-token' });
    await callGoogleBackend('works.fetch', [{ userId: 'client-supplied-id' }], true);
    await callGoogleBackend('works.create', [{ title: 'Work' }, { requestId: 'id' }], true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].headers['X-CXL-CSRF']).toBe('csrf-token');
  });

  it('fails closed when browser fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    await expect(callGoogleBackend('works.fetch', [])).rejects.toBeInstanceOf(GoogleBackendUnavailableError);
  });
});
