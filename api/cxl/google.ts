import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Asset } from '../../src/types';
import type { FetchAssetsOptions } from '../../src/lib/supabaseService';
import { directOwnerReadsEnabled, directOwnerWorksFetch, directPublicReadsEnabled, directPublicWorkDetail, directPublicWorksList, verifyOwnerWriteCommitted } from './googleDirect.js';
import { filterGoogleWorks } from '../../src/data/googleWorksRead.js';
import { cookieValue, OWNER_SESSION_COOKIE, selectOwnerAuthMode, verifyCsrfRequest, verifyOwnerSessionToken } from '../../src/server/cxlOwnerAuth.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse & { json?: (body: unknown) => void };
const ALLOWED_OPTIONS = new Set(['userId','currentUserId','creatorSlug','assetId','category','folderId','search','includeDeleted','onlyDeleted','publicOnly','limit','detail']);
const PUBLIC_ACTIONS = new Set(['profiles.getCreator','profiles.getPublic','settings.readCreatorSpace']);
const MEDIA_UPLOAD_ACTIONS = new Set(['media.upload.begin','media.upload.chunk','media.upload.finalize']);
const MEDIA_CLEANUP_ACTION = 'media.cleanup';
const MEDIA_REPAIR_ACTION = 'media.work.repairDeliveryChunks';
const WORK_DELETE_ACTIONS = new Set(['works.softDelete','works.restore','works.permanentDelete']);
const OWNER_ACTIONS = new Set(['works.create','works.update', ...WORK_DELETE_ACTIONS, 'folders.fetch','public.snapshot.rebuild', ...MEDIA_UPLOAD_ACTIONS, MEDIA_CLEANUP_ACTION, MEDIA_REPAIR_ACTION]);
const GAS_TIMEOUT_MS = 30_000;
const OWNER_TIMING_ACTIONS = new Set(['works.fetch','folders.fetch','works.create','works.update', ...WORK_DELETE_ACTIONS]);
const OWNER_TIMING_PHASES = new Set(['auth_request_validation','existing_work_index_lookup','canonical_drive_json_read','revision_idempotency_validation','write_payload_prepare','search_artifact_generation','search_chunk_write','stale_search_cleanup','drive_revision_write','private_index_update','private_public_transition','public_projection_sync','response_construction','owner_index_read','owner_search_index_read','summary_parse_projection','folders_drive_read','folders_projection','script_lock_wait','locked_revision_read']);

