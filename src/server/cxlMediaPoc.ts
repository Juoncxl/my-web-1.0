import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  cookieValue,
  OWNER_SESSION_COOKIE,
  selectOwnerAuthMode,
  verifyCsrfRequest,
  verifyOwnerSessionToken
} from './cxlOwnerAuth.js';

type Request = IncomingMessage & { body?: unknown; url?: string };
type Response = ServerResponse & {
  end: (data?: string | Buffer) => void;
  write: (chunk: Uint8Array) => boolean;
  once: (event: 'drain', listener: () => void) => Response;
  destroy: (error?: Error) => void;
};
type JsonRecord = Record<string, unknown>;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const CHUNK_BYTES = 2 * 1024 * 1024;
const GAS_TIMEOUT_MS = 30_000;
const GAS_POST_CHAR_LIMIT = 4_900_000;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ACTIONS = new Set(['begin', 'chunk', 'finalize', 'setPublic', 'cleanup']);
const SAFE_GAS_CODES = new Set([
  'INVALID_MEDIA_POC_REQUEST', 'INVALID_MEDIA_POC_CHUNK', 'MEDIA_POC_NOT_CONFIGURED',
  'MEDIA_POC_FOLDER_NOT_PRIVATE', 'MEDIA_POC_IDEMPOTENCY_CONFLICT', 'MEDIA_POC_SESSION_NOT_FOUND',
  'MEDIA_POC_SESSION_EXPIRED', 'MEDIA_POC_SESSION_CLOSED', 'MEDIA_POC_CHUNK_CHECKSUM',
  'MEDIA_POC_CHUNK_CONFLICT', 'MEDIA_POC_CHUNK_MISSING', 'MEDIA_POC_FINAL_CHECKSUM',
  'MEDIA_POC_MIME_MISMATCH', 'MEDIA_POC_MEDIA_NOT_FOUND', 'MEDIA_POC_MEDIA_NOT_PUBLIC',
  'MEDIA_POC_MEDIA_INVALID', 'MEDIA_POC_MEDIA_READ_FAILED'
]);
const TIMING_PHASES = new Set([
  'chunk_receive', 'chunk_persist', 'finalize_lookup', 'final_assembly', 'checksum_validation',
  'binary_validation', 'canonical_drive_write', 'owner_media_read', 'public_media_authorization',
  'public_media_read', 'staging_cleanup', 'total'
]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sendJson(res: Response, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function unavailable(res: Response) {
  return sendJson(res, 404, { ok: false, error: 'Media proof-of-concept is unavailable' });
}

function enabled() {
  return process.env.VERCEL_ENV === 'preview' && process.env.CXL_MEDIA_POC_ENABLED === '1';
}

function parseBody(req: Request): unknown {
  if (isRecord(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return null;
}

function isOwnerSession(req: Request) {
  const ownerId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  return selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND) === 'vercel'
    && Boolean(ownerId && process.env.CXL_OWNER_GOOGLE_SUB?.trim()
      && (process.env.CXL_OWNER_SESSION_SECRET || '').length >= 32
      && verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE)));
}

function gasEndpoint(): URL | null {
  const raw = process.env.CXL_GAS_OWNER_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'script.google.com'
      && /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) ? url : null;
  } catch { return null; }
}

function safeTiming(res: Response, action: string, startedAt: number, timing?: unknown) {
  if (process.env.VERCEL_ENV !== 'preview') return;
  if (isRecord(timing) && timing.action === action && isRecord(timing.phases)) {
    const metrics = Object.entries(timing.phases).flatMap(([phase, duration]) => TIMING_PHASES.has(phase)
      && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? [`${phase};dur=${duration.toFixed(2)}`] : []);
    if (typeof timing.totalMs === 'number' && Number.isFinite(timing.totalMs) && timing.totalMs >= 0) {
      metrics.push(`total;dur=${timing.totalMs.toFixed(2)}`);
    }
    if (metrics.length) res.setHeader('Server-Timing', metrics.join(', '));
  } else if (!isRecord(timing)) {
    res.setHeader('Server-Timing', `cxl_media_poc;desc="${action}";dur=${(Date.now() - startedAt).toFixed(2)}`);
  }
}

