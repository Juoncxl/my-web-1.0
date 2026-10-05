import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/cxl/media';

function invoke(url: string, method = 'GET', headers: Record<string, string> = {}) {
  const response = { statusCode: 200, headers: {} as Record<string, string>, body: Buffer.alloc(0),
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(value?: string | Buffer) { this.body = value === undefined ? Buffer.alloc(0) : Buffer.from(value); } };
  const req = { method, url, headers } as any;
  return handler(req, response as any).then(() => ({ ...response, json: () => JSON.parse(response.body.toString('utf8')) }));
}

describe('Public Google icon media proxy', () => {
  beforeEach(() => vi.stubEnv('CXL_GAS_PUBLIC_URL', 'https://script.google.com/macros/s/public/exec'));
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('returns an image through the Public GAS media.icon action without exposing upstream identifiers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { mimeType: 'image/png', base64: Buffer.from('icon-bytes').toString('base64') } }) });
    vi.stubGlobal('fetch', fetchMock);
    const response = await invoke('/api/cxl/media?workId=asset_public-1&ref=media%3Aicon-1&v=1767225600000');
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('image/png');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(response.headers['Cache-Control']).toBe('public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
    expect(response.body).toEqual(Buffer.from('icon-bytes'));
    expect(fetchMock.mock.calls[0][0]).toContain('cxlApi=media.icon');
    expect(fetchMock.mock.calls[0][0]).toContain('ref=media%3Aicon-1');
    expect(response.body.toString()).not.toContain('drive-file-id');
  });

  it('rejects non-numeric, overlong, or arbitrary media versions before calling GAS', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Ax&v=2026-09-26T10%3A30%3A00.000Z')).statusCode).toBe(400);
    expect((await invoke(`/api/cxl/media?workId=asset_ok&ref=media%3Ax&v=${'1'.repeat(17)}`)).statusCode).toBe(400);
    expect((await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Ax&v=not-a-version')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the stable cxl-media hash reference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { mimeType: 'image/jpeg', base64: 'aGVsbG8=' } }) }));
    const hash = 'a'.repeat(64);
    const response = await invoke(`/api/cxl/media?workId=asset_hash-1&ref=${encodeURIComponent(`cxl-media:${hash}`)}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('image/jpeg');
  });

  it('rejects unsupported methods and malformed work or media references before calling GAS', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke('/api/cxl/media?workId=not-a-work&ref=media%3Ax', 'POST')).statusCode).toBe(405);
    expect((await invoke('/api/cxl/media?workId=bad&ref=media%3Ax')).statusCode).toBe(400);
    expect((await invoke('/api/cxl/media?workId=asset_ok&ref=data%3Aimage%2Fpng')).statusCode).toBe(400);
    expect((await invoke(`/api/cxl/media?workId=asset_ok&ref=cxl-media%3A${'A'.repeat(64)}`)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME and hides GAS error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { mimeType: 'text/html', base64: Buffer.from('<html/>').toString('base64') } }) }));
    const unsupported = await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Aicon');
    expect(unsupported.statusCode).toBe(415);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'Drive file id PRIVATE_DRIVE_ID at /private/path' }) }));
    const denied = await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Aicon');
    expect(denied.statusCode).toBe(404);
    expect(denied.body.toString()).not.toContain('PRIVATE_DRIVE_ID');
    expect(denied.body.toString()).not.toContain('/private/path');
  });

  it('returns controlled errors for missing configuration, malformed payloads, and upstream timeouts', async () => {
    vi.stubEnv('CXL_GAS_PUBLIC_URL', '');
    expect((await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Aicon')).statusCode).toBe(503);
    vi.stubEnv('CXL_GAS_PUBLIC_URL', 'https://script.google.com/macros/s/public/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { mimeType: 'image/png', base64: 'not base64' } }) }));
    expect((await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Aicon')).statusCode).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('request deadline'), { name: 'TimeoutError' })));
    const timedOut = await invoke('/api/cxl/media?workId=asset_ok&ref=media%3Aicon');
    expect(timedOut.statusCode).toBe(504);
    expect(timedOut.body.toString()).not.toContain('script.google.com');
  });
});
