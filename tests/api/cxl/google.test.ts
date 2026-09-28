import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/cxl/google';
import { createOwnerSessionToken } from '../../../src/server/cxlOwnerAuth';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: async (token: string) => token === 'owner-session'
    ? { data: { user: { id: 'owner-1' } }, error: null }
    : token === 'non-owner-session'
      ? { data: { user: { id: 'creator-2' } }, error: null }
      : { data: { user: null }, error: new Error('invalid token') } } })
}));

const makeAsset = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, userId: 'owner-1', title: id, category: 'character', status: 'draft', visibility: 'public', isPublic: true,
  folderId: null, tags: [], content: '', contentBlocks: [], previewImage: '', previewImages: [], media: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '', deletedAt: null, ...overrides
});
function invoke(body: unknown, authorization?: string, method = 'POST', extraHeaders: Record<string, string> = {}) {
  const response = { statusCode: 200, headers: {} as Record<string, string>, body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; }, end(value: string) { this.body = value; } };
  const req = { method, headers: { ...(authorization ? { authorization } : {}), ...extraHeaders }, body } as any;
  return handler(req, response as any).then(() => ({ ...response, json: JSON.parse(response.body) }));
}

describe('Vercel Google Works read proxy', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-anon-key');
    vi.stubEnv('CXL_OWNER_USER_ID', 'owner-1');
    vi.stubEnv('CXL_API_SHARED_SECRET', 'server-only-secret');
    vi.stubEnv('CXL_GAS_OWNER_URL', 'https://script.google.com/macros/s/owner/exec');
    vi.stubEnv('CXL_GAS_PUBLIC_URL', 'https://script.google.com/macros/s/public/exec');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('rejects methods, unknown actions, and invalid options before proxying', async () => {
    expect((await invoke({}, undefined, 'GET')).statusCode).toBe(405);
    expect((await invoke({ action: 'works.create', args: [] }, 'Bearer owner-session')).statusCode).toBe(400);
    expect((await invoke({ action: 'works.fetch', args: [{ arbitrary: true }] })).statusCode).toBe(400);
  });

  it('uses public GAS list for anonymous reads and applies public filters server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [
      makeAsset('visible', { tags: ['target'] }), makeAsset('private', { visibility: 'private', isPublic: false })
    ] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ publicOnly: true, search: 'target' }] });
    expect(result.statusCode).toBe(200);
    expect(result.json.data.data.map((asset: { id: string }) => asset.id)).toEqual(['visible']);
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=works.list');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('keeps anonymous public reads working when owner identity is not configured', async () => {
    vi.stubEnv('CXL_OWNER_USER_ID', '');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [makeAsset('public')] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({ action: 'works.fetch', args: [{ publicOnly: true }] });

    expect(result.statusCode).toBe(200);
    expect(result.json.data.data.map((asset: { id: string }) => asset.id)).toEqual(['public']);
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=works.list');
    expect(fetchMock.mock.calls[0][0]).toContain('/public/exec');
  });

  it('uses the public detail endpoint for an explicit Asset ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: makeAsset('one') }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ assetId: 'one', publicOnly: true }] });
    expect(result.statusCode).toBe(200);
    expect(result.json.data.data.map((asset: { id: string }) => asset.id)).toEqual(['one']);
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=works.detail');
  });

  it('verifies owner session and injects the server secret only on the server-to-GAS request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: [makeAsset('private', { visibility: 'private', isPublic: false })], error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1', currentUserId: 'owner-1' }] }, 'Bearer owner-session');
    expect(result.statusCode).toBe(200);
    expect(result.json.data.data[0].id).toBe('private');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).authorization).toBe('server-only-secret');
  });

  it('sends Owner list search to GAS and does not re-filter compact summaries in Vercel', async () => {
    const indexedMatch = makeAsset('indexed-match', { title: 'Compact title', content: '', tags: [] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: [indexedMatch], error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1', search: 'needle-in-canonical-content', detail: 'summary' }] }, 'Bearer owner-session');

    expect(result.statusCode).toBe(200);
    expect(result.json.data.data.map((asset: { id: string }) => asset.id)).toEqual(['indexed-match']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args[0].search).toBe('needle-in-canonical-content');
  });

  it('refuses owner scope without a verified user token', async () => {
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1' }] });
    expect(result.statusCode).toBe(401);
  });

  it('allows only verified Owner create/update/folder reads and injects the shared secret server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: { id: 'asset_created' }, error: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    const asset = { title: 'New Work', category: 'character', tags: [], visibility: 'private', isPublic: false, icon: { type: 'emoji', value: '✨' }, content: '' };
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    const create = await invoke({ action: 'works.create', args: [asset, { requestId }] }, 'Bearer owner-session');
    const update = await invoke({ action: 'works.update', args: ['asset_created', { title: 'Changed' }, { requestId, expectedRevision: 1 }] }, 'Bearer owner-session');
    const folders = await invoke({ action: 'folders.fetch', args: ['owner-1'] }, 'Bearer owner-session');
    expect([create.statusCode, update.statusCode, folders.statusCode]).toEqual([200, 200, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'works.create' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'works.update' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'folders.fetch', args: [] });
  });

  it('uses the verified Vercel Owner session for folders.fetch and sends no browser identity to GAS', async () => {
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [{ id: 'folder-1', name: 'Owner folder' }] }) });
    vi.stubGlobal('fetch', fetchMock);

    expect((await invoke({ action: 'folders.fetch', args: [] })).statusCode).toBe(401);
    const spoofed = await invoke({ action: 'folders.fetch', args: ['attacker-controlled-id'] }, undefined, 'POST', { cookie });
    expect(spoofed.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    const result = await invoke({ action: 'folders.fetch', args: [] }, undefined, 'POST', { cookie });
    expect(result.statusCode).toBe(200);
    expect(result.json.data).toEqual([{ id: 'folder-1', name: 'Owner folder' }]);
    const gasRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(gasRequest).toMatchObject({ authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'folders.fetch', args: [] });
    expect(JSON.stringify(gasRequest)).not.toContain('attacker-controlled-id');
  });

  it('rejects unauthenticated, non-owner, malformed, and out-of-scope mutation requests before GAS', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const asset = { title: 'New', category: 'character' };
    expect((await invoke({ action: 'works.create', args: [asset, { requestId: '123e4567-e89b-42d3-a456-426614174000' }] })).statusCode).toBe(401);
    expect((await invoke({ action: 'works.create', args: [asset, { requestId: '123e4567-e89b-42d3-a456-426614174000' }] }, 'Bearer non-owner-session')).statusCode).toBe(401);
    expect((await invoke({ action: 'works.update', args: ['asset_x', { title: 'X' }, { requestId: 'bad', expectedRevision: 0 }] }, 'Bearer owner-session')).statusCode).toBe(400);
    expect((await invoke({ action: 'works.permanentDelete', args: ['asset_x'] }, 'Bearer owner-session')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces private-saved/public-sync-pending without inviting a duplicate create', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: false,
      code: 'PUBLIC_SYNC_PENDING', error: 'Public projection sync is pending', privateSaved: true, workId: 'asset_created' }) }));
    const result = await invoke({ action: 'works.create', args: [{ title: 'New', category: 'character' }, { requestId: '123e4567-e89b-42d3-a456-426614174000' }] }, 'Bearer owner-session');
    expect(result.statusCode).toBe(409);
    expect(result.json).toMatchObject({ code: 'PUBLIC_SYNC_PENDING', privateSaved: true, workId: 'asset_created' });
  });

  it('maps the API-only GAS unauthorized envelope to HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({
      ok: false, code: 'OWNER_API_UNAUTHORIZED', error: 'Unauthorized', httpStatus: 401
    }) }));
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1', currentUserId: 'owner-1' }] }, 'Bearer owner-session');
    expect(result.statusCode).toBe(401);
    expect(result.json.code).toBe('OWNER_API_UNAUTHORIZED');
  });

  it('rejects owner requests clearly when owner identity configuration is missing', async () => {
    vi.stubEnv('CXL_OWNER_USER_ID', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1' }] }, 'Bearer owner-session');

    expect(result.statusCode).toBe(503);
    expect(result.json.error).toContain('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['invalid-session', 'non-owner-session'])('rejects invalid or non-owner token %s', async token => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({ action: 'works.fetch', args: [{ publicOnly: true }] }, `Bearer ${token}`);

    expect(result.statusCode).toBe(401);
    expect(result.json.error).toContain('Valid owner authentication');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the public creator index for supported slug-based Works reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [makeAsset('creator-work', { publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' })] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ creatorSlug: '@Creator-One', search: 'work' }] });
    expect(result.statusCode).toBe(200);
    expect(result.json.data.data.map((asset: { id: string }) => asset.id)).toEqual(['creator-work']);
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=works.creator');
    expect(fetchMock.mock.calls[0][0]).toContain('slug=creator-one');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('accepts Owner session cookies, maps browser identity to the server Owner key, and protects writes with Origin/CSRF', async () => {
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const ownerCookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: [makeAsset('private')] } }) });
    vi.stubGlobal('fetch', fetchMock);

    const missing = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1' }] });
    const privateRead = await invoke({ action: 'works.fetch', args: [{ userId: 'browser-controlled-id', currentUserId: 'attacker-id' }] }, undefined, 'POST', { cookie: ownerCookie });
    expect(missing.statusCode).toBe(401);
    expect(privateRead.statusCode).toBe(200);
    const readPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(readPayload.ownerUserId).toBe('owner-1');
    expect(readPayload.args[0]).toMatchObject({ userId: 'owner-1', currentUserId: 'owner-1' });

    const asset = { title: 'New Work', category: 'character', userId: 'client-spoofed-owner' };
    const writeArgs = { action: 'works.create', args: [asset, { requestId: '123e4567-e89b-42d3-a456-426614174000' }] };
    const noCsrf = await invoke(writeArgs, undefined, 'POST', { cookie: ownerCookie });
    const badOrigin = await invoke(writeArgs, undefined, 'POST', { cookie: ownerCookie, origin: 'https://evil.example', 'x-cxl-csrf': 'csrf-token' });
    const accepted = await invoke(writeArgs, undefined, 'POST', { cookie: ownerCookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' });
    expect([noCsrf.statusCode, badOrigin.statusCode, accepted.statusCode]).toEqual([403, 403, 200]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).ownerUserId).toBe('owner-1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).args[0].userId).toBe('owner-1');
  });

  it('exposes sanitized GAS phase timings in Preview response headers without changing the data body', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const privateWork = makeAsset('work-id-not-for-timing', { userId: 'internal-owner-id' });
    const timing = { action: 'works.update', phases: { auth_request_validation: 4, canonical_drive_json_read: 120, public_projection_sync: 35 }, totalMs: 180 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: privateWork, error: null }, meta: { timing } }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({ action: 'works.update', args: ['asset_work', { title: 'Updated' }, { requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1 }] }, undefined, 'POST', { cookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).includeTiming).toBe(true);
    expect(result.headers['Server-Timing']).toContain('cxl_action;desc="works.update"');
    expect(result.headers['Server-Timing']).toContain('canonical_drive_json_read;dur=120.00');
    expect(result.json).toEqual({ ok: true, data: { data: privateWork, error: null } });
    expect(result.headers['Server-Timing']).not.toMatch(/work-id-not-for-timing|internal-owner-id|https:|secret|cookie/i);
    expect(JSON.stringify(result.json)).not.toContain('meta');
  });

  it('does not request or expose GAS timing telemetry outside Preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: [], error: null }, meta: { timing: { action: 'works.fetch', phases: {}, totalMs: 1 } } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1' }] }, undefined, 'POST', { cookie: `__Host-cxl_owner=${token}` });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('includeTiming');
    expect(result.headers['Server-Timing']).toBeUndefined();
    expect(result.json).not.toHaveProperty('meta');
  });

  it('does not inject server-owned userId into works.update payloads', async () => {
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: { id: 'asset_work' }, error: null } }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({ action: 'works.update', args: ['asset_work', { title: 'Edited' }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 2
    }] }, undefined, 'POST', { cookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' });

    expect(result.statusCode).toBe(200);
    const gasRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(gasRequest.args).toEqual(['asset_work', { title: 'Edited' }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 2
    }]);
    expect(gasRequest.args[1]).not.toHaveProperty('userId');
    expect(gasRequest.ownerUserId).toBe('owner-1');
  });

  it('keeps anonymous public Works reads unchanged in Vercel auth mode without Owner config', async () => {
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_USER_ID', '');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [makeAsset('public')] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke({ action: 'works.fetch', args: [{ publicOnly: true }] });
    expect(result.statusCode).toBe(200);
    expect(result.json.data.data).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/public/exec');
  });

  it('proxies only the supported public profile/settings read contracts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: { id: 'cxlc_0123456789abcdef0123456789abcdef', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' }, error: null, reason: null } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: [], error: null } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: { data: null, error: null, source: 'none' } }) });
    vi.stubGlobal('fetch', fetchMock);

    expect((await invoke({ action: 'profiles.getCreator', args: ['@Creator-One'] })).statusCode).toBe(200);
    expect((await invoke({ action: 'profiles.getPublic', args: [['cxlc_0123456789abcdef0123456789abcdef', 'cxlc_0123456789abcdef0123456789abcdef']] })).statusCode).toBe(200);
    expect((await invoke({ action: 'settings.readCreatorSpace', args: ['cxlc_0123456789abcdef0123456789abcdef'] })).statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=profiles.getCreator');
    expect(fetchMock.mock.calls[0][0]).toContain('slug=creator-one');
    const ids = new URL(fetchMock.mock.calls[1][0]).searchParams.get('ids');
    expect(JSON.parse(ids || '[]')).toEqual(['cxlc_0123456789abcdef0123456789abcdef']);
    expect(fetchMock.mock.calls[2][0]).toContain('cxlApi=settings.readCreatorSpace');
    expect(fetchMock.mock.calls.every(call => call[1].headers.Authorization === undefined)).toBe(true);
  });

  it('rejects unsupported actions and invalid public creator arguments before proxying', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke({ action: 'settings.writeCreatorSpace', args: ['cxlc_0123456789abcdef0123456789abcdef', {}] })).statusCode).toBe(400);
    expect((await invoke({ action: 'profiles.getPublic', args: [['internal-profile-id']] })).statusCode).toBe(400);
    expect((await invoke({ action: 'settings.readCreatorSpace', args: ['internal-profile-id'] })).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes unavailable configuration and malformed GAS responses', async () => {
    vi.stubEnv('CXL_GAS_PUBLIC_URL', '');
    expect((await invoke({ action: 'works.fetch', args: [{}] })).statusCode).toBe(503);
    vi.stubEnv('CXL_GAS_PUBLIC_URL', 'https://script.google.com/macros/s/public/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'not-json' }));
    const bad = await invoke({ action: 'works.fetch', args: [{}] });
    expect(bad.statusCode).toBe(502);
    expect(bad.json.error).toContain('malformed JSON');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [{ id: 'incomplete', title: 'Missing fields' }] }) }));
    const malformedShape = await invoke({ action: 'works.fetch', args: [{}] });
    expect(malformedShape.statusCode).toBe(502);
    expect(malformedShape.json.error).toContain('CXL Asset list shape');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const unavailable = await invoke({ action: 'works.fetch', args: [{}] });
    expect(unavailable.statusCode).toBe(502);
    expect(unavailable.json.error).toContain('network unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('deadline exceeded'), { name: 'TimeoutError' })));
    const timeout = await invoke({ action: 'works.fetch', args: [{}] });
    expect(timeout.statusCode).toBe(504);
  });

  it.each([
    ['works.fetch', [{ publicOnly: true }]],
    ['profiles.getCreator', ['@Creator-One']],
    ['settings.readCreatorSpace', ['cxlc_0123456789abcdef0123456789abcdef']]
  ] as const)('%s uses the configured timeout and maps an aborted GAS request to 504', async (action, args) => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
      }, { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const pending = invoke({ action, args: [...args] });
      expect(timeoutSpy).toHaveBeenCalledWith(30_000);
      expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);

      controller.abort();
      const result = await pending;

      expect(result.statusCode).toBe(504);
      expect(result.json.error).toMatch(/timeout/i);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it('allows standard Work media upload actions only from a CSRF-protected Owner session in Preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: {
      uploadId: '123e4567-e89b-42d3-a456-426614174099', mediaId: '123e4567-e89b-42d3-a456-426614174010', finalized: false
    } }) });
    vi.stubGlobal('fetch', fetchMock);
    const begin = {
      uploadId: '123e4567-e89b-42d3-a456-426614174000', mediaId: '123e4567-e89b-42d3-a456-426614174010',
      workId: 'asset_1234567890abcdef1234567890abcdef', totalFileSize: 68, rawChunkSize: 2 * 1024 * 1024,
      totalChunks: 1, mimeType: 'image/png', sha256: 'a'.repeat(64), purpose: 'gallery', contextId: null,
      sortOrder: 0, isCover: true
    };
    const headers = { cookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' };

    const missingCsrf = await invoke({ action: 'media.upload.begin', args: [begin] }, undefined, 'POST', { cookie, origin: 'https://cxl.example' });
    const invalid = await invoke({ action: 'media.upload.begin', args: [{ ...begin, driveId: 'must-not-pass' }] }, undefined, 'POST', headers);
    const accepted = await invoke({ action: 'media.upload.begin', args: [begin] }, undefined, 'POST', headers);
    const workMediaId = begin.mediaId;
    const commit = await invoke({ action: 'works.create', args: [{
      title: 'Media Work', category: 'prompts', content: '', contentBlocks: [],
      previewImage: `media:${workMediaId}`, previewImages: [`media:${workMediaId}`]
    }, { requestId: '123e4567-e89b-42d3-a456-426614174011', mediaIds: [workMediaId] }] }, undefined, 'POST', headers);

    expect([missingCsrf.statusCode, invalid.statusCode, accepted.statusCode, commit.statusCode]).toEqual([403, 400, 200, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const gasRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(gasRequest).toMatchObject({ authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'media.upload.begin', args: [begin] });
    expect(JSON.stringify(gasRequest)).not.toMatch(/cookie|csrf-token|google-owner-subject/);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ action: 'works.create', args: [expect.objectContaining({ previewImage: `media:${workMediaId}` }), { mediaIds: [workMediaId] }] });
  });

  it('blocks new Work media uploads and media-bearing Work commits outside Preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mediaId = '123e4567-e89b-42d3-a456-426614174010';
    const begin = { uploadId: '123e4567-e89b-42d3-a456-426614174000', mediaId,
      workId: 'asset_1234567890abcdef1234567890abcdef', totalFileSize: 68, rawChunkSize: 2 * 1024 * 1024,
      totalChunks: 1, mimeType: 'image/png', sha256: 'a'.repeat(64), purpose: 'gallery', contextId: null, sortOrder: 0, isCover: true };
    const create = { title: 'Work', category: 'prompts', content: '', contentBlocks: [], previewImage: `media:${mediaId}`, previewImages: [`media:${mediaId}`] };

    const upload = await invoke({ action: 'media.upload.begin', args: [begin] }, 'Bearer owner-session');
    const commit = await invoke({ action: 'works.create', args: [create, { requestId: '123e4567-e89b-42d3-a456-426614174001', mediaIds: [mediaId] }] }, 'Bearer owner-session');

    expect([upload.statusCode, commit.statusCode]).toEqual([404, 404]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows bounded Work-media cleanup only for a CSRF-protected Owner session in Preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: {
      processed: 3, deletedSessions: 1, deletedChunks: 2, deletedMedia: 0, retiredMedia: 1, repairedManifests: 0, skipped: 1
    } }) });
    vi.stubGlobal('fetch', fetchMock);
    const headers = { cookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' };

    const missingCsrf = await invoke({ action: 'media.cleanup', args: [] }, undefined, 'POST', { cookie, origin: 'https://cxl.example' });
    const invalidArgs = await invoke({ action: 'media.cleanup', args: [{ mediaId: '123e4567-e89b-42d3-a456-426614174010' }] }, undefined, 'POST', headers);
    const accepted = await invoke({ action: 'media.cleanup', args: [] }, undefined, 'POST', headers);

    expect([missingCsrf.statusCode, invalidArgs.statusCode, accepted.statusCode]).toEqual([403, 400, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toMatchObject({ action: 'media.cleanup', args: [], ownerUserId: 'owner-1', authorization: 'server-only-secret' });
    expect(JSON.stringify(request)).not.toMatch(/cookie|csrf-token|google-owner-subject/);
    vi.stubEnv('VERCEL_ENV', 'production');
    const production = await invoke({ action: 'media.cleanup', args: [] }, undefined, 'POST', headers);
    expect(production.statusCode).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restricts delivery repair to Preview Owner session and returns counts only', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', 'google-owner-subject-123456789');
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', 'session-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    const token = createOwnerSessionToken('google-owner-subject-123456789', undefined, process.env.CXL_OWNER_SESSION_SECRET!).token;
    const cookie = `__Host-cxl_owner=${token}; __Host-cxl_csrf=csrf-token`;
    const headers = { cookie, origin: 'https://cxl.example', 'x-cxl-csrf': 'csrf-token' };
    const action = { action: 'media.work.repairDeliveryChunks', args: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true,
      data: { processed: 1, repaired: 1, skipped: 0, remaining: 2 } }) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke(action)).statusCode).toBe(401);
    expect((await invoke(action, undefined, 'POST', { cookie, origin: 'https://cxl.example' })).statusCode).toBe(403);
    expect((await invoke({ ...action, args: [{ mediaId: 'secret' }] }, undefined, 'POST', headers)).statusCode).toBe(400);
    const accepted = await invoke(action, undefined, 'POST', headers);
    expect(accepted).toMatchObject({ statusCode: 200, json: { ok: true,
      data: { processed: 1, repaired: 1, skipped: 0, remaining: 2 } } });
    expect(JSON.stringify(accepted.json)).not.toMatch(/owner-1|drive-file|asset_|secret/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: action.action, args: [], authorization: 'server-only-secret' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true,
      data: { processed: 1, repaired: 1, skipped: 0, remaining: 0, driveFileId: 'private-file' } }) });
    const unsafe = await invoke(action, undefined, 'POST', headers);
    expect(unsafe.statusCode).toBe(502);
    expect(JSON.stringify(unsafe.json)).not.toContain('private-file');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await invoke(action, undefined, 'POST', headers)).statusCode).toBe(404);
  });
});
