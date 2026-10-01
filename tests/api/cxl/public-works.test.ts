import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/cxl/public-works';

const makeWork = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, userId: 'creator-1', authorName: 'Creator', title: id, category: 'character', status: 'finished',
  visibility: 'public', isPublic: true, folderId: 'private-folder', tags: [], content: 'private canonical content',
  shortDescription: 'public summary', contentBlocks: [], uiCodeSnippet: 'private code', previewImage: '',
  previewImages: [], media: [], versions: [{ id: 'private-version' }], createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '', deletedAt: null, ...overrides
});

function invoke(method = 'GET', headers: Record<string, string> = {}) {
  const response = { statusCode: 200, headers: {} as Record<string, string>, body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; }, end(value = '') { this.body = value; } };
  const req = { method, headers } as any;
  return handler(req, response as any).then(() => ({ ...response, json: response.body ? JSON.parse(response.body) : null }));
}

describe('cacheable public Works snapshot route', () => {
  beforeEach(() => {
    vi.stubEnv('CXL_OWNER_USER_ID', 'owner-1');
    vi.stubEnv('CXL_API_SHARED_SECRET', 'server-only-secret');
    vi.stubEnv('CXL_GAS_OWNER_URL', 'https://script.google.com/macros/s/owner/exec');
    vi.stubEnv('VERCEL_ENV', 'preview');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('serves only validated public summaries with resilient shared caching and an ETag', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true,
      data: [makeWork('visible'), makeWork('private', { visibility: 'private', isPublic: false })],
      meta: { timing: { phases: { snapshot_manifest_read: 2, snapshot_chunks_read: 3, snapshot_parse: 1, secret_phase: 999 } } }
    }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke();

    expect(result.statusCode).toBe(200);
    expect(result.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=30, stale-while-revalidate=86400, stale-if-error=604800');
    expect(result.headers.ETag).toMatch(/^".+"$/);
    expect(result.headers['Server-Timing']).toContain('snapshot_manifest_read;dur=2.00');
    expect(result.headers['Server-Timing']).not.toContain('secret_phase');
    expect(result.json.data.data.map((work: { id: string }) => work.id)).toEqual(['visible']);
    expect(result.json.data.data[0]).not.toHaveProperty('folderId');
    expect(result.json.data.data[0].content).toBe('');
    expect(result.json.data.data[0].uiCodeSnippet).toBe('');
    expect(JSON.stringify(result.json)).not.toContain('server-only-secret');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      authorization: 'server-only-secret', ownerUserId: 'owner-1', action: 'public.works.list', includeTiming: true
    });
  });

  it('returns 304 for a matching ETag and does not cache errors', async () => {
    const works = [makeWork('visible')];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: works }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: works }) })
      .mockResolvedValueOnce({ ok: false, status: 200, text: async () => JSON.stringify({ ok: false, error: 'snapshot unavailable' }) });
    vi.stubGlobal('fetch', fetchMock);
    const first = await invoke();
    const same = await invoke('GET', { 'if-none-match': first.headers.ETag });
    const failed = await invoke();

    expect(same.statusCode).toBe(304);
    expect(same.body).toBe('');
    expect(failed.statusCode).toBe(502);
    expect(failed.headers['Cache-Control']).toBe('no-store');
  });

  it('accepts only GET requests', async () => {
    expect((await invoke('POST')).statusCode).toBe(405);
  });
});