function logSafeTiming(action: string, phases: Record<string, number>, startedAt: number) {
  if (process.env.VERCEL_ENV !== 'preview') return;
  const safePhases = Object.fromEntries(Object.entries(phases).filter(([name, duration]) => TIMING_PHASES.has(name)
    && Number.isFinite(duration) && duration >= 0));
  safePhases.total = Date.now() - startedAt;
  console.info(JSON.stringify({ event: 'cxl_media_poc_timing', action, phases: safePhases }));
}

function gasError(raw: unknown): { status: number; error: string; code?: string } {
  if (!isRecord(raw) || raw.ok !== false) return { status: 502, error: 'Media proof-of-concept request failed' };
  const code = typeof raw.code === 'string' && SAFE_GAS_CODES.has(raw.code) ? raw.code : undefined;
  if (code === 'MEDIA_POC_MEDIA_NOT_FOUND' || code === 'MEDIA_POC_SESSION_NOT_FOUND') return { status: 404, error: 'Test media is unavailable', code };
  if (code === 'MEDIA_POC_MEDIA_NOT_PUBLIC') return { status: 404, error: 'Test media is unavailable', code };
  if (code === 'MEDIA_POC_NOT_CONFIGURED') return { status: 503, error: 'Isolated media test storage is not configured', code };
  if (code === 'MEDIA_POC_FOLDER_NOT_PRIVATE') return { status: 503, error: 'Isolated media test storage is not private', code };
  if (code?.includes('CHECKSUM') || code === 'MEDIA_POC_MIME_MISMATCH' || code === 'MEDIA_POC_CHUNK_CONFLICT') {
    return { status: 422, error: 'Test media failed integrity validation', code };
  }
  if (code === 'MEDIA_POC_IDEMPOTENCY_CONFLICT') return { status: 409, error: 'Upload retry conflicts with existing test data', code };
  if (code?.startsWith('INVALID_')) return { status: 400, error: 'Invalid media proof-of-concept request', code };
  if (code?.startsWith('MEDIA_POC_SESSION_')) return { status: 409, error: 'Test upload session is unavailable', code };
  return { status: 502, error: 'Media proof-of-concept request failed' };
}

async function callGas(action: string, args: unknown[], includeTiming: boolean) {
  const endpoint = gasEndpoint();
  const secret = process.env.CXL_API_SHARED_SECRET || '';
  const ownerId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  if (!endpoint || !secret || !ownerId) throw Object.assign(new Error('not configured'), { statusCode: 503 });
  const payload = JSON.stringify({ authorization: secret, ownerUserId: ownerId, action: `media.poc.${action}`, args,
    ...(includeTiming && process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) });
  if (payload.length > GAS_POST_CHAR_LIMIT) throw Object.assign(new Error('request too large'), { statusCode: 413 });
  const startedAt = Date.now();
  const response = await fetch(endpoint.toString(), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: payload,
    redirect: 'follow', signal: AbortSignal.timeout(GAS_TIMEOUT_MS)
  });
  const responseText = await response.text();
  if (!response.ok) throw Object.assign(new Error('upstream error'), { statusCode: 502 });
  let raw: unknown;
  try { raw = JSON.parse(responseText); } catch { throw Object.assign(new Error('invalid upstream response'), { statusCode: 502 }); }
  if (!isRecord(raw) || raw.ok !== true) throw Object.assign(new Error('upstream operation failed'), gasError(raw));
  return { data: raw.data, timing: raw.meta && isRecord(raw.meta) ? raw.meta.timing : undefined, elapsedMs: Date.now() - startedAt };
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

function controlledError(res: Response, error: unknown) {
  if (isRecord(error) && typeof error.status === 'number') {
    const code = typeof error.code === 'string' ? error.code : undefined;
    return sendJson(res, error.status, { ok: false, error: typeof error.error === 'string' ? error.error : 'Media proof-of-concept request failed', ...(code ? { code } : {}) });
  }
  const status = error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(error.message)) ? 504 : 502;
  return sendJson(res, status, { ok: false, error: status === 504 ? 'Media proof-of-concept request timed out' : 'Media proof-of-concept request failed' });
}

function validMimeAndHash(body: JsonRecord) {
  return typeof body.mimeType === 'string' && IMAGE_MIME_TYPES.has(body.mimeType)
    && typeof body.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(body.sha256);
}

function hasOnlyKeys(body: JsonRecord, keys: string[]) {
  return Object.keys(body).every(key => keys.includes(key));
}

