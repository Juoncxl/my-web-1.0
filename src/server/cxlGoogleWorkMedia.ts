import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  cookieValue,
  OWNER_SESSION_COOKIE,
  selectOwnerAuthMode,
  verifyOwnerSessionToken
} from './cxlOwnerAuth.js';

type Request = IncomingMessage & { url?: string };
type Response = ServerResponse & {
  end: (data?: string | Buffer) => void;
  write: (chunk: Uint8Array) => boolean;
  once: (event: 'drain' | 'error', listener: (...args: any[]) => void) => Response;
  off: (event: 'drain' | 'error', listener: (...args: any[]) => void) => Response;
  destroy: (error?: Error) => void;
};

const CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const GAS_TIMEOUT_MS = 30_000;
const GAS_POST_CHAR_LIMIT = 4_900_000;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const GAS_READ_CODES = new Set([
  'INVALID_MEDIA_READ_REQUEST', 'MEDIA_READ_NOT_FOUND', 'MEDIA_READ_NOT_PUBLIC',
  'MEDIA_READ_INVALID', 'MEDIA_READ_FAILED'
]);
const WORK_MEDIA_TIMING_PHASES = new Set([
  'work_lookup', 'canonical_work_read', 'owner_auth_cache', 'association_validation', 'public_projection_validation',
  'file_metadata_validation', 'binary_fetch', 'response_construction'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sendJson(res: Response, status: number, code: string, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.end(JSON.stringify({ ok: false, code, error: message }));
}

function ownerSessionValid(req: Request) {
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

function failure(res: Response, status: number, code: string, message: string) {
  return sendJson(res, status, code, message);
}

function strictBase64(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !value.length
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
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

function readCodeFromGas(raw: unknown): { status: number; code: string; message: string } {
  const code = isRecord(raw) && typeof raw.code === 'string' && GAS_READ_CODES.has(raw.code) ? raw.code : '';
  if (code === 'INVALID_MEDIA_READ_REQUEST') return { status: 400, code, message: 'Invalid media read request' };
  if (code === 'MEDIA_READ_INVALID') return { status: 502, code, message: 'Media is invalid or unavailable' };
  if (code === 'MEDIA_READ_FAILED') return { status: 502, code, message: 'Media is unavailable' };
  return { status: 404, code: code || 'MEDIA_READ_NOT_FOUND', message: 'Media is unavailable' };
}

function previewWorkMediaTiming(res: Response, raw: unknown, action: string) {
  if (process.env.VERCEL_ENV !== 'preview' || !isRecord(raw) || !isRecord(raw.meta)
    || !isRecord(raw.meta.timing)) return;
  const timing = raw.meta.timing;
  if (timing.action !== action || !isRecord(timing.phases)) return;
  const metrics = Object.entries(timing.phases).flatMap(([phase, duration]) => WORK_MEDIA_TIMING_PHASES.has(phase)
    && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 600_000
    ? [`${phase};dur=${duration.toFixed(2)}`] : []);
  if (typeof timing.totalMs === 'number' && Number.isFinite(timing.totalMs)
    && timing.totalMs >= 0 && timing.totalMs <= 600_000) metrics.push(`total;dur=${timing.totalMs.toFixed(2)}`);
  if (metrics.length) res.setHeader('Server-Timing', metrics.join(', '));
}

async function callGas(scope: 'owner' | 'public', workId: string, mediaId: string, chunkIndex: number,
  onResponse?: (raw: unknown, action: string) => void) {
  const endpoint = gasEndpoint();
  const secret = process.env.CXL_API_SHARED_SECRET || '';
  const ownerId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  if (!endpoint || !secret || !ownerId) throw Object.assign(new Error('configuration unavailable'), { safeStatus: 503 });

  const action = scope === 'public' ? 'media.work.publicChunk' : 'media.work.ownerChunk';
  const payload = JSON.stringify({ authorization: secret, ownerUserId: ownerId, action,
    args: [{ workId, mediaId, ref: `media:${mediaId}`, chunkIndex }],
    ...(process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) });
  if (payload.length > GAS_POST_CHAR_LIMIT) throw Object.assign(new Error('request too large'), { safeStatus: 413 });

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(endpoint.toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload, redirect: 'follow', signal: AbortSignal.timeout(GAS_TIMEOUT_MS)
    });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(error.message));
    throw Object.assign(new Error('upstream unavailable'), { safeStatus: timeout ? 504 : 502 });
  }

  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw Object.assign(new Error('invalid upstream response'), { safeStatus: 502 }); }
  onResponse?.(raw, action);
  if (!response.ok || !isRecord(raw) || raw.ok !== true) {
    const mapped = readCodeFromGas(raw);
    throw Object.assign(new Error(mapped.message), { safeStatus: mapped.status, safeCode: mapped.code });
  }
  if (!isRecord(raw.data)) throw Object.assign(new Error('invalid upstream response'), { safeStatus: 502 });
  return raw.data;
}

