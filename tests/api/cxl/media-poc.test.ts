import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { mediaPocLimits } from '../../../api/cxl/media';
import { createOwnerSessionToken } from '../../../src/server/cxlOwnerAuth';

const SECRET = 'server-only-cxl-shared-secret';
const SESSION_SECRET = 'owner-session-secret-that-is-long-enough-for-preview';
const OWNER_SUB = 'google-owner-subject-123456789';
const APP_ORIGIN = 'https://cxl.example';
const OWNER_COOKIE = `__Host-cxl_owner=${createOwnerSessionToken(OWNER_SUB, undefined, SESSION_SECRET).token}; __Host-cxl_csrf=csrf-token`;

function imageBytes() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
}

function liveTestPng68() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=', 'base64');
}

function sha256(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex'); }

function ownerReadUrl(ids: { workNonce: string; mediaId: string }) {
  return `/api/cxl/media?poc=1&scope=owner&workNonce=${ids.workNonce}&mediaId=${ids.mediaId}&ref=${encodeURIComponent(`media:${ids.mediaId}`)}`;
}

function gasReadData(bytes: Buffer, ids: { workNonce: string; mediaId: string }, overrides: Record<string, unknown> = {}) {
  return {
    workId: `asset_media_poc_${ids.workNonce}`,
    mediaId: ids.mediaId,
    ref: `media:${ids.mediaId}`,
    mimeType: 'image/png',
    totalFileSize: bytes.length,
    totalChunks: 1,
    chunkIndex: 0,
    sha256: sha256(bytes),
    chunkSha256: sha256(bytes),
    base64: bytes.toString('base64'),
    ...overrides
  };
}

async function invokeOwnerRead(fetchImpl: (...args: any[]) => any, ids: { workNonce: string; mediaId: string }, response = makeResponse()) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  await handler(makeRequest(undefined, { method: 'GET', url: ownerReadUrl(ids), cookie: OWNER_COOKIE }) as any, response as any);
  return response;
}

function expectSafeReadFailureLog(warn: ReturnType<typeof vi.spyOn>, code: string) {
  const logged = JSON.parse(String(warn.mock.calls.at(-1)?.[0]));
  expect(Object.keys(logged).sort()).toEqual(['action', 'chunkIndex', 'code', 'elapsedMs']);
  expect(logged).toMatchObject({ action: 'media.poc.ownerChunk', code, chunkIndex: expect.any(Number) });
  expect(logged.elapsedMs).toEqual(expect.any(Number));
  expect(JSON.stringify(logged)).not.toMatch(/123e4567|server-only|drive|secret|https?:/i);
}

function makeResponse() {
  const chunks: Buffer[] = [];
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    ended: false,
    destroyed: false,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(value?: string | Buffer) { if (value !== undefined) chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value)); this.ended = true; return this; },
    write(value: Uint8Array) { chunks.push(Buffer.from(value)); return true; },
    once(event: 'drain' | 'error', callback: (...args: any[]) => void) { if (event === 'drain') queueMicrotask(() => callback()); return this; },
    off(_event: 'drain' | 'error', _callback: (...args: any[]) => void) { return this; },
    destroy() { this.destroyed = true; this.ended = true; return this; },
    get headersSent() { return chunks.length > 0 || this.ended; },
    get bodyBuffer() { return Buffer.concat(chunks); },
    get json() { try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; } }
  };
  return response;
}

function makeRequest(body: unknown, options: { method?: string; url?: string; cookie?: string; origin?: string; csrf?: string } = {}) {
  return {
    method: options.method || 'POST',
    url: options.url || '/api/cxl/media?poc=1',
    body,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.csrf ? { 'x-cxl-csrf': options.csrf } : {})
    }
  } as any;
}

async function invoke(body: unknown, options: Parameters<typeof makeRequest>[1] = {}) {
  const response = makeResponse();
  await handler(makeRequest(body, options), response as any);
  return response;
}

function enablePreview() {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('CXL_MEDIA_POC_ENABLED', '1');
  vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
  vi.stubEnv('CXL_OWNER_USER_ID', 'private-owner-key');
  vi.stubEnv('CXL_OWNER_GOOGLE_SUB', OWNER_SUB);
  vi.stubEnv('CXL_OWNER_SESSION_SECRET', SESSION_SECRET);
  vi.stubEnv('CXL_OWNER_APP_ORIGIN', APP_ORIGIN);
  vi.stubEnv('CXL_GAS_OWNER_URL', 'https://script.google.com/macros/s/private-deployment/exec');
  vi.stubEnv('CXL_API_SHARED_SECRET', SECRET);
}