async function postAction(req: Request, res: Response, body: JsonRecord, startedAt: number) {
  const action = body.action;
  if (typeof action !== 'string' || !ACTIONS.has(action)) return sendJson(res, 400, { ok: false, error: 'Invalid media proof-of-concept request' });
  if (!isOwnerSession(req)) return sendJson(res, 401, { ok: false, error: 'Owner authentication required' });
  const origin = process.env.CXL_OWNER_APP_ORIGIN?.trim() || '';
  if (!verifyCsrfRequest(req.headers.origin, origin, req.headers.cookie, req.headers['x-cxl-csrf'] as string | undefined)) {
    return sendJson(res, 403, { ok: false, error: 'Request origin or CSRF token is invalid' });
  }
  const phases: Record<string, number> = {};
  try {
    let args: unknown[];
    if (action === 'begin') {
      if (!hasOnlyKeys(body, ['action', 'size', 'mimeType', 'sha256'])
        || typeof body.size !== 'number' || !Number.isInteger(body.size) || body.size < 1 || body.size > MAX_FILE_BYTES
        || !validMimeAndHash(body as JsonRecord)) return sendJson(res, 400, { ok: false, error: 'Invalid media upload metadata' });
      const mimeType = String(body.mimeType);
      const sha256 = String(body.sha256).toLowerCase();
      const uploadId = randomUUID(), mediaId = randomUUID(), workNonce = randomUUID();
      args = [{ uploadId, mediaId, workNonce, totalFileSize: body.size, rawChunkSize: CHUNK_BYTES,
        totalChunks: Math.ceil(body.size / CHUNK_BYTES), mimeType, sha256 }];
    } else if (action === 'chunk') {
      if (!hasOnlyKeys(body, ['action', 'uploadId', 'chunkIndex', 'base64', 'sha256'])
        || !validUuid(body.uploadId) || !Number.isInteger(body.chunkIndex) || typeof body.base64 !== 'string'
        || body.base64.length > 4 * Math.ceil(CHUNK_BYTES / 3) || typeof body.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(body.sha256)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid media chunk' });
      }
      args = [{ uploadId: body.uploadId, chunkIndex: body.chunkIndex, base64: body.base64, sha256: body.sha256.toLowerCase() }];
    } else if (action === 'finalize') {
      if (!hasOnlyKeys(body, ['action', 'uploadId']) || !validUuid(body.uploadId)) return sendJson(res, 400, { ok: false, error: 'Invalid upload session' });
      args = [{ uploadId: body.uploadId }];
    } else if (action === 'setPublic') {
      if (!hasOnlyKeys(body, ['action', 'mediaId', 'workNonce', 'isPublic'])
        || !validUuid(body.mediaId) || !validUuid(body.workNonce) || typeof body.isPublic !== 'boolean') return sendJson(res, 400, { ok: false, error: 'Invalid test media visibility request' });
      args = [{ mediaId: body.mediaId, workNonce: body.workNonce, isPublic: body.isPublic }];
    } else {
      if (!hasOnlyKeys(body, ['action'])) return sendJson(res, 400, { ok: false, error: 'Invalid cleanup request' });
      args = [];
    }
    const result = await callGas(action, args, true);
    if (isRecord(result.data) && isRecord(result.data.timing) && isRecord(result.data.timing.phases)) {
      for (const [phase, duration] of Object.entries(result.data.timing.phases)) {
        if (TIMING_PHASES.has(phase) && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) phases[phase] = duration;
      }
    }
    safeTiming(res, `media.poc.${action}`, startedAt, result.timing);
    res.setHeader('Cache-Control', 'private, no-store');
    return sendJson(res, 200, { ok: true, data: result.data });
  } catch (error) {
    logSafeTiming(`media.poc.${action}`, phases, startedAt);
    return controlledError(res, error);
  }
}

function strictBase64(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !value.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value ? bytes : null;
}

function supportedSignature(mimeType: string, bytes: Buffer) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function query(req: Request) {
  return new URL(req.url || '/', 'https://cxl.invalid').searchParams;
}

async function waitForDrain(res: Response) {
  await new Promise<void>(resolve => res.once('drain', resolve));
}

