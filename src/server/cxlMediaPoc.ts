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
  once: (event: 'drain' | 'error', listener: (...args: any[]) => void) => Response;
  off: (event: 'drain' | 'error', listener: (...args: any[]) => void) => Response;
  destroy: (error?: Error) => void;
};
type JsonRecord = Record<string, unknown>;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const CHUNK_BYTES = 2 * 1024 * 1024;
const GAS_TIMEOUT_MS = 30_000;
const GAS_POST_CHAR_LIMIT = 4_900_000;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ACTIONS = new Set(['begin', 'chunk', 'finalize', 'setPublic', 'cleanup', 'readDiagnostics']);
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
const READ_FAILURE_CODES = new Set([
  'MEDIA_POC_READ_RESPONSE_INVALID', 'MEDIA_POC_READ_METADATA_INVALID', 'MEDIA_POC_READ_CHUNK_SIZE',
  'MEDIA_POC_READ_CHUNK_CHECKSUM', 'MEDIA_POC_READ_METADATA_MISMATCH', 'MEDIA_POC_READ_SIGNATURE',
  'MEDIA_POC_READ_FULL_CHECKSUM', 'MEDIA_POC_READ_STREAM_FAILED', 'MEDIA_POC_READ_UPSTREAM_HTTP',
  'MEDIA_POC_READ_UPSTREAM_RESPONSE_INVALID', 'MEDIA_POC_READ_UPSTREAM_TIMEOUT', 'MEDIA_POC_READ_UPSTREAM_FAILED'
]);
const READ_VALIDATION_CODES = new Set([
  'MEDIA_POC_READ_RESPONSE_INVALID', 'MEDIA_POC_READ_METADATA_INVALID', 'MEDIA_POC_READ_CHUNK_SIZE',
  'MEDIA_POC_READ_CHUNK_CHECKSUM', 'MEDIA_POC_READ_METADATA_MISMATCH', 'MEDIA_POC_READ_SIGNATURE',
  'MEDIA_POC_READ_FULL_CHECKSUM'
]);
const READ_DIAGNOSTIC_PHASES = new Set([
  'request_received', 'manifest_validated', 'oauth_token_started', 'oauth_token_acquired', 'oauth_token_failed',
  'drive_fetch_started', 'drive_fetch_failed', 'drive_fetch_completed', 'drive_range_validated', 'response_constructed', 'read_failed'
]);
const READ_DIAGNOSTIC_CODES = new Set([
  'INVALID_MEDIA_POC_REQUEST', 'MEDIA_POC_STATE_INVALID', 'MEDIA_POC_MEDIA_NOT_FOUND',
  'MEDIA_POC_MEDIA_NOT_PUBLIC', 'MEDIA_POC_MEDIA_INVALID', 'MEDIA_POC_MEDIA_READ_FAILED'
]);
const READ_DIAGNOSTIC_FAILURE_CLASSES = new Set([
  'authorization_required', 'external_request_permission', 'invalid_request_options',
  'url_fetch_runtime_failure', 'unknown_fetch_exception'
]);
const READ_DIAGNOSTIC_PHASE_KEYS = new Set(['phase', 'code', 'failureClass', 'httpStatus', 'expectedBytes', 'actualBytes', 'durationMs', 'chunkIndex']);
const GAS_TRANSPORT_STAGES = [
  'gas_request_started', 'gas_response_headers_received', 'gas_body_read_started',
  'gas_body_read_completed', 'gas_json_parsed'
] as const;
const GAS_TRANSPORT_FAILURE_CLASSES = [
  'fetch_wait', 'body_read', 'json_parse', 'upstream_http', 'network_runtime', 'unknown'
] as const;
type GasTransportStage = typeof GAS_TRANSPORT_STAGES[number];
type GasTransportFailureClass = typeof GAS_TRANSPORT_FAILURE_CLASSES[number];
type GasTransportTrace = { stages: GasTransportStage[]; failureClass?: GasTransportFailureClass };

type MediaPocReadFailureCode =
  | 'MEDIA_POC_READ_RESPONSE_INVALID'
  | 'MEDIA_POC_READ_METADATA_INVALID'
  | 'MEDIA_POC_READ_CHUNK_SIZE'
  | 'MEDIA_POC_READ_CHUNK_CHECKSUM'
  | 'MEDIA_POC_READ_METADATA_MISMATCH'
  | 'MEDIA_POC_READ_SIGNATURE'
  | 'MEDIA_POC_READ_FULL_CHECKSUM'
  | 'MEDIA_POC_READ_STREAM_FAILED'
  | 'MEDIA_POC_READ_UPSTREAM_HTTP'
  | 'MEDIA_POC_READ_UPSTREAM_RESPONSE_INVALID'
  | 'MEDIA_POC_READ_UPSTREAM_TIMEOUT'
  | 'MEDIA_POC_READ_UPSTREAM_FAILED';