describe('isolated Preview media POC route', () => {
  beforeEach(() => enablePreview());
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('is unavailable outside Preview or before the explicit server-side opt-in', async () => {
    vi.stubEnv('CXL_MEDIA_POC_ENABLED', '0');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const response = await invoke({ action: 'cleanup' }, { cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token' });
    expect(response.statusCode).toBe(404);
    expect(response.json.error).toBe('Media proof-of-concept is unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('CXL_MEDIA_POC_ENABLED', '1');
    expect((await invoke({ action: 'cleanup' })).statusCode).toBe(404);
  });

  it('keeps the existing public icon path available when the POC is disabled', async () => {
    vi.stubEnv('CXL_MEDIA_POC_ENABLED', '0');
    vi.stubEnv('CXL_GAS_PUBLIC_URL', 'https://script.google.com/macros/s/public/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: {
      mimeType: 'image/png', base64: Buffer.from('existing-icon').toString('base64')
    } }) }));

    const response = await (async () => {
      const result = makeResponse();
      await handler(makeRequest(undefined, { method: 'GET', url: '/api/cxl/media?workId=asset_existing&ref=media%3Aicon' }) as any, result as any);
      return result;
    })();

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('image/png');
    expect(response.bodyBuffer).toEqual(Buffer.from('existing-icon'));
  });

  it('routes only a single exact poc=1 discriminator to the isolated handler', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const duplicate = await invoke({ action: 'cleanup' }, {
      url: '/api/cxl/media?poc=1&poc=1', cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token'
    });
    const invalid = await invoke({ action: 'cleanup' }, {
      url: '/api/cxl/media?poc=true', cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token'
    });
    const normalPost = await invoke({ action: 'cleanup' }, {
      url: '/api/cxl/media', cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token'
    });

    expect(duplicate.statusCode).toBe(404);
    expect(invalid.statusCode).toBe(404);
    expect(normalPost.statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a valid Owner session and exact Origin/CSRF for every state-changing POC operation', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const unauthenticated = await invoke({ action: 'cleanup' }, { origin: APP_ORIGIN, csrf: 'csrf-token' });
    const noCsrf = await invoke({ action: 'cleanup' }, { cookie: OWNER_COOKIE, origin: APP_ORIGIN });
    const wrongOrigin = await invoke({ action: 'cleanup' }, { cookie: OWNER_COOKIE, origin: 'https://attacker.example', csrf: 'csrf-token' });
    expect([unauthenticated.statusCode, noCsrf.statusCode, wrongOrigin.statusCode]).toEqual([401, 403, 403]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps server credentials and deployment details out of browser responses', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(request).toMatchObject({ authorization: SECRET, ownerUserId: 'private-owner-key', action: 'media.poc.begin' });
      expect(request.args[0]).toMatchObject({ rawChunkSize: mediaPocLimits.chunkBytes, totalChunks: 1, mimeType: 'image/png' });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: {
        uploadId: request.args[0].uploadId, workId: `asset_media_poc_${request.args[0].workNonce}`,
        mediaId: request.args[0].mediaId, ref: `media:${request.args[0].mediaId}`, state: 'private'
      }, meta: { timing: { action: 'media.poc.begin', phases: { chunk_receive: 4, private_owner_id: 999 }, totalMs: 5 } } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await invoke({ action: 'begin', size: imageBytes().length, mimeType: 'image/png', sha256: sha256(imageBytes()) },
      { cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token' });
    expect(response.statusCode).toBe(200);
    expect(response.json.data).toMatchObject({ state: 'private', ref: expect.stringMatching(/^media:/) });
    expect(JSON.stringify(response.json)).not.toMatch(/server-only-cxl-shared-secret|script\.google\.com|drive-private|fileId|filePath/i);
    expect(response.headers['Cache-Control']).toBe('private, no-store');
    expect(response.headers['Server-Timing']).toBe('chunk_receive;dur=4.00, total;dur=5.00');
    expect(response.headers['Server-Timing']).not.toMatch(/private_owner_id|server-only|fileId/i);
  });

  it('streams a complete 10 MiB Owner-private binary over five bounded GAS read responses', async () => {
    const bytes = Buffer.alloc(mediaPocLimits.maxFileBytes, 0x6a);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    const overallHash = sha256(bytes);
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174010', mediaId: '123e4567-e89b-42d3-a456-426614174011' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      const chunkIndex = request.args[0].chunkIndex as number;
      const chunk = bytes.subarray(chunkIndex * mediaPocLimits.chunkBytes, Math.min((chunkIndex + 1) * mediaPocLimits.chunkBytes, bytes.length));
      expect(request).toMatchObject({ authorization: SECRET, ownerUserId: 'private-owner-key', action: 'media.poc.ownerChunk' });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: {
        workId: `asset_media_poc_${ids.workNonce}`, ...ids, ref: `media:${ids.mediaId}`, mimeType: 'image/png',
        totalFileSize: bytes.length, totalChunks: 5, chunkIndex, sha256: overallHash,
        chunkSha256: sha256(chunk), base64: chunk.toString('base64')
      } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = makeResponse();
    const url = `/api/cxl/media?poc=1&scope=owner&workNonce=${ids.workNonce}&mediaId=${ids.mediaId}&ref=media%3A${ids.mediaId}`;
    await handler(makeRequest(undefined, { method: 'GET', url, cookie: OWNER_COOKIE }) as any, response as any);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(response.statusCode).toBe(200);
    expect(response.bodyBuffer.length).toBe(mediaPocLimits.maxFileBytes);
    expect(sha256(response.bodyBuffer)).toBe(overallHash);
    expect(response.headers['Content-Length']).toBe(String(mediaPocLimits.maxFileBytes));
    expect(response.headers['Cache-Control']).toBe('private, no-store');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
  }, 20_000);

  it('accepts the exact 68-byte finalized Owner PNG response contract from GAS', async () => {
    const bytes = liveTestPng68();
    expect(bytes).toHaveLength(68);
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174020', mediaId: '123e4567-e89b-42d3-a456-426614174021' };
    const gasData = gasReadData(bytes, ids);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(request.action).toBe('media.poc.ownerChunk');
      expect(request.args).toEqual([{ workNonce: ids.workNonce, mediaId: ids.mediaId, ref: `media:${ids.mediaId}`, chunkIndex: 0 }]);
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: gasData }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = makeResponse();
    await handler(makeRequest(undefined, { method: 'GET', url: ownerReadUrl(ids), cookie: OWNER_COOKIE }) as any, response as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('image/png');
    expect(response.headers['Content-Length']).toBe('68');
    expect(response.bodyBuffer).toEqual(bytes);
  });

  it.each([
    ['upstream HTTP failure', 'MEDIA_POC_READ_UPSTREAM_HTTP', 'upstream-http'],
    ['upstream JSON failure', 'MEDIA_POC_READ_UPSTREAM_RESPONSE_INVALID', 'upstream-json'],
    ['upstream timeout', 'MEDIA_POC_READ_UPSTREAM_TIMEOUT', 'timeout'],
    ['upstream network failure', 'MEDIA_POC_READ_UPSTREAM_FAILED', 'network'],
    ['invalid response shape', 'MEDIA_POC_READ_RESPONSE_INVALID', 'response-shape'],
    ['invalid media metadata', 'MEDIA_POC_READ_METADATA_INVALID', 'metadata'],
    ['invalid chunk size', 'MEDIA_POC_READ_CHUNK_SIZE', 'chunk-size'],
    ['invalid chunk checksum', 'MEDIA_POC_READ_CHUNK_CHECKSUM', 'chunk-checksum'],
    ['invalid image signature', 'MEDIA_POC_READ_SIGNATURE', 'signature']
  ])('returns a safe diagnostic for %s', async (_label, expectedCode, failureKind) => {
    const bytes = liveTestPng68();
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174030', mediaId: '123e4567-e89b-42d3-a456-426614174031' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let fetchImpl: (...args: any[]) => any;
    if (failureKind === 'upstream-http') fetchImpl = async () => ({ ok: false, status: 500, text: async () => '' });
    else if (failureKind === 'upstream-json') fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{bad json' });
    else if (failureKind === 'timeout') fetchImpl = async () => { throw Object.assign(new Error('deadline exceeded'), { name: 'TimeoutError' }); };
    else if (failureKind === 'network') fetchImpl = async () => { throw new Error('network unavailable'); };
    else if (failureKind === 'response-shape') fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: null }) });
    else {
      let data = gasReadData(bytes, ids);
      if (failureKind === 'metadata') data = { ...data, totalFileSize: 0 };
      if (failureKind === 'chunk-size') data = { ...data, base64: bytes.subarray(1).toString('base64') };
      if (failureKind === 'chunk-checksum') data = { ...data, chunkSha256: '0'.repeat(64) };
      if (failureKind === 'signature') {
        const invalidImage = Buffer.from(bytes); invalidImage[0] ^= 1;
        data = gasReadData(invalidImage, ids);
      }
      fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data }) });
    }

    const response = await invokeOwnerRead(fetchImpl, ids);
    expect(response.statusCode).toBe(expectedCode === 'MEDIA_POC_READ_UPSTREAM_TIMEOUT' ? 504 : 502);
    expect(response.json).toMatchObject({ ok: false, code: expectedCode });
    expect(response.json.error).toMatch(/read (validation|request) failed/i);
    expect(JSON.stringify(response.json)).not.toMatch(/123e4567|server-only|drive|secret|https?:|base64:/i);
    expectSafeReadFailureLog(warn, expectedCode);
  });

  it('distinguishes inconsistent metadata between chunks without logging identifiers', async () => {
    const bytes = Buffer.alloc(mediaPocLimits.chunkBytes + 1, 0x45);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174040', mediaId: '123e4567-e89b-42d3-a456-426614174041' };
    const overallHash = sha256(bytes);
    const firstChunk = bytes.subarray(0, mediaPocLimits.chunkBytes);
    const lastChunk = bytes.subarray(mediaPocLimits.chunkBytes);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      const chunkIndex = request.args[0].chunkIndex as number;
      const chunk = chunkIndex === 0 ? firstChunk : lastChunk;
      const data = {
        ...gasReadData(chunk, ids, {
          totalFileSize: bytes.length,
          totalChunks: 2,
          chunkIndex,
          sha256: chunkIndex === 0 ? overallHash : 'f'.repeat(64)
        })
      };
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data }) };
    };

    const response = await invokeOwnerRead(fetchImpl, ids);
    expect(response.destroyed).toBe(true);
    expectSafeReadFailureLog(warn, 'MEDIA_POC_READ_METADATA_MISMATCH');
  }, 20_000);

  it('logs full-file checksum failures with a safe code after streaming has begun', async () => {
    const bytes = liveTestPng68();
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174050', mediaId: '123e4567-e89b-42d3-a456-426614174051' };
    const gasData = gasReadData(bytes, ids, { sha256: 'f'.repeat(64) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await invokeOwnerRead(async () => ({
      ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: gasData })
    }), ids);

    expect(response.destroyed).toBe(true);
    expectSafeReadFailureLog(warn, 'MEDIA_POC_READ_FULL_CHECKSUM');
  });

  it('reports a stream write failure with a safe diagnostic code', async () => {
    const bytes = liveTestPng68();
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174060', mediaId: '123e4567-e89b-42d3-a456-426614174061' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = makeResponse();
    response.write = () => { throw new Error('write failed'); };
    const result = await invokeOwnerRead(async () => ({
      ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: gasReadData(bytes, ids) })
    }), ids, response);

    expect(result.statusCode).toBe(502);
    expect(result.json).toMatchObject({ ok: false, code: 'MEDIA_POC_READ_STREAM_FAILED' });
    expectSafeReadFailureLog(warn, 'MEDIA_POC_READ_STREAM_FAILED');
  });

  it('reports a stream error while waiting for backpressure drain', async () => {
    const bytes = liveTestPng68();
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174070', mediaId: '123e4567-e89b-42d3-a456-426614174071' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = makeResponse();
    response.write = () => false;
    response.once = (event, callback) => {
      if (event === 'error') queueMicrotask(() => callback(new Error('socket reset')));
      return response;
    };
    const result = await invokeOwnerRead(async () => ({
      ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: gasReadData(bytes, ids) })
    }), ids, response);

    expect(result.statusCode).toBe(502);
    expect(result.json).toMatchObject({ ok: false, code: 'MEDIA_POC_READ_STREAM_FAILED' });
    expectSafeReadFailureLog(warn, 'MEDIA_POC_READ_STREAM_FAILED');
  });

  it('streams anonymous public bytes only after GAS approves the exact POC public association', async () => {
    const bytes = imageBytes();
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174000', mediaId: '123e4567-e89b-42d3-a456-426614174001' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(request).toMatchObject({ authorization: SECRET, ownerUserId: 'private-owner-key', action: 'media.poc.publicChunk' });
      expect(request.args[0]).toMatchObject({ ...ids, ref: `media:${ids.mediaId}`, chunkIndex: 0 });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: {
        workId: `asset_media_poc_${ids.workNonce}`, ...ids, ref: `media:${ids.mediaId}`, mimeType: 'image/png',
        totalFileSize: bytes.length, totalChunks: 1, chunkIndex: 0, sha256: sha256(bytes), chunkSha256: sha256(bytes), base64: bytes.toString('base64')
      } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = makeResponse();
    await handler(makeRequest(undefined, { method: 'GET', url: `/api/cxl/media?poc=1&scope=public&workNonce=${ids.workNonce}&mediaId=${ids.mediaId}&ref=media%3A${ids.mediaId}` }) as any, response as any);
    expect(response.statusCode).toBe(200);
    expect(response.bodyBuffer).toEqual(bytes);
    expect(response.headers['Content-Type']).toBe('image/png');
    expect(response.headers['Cache-Control']).toBe('private, no-store');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(JSON.stringify(response.headers)).not.toMatch(/drive|script\.google|secret/i);
  });

  it('requires Owner session for private reads and hides private media from anonymous callers', async () => {
    const ids = { workNonce: '123e4567-e89b-42d3-a456-426614174000', mediaId: '123e4567-e89b-42d3-a456-426614174001' };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({
      ok: false, code: 'MEDIA_POC_MEDIA_NOT_PUBLIC', error: 'private file ID must not leak'
    }) }));
    vi.stubGlobal('fetch', fetchMock);
    const ownerRequest = `/api/cxl/media?poc=1&scope=owner&workNonce=${ids.workNonce}&mediaId=${ids.mediaId}&ref=media%3A${ids.mediaId}`;
    const anonymousPrivate = await (async () => { const response = makeResponse(); await handler(makeRequest(undefined, { method: 'GET', url: ownerRequest }) as any, response as any); return response; })();
    expect(anonymousPrivate.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    const publicRequest = `/api/cxl/media?poc=1&scope=public&workNonce=${ids.workNonce}&mediaId=${ids.mediaId}&ref=media%3A${ids.mediaId}`;
    const response = makeResponse();
    await handler(makeRequest(undefined, { method: 'GET', url: publicRequest }) as any, response as any);
    expect(response.statusCode).toBe(404);
    expect(response.json.error).toBe('Test media is unavailable');
    expect(JSON.stringify(response.json)).not.toMatch(/private file ID|drive|script\.google|secret/i);
  });

  it('rejects invalid methods, references, chunk metadata and bad upstream binary signatures', async () => {
    const method = await invoke({}, { method: 'PUT' });
    expect(method.statusCode).toBe(405);
    const invalid = await invoke({}, { method: 'GET', url: '/api/cxl/media?poc=1&scope=public&mediaId=bad&workNonce=bad&ref=media%3Abad' });
    expect(invalid.statusCode).toBe(400);
    const bytes = Buffer.from('not an image');
    const upstreamData = { ok: true, data: {
      workId: 'asset_media_poc_123e4567-e89b-42d3-a456-426614174000', workNonce: '123e4567-e89b-42d3-a456-426614174000',
      mediaId: '123e4567-e89b-42d3-a456-426614174001', ref: 'media:123e4567-e89b-42d3-a456-426614174001', mimeType: 'image/png',
      totalFileSize: bytes.length, totalChunks: 1, chunkIndex: 0, sha256: sha256(bytes), chunkSha256: sha256(bytes), base64: bytes.toString('base64')
    } };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(upstreamData) }));
    const badImage = makeResponse();
    const request = makeRequest(undefined, { method: 'GET', url: '/api/cxl/media?poc=1&scope=public&workNonce=123e4567-e89b-42d3-a456-426614174000&mediaId=123e4567-e89b-42d3-a456-426614174001&ref=media%3A123e4567-e89b-42d3-a456-426614174001' });
    await handler(request as any, badImage as any);
    expect(badImage.statusCode).toBe(502);
    expect(badImage.json).toMatchObject({ ok: false, error: 'Media proof-of-concept read validation failed', code: 'MEDIA_POC_READ_SIGNATURE' });
  });

  it('bounds each upload chunk below Vercel and Apps Script request-body limits', async () => {
    expect(mediaPocLimits).toEqual({ maxFileBytes: 10 * 1024 * 1024, chunkBytes: 2 * 1024 * 1024 });
    const oversized = await invoke({ action: 'begin', size: 10 * 1024 * 1024 + 1, mimeType: 'image/png', sha256: 'a'.repeat(64) },
      { cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token' });
    expect(oversized.statusCode).toBe(400);
    const invalidChunk = await invoke({ action: 'chunk', uploadId: '123e4567-e89b-42d3-a456-426614174000', chunkIndex: 0,
      base64: 'A'.repeat(4 * Math.ceil(mediaPocLimits.chunkBytes / 3) + 4), sha256: 'a'.repeat(64) },
    { cookie: OWNER_COOKIE, origin: APP_ORIGIN, csrf: 'csrf-token' });
    expect(invalidChunk.statusCode).toBe(400);
  });
});
