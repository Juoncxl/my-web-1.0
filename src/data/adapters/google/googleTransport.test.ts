import { afterEach, describe, expect, it, vi } from 'vitest';
import { callGoogleBackend, GoogleBackendRequestError, GoogleBackendUnavailableError, OWNER_SESSION_EXPIRED_MESSAGE } from './googleTransport';
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
    const iconId = '123e4567-e89b-42d3-a456-426614174031';
    const galleryId = '123e4567-e89b-42d3-a456-426614174032';
    const workId = 'asset_1234567890abcdef1234567890abcdef';
    const version = String(Date.parse('2026-01-02T00:00:00Z'));
    const iconUrl = `/api/cxl/media?scope=public&workId=${workId}&ref=media%3A${iconId}&v=${version}`;
    const galleryUrl = `/api/cxl/media?scope=public&workId=${workId}&ref=media%3A${galleryId}&v=${version}`;
    const work = { id: workId, userId: 'public-owner', authorName: 'Creator', title: 'Public Work',
      icon: { type: 'image', value: `media:${iconId}`, mediaId: iconId }, category: 'character', content: '', contentBlocks: [],
      previewImage: `media:${galleryId}`, previewImages: [`media:${galleryId}`], media: [
        { id: iconId, assetId: workId, storagePath: `google-work-media/${iconId}`, purpose: 'icon', mimeType: 'image/png',
          fileSize: 8, sortOrder: 0, isCover: false, delivery: 'vercel_proxy' },
        { id: galleryId, assetId: workId, storagePath: `google-work-media/${galleryId}`, purpose: 'gallery', mimeType: 'image/png',
          fileSize: 8, sortOrder: 0, isCover: true, delivery: 'vercel_proxy' }
      ], isPublic: true, visibility: 'public', status: 'finished',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', tags: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ ok: true, data: { data: [work], error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await googleDataAdapter.works.fetch({ creatorSlug: 'creator-one', publicOnly: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'works.fetch', args: [{ creatorSlug: 'creator-one', publicOnly: true }]
    });
    expect(result.data?.[0].icon.value).toBe(iconUrl);
    expect(result.data?.[0].previewImage).toBe(galleryUrl);
    expect(result.data?.[0].previewImages).toEqual([galleryUrl]);
  });

  it('loads the public summary feed through the cacheable same-origin GET route', async () => {
    const publicWork = { id: 'asset_public', userId: 'creator-1', authorName: 'Creator', title: 'Public',
      icon: { type: 'emoji', value: '✨' }, category: 'character', content: 'public content', contentBlocks: [],
      previewImage: '', previewImages: [], media: [], isPublic: true, visibility: 'public', status: 'finished',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '', deletedAt: null, tags: [] };
    const privateWork = { ...publicWork, id: 'asset_private', visibility: 'private', isPublic: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ ok: true, data: { data: [publicWork, privateWork], error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await googleDataAdapter.works.fetch({ publicOnly: true });

    // Guests (no readable Owner CSRF cookie) use the CDN-cacheable route.
    expect(fetchMock).toHaveBeenCalledWith('/api/cxl/public-works', {
      method: 'GET', cache: 'default', credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    expect(result.data?.map(asset => asset.id)).toEqual(['asset_public']);
    expect(result.data?.[0].content).toBe('public content');
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
    await callGoogleBackend('public.snapshot.rebuild', [], true);
    await callGoogleBackend('folders.fetch', ['browser-spoofed-id'], true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].headers['X-CXL-CSRF']).toBe('csrf-token');
    expect(fetchMock.mock.calls[2][1].headers['X-CXL-CSRF']).toBe('csrf-token');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'public.snapshot.rebuild', args: [] });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ action: 'folders.fetch', args: [] });
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBeUndefined();
  });

  it('asks the session endpoint to restore a missing CSRF cookie before an Owner write', async () => {
    const doc = { cookie: '' };
    vi.stubGlobal('document', doc);
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/cxl/auth/session') { doc.cookie = '__Host-cxl_csrf=fresh-token'; return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: {} }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    await callGoogleBackend('works.update', ['asset_x', {}, { requestId: 'id', expectedRevision: 1 }], true);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/cxl/auth/session', '/api/cxl/google']);
    expect((fetchMock.mock.calls[1] as any)[1].headers['X-CXL-CSRF']).toBe('fresh-token');
  });

  it('explains an expired Owner login in Thai instead of a CSRF error', async () => {
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, authenticated: false }) }));
    await expect(callGoogleBackend('works.update', ['asset_x', {}, {}], true)).rejects.toThrow(OWNER_SESSION_EXPIRED_MESSAGE);
  });

  it('fails closed when browser fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    await expect(callGoogleBackend('works.fetch', [])).rejects.toBeInstanceOf(GoogleBackendUnavailableError);
  });

  it('preserves only the HTTP status/code needed to classify transient API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 504, json: async () => ({ ok: false, code: 'UPSTREAM_TIMEOUT', error: 'Google request timed out' }) }));
    await expect(callGoogleBackend('works.fetch', [{}], true)).rejects.toMatchObject({
      name: 'GoogleBackendRequestError', status: 504, code: 'UPSTREAM_TIMEOUT'
    } satisfies Partial<GoogleBackendRequestError>);
  });
});