class MediaPocReadError extends Error {
  constructor(readonly diagnosticCode: MediaPocReadFailureCode, readonly statusCode = 502) {
    super('Media proof-of-concept read failed');
    this.name = 'MediaPocReadError';
  }
}

function failRead(code: MediaPocReadFailureCode): never {
  throw new MediaPocReadError(code, code === 'MEDIA_POC_READ_UPSTREAM_TIMEOUT' ? 504 : 502);
}

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

async function callGas(action: string, args: unknown[], includeTiming: boolean, transport?: GasTransportTrace) {
  const endpoint = gasEndpoint();
  const secret = process.env.CXL_API_SHARED_SECRET || '';
  const ownerId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  if (!endpoint || !secret || !ownerId) throw Object.assign(new Error('not configured'), { statusCode: 503 });
  const payload = JSON.stringify({ authorization: secret, ownerUserId: ownerId, action: `media.poc.${action}`, args,
    ...(includeTiming && process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) });
  if (payload.length > GAS_POST_CHAR_LIMIT) throw Object.assign(new Error('request too large'), { statusCode: 413 });
  const startedAt = Date.now();
  transport?.stages.push('gas_request_started');
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(endpoint.toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: payload,
      redirect: 'follow', signal: AbortSignal.timeout(GAS_TIMEOUT_MS)
    });
  } catch (error) {
    if (transport) transport.failureClass = isTimeoutError(error) ? 'fetch_wait' : 'network_runtime';
    throw error;
  }
  transport?.stages.push('gas_response_headers_received');
  transport?.stages.push('gas_body_read_started');
  let responseText: string;
  try { responseText = await response.text(); }
  catch (error) {
    if (transport) transport.failureClass = 'body_read';
    throw error;
  }
  transport?.stages.push('gas_body_read_completed');
  try {
    if (!response.ok) {
      if (transport) transport.failureClass = 'upstream_http';
      if (action === 'ownerChunk' || action === 'publicChunk') failRead('MEDIA_POC_READ_UPSTREAM_HTTP');
      throw Object.assign(new Error('upstream error'), { statusCode: 502 });
    }
    let raw: unknown;
    try { raw = JSON.parse(responseText); }
    catch {
      if (transport) transport.failureClass = 'json_parse';
      if (action === 'ownerChunk' || action === 'publicChunk') failRead('MEDIA_POC_READ_UPSTREAM_RESPONSE_INVALID');
      throw Object.assign(new Error('invalid upstream response'), { statusCode: 502 });
    }
    transport?.stages.push('gas_json_parsed');
    if (!isRecord(raw) || raw.ok !== true) throw Object.assign(new Error('upstream operation failed'), gasError(raw));
    return { data: raw.data, timing: raw.meta && isRecord(raw.meta) ? raw.meta.timing : undefined, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    if (transport && !transport.failureClass) transport.failureClass = 'unknown';
    throw error;
  }
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

function isSafeReadDiagnostic(value: unknown): value is JsonRecord {
  if (!isRecord(value) || !hasOnlyKeys(value, ['action', 'phases'])
    || (value.action !== 'ownerChunk' && value.action !== 'publicChunk')
    || !Array.isArray(value.phases) || value.phases.length < 1 || value.phases.length > READ_DIAGNOSTIC_PHASES.size) return false;
  const seen = new Set<string>();
  for (const phase of value.phases) {
    if (!isRecord(phase) || !hasOnlyKeys(phase, [...READ_DIAGNOSTIC_PHASE_KEYS])
      || typeof phase.phase !== 'string' || !READ_DIAGNOSTIC_PHASES.has(phase.phase) || seen.has(phase.phase)) return false;
    seen.add(phase.phase);
    if ('code' in phase && (typeof phase.code !== 'string' || !READ_DIAGNOSTIC_CODES.has(phase.code))) return false;
    if ('failureClass' in phase && (phase.phase !== 'drive_fetch_failed'
      || typeof phase.failureClass !== 'string' || !READ_DIAGNOSTIC_FAILURE_CLASSES.has(phase.failureClass))) return false;
    if ('httpStatus' in phase && (typeof phase.httpStatus !== 'number' || !Number.isInteger(phase.httpStatus) || phase.httpStatus < 100 || phase.httpStatus > 599)) return false;
    if ('expectedBytes' in phase && (typeof phase.expectedBytes !== 'number' || !Number.isInteger(phase.expectedBytes) || phase.expectedBytes < 0 || phase.expectedBytes > CHUNK_BYTES)) return false;
    if ('actualBytes' in phase && (typeof phase.actualBytes !== 'number' || !Number.isInteger(phase.actualBytes) || phase.actualBytes < 0 || phase.actualBytes > MAX_FILE_BYTES)) return false;
    if ('durationMs' in phase && (typeof phase.durationMs !== 'number' || !Number.isInteger(phase.durationMs) || phase.durationMs < 0 || phase.durationMs > 600_000)) return false;
    if ('chunkIndex' in phase && (typeof phase.chunkIndex !== 'number' || !Number.isInteger(phase.chunkIndex) || phase.chunkIndex < 0 || phase.chunkIndex > 4)) return false;
  }
  return value.phases[0].phase === 'request_received';
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
    } else if (action === 'readDiagnostics') {
      if (!hasOnlyKeys(body, ['action'])) return sendJson(res, 400, { ok: false, error: 'Invalid read diagnostics request' });
      args = [];
    } else {
      if (!hasOnlyKeys(body, ['action'])) return sendJson(res, 400, { ok: false, error: 'Invalid cleanup request' });
      args = [];
    }
    const result = await callGas(action, args, true);
    if (action === 'readDiagnostics' && result.data !== null && !isSafeReadDiagnostic(result.data)) {
      return sendJson(res, 502, { ok: false, error: 'Media read diagnostics response was invalid' });
    }
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
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('error', onError);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (error?: Error) => { cleanup(); reject(error || new Error('stream failed')); };
    res.once('drain', onDrain);
    res.once('error', onError);
  });
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(error.message));
}