function validateChunk(data: Record<string, unknown>, workId: string, mediaId: string, chunkIndex: number) {
  if (data.workId !== workId || data.mediaId !== mediaId || data.ref !== `media:${mediaId}`
    || data.chunkIndex !== chunkIndex || typeof data.mimeType !== 'string' || !IMAGE_MIME_TYPES.has(data.mimeType)
    || !Number.isInteger(data.totalFileSize) || Number(data.totalFileSize) < 1 || Number(data.totalFileSize) > MAX_FILE_BYTES
    || !Number.isInteger(data.totalChunks) || Number(data.totalChunks) !== Math.ceil(Number(data.totalFileSize) / CHUNK_BYTES)
    || Number(data.totalChunks) > 5 || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) {
    throw Object.assign(new Error('invalid media metadata'), { safeStatus: 502, safeCode: 'MEDIA_READ_RESPONSE_INVALID' });
  }
  const bytes = strictBase64(data.base64);
  const expectedLength = Math.min(CHUNK_BYTES, Number(data.totalFileSize) - chunkIndex * CHUNK_BYTES);
  if (!bytes || bytes.length !== expectedLength) {
    throw Object.assign(new Error('invalid media chunk'), { safeStatus: 502, safeCode: 'MEDIA_READ_CHUNK_INVALID' });
  }
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if (typeof data.chunkSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.chunkSha256)
    || checksum !== data.chunkSha256.toLowerCase()) {
    throw Object.assign(new Error('invalid media checksum'), { safeStatus: 502, safeCode: 'MEDIA_READ_CHUNK_INVALID' });
  }
  return { bytes, mimeType: data.mimeType, totalFileSize: Number(data.totalFileSize), totalChunks: Number(data.totalChunks), sha256: data.sha256.toLowerCase() };
}

async function waitForDrain(res: Response) {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { res.off('drain', onDrain); res.off('error', onError); };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('stream failed')); };
    res.once('drain', onDrain);
    res.once('error', onError);
  });
}

export async function handleGoogleWorkMediaRead(req: Request, res: Response) {
  if (process.env.VERCEL_ENV !== 'preview') return failure(res, 404, 'MEDIA_NOT_FOUND', 'Media is unavailable');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return failure(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  let params: URLSearchParams;
  try { params = new URL(req.url || '/', 'https://cxl.invalid').searchParams; }
  catch { return failure(res, 400, 'INVALID_MEDIA_READ_REQUEST', 'Invalid media read request'); }
  const scope = params.get('scope');
  const workId = params.get('workId') || '';
  const ref = params.get('ref') || '';
  const mediaId = ref.startsWith('media:') ? ref.slice('media:'.length) : '';
  if (params.getAll('scope').length !== 1 || params.getAll('workId').length !== 1 || params.getAll('ref').length !== 1
    || (scope !== 'owner' && scope !== 'public') || !/^asset_[A-Za-z0-9_-]{1,96}$/.test(workId)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(mediaId)
    || ref !== `media:${mediaId}`) {
    return failure(res, 400, 'INVALID_MEDIA_READ_REQUEST', 'Invalid media read request');
  }
  if (scope === 'owner' && !ownerSessionValid(req)) {
    return failure(res, 401, 'OWNER_AUTH_REQUIRED', 'Owner authentication required');
  }
  if (!gasEndpoint() || !process.env.CXL_API_SHARED_SECRET || !process.env.CXL_OWNER_USER_ID) {
    return failure(res, 503, 'MEDIA_READ_UNAVAILABLE', 'Media is unavailable');
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const digest = createHash('sha256');
  let metadata: ReturnType<typeof validateChunk> | undefined;
  try {
    for (let chunkIndex = 0; ; chunkIndex += 1) {
      const data = await callGas(scope, workId, mediaId, chunkIndex,
        chunkIndex === 0 ? (raw, action) => previewWorkMediaTiming(res, raw, action) : undefined);
      const chunk = validateChunk(data, workId, mediaId, chunkIndex);
      if (metadata && (metadata.mimeType !== chunk.mimeType || metadata.totalFileSize !== chunk.totalFileSize
        || metadata.totalChunks !== chunk.totalChunks || metadata.sha256 !== chunk.sha256)) {
        throw Object.assign(new Error('media metadata changed'), { safeStatus: 502, safeCode: 'MEDIA_READ_RESPONSE_INVALID' });
      }
      metadata ||= chunk;
      if (chunkIndex === 0) {
        if (!supportedSignature(chunk.mimeType, chunk.bytes)) {
          throw Object.assign(new Error('unsupported media signature'), { safeStatus: 502, safeCode: 'MEDIA_READ_INVALID' });
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', chunk.mimeType);
        res.setHeader('Content-Length', String(chunk.totalFileSize));
      }
      digest.update(chunk.bytes);
      let accepted: boolean;
      try { accepted = res.write(chunk.bytes); }
      catch { throw Object.assign(new Error('stream failed'), { safeStatus: 502, safeCode: 'MEDIA_READ_FAILED' }); }
      if (!accepted) {
        try { await waitForDrain(res); }
        catch { throw Object.assign(new Error('stream failed'), { safeStatus: 502, safeCode: 'MEDIA_READ_FAILED' }); }
      }
      if (chunkIndex + 1 === chunk.totalChunks) break;
    }
    if (!metadata || digest.digest('hex') !== metadata.sha256) {
      throw Object.assign(new Error('media checksum mismatch'), { safeStatus: 502, safeCode: 'MEDIA_READ_INVALID' });
    }
    return res.end();
  } catch (error) {
    if (res.headersSent) return res.destroy(new Error('Google Work media stream failed'));
    const status = isRecord(error) && typeof error.safeStatus === 'number' ? error.safeStatus : 502;
    const code = isRecord(error) && typeof error.safeCode === 'string' && /^MEDIA_READ_[A-Z_]+$/.test(error.safeCode)
      ? error.safeCode : 'MEDIA_READ_FAILED';
    if (status === 404) return failure(res, status, code, 'Media is unavailable');
    if (status === 401) return failure(res, status, code, 'Owner authentication required');
    if (status === 503) return failure(res, status, code, 'Media is unavailable');
    return failure(res, status, code, status === 504 ? 'Media read timed out' : 'Media read failed');
  }
}

export const googleWorkMediaReadLimits = { maxFileBytes: MAX_FILE_BYTES, chunkBytes: CHUNK_BYTES };
