import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './google';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: async (token: string) => token === 'owner-session'
    ? { data: { user: { id: 'owner-1' } }, error: null }
    : { data: { user: null }, error: new Error('invalid token') } } })
}));

const makeAsset = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, userId: 'owner-1', title: id, category: 'character', status: 'draft', visibility: 'public', isPublic: true,
  folderId: null, tags: [], content: '', contentBlocks: [], previewImage: '', previewImages: [], media: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '', deletedAt: null, ...overrides
});
function invoke(body: unknown, authorization?: string, method = 'POST') {
  const response = { statusCode: 200, headers: {} as Record<string, string>, body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; }, end(value: string) { this.body = value; } };
  const req = { method, headers: authorization ? { authorization } : {}, body } as any;
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
    expect((await invoke({ action: 'works.create', args: [] })).statusCode).toBe(400);
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

  it('refuses owner scope without a verified user token', async () => {
    const result = await invoke({ action: 'works.fetch', args: [{ userId: 'owner-1' }] });
    expect(result.statusCode).toBe(401);
  });

  it('does not silently fake Profile-based public creator filtering', async () => {
    const result = await invoke({ action: 'works.fetch', args: [{ creatorSlug: 'creator-name' }] });
    expect(result.statusCode).toBe(501);
    expect(result.json.error).toContain('Profiles');
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
});