function readFailureCode(error: unknown): string {
  if (error instanceof MediaPocReadError && READ_FAILURE_CODES.has(error.diagnosticCode)) return error.diagnosticCode;
  if (isRecord(error) && typeof error.code === 'string' && SAFE_GAS_CODES.has(error.code)) return error.code;
  if (isTimeoutError(error)) {
    return 'MEDIA_POC_READ_UPSTREAM_TIMEOUT';
  }
  return 'MEDIA_POC_READ_UPSTREAM_FAILED';
}

function logSafeReadFailure(action: string, code: string, chunkIndex: number, startedAt: number) {
  if (process.env.VERCEL_ENV !== 'preview') return;
  const safeCode = READ_FAILURE_CODES.has(code) || SAFE_GAS_CODES.has(code) ? code : 'MEDIA_POC_READ_UPSTREAM_FAILED';
  const entry: Record<string, string | number> = {
    action: action === 'publicChunk' ? 'media.poc.publicChunk' : 'media.poc.ownerChunk',
    code: safeCode,
    elapsedMs: Math.max(0, Date.now() - startedAt)
  };
  if (Number.isInteger(chunkIndex) && chunkIndex >= 0 && chunkIndex <= 4) entry.chunkIndex = chunkIndex;
  console.warn(JSON.stringify(entry));
}

function readFailureStatus(error: unknown, code: string) {
  if (error instanceof MediaPocReadError) return error.statusCode;
  if (isRecord(error) && typeof error.status === 'number' && SAFE_GAS_CODES.has(String(error.code || ''))) return error.status;
  if (code === 'MEDIA_POC_READ_UPSTREAM_TIMEOUT') return 504;
  if (isRecord(error) && typeof error.statusCode === 'number') return error.statusCode;
  return 502;
}

function safeGasTransportFailure(transport?: GasTransportTrace) {
  if (process.env.VERCEL_ENV !== 'preview' || !transport?.failureClass
    || transport.stages.length < 1 || transport.stages.length > GAS_TRANSPORT_STAGES.length
    || !GAS_TRANSPORT_FAILURE_CLASSES.includes(transport.failureClass)
    || transport.stages.some(stage => !GAS_TRANSPORT_STAGES.includes(stage))) return null;
  return { stage: transport.stages[transport.stages.length - 1], failureClass: transport.failureClass, stages: [...transport.stages] };
}

