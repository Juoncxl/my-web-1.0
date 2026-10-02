import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOwnerSessionToken, OWNER_SESSION_COOKIE } from './cxlOwnerAuth';
import { attachmentDisposition, handleGoogleWorkMediaRead } from './cxlGoogleWorkMedia';

describe('download filename', () => {
  it('uses the readable Thai name with the real extension and a safe ASCII fallback', () => {
    const header = attachmentDisposition('ทหารที่รัก-เอมิน-2.jpg', 'cxl-asset_x-id', 'png');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('ทหารที่รัก-เอมิน-2.png')}`);
    expect(header).toMatch(/filename="[A-Za-z0-9._-]+\.png"/);
    expect(attachmentDisposition('../../"evil"\r\n', 'fallback', 'png')).not.toMatch(/[\r\n]|\.\.\/|"evil"/);
    expect(attachmentDisposition(null, 'cxl-asset_x-id', 'webp')).toContain('filename="cxl-asset_x-id.webp"');
  });
});

const WORK_ID = 'asset_1234567890abcdef1234567890abcdef';
const MEDIA_ID = '123e4567-e89b-42d3-a456-426614174001';
const OWNER_SUB = 'google-owner-subject-123456789';
const SESSION_SECRET = 'test-owner-session-secret-that-is-at-least-32-characters-long';
const IMAGE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

class MockResponse {
  statusCode = 200;
  headersSent = false;
  headers: Record<string, string> = {};
  chunks: Buffer[] = [];
  ended = false;
  destroyed = false;
  setHeader(key: string, value: string) { this.headers[key] = value; }
  write(chunk: Uint8Array) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); return true; }
  end(data?: string | Buffer) {
    this.headersSent = true;
    this.ended = true;
    if (data !== undefined) this.chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return this;
  }
  once() { return this; }
  off() { return this; }
  destroy() { this.destroyed = true; }
  body() { return Buffer.concat(this.chunks); }
}

function ownerCookie() {
  const { token } = createOwnerSessionToken(OWNER_SUB, 'owner@example.invalid', SESSION_SECRET);
  return `${OWNER_SESSION_COOKIE}=${token}`;
}

function setReadEnvironment() {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
  vi.stubEnv('CXL_OWNER_USER_ID', 'private-owner-key');
  vi.stubEnv('CXL_OWNER_GOOGLE_SUB', OWNER_SUB);
  vi.stubEnv('CXL_OWNER_SESSION_SECRET', SESSION_SECRET);
  vi.stubEnv('CXL_GAS_OWNER_URL', 'https://script.google.com/macros/s/preview-id/exec');
  vi.stubEnv('CXL_API_SHARED_SECRET', 'server-only-gas-secret');
}

function chunkResponse(overrides: Record<string, unknown> = {}) {
  return {
    workId: WORK_ID,
    mediaId: MEDIA_ID,
    ref: `media:${MEDIA_ID}`,
    mimeType: 'image/png',
    totalFileSize: IMAGE_BYTES.length,
    totalChunks: 1,
    chunkIndex: 0,
    sha256: sha256(IMAGE_BYTES),
    chunkSha256: sha256(IMAGE_BYTES),
    base64: IMAGE_BYTES.toString('base64'),
    ...overrides
  };
}

function request(url: string, cookie?: string, method = 'GET') {
  return { method, url, headers: { ...(cookie ? { cookie } : {}) } } as IncomingMessage & { url: string };
}

describe('Google standard Work media proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('requires a verified Owner session before sending private reads upstream', async () => {
    setReadEnvironment();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=owner&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams an Owner private media chunk through the existing server side GAS bridge', async () => {
    setReadEnvironment();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      expect(payload).toMatchObject({ ownerUserId: 'private-owner-key', action: 'media.work.ownerChunk',
        args: [{ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }] });
      return new Response(JSON.stringify({ ok: true, data: chunkResponse() }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=owner&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`, ownerCookie()), res as unknown as ServerResponse);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/png');
    // The Owner's own browser may keep immutable media; shared caches may not.
    expect(res.headers['Cache-Control']).toBe('private, max-age=3600');
    expect(res.body()).toEqual(IMAGE_BYTES);
    expect(res.body().toString()).not.toContain('private-owner-key');
    expect(res.body().toString()).not.toContain('server-only-gas-secret');
  });

  it('sends Preview timing requests and emits only allowlisted Server-Timing metrics before binary output', async () => {
    setReadEnvironment();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body)).includeTiming).toBe(true);
      return new Response(JSON.stringify({ ok: true, data: chunkResponse(), meta: { timing: {
        action: 'media.work.ownerChunk', phases: {
          work_lookup: 12, canonical_work_read: 3.25, association_validation: 4,
          owner_auth_cache: 1.5, file_metadata_validation: 2, binary_fetch: 9, response_construction: 1,
          injected: 55, 'drive-file-secret': 100, public_projection_validation: 'bad'
        }, totalMs: 32.5, ownerId: OWNER_SUB
      } } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=owner&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`, ownerCookie()), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body()).toEqual(IMAGE_BYTES);
    expect(res.headers['Server-Timing']).toBe('work_lookup;dur=12.00, canonical_work_read;dur=3.25, association_validation;dur=4.00, owner_auth_cache;dur=1.50, file_metadata_validation;dur=2.00, binary_fetch;dur=9.00, response_construction;dur=1.00, total;dur=32.50');
    expect(res.headers['Server-Timing']).not.toMatch(/secret|ownerId|drive|media:|asset_/i);
  });

  it('does not require an Owner browser session for public requests, but delegates the association decision to GAS', async () => {
    setReadEnvironment();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ action: 'media.work.publicChunk',
        args: [{ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }] });
      return new Response(JSON.stringify({ ok: true, data: chunkResponse() }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=public&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body()).toEqual(IMAGE_BYTES);
  });

  it('assembles sequential Range chunks and verifies the full media checksum', async () => {
    setReadEnvironment();
    const fullBytes = Buffer.alloc(2 * 1024 * 1024 + 1);
    IMAGE_BYTES.copy(fullBytes);
    const fullHash = sha256(fullBytes);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      const chunkIndex = payload.args[0].chunkIndex as number;
      const start = chunkIndex * 2 * 1024 * 1024;
      const bytes = fullBytes.subarray(start, Math.min(fullBytes.length, start + 2 * 1024 * 1024));
      const data = chunkResponse({ totalFileSize: fullBytes.length, totalChunks: 2, chunkIndex,
        sha256: fullHash, chunkSha256: sha256(bytes), base64: bytes.toString('base64') });
      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=public&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`), res as unknown as ServerResponse);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body()).toEqual(fullBytes);
  }, 30_000);

  it('fails closed when GAS rejects a stale, private, or mismatched public association', async () => {
    setReadEnvironment();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'MEDIA_READ_NOT_PUBLIC' }), { status: 200 })));
    const res = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=public&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(404);
    expect(res.body().toString()).not.toContain('Drive');
    expect(res.body().toString()).not.toContain('private-owner-key');
  });

  it('rejects malformed paths and invalid upstream bytes with controlled responses', async () => {
    setReadEnvironment();
    const malformed = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=public&workId=${WORK_ID}&ref=media%3Abad`), malformed as unknown as ServerResponse);
    expect(malformed.statusCode).toBe(400);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, data: chunkResponse({
      base64: Buffer.from('not an image').toString('base64'), totalFileSize: Buffer.byteLength('not an image'),
      totalChunks: 1, sha256: sha256(Buffer.from('not an image')), chunkSha256: sha256(Buffer.from('not an image'))
    }) }), { status: 200 })));
    const invalid = new MockResponse();
    await handleGoogleWorkMediaRead(request(`/api/cxl/media?scope=public&workId=${WORK_ID}&ref=media%3A${MEDIA_ID}`), invalid as unknown as ServerResponse);
    expect(invalid.statusCode).toBe(502);
    expect(invalid.body().toString()).not.toContain('not an image');
  });
});