function send(res: Response, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function workMediaEnabled() {
  return process.env.VERCEL_ENV === 'preview' || process.env.CXL_GOOGLE_WORK_MEDIA_ENABLED === '1';
}
function previewOwnerServerTiming(res: Response, raw: unknown, requestedAction: string) {
  if (process.env.VERCEL_ENV !== 'preview' || !record(raw) || !record(raw.meta) || !record(raw.meta.timing)) return;
  const timing = raw.meta.timing;
  if (timing.action !== requestedAction || !OWNER_TIMING_ACTIONS.has(requestedAction) || typeof timing.totalMs !== 'number'
    || !Number.isFinite(timing.totalMs) || timing.totalMs < 0 || !record(timing.phases)) return;
  const metrics = Object.entries(timing.phases).flatMap(([phase, duration]) => OWNER_TIMING_PHASES.has(phase)
    && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
    ? [`${phase};dur=${duration.toFixed(2)}`] : []);
  metrics.push(`cxl_action;desc="${requestedAction}"`, `total;dur=${timing.totalMs.toFixed(2)}`);
  res.setHeader('Server-Timing', metrics.join(', '));
}
/** Preview-only: log Apps Script phase durations (allow-listed phase names and ms only). */
function logOwnerPhaseTiming(raw: unknown, requestedAction: string) {
  if (process.env.VERCEL_ENV !== 'preview' || !record(raw) || !record(raw.meta) || !record(raw.meta.timing)) return;
  const timing = raw.meta.timing;
  if (timing.action !== requestedAction || !record(timing.phases)) return;
  const phases = Object.fromEntries(Object.entries(timing.phases).filter(([phase, duration]) =>
    OWNER_TIMING_PHASES.has(phase) && typeof duration === 'number' && Number.isFinite(duration)).map(([phase, duration]) => [phase, Math.round(duration as number)]));
  console.info(JSON.stringify({ event: 'cxl_gas_phase_timing', action: requestedAction, totalMs: typeof timing.totalMs === 'number' ? Math.round(timing.totalMs) : -1, phases }));
}
function validOptions(value: unknown): value is FetchAssetsOptions {
  return record(value) && Object.keys(value).every(key => ALLOWED_OPTIONS.has(key))
    && ['userId','currentUserId','creatorSlug','assetId','category','search'].every(key => value[key] === undefined || (typeof value[key] === 'string' && value[key].length <= 256))
    && (value.detail === undefined || value.detail === 'summary' || value.detail === 'full')
    && (value.folderId === undefined || value.folderId === null || typeof value.folderId === 'string')
    && (value.limit === undefined || (typeof value.limit === 'number' && Number.isFinite(value.limit)))
    && ['includeDeleted','onlyDeleted','publicOnly'].every(key => value[key] === undefined || typeof value[key] === 'boolean');
}
function gasEndpoint(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com'
      || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)) return null;
    // A slash after /exec can cause an HTTP redirect that turns POST into GET.
    url.pathname = url.pathname.replace(/\/$/, '');
    return url;
  } catch { return null; }
}
function parseBody(req: Request): unknown {
  if (record(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return null;
}
async function verifyOwner(accessToken: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const ownerId = process.env.CXL_OWNER_USER_ID;
  if (!url || !anonKey || !ownerId || !accessToken) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.getUser(accessToken);
    return !error && data.user?.id === ownerId ? data.user.id : null;
  } catch { return null; }
}
// Apps Script usually answers reads in ~1-2s, but the googleusercontent hop sometimes
// stalls until its one-time URL expires (404). Retry reads with short budgets;
// writes are never retried so a stalled response cannot duplicate a mutation.
// Snapshot-only reads answer in ~1.5s; public detail touches Drive and takes ~3-7s.
// Owner reads (the full profile/Vault list) can legitimately exceed 10s, so they keep
// a long budget: a short cut-off hid private Works and left cards without a revision.
function readRetryPlan(action: string): { timeoutMs: number; attempts: number } | null {
  if (action === 'works.fetch' || action === 'folders.fetch') return { timeoutMs: 25_000, attempts: 1 };
  if (action === 'public.works.detail') return { timeoutMs: 10_000, attempts: 2 };
  if (action.startsWith('public.')) return { timeoutMs: 5_000, attempts: 3 };
  return null;
}
async function gasJson(url: string, init: RequestInit, action: string) {
  const plan = readRetryPlan(action);
  if (!plan) return gasJsonAttempt(url, init, action, GAS_TIMEOUT_MS, 1);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await gasJsonAttempt(url, init, action, plan.timeoutMs, attempt);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const retryable = (error instanceof Error && error.name === 'TimeoutError') || /time.?out|HTTP 404|HTTP 5\d\d/i.test(message);
      if (!retryable || attempt >= plan.attempts) throw error;
    }
  }
}
async function gasJsonAttempt(url: string, init: RequestInit, action: string, timeoutMs: number, attempt: number) {
  const started = Date.now();
  let finalHop = '';
  let outcome = 'error';
  let postMs = -1;
  let echoMs = -1;
  try {
    // ContentService answers the POST with a 302 to a one-time googleusercontent URL,
    // which is read with GET, as Google documents. The POST leg is taken manually only
    // to time the two legs separately; the echo leg still follows redirects normally.
    // gasEndpoint() strips a trailing /exec/ slash, whose extra redirect would reach doGet().
    const signal = AbortSignal.timeout(timeoutMs);
    let response = await fetch(url, { ...init, redirect: 'manual', signal });
    postMs = Date.now() - started;
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    if (location && new URL(location, url).hostname === 'script.googleusercontent.com') {
      const echoStarted = Date.now();
      // Do not re-request a stalled echo URL: Google then routes it to doGet() (METHOD_NOT_ALLOWED).
      response = await fetch(new URL(location, url), { method: 'GET', redirect: 'follow', signal });
      echoMs = Date.now() - echoStarted;
    } else if (response.status >= 300 && response.status < 400) {
      // Never re-send the POST: a write could run twice. Surface the unexpected shape instead.
      outcome = `redirect_${response.status}`;
      throw new Error('Google Apps Script redirected to an unexpected destination');
    }
    try { const final = new URL(response.url); finalHop = `${final.hostname}${final.pathname}`.replace(/\/macros\/s\/[^/]+\//, '/macros/s/*/'); } catch { /* diagnostics only */ }
    const text = await response.text();
    if (!response.ok) { outcome = `http_${response.status}`; throw new Error(`Google Apps Script responded with HTTP ${response.status}`); }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { outcome = 'malformed_json'; throw new Error('Google Apps Script returned malformed JSON'); }
    outcome = record(parsed) && parsed.ok === true ? 'ok'
      : record(parsed) && typeof parsed.code === 'string' && /^[A-Z_]{1,64}$/.test(parsed.code) ? parsed.code : 'not_ok';
    return parsed;
  } finally {
    // Runtime diagnostics deliberately omit endpoint URLs, payloads, IDs, and credentials.
    console.info(JSON.stringify({ event: 'cxl_gas_request_timing', action, elapsedMs: Date.now() - started, finalHop, outcome, attempt, postMs, echoMs }));
  }
}
/**
 * Apps Script writes take ~16-18s and their response sometimes never arrives.
 * From 2s on, also poll the read-only Sheets/Drive state every 1.5s; whichever
 * confirms first wins. Before the commit none of the checks can match, and a
 * committed write is reported with the same data shape Apps Script returns.
 * Logs showed writes already committed at the first 8s check, so start early.
 */
const WRITE_VERIFY_START_MS = 2_000;
const WRITE_VERIFY_INTERVAL_MS = 1_500;
async function raceWriteWithVerification(gasCall: Promise<unknown>, action: string, args: unknown[]): Promise<unknown> {
  let settled = false;
  gasCall.then(() => { settled = true; }, () => { settled = true; });
  const verified = (async () => {
    await new Promise(resolve => setTimeout(resolve, WRITE_VERIFY_START_MS));
    for (let check = 0; !settled; check += 1) {
      try {
        const committed = await verifyOwnerWriteCommitted(action, args);
        console.info(JSON.stringify({ event: 'cxl_write_verify', action, check, committed: committed !== null }));
        if (committed !== null) return { ok: true, data: committed };
      } catch (error) {
        console.info(JSON.stringify({ event: 'cxl_write_verify_failed', action, reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
      }
      await new Promise(resolve => setTimeout(resolve, WRITE_VERIFY_INTERVAL_MS));
    }
    return new Promise<never>(() => undefined); // Apps Script answered first; never resolve.
  })();
  return Promise.race([gasCall, verified]);
}
function validPublicActionArgs(action: string, args: unknown[]): boolean {
  if (action === 'profiles.getCreator') return args.length === 1 && typeof args[0] === 'string' && args[0].length <= 128;
  if (action === 'profiles.getPublic') return args.length === 1 && Array.isArray(args[0]) && args[0].length <= 100
    && args[0].every(id => typeof id === 'string' && /^cxlc_[a-f0-9]{32}$/i.test(id));
  if (action === 'settings.readCreatorSpace') return args.length === 1 && typeof args[0] === 'string'
    && /^cxlc_[a-f0-9]{32}$/i.test(args[0]);
  return false;
}
export function publicOwnerGasRequest(action: string, args: unknown[], ownerUserId?: string, includeTiming = false) {
  const endpoint = gasEndpoint(process.env.CXL_GAS_OWNER_URL);
  const secret = process.env.CXL_API_SHARED_SECRET;
  const configuredOwnerId = ownerUserId || process.env.CXL_OWNER_USER_ID?.trim();
  if (!endpoint || !secret || !configuredOwnerId) throw Object.assign(new Error('Google owner API is not configured on the server'), { status: 503 });
  return gasJson(endpoint.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorization: secret, ownerUserId: configuredOwnerId, action, args,
      ...(includeTiming && process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) }) }, action);
}
/**
 * Public list/detail reads: use the direct Sheets/Drive path when configured and
 * fall back to Apps Script on any failure. Returns the Apps Script response shape.
 */
async function publicReadRequest(action: string, args: unknown[], ownerUserId?: string, includeTiming = false): Promise<unknown> {
  if (directPublicReadsEnabled() && (action === 'public.works.list' || (action === 'public.works.detail' && typeof args[0] === 'string'))) {
    const started = Date.now();
    try {
      const data = action === 'public.works.list' ? await directPublicWorksList() : await directPublicWorkDetail(args[0] as string);
      console.info(JSON.stringify({ event: 'cxl_direct_public_read', action, elapsedMs: Date.now() - started, used: true }));
      return data === null
        ? { ok: false, error: 'Work is not publicly available', code: 'WORK_NOT_FOUND' }
        : { ok: true, data };
    } catch (error) {
      console.info(JSON.stringify({ event: 'cxl_direct_read_failed', action, reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
    }
  }
  return publicOwnerGasRequest(action, args, ownerUserId, includeTiming);
}
function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
function validMediaIds(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length <= 20
    && value.every(id => validRequestId(id)) && new Set(value).size === value.length);
}
function validMediaUploadArgs(action: string, args: unknown[]): boolean {
  if (action === 'media.upload.begin') {
    if (args.length !== 1 || !record(args[0])) return false;
    const input = args[0];
    const allowed = new Set(['uploadId','mediaId','workId','totalFileSize','rawChunkSize','totalChunks','mimeType','sha256','purpose','contextId','sortOrder','isCover']);
    return Object.keys(input).every(key => allowed.has(key))
      && validRequestId(input.uploadId) && validRequestId(input.mediaId)
      && typeof input.workId === 'string' && /^asset_[A-Za-z0-9_-]{1,96}$/.test(input.workId)
      && Number.isInteger(input.totalFileSize) && Number(input.totalFileSize) >= 1 && Number(input.totalFileSize) <= 10 * 1024 * 1024
      && input.rawChunkSize === 2 * 1024 * 1024
      && Number.isInteger(input.totalChunks) && Number(input.totalChunks) === Math.ceil(Number(input.totalFileSize) / (2 * 1024 * 1024))
      && Number(input.totalChunks) >= 1 && Number(input.totalChunks) <= 5
      && ['image/jpeg','image/png','image/webp','image/gif'].includes(String(input.mimeType))
      && typeof input.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(input.sha256)
      && ['icon','gallery','prompt_example','collab_reference'].includes(String(input.purpose))
      && (input.contextId === undefined || input.contextId === null || (typeof input.contextId === 'string' && input.contextId.length <= 128))
      && Number.isInteger(input.sortOrder) && Number(input.sortOrder) >= 0 && Number(input.sortOrder) <= 20
      && typeof input.isCover === 'boolean';
  }
  if (action === 'media.upload.chunk') {
    if (args.length !== 1 || !record(args[0])) return false;
    const input = args[0];
    const maxBase64Length = 4 * Math.ceil((2 * 1024 * 1024) / 3);
    return Object.keys(input).every(key => ['uploadId','chunkIndex','base64','sha256'].includes(key))
      && validRequestId(input.uploadId) && Number.isInteger(input.chunkIndex)
      && Number(input.chunkIndex) >= 0 && Number(input.chunkIndex) <= 4
      && typeof input.base64 === 'string' && input.base64.length > 0 && input.base64.length <= maxBase64Length
      && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64)
      && typeof input.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(input.sha256);
  }
  if (action === 'media.upload.finalize') return args.length === 1 && record(args[0])
    && Object.keys(args[0]).length === 1 && validRequestId(args[0].uploadId);
  return false;
}
function validWorkWriteOptions(action: string, value: unknown): boolean {
  if (!record(value) || !validRequestId(value.requestId) || !validMediaIds(value.mediaIds)) return false;
  const allowed = new Set(action === 'works.create' ? ['requestId','mediaIds'] : ['requestId','expectedRevision','mediaIds']);
  return Object.keys(value).every(key => allowed.has(key))
    && (action !== 'works.update' || (Number.isInteger(value.expectedRevision) && Number(value.expectedRevision) >= 1));
}
function validOwnerActionArgs(action: string, args: unknown[], ownerId: string, authMode: 'supabase' | 'vercel'): boolean {
  if (action === 'public.snapshot.rebuild') return authMode === 'vercel' && args.length === 0;
  if (action === 'folders.fetch') return authMode === 'vercel'
    ? args.length === 0
    : args.length === 1 && (args[0] === undefined || args[0] === ownerId);
  if (action === 'works.create') return args.length === 2 && record(args[0]) && validWorkWriteOptions(action, args[1]);
  if (action === 'works.update') return args.length === 3 && typeof args[0] === 'string' && /^asset_[A-Za-z0-9_-]{1,96}$/.test(args[0])
    && record(args[1]) && validWorkWriteOptions(action, args[2]);
  if (action === 'works.softDelete' || action === 'works.restore' || action === 'works.permanentDelete') {
    return args.length === 1 && typeof args[0] === 'string' && /^asset_[A-Za-z0-9_-]{1,96}$/.test(args[0]);
  }
  if (action === MEDIA_CLEANUP_ACTION || action === MEDIA_REPAIR_ACTION) return args.length === 0;
  if (MEDIA_UPLOAD_ACTIONS.has(action)) return validMediaUploadArgs(action, args);
  return false;
}
function ownerErrorStatus(code: unknown): number {
  if (code === 'OWNER_API_UNAUTHORIZED') return 401;
  if (code === 'INVALID_JSON' || code === 'INVALID_REQUEST' || code === 'UNSUPPORTED_ACTION') return 400;
  if (code === 'REVISION_CONFLICT' || code === 'PUBLIC_SYNC_PENDING' || code === 'IDEMPOTENCY_KEY_REUSED' || code === 'CREATOR_MAPPING_CONFLICT') return 409;
  if (code === 'WORK_NOT_FOUND') return 404;
  if (code === 'WORK_NOT_IN_TRASH') return 409;
  if (code === 'PUBLIC_SNAPSHOT_NOT_READY' || code === 'PUBLIC_SNAPSHOT_NOT_CONFIGURED' || code === 'PUBLIC_SNAPSHOT_WRITE_FAILED') return 503;
  if (code === 'WORK_NOT_OWNED') return 403;
  if (code === 'UNSUPPORTED_MEDIA_MUTATION' || code === 'UNSUPPORTED_COLLAB_DRAFT') return 422;
  if (code === 'CREATOR_MAPPING_MISSING' || code === 'CREATOR_MAPPING_AMBIGUOUS' || code === 'FOLDER_SCHEMA_INVALID') return 503;
  if (code === 'OWNER_REQUIRED') return 401;
  if (code === 'MEDIA_UPLOAD_NOT_CONFIGURED' || code === 'MEDIA_UPLOAD_FOLDER_NOT_PRIVATE') return 503;
  if (code === 'WORK_MEDIA_CACHE_INVALIDATION_FAILED') return 503;
  if (code === 'MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT' || code === 'MEDIA_UPLOAD_SESSION_EXPIRED' || code === 'MEDIA_UPLOAD_SESSION_CLOSED') return 409;
  if (code === 'MEDIA_UPLOAD_CHUNK_CHECKSUM' || code === 'MEDIA_UPLOAD_CHUNK_CONFLICT' || code === 'MEDIA_UPLOAD_FINAL_CHECKSUM' || code === 'MEDIA_UPLOAD_MIME_MISMATCH') return 422;
  if (typeof code === 'string' && code.startsWith('INVALID_MEDIA_UPLOAD')) return 400;
  if (code === 'INVALID_FOLDER' || code === 'INVALID_WORK' || code === 'INVALID_COLLAB_DRAFT' || code === 'INVALID_REQUEST_ID' || code === 'REVISION_REQUIRED') return 400;
  return 502;
}
export function validateAssetList(value: unknown): Asset[] {
  if (!Array.isArray(value) || value.some(item => !record(item)
    || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.category !== 'string'
    || typeof item.status !== 'string' || typeof item.visibility !== 'string' || typeof item.isPublic !== 'boolean'
    || !Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string') || typeof item.content !== 'string' || !Array.isArray(item.previewImages)
    || !Array.isArray(item.contentBlocks) || !Array.isArray(item.media))) {
    throw new Error('Google Works response does not match the CXL Asset list shape');
  }
  return value as Asset[];
}

/** Read the anonymous, sanitized public snapshot for the cacheable GET route. */
export async function fetchPublicWorksSnapshot() {
  const handlerStartedAt = Date.now();
  const gasStartedAt = Date.now();
  const raw = await publicReadRequest('public.works.list', [{}], undefined, true);
  const gasElapsedMs = Date.now() - gasStartedAt;
  const validationStartedAt = Date.now();
  if (!record(raw) || raw.ok !== true) {
    const error = Object.assign(new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google public API response is malformed'), {
      status: record(raw) && typeof raw.httpStatus === 'number' ? raw.httpStatus : ownerErrorStatus(record(raw) ? raw.code : undefined)
    });
    throw error;
  }
  const works = filterGoogleWorks(validateAssetList(raw.data), { publicOnly: true, detail: 'summary' }).map(work => {
    const sanitized = { ...work, userId: '', collaboration: null, versions: [] };
    delete sanitized.folderId;
    delete sanitized.revision;
    delete sanitized.qaStorageKey;
    delete sanitized.linkedAssetIds;
    return sanitized;
  });
  const responseValidationMs = Date.now() - validationStartedAt;
  const gasTiming = process.env.VERCEL_ENV === 'preview' && record(raw.meta) && record(raw.meta.timing)
    ? raw.meta.timing : undefined;
  return {
    works,
    timing: {
      handlerStartToGasMs: gasStartedAt - handlerStartedAt,
      gasElapsedMs,
      responseValidationMs,
      gas: gasTiming
    }
  };
}

/** Anonymous public Work detail for the cacheable GET route; same data as an anonymous works.fetch. */
export async function fetchPublicWorkDetail(assetId: string) {
  const raw = await publicReadRequest('public.works.detail', [assetId]);
  if (!record(raw) || raw.ok !== true) {
    throw Object.assign(new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google public API response is malformed'), {
      status: ownerErrorStatus(record(raw) ? raw.code : undefined)
    });
  }
  return filterGoogleWorks(validateAssetList([raw.data]), { assetId, detail: 'full', limit: 1 });
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  let body: unknown;
  try { body = parseBody(req); } catch { return send(res, 400, { ok: false, error: 'Malformed JSON request' }); }
  if (!record(body) || typeof body.action !== 'string' || !Array.isArray(body.args))
    return send(res, 400, { ok: false, error: 'Invalid public read request' });
  const action = body.action;
  if (!PUBLIC_ACTIONS.has(action) && !OWNER_ACTIONS.has(action) && action !== 'works.fetch')
    return send(res, 400, { ok: false, error: 'Only supported public reads are available through this endpoint' });
  if (PUBLIC_ACTIONS.has(action)) {
    if (!validPublicActionArgs(action, body.args)) return send(res, 400, { ok: false, error: `Invalid ${action} request` });
    try {
      const response = await publicOwnerGasRequest(`public.${action}`, body.args);
      if (!record(response) || response.ok !== true) return send(res, ownerErrorStatus(record(response) ? response.code : undefined), {
        ok: false, error: record(response) && typeof response.error === 'string' ? response.error.slice(0, 300) : 'Google public read failed',
        ...(record(response) && typeof response.code === 'string' ? { code: response.code } : {})
      });
      return send(res, 200, { ok: true, data: response.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google public read failed';
      const status = record(error) && typeof error.status === 'number' ? error.status
        : (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
      return send(res, status, { ok: false, error: message.slice(0, 300) });
    }
  }
  if (OWNER_ACTIONS.has(action)) {
    if (action === MEDIA_REPAIR_ACTION && process.env.VERCEL_ENV !== 'preview')
      return send(res, 404, { ok: false, error: 'Work media repair is available only in Preview' });
    if ((MEDIA_UPLOAD_ACTIONS.has(action) || action === MEDIA_CLEANUP_ACTION || ((action === 'works.create' || action === 'works.update')
      && record(body.args[action === 'works.create' ? 1 : 2]) && Array.isArray((body.args[action === 'works.create' ? 1 : 2] as Record<string, unknown>).mediaIds)
      && ((body.args[action === 'works.create' ? 1 : 2] as Record<string, unknown>).mediaIds as unknown[]).length > 0))
      && !workMediaEnabled()) {
      return send(res, 404, { ok: false, error: 'Google Work media writes are not enabled for this deployment' });
    }
    const authMode = selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND);
    if (action === MEDIA_REPAIR_ACTION && authMode !== 'vercel')
      return send(res, 503, { ok: false, error: 'Owner session authentication is required for Work media repair' });
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const ownerUserId = process.env.CXL_OWNER_USER_ID?.trim() || '';
    const configured = authMode === 'vercel'
      ? Boolean(ownerUserId && process.env.CXL_OWNER_GOOGLE_SUB?.trim() && (process.env.CXL_OWNER_SESSION_SECRET || '').length >= 32)
      : Boolean(ownerUserId && process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
    if (!configured) return send(res, 503, { ok: false, error: 'Owner authentication is not configured on the server' });
    if (authMode === 'vercel' && bearer) return send(res, 401, { ok: false, error: 'Bearer authentication is not accepted in Vercel Owner mode' });
    if (authMode === 'supabase' && !bearer) return send(res, 401, { ok: false, error: 'Owner authentication required' });
    const authenticatedOwnerId = authMode === 'vercel'
      ? (verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE)) ? ownerUserId : null)
      : await verifyOwner(bearer);
    if (!authenticatedOwnerId) return send(res, 401, { ok: false, error: 'Valid owner authentication required' });
    if (authMode === 'supabase' && authenticatedOwnerId !== ownerUserId) return send(res, 403, { ok: false, error: 'Authenticated user is not the configured Owner' });
    if (!validOwnerActionArgs(action, body.args, authenticatedOwnerId, authMode))
      return send(res, 400, { ok: false, error: `Invalid ${action} request` });
    if ((action === 'works.create' || action === 'works.update' || WORK_DELETE_ACTIONS.has(action) || action === 'public.snapshot.rebuild' || MEDIA_UPLOAD_ACTIONS.has(action) || action === MEDIA_CLEANUP_ACTION || action === MEDIA_REPAIR_ACTION) && authMode === 'vercel'
      && !verifyCsrfRequest(req.headers.origin, process.env.CXL_OWNER_APP_ORIGIN?.trim() || '', req.headers.cookie, req.headers['x-cxl-csrf'] as string | undefined)) {
      return send(res, 403, { ok: false, error: 'Request origin or CSRF token is invalid' });
    }
    const endpoint = gasEndpoint(process.env.CXL_GAS_OWNER_URL);
    const secret = process.env.CXL_API_SHARED_SECRET;
    if (!endpoint || !secret) return send(res, 503, { ok: false, error: 'Google owner API is not configured on the server' });
    try {
      const ownerArgs = action === 'folders.fetch' ? []
        : action === 'works.create' && authMode === 'vercel'
          ? [{ ...(body.args[0] as Record<string, unknown>), userId: authenticatedOwnerId }, body.args[1]]
          : action === 'works.update' && authMode === 'vercel'
            ? body.args
            : body.args;
      const gasCall = gasJson(endpoint.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization: secret, ownerUserId: authenticatedOwnerId, action, args: ownerArgs,
          ...(process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) }) }, action);
      const raw = (action === 'works.create' || action === 'works.update' || WORK_DELETE_ACTIONS.has(action)) && directOwnerReadsEnabled()
        // Log phases even when the direct verification answers first.
        ? (gasCall.then(result => logOwnerPhaseTiming(result, action), () => undefined),
          await raceWriteWithVerification(gasCall, action, body.args))
        : await gasCall;
      previewOwnerServerTiming(res, raw, action);
      if (!record(raw) || raw.ok !== true) {
        if (action === MEDIA_REPAIR_ACTION) return send(res, 502, { ok: false, error: 'Work media repair failed' });
        const code = record(raw) ? raw.code : undefined;
        const message = record(raw) && typeof raw.error === 'string' ? raw.error : 'Google owner API response is malformed';
        return send(res, ownerErrorStatus(code), { ok: false, error: message.slice(0, 300), ...(code ? { code } : {}),
          ...(record(raw) && raw.privateSaved === true ? { privateSaved: true, workId: typeof raw.workId === 'string' ? raw.workId : undefined } : {}) });
      }
      if (action === MEDIA_REPAIR_ACTION) {
        const counts = raw.data;
        if (!record(counts) || !['processed','repaired','skipped','remaining'].every(key => Number.isInteger(counts[key]) && Number(counts[key]) >= 0)
          || Object.keys(counts).some(key => !['processed','repaired','skipped','remaining'].includes(key)))
          return send(res, 502, { ok: false, error: 'Work media repair response is invalid' });
        return send(res, 200, { ok: true, data: { processed: counts.processed, repaired: counts.repaired, skipped: counts.skipped, remaining: counts.remaining } });
      }
      return send(res, 200, { ok: true, data: raw.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google owner request failed';
      const status = (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
      if (action === MEDIA_REPAIR_ACTION) return send(res, status, { ok: false, error: status === 504 ? 'Work media repair timed out' : 'Work media repair failed' });
      // The Apps Script response often never arrives although the write committed.
      // Confirm through the read-only Sheets/Drive path before reporting a failure.
      if ((action === 'works.create' || action === 'works.update' || WORK_DELETE_ACTIONS.has(action)) && directOwnerReadsEnabled()) {
        for (let check = 0; check < 4; check += 1) {
          if (check) await new Promise(resolve => setTimeout(resolve, 2_500));
          try {
            const committed = await verifyOwnerWriteCommitted(action, body.args);
            console.info(JSON.stringify({ event: 'cxl_write_verify', action, check, committed: committed !== null }));
            if (committed !== null) return send(res, 200, { ok: true, data: committed });
          } catch (verifyError) {
            console.info(JSON.stringify({ event: 'cxl_write_verify_failed', action, reason: verifyError instanceof Error ? verifyError.message.slice(0, 120) : 'unknown' }));
          }
        }
      }
      return send(res, status, { ok: false, error: message.slice(0, 300) });
    }
  }
  if (body.args.length > 1) return send(res, 400, { ok: false, error: 'Invalid works.fetch request' });
  const optionsValue = body.args[0] === undefined ? {} : body.args[0];
  if (!validOptions(optionsValue)) return send(res, 400, { ok: false, error: 'Invalid works.fetch options' });
  const options = optionsValue as FetchAssetsOptions;
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const authMode = selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND);
  const ownerUserId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  const hasOwnerAuthConfig = authMode === 'vercel'
    ? Boolean(ownerUserId && process.env.CXL_OWNER_GOOGLE_SUB?.trim() && (process.env.CXL_OWNER_SESSION_SECRET || '').length >= 32)
    : Boolean(ownerUserId && process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
  if (bearer && !hasOwnerAuthConfig) {
    return send(res, 503, { ok: false, error: 'Owner authentication is not configured on the server' });
  }
  if (authMode === 'vercel' && bearer) return send(res, 401, { ok: false, error: 'Bearer authentication is not accepted in Vercel Owner mode' });
  const ownerId = authMode === 'vercel'
    ? (verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE)) ? ownerUserId : null)
    : bearer ? await verifyOwner(bearer) : null;
  if (bearer && !ownerId) return send(res, 401, { ok: false, error: 'Valid owner authentication required' });
  if (authMode === 'vercel' && ownerId) {
    if (options.userId) options.userId = ownerId;
    if (options.currentUserId) options.currentUserId = ownerId;
  }
  const requestsOwnerScope = Boolean(options.onlyDeleted || options.includeDeleted
    || options.currentUserId?.trim()
    || (options.userId?.trim() && (!ownerUserId || options.userId === ownerUserId)));
  if (requestsOwnerScope && !ownerId) {
    return send(res, 401, { ok: false, error: options.onlyDeleted || options.includeDeleted
      ? 'Owner authentication required for private/trash reads'
      : 'Owner authentication required for private Works' });
  }
  if (authMode === 'supabase' && ownerId && options.currentUserId && options.currentUserId !== ownerId) return send(res, 403, { ok: false, error: 'Current user does not match the authenticated owner' });
  let publicCreatorSlug: string | null = null;
  if (options.creatorSlug) {
    let decoded = '';
    try { decoded = decodeURIComponent(options.creatorSlug).trim(); } catch { return send(res, 400, { ok: false, error: 'Invalid creator slug' }); }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded)) {
      const slug = decoded.replace(/^@+/, '').toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(slug) || options.userId || options.currentUserId
        || options.includeDeleted || options.onlyDeleted || options.folderId !== undefined) {
        return send(res, 400, { ok: false, error: 'Invalid public creator Works request' });
      }
      publicCreatorSlug = slug;
    } else {
      if (decoded !== ownerUserId) return send(res, 501, { ok: false, error: 'Public creator lookup requires the Profiles read capability' });
      if (!ownerId) return send(res, 401, { ok: false, error: 'Owner authentication required for owner profile Works' });
    }
  }
  if (options.userId && options.userId !== ownerUserId) {
    return send(res, 501, { ok: false, error: 'Public creator filtering requires the Profiles read capability' });
  }
  const ownerScope = Boolean(!publicCreatorSlug && ownerId && (authMode === 'vercel' || !options.userId || options.userId === ownerId) && !options.publicOnly);

  try {
    let raw: unknown;
    let directWorks: unknown[] | null = null;
    if (ownerScope && directOwnerReadsEnabled()) {
      const started = Date.now();
      try {
        directWorks = await directOwnerWorksFetch({ ...options, ...(authMode === 'vercel' ? { userId: ownerId } : {}), currentUserId: ownerId } as Record<string, unknown>);
      } catch (error) {
        // Fall back to Apps Script; log only the error class, never IDs or payloads.
        console.info(JSON.stringify({ event: 'cxl_direct_read_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
      }
      console.info(JSON.stringify({ event: 'cxl_direct_read_timing', detail: Boolean(options.assetId), elapsedMs: Date.now() - started, used: directWorks !== null }));
    }
    if (directWorks) {
      raw = directWorks;
    } else if (ownerScope) {
      const endpoint = gasEndpoint(process.env.CXL_GAS_OWNER_URL);
      const secret = process.env.CXL_API_SHARED_SECRET;
      if (!endpoint || !secret) return send(res, 503, { ok: false, error: 'Google owner API is not configured on the server' });
      raw = await gasJson(endpoint.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization: secret, ownerUserId: ownerId, action: 'works.fetch', args: [{ ...options,
          ...(authMode === 'vercel' ? { userId: ownerId } : {}), currentUserId: ownerId }],
          ...(process.env.VERCEL_ENV === 'preview' ? { includeTiming: true } : {}) }) }, 'works.fetch');
      previewOwnerServerTiming(res, raw, 'works.fetch');
      if (!record(raw) || raw.ok !== true || !record(raw.data) || !Array.isArray(raw.data.data)) {
        const error = new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google owner API response is malformed') as Error & { apiCode?: unknown };
        if (record(raw)) error.apiCode = raw.code;
        throw error;
      }
      raw = raw.data.data;
    } else {
      const bridgeAction = publicCreatorSlug ? 'public.works.creator' : options.assetId ? 'public.works.detail' : 'public.works.list';
      const bridgeArgs = publicCreatorSlug ? [publicCreatorSlug] : options.assetId ? [options.assetId] : [{}];
      const response = await publicReadRequest(bridgeAction, bridgeArgs, ownerUserId);
      if (!record(response) || response.ok !== true) {
        const error = new Error(record(response) && typeof response.error === 'string' ? response.error : 'Google public API response is malformed') as Error & { apiCode?: unknown };
        if (record(response)) error.apiCode = response.code;
        throw error;
      }
      raw = options.assetId ? [response.data] : response.data;
    }
    const works = validateAssetList(raw);
    const scopedOptions = { ...options, ...(ownerScope ? { search: undefined } : {}), publicOnly: publicCreatorSlug ? true : options.publicOnly,
      currentUserId: ownerScope ? ownerId || undefined : undefined };
    const filtered = filterGoogleWorks(works, scopedOptions, { currentUserId: ownerScope ? ownerId || undefined : undefined });
    return send(res, 200, { ok: true, data: { data: filtered, error: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Works read failed';
    const code = error instanceof Error ? (error as Error & { apiCode?: unknown }).apiCode : undefined;
    const status = code ? ownerErrorStatus(code) : record(error) && typeof error.status === 'number' ? error.status
      : (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
    return send(res, status, { ok: false, error: message.slice(0, 300), ...(code ? { code } : {}) });
  }
}