function sendReadFailure(res: Response, error: unknown, code: string, transport?: GasTransportTrace) {
  if (isRecord(error) && typeof error.status === 'number' && typeof error.code === 'string' && SAFE_GAS_CODES.has(error.code)) {
    return controlledError(res, error);
  }
  const validationFailure = READ_VALIDATION_CODES.has(code);
  const status = readFailureStatus(error, code);
  const safeTransport = status === 502 || status === 504 ? safeGasTransportFailure(transport) : null;
  return sendJson(res, status, {
    ok: false,
    error: validationFailure ? 'Media proof-of-concept read validation failed' : 'Media proof-of-concept read request failed',
    code: READ_FAILURE_CODES.has(code) ? code : 'MEDIA_POC_READ_UPSTREAM_FAILED',
    ...(safeTransport ? { transport: safeTransport } : {})
  });
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
  let failedChunkIndex = 0;
  let transport: GasTransportTrace | undefined;
  try {
    for (let chunkIndex = 0; ; chunkIndex++) {
      failedChunkIndex = chunkIndex;
      const action = scope === 'owner' ? 'ownerChunk' : 'publicChunk';
      transport = { stages: [] };
      const result = await callGas(action, [{ workNonce, mediaId, ref, chunkIndex }], true, transport);
      if (isRecord(result.timing) && isRecord(result.timing.phases)) {
        for (const [phase, duration] of Object.entries(result.timing.phases)) {
          if (TIMING_PHASES.has(phase) && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
            phases[phase] = (phases[phase] || 0) + duration;
          }
        }
      }
      const data = result.data;
      if (!isRecord(data) || data.workId !== `asset_media_poc_${workNonce}` || data.mediaId !== mediaId || data.ref !== ref) {
        failRead('MEDIA_POC_READ_RESPONSE_INVALID');
      }
      if (typeof data.mimeType !== 'string' || !IMAGE_MIME_TYPES.has(data.mimeType)
        || typeof data.totalFileSize !== 'number' || !Number.isInteger(data.totalFileSize)
        || data.totalFileSize < 1 || data.totalFileSize > MAX_FILE_BYTES
        || !Number.isInteger(data.totalChunks) || data.totalChunks !== Math.ceil(data.totalFileSize / CHUNK_BYTES)
        || data.totalChunks > 5 || data.chunkIndex !== chunkIndex
        || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) {
        failRead('MEDIA_POC_READ_METADATA_INVALID');
      }
      const bytes = strictBase64(data.base64);
      const expectedLength = Math.min(CHUNK_BYTES, data.totalFileSize - chunkIndex * CHUNK_BYTES);
      if (!bytes || bytes.length !== expectedLength) failRead('MEDIA_POC_READ_CHUNK_SIZE');
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (typeof data.chunkSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.chunkSha256)
        || checksum !== data.chunkSha256.toLowerCase()) failRead('MEDIA_POC_READ_CHUNK_CHECKSUM');
      if (metadata && (metadata.mimeType !== data.mimeType || metadata.totalFileSize !== data.totalFileSize
        || metadata.totalChunks !== data.totalChunks || metadata.sha256 !== data.sha256)) failRead('MEDIA_POC_READ_METADATA_MISMATCH');
      metadata ||= data;
      if (chunkIndex === 0 && !supportedSignature(data.mimeType, bytes)) failRead('MEDIA_POC_READ_SIGNATURE');
      fullDigest.update(bytes);
      phases[scope === 'owner' ? 'owner_media_read' : 'public_media_read'] = (phases[scope === 'owner' ? 'owner_media_read' : 'public_media_read'] || 0) + result.elapsedMs;
      if (chunkIndex === 0) {
        res.statusCode = 200;
        res.setHeader('Content-Type', data.mimeType);
        res.setHeader('Content-Length', String(data.totalFileSize));
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      let accepted: boolean;
      try { accepted = res.write(bytes); }
      catch { failRead('MEDIA_POC_READ_STREAM_FAILED'); }
      if (!accepted) {
        try { await waitForDrain(res); }
        catch { failRead('MEDIA_POC_READ_STREAM_FAILED'); }
      }
      if (chunkIndex + 1 === data.totalChunks) break;
    }
    if (!metadata || fullDigest.digest('hex') !== String(metadata.sha256).toLowerCase()) failRead('MEDIA_POC_READ_FULL_CHECKSUM');
    logSafeTiming(scope === 'owner' ? 'media.poc.ownerChunk' : 'media.poc.publicChunk', phases, startedAt);
    return res.end();
  } catch (error) {
    const code = readFailureCode(error);
    logSafeReadFailure(scope === 'public' ? 'publicChunk' : 'ownerChunk', code, failedChunkIndex, startedAt);
    if (res.headersSent) return res.destroy(new Error('Media proof-of-concept stream failed'));
    return sendReadFailure(res, error, code, transport);
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