async function streamRead(req: Request, res: Response, startedAt: number) {
  const params = query(req);
  const scope = params.get('scope');
  if (scope !== 'owner' && scope !== 'public') return sendJson(res, 400, { ok: false, error: 'Invalid media read scope' });
  if (scope === 'owner' && !isOwnerSession(req)) return sendJson(res, 401, { ok: false, error: 'Owner authentication required' });
  const workNonce = params.get('workNonce') || '';
  const mediaId = params.get('mediaId') || '';
  const ref = params.get('ref') || '';
  if (!validUuid(workNonce) || !validUuid(mediaId) || ref !== `media:${mediaId}`) return sendJson(res, 400, { ok: false, error: 'Invalid test media reference' });
  const phases: Record<string, number> = {};
  const fullDigest = createHash('sha256');
  let metadata: JsonRecord | undefined;
  try {
    for (let chunkIndex = 0; ; chunkIndex++) {
      const action = scope === 'owner' ? 'ownerChunk' : 'publicChunk';
      const result = await callGas(action, [{ workNonce, mediaId, ref, chunkIndex }], true);
      if (isRecord(result.timing) && isRecord(result.timing.phases)) {
        for (const [phase, duration] of Object.entries(result.timing.phases)) {
          if (TIMING_PHASES.has(phase) && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
            phases[phase] = (phases[phase] || 0) + duration;
          }
        }
      }
      const data = result.data;
      if (!isRecord(data) || data.workId !== `asset_media_poc_${workNonce}` || data.mediaId !== mediaId
        || data.ref !== ref || typeof data.mimeType !== 'string' || !IMAGE_MIME_TYPES.has(data.mimeType)
        || typeof data.totalFileSize !== 'number' || !Number.isInteger(data.totalFileSize) || data.totalFileSize < 1 || data.totalFileSize > MAX_FILE_BYTES
        || !Number.isInteger(data.totalChunks) || data.totalChunks !== Math.ceil(data.totalFileSize / CHUNK_BYTES) || data.totalChunks > 5
        || data.chunkIndex !== chunkIndex || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) {
        throw new Error('invalid response');
      }
      const bytes = strictBase64(data.base64);
      const expectedLength = Math.min(CHUNK_BYTES, data.totalFileSize - chunkIndex * CHUNK_BYTES);
      if (!bytes || bytes.length !== expectedLength) throw new Error('invalid chunk');
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (typeof data.chunkSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.chunkSha256)
        || checksum !== data.chunkSha256.toLowerCase()) throw new Error('invalid chunk');
      if (metadata && (metadata.mimeType !== data.mimeType || metadata.totalFileSize !== data.totalFileSize
        || metadata.totalChunks !== data.totalChunks || metadata.sha256 !== data.sha256)) throw new Error('inconsistent chunks');
      metadata ||= data;
      if (chunkIndex === 0 && !supportedSignature(data.mimeType, bytes)) throw new Error('invalid image signature');
      fullDigest.update(bytes);
      phases[scope === 'owner' ? 'owner_media_read' : 'public_media_read'] = (phases[scope === 'owner' ? 'owner_media_read' : 'public_media_read'] || 0) + result.elapsedMs;
      if (chunkIndex === 0) {
        res.statusCode = 200;
        res.setHeader('Content-Type', data.mimeType);
        res.setHeader('Content-Length', String(data.totalFileSize));
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      if (!res.write(bytes)) await waitForDrain(res);
      if (chunkIndex + 1 === data.totalChunks) break;
    }
    if (!metadata || fullDigest.digest('hex') !== String(metadata.sha256).toLowerCase()) throw new Error('invalid full checksum');
    logSafeTiming(scope === 'owner' ? 'media.poc.ownerChunk' : 'media.poc.publicChunk', phases, startedAt);
    return res.end();
  } catch (error) {
    logSafeTiming(scope === 'owner' ? 'media.poc.ownerChunk' : 'media.poc.publicChunk', phases, startedAt);
    if (res.headersSent) return res.destroy(new Error('Media proof-of-concept stream failed'));
    return controlledError(res, error);
  }
}

export async function handleMediaPoc(req: Request, res: Response) {
  if (!enabled()) return unavailable(res);
  if (req.method === 'POST') {
    let body: unknown;
    try { body = parseBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Malformed media proof-of-concept request' }); }
    if (!isRecord(body)) return sendJson(res, 400, { ok: false, error: 'Invalid media proof-of-concept request' });
    return postAction(req, res, body, Date.now());
  }
  if (req.method === 'GET') return streamRead(req, res, Date.now());
  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

export const mediaPocLimits = { maxFileBytes: MAX_FILE_BYTES, chunkBytes: CHUNK_BYTES };
export const mediaPocHelpers = { strictBase64, supportedSignature };
