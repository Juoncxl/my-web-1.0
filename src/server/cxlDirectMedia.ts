import { createHash, randomUUID } from 'node:crypto';
import { DirectWriteError, fail } from './cxlDirectErrors.js';
import { isR2FileId, mediaBucket, r2CleanupWorkMedia, r2FindWorkMediaFiles, r2MediaBegin, r2MediaChunk, r2MediaFinalize, r2PatchMedia, r2TrashMedia, r2UploadSession, r2UploadsEnabled } from './cxlR2Media.js';

/**
 * Direct Work media upload (replaces Apps Script media.upload.begin/chunk/finalize).
 *
 * Bytes go to Drive through a resumable upload session owned by the Owner, in the
 * same private media folder and under the same canonical name Apps Script uses
 * (cxl-work-media-<mediaId>.<ext>). Apps Script kept its upload manifest in Script
 * Properties, which only Apps Script can read; here the manifest lives in the media
 * file's Drive appProperties, and the in-flight session in a small JSON file.
 * Reads are unchanged: Works reference media by drive_file_id in their record.
 */

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface DirectMediaEnv { ownerToken: string; mediaFolderId?: string }

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_BYTES = 10 * 1024 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const FILE_FIELDS = 'id,name,size,mimeType,sha256Checksum,createdTime,parents,appProperties';

export interface WorkMediaFile {
  id: string; name: string; size: number; mimeType: string; sha256: string; createdTime: string; props: Record<string, string>;
}

async function drive(env: DirectMediaEnv, url: string, init: RequestInit = {}, okStatuses: number[] = []): Promise<globalThis.Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${env.ownerToken}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok && !okStatuses.includes(response.status)) throw new DirectWriteError(`Drive ${init.method || 'GET'} failed (HTTP ${response.status})`, 'MEDIA_UPLOAD_DRIVE_FAILED');
  return response;
}

const quote = (value: string) => value.replace(/['\\]/g, '\\$&');
export const canonicalMediaName = (mediaId: string, mimeType: string) => `cxl-work-media-${mediaId}.${EXTENSIONS[mimeType] || ''}`;
const sessionFileName = (uploadId: string) => `cxl-work-media-session-${uploadId}.json`;

let cachedMediaFolder: string | null = null;

/** The private folder holding canonical Work media (Apps Script's CXL_WORK_MEDIA_FOLDER_ID). */
export async function workMediaFolderId(env: DirectMediaEnv): Promise<string> {
  if (env.mediaFolderId) return env.mediaFolderId;
  if (cachedMediaFolder) return cachedMediaFolder;
  const query = "name contains 'cxl-work-media-' and not name contains 'chunk' and not name contains 'session' and trashed = false";
  const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(name,parents)&pageSize=20&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: { name?: string; parents?: string[] }[] };
  const found = (listed.files || []).find(file => /^cxl-work-media-[a-f0-9-]{36}\.(jpg|png|webp|gif)$/i.test(file.name || '') && file.parents?.[0]);
  if (!found) fail('MEDIA_UPLOAD_NOT_CONFIGURED', 'Work media storage folder could not be located');
  cachedMediaFolder = found!.parents![0];
  return cachedMediaFolder;
}

function toMediaFile(file: Json): WorkMediaFile {
  return { id: String(file.id), name: String(file.name || ''), size: Number(file.size || 0), mimeType: String(file.mimeType || ''),
    sha256: String(file.sha256Checksum || '').toLowerCase(), createdTime: String(file.createdTime || ''), props: (file.appProperties || {}) as Record<string, string> };
}

const STATE_RANK: Record<string, number> = { attached: 0, finalized: 1, uploading: 2 };
// Placement (purpose, participant, order, cover) may differ between copies; begin re-applies the current one.
const SAME_UPLOAD_PROPS = ['cxlWorkId', 'cxlOwner', 'cxlSha256'];

/** The canonical media file carrying this mediaId in its appProperties (or legacy name), if any. */
export async function findWorkMediaFile(env: DirectMediaEnv, mediaId: string): Promise<WorkMediaFile | null> {
  return (await findWorkMediaFiles(env, [mediaId])).get(mediaId) ?? null;
}

// Media IDs looked up per Drive query. Each one adds ~80 characters to the query string.
const FIND_IDS_PER_QUERY = 20;

/**
 * The canonical media files for many mediaIds, in as few Drive calls as possible (one query per
 * 20 IDs). Workers on the free plan may only make 50 outbound calls per request, and a Collab save
 * can attach dozens of images.
 */
export async function findWorkMediaFiles(env: DirectMediaEnv, mediaIds: string[]): Promise<Map<string, WorkMediaFile | null>> {
  // Images uploaded to R2 win; only the rest are looked up in Drive.
  const inR2 = mediaBucket() ? await r2FindWorkMediaFiles(mediaIds) : new Map<string, WorkMediaFile | null>();
  const driveIds = mediaIds.filter(id => !inR2.get(id));
  const fromDrive = driveIds.length ? await findDriveWorkMediaFiles(env, driveIds) : new Map<string, WorkMediaFile | null>();
  return new Map(mediaIds.map(id => [id, inR2.get(id) || fromDrive.get(id) || null]));
}

async function findDriveWorkMediaFiles(env: DirectMediaEnv, mediaIds: string[]): Promise<Map<string, WorkMediaFile | null>> {
  const ids = [...new Set(mediaIds.filter(id => UUID_RE.test(id)))];
  const byId = new Map<string, WorkMediaFile[]>(ids.map(id => [id, []]));
  const collect = async (group: string[]) => {
    const clauses = group.map(id => `appProperties has { key='cxlMediaId' and value='${quote(id)}' }`);
    const query = `${clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]} and trashed = false`;
    const files: WorkMediaFile[] = [];
    let pageToken = '';
    do {
      const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=nextPageToken,files(${FILE_FIELDS})&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)).json() as { files?: Json[]; nextPageToken?: string };
      files.push(...(listed.files || []).filter(file => !String(file.name || '').includes('session')).map(toMediaFile));
      pageToken = listed.nextPageToken || '';
    } while (pageToken);
    files.forEach(file => byId.get(file.props.cxlMediaId)?.push(file));
  };
  for (let start = 0; start < ids.length; start += FIND_IDS_PER_QUERY) {
    const group = ids.slice(start, start + FIND_IDS_PER_QUERY);
    try {
      await collect(group);
    } catch (error) {
      // Should Drive ever refuse the combined query, look the IDs up one by one as before.
      if (group.length === 1) throw error;
      console.warn(JSON.stringify({ event: 'cxl_media_find_combined_failed', ids: group.length }));
      for (const id of group) await collect([id]);
    }
  }
  const found = new Map<string, WorkMediaFile | null>();
  const extras: string[] = [];
  for (const id of mediaIds) {
    const files = byId.get(id) || [];
    if (files.length <= 1) { found.set(id, files[0] || null); continue; }
    // A retried save could upload the same image twice. Identical copies are healed: keep the
    // furthest-along (then oldest) and move the rest to Drive trash. Anything else stays an error.
    const [first] = files;
    const identical = files.every(file => file.sha256 && file.sha256 === first.sha256 && file.size === first.size && file.mimeType === first.mimeType
      && SAME_UPLOAD_PROPS.every(key => (file.props[key] || '') === (first.props[key] || '')) && file.props.cxlState in STATE_RANK);
    if (!identical) fail('MEDIA_UPLOAD_DUPLICATE_FILE', 'Work media storage contains duplicate upload files');
    const [keep, ...extra] = [...files].sort((a, b) => STATE_RANK[a.props.cxlState] - STATE_RANK[b.props.cxlState] || a.createdTime.localeCompare(b.createdTime));
    found.set(id, keep);
    extras.push(...extra.map(file => file.id));
  }
  if (extras.length) await trashDriveFiles(env, extras);
  return found;
}

export async function markWorkMediaState(env: DirectMediaEnv, fileId: string, props: Record<string, string>): Promise<void> {
  if (isR2FileId(fileId)) { await r2PatchMedia(fileId, props); return; }
  await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: props })
  });
}

const DRIVE_BATCH = 'https://www.googleapis.com/batch/drive/v3';
const DRIVE_BATCH_LIMIT = 100;
export interface DriveBatchCall { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown }
export interface DriveBatchResult { status: number; body: Json }

/**
 * Many small Drive calls sent as one HTTP request (Drive's batch endpoint, up to 100 calls each).
 * Results come back in call order; a call that got no answer has status 0.
 */
export async function driveBatch(env: DirectMediaEnv, calls: DriveBatchCall[]): Promise<DriveBatchResult[]> {
  const results: DriveBatchResult[] = [];
  for (let start = 0; start < calls.length; start += DRIVE_BATCH_LIMIT) {
    const slice = calls.slice(start, start + DRIVE_BATCH_LIMIT);
    const boundary = `cxl_batch_${randomUUID()}`;
    const body = slice.map((call, index) => [
      `--${boundary}`, 'Content-Type: application/http', `Content-ID: <item${index}>`, '',
      `${call.method} ${call.path} HTTP/1.1`,
      ...(call.body === undefined ? [] : ['Content-Type: application/json; charset=UTF-8']), '',
      call.body === undefined ? '' : JSON.stringify(call.body)
    ].join('\r\n')).join('\r\n') + `\r\n--${boundary}--\r\n`;
    const response = await drive(env, DRIVE_BATCH, { method: 'POST', headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}` }, body });
    const answers = parseBatchResponse(response.headers.get('content-type') || '', await response.text());
    slice.forEach((_, index) => results.push(answers.get(index) || { status: 0, body: null }));
  }
  return results;
}

/** Splits a multipart/mixed batch answer into per-call results keyed by the request's Content-ID index. */
export function parseBatchResponse(contentType: string, text: string): Map<number, DriveBatchResult> {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const answers = new Map<number, DriveBatchResult>();
  if (!boundary) return answers;
  for (const part of text.split(`--${boundary[1] || boundary[2]}`)) {
    const id = part.match(/Content-ID:\s*<response-item(\d+)>/i);
    const status = part.match(/HTTP\/1\.[01] (\d{3})/);
    if (!id || !status) continue;
    const afterStatus = part.slice(status.index! + status[0].length);
    const bodyStart = afterStatus.search(/\r?\n\r?\n/);
    const raw = bodyStart < 0 ? '' : afterStatus.slice(bodyStart).trim();
    let body: Json = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    answers.set(Number(id[1]), { status: Number(status[1]), body });
  }
  return answers;
}

const batchOk = (result: DriveBatchResult, okStatuses: number[] = []) => (result.status >= 200 && result.status < 300) || okStatuses.includes(result.status);
const filePath = (fileId: string, suffix = '') => `/drive/v3/files/${encodeURIComponent(fileId)}${suffix}`;

/** PATCHes many Drive files in one batch. Returns whether each one succeeded, in order. */
export async function patchDriveFiles(env: DirectMediaEnv, patches: { fileId: string; body: Json }[]): Promise<boolean[]> {
  if (!patches.length) return [];
  // R2 media keep their manifest in R2; only appProperties patches apply to them.
  const ok = new Array<boolean>(patches.length).fill(false);
  const drivePatches: number[] = [];
  for (const [index, patch] of patches.entries()) {
    if (isR2FileId(patch.fileId)) ok[index] = await r2PatchMedia(patch.fileId, patch.body?.appProperties || {}).catch(() => false);
    else drivePatches.push(index);
  }
  if (drivePatches.length) {
    const results = await driveBatch(env, drivePatches.map(index => ({ method: 'PATCH', path: filePath(patches[index].fileId, '?supportsAllDrives=true&fields=id'), body: patches[index].body })));
    results.forEach((result, position) => { ok[drivePatches[position]] = batchOk(result); });
  }
  return ok;
}

/** Moves many files to the Owner's Drive trash (recoverable for 30 days) in one batch. Files already gone count as done. */
export async function trashDriveFiles(env: DirectMediaEnv, allFileIds: string[]): Promise<void> {
  const r2Files = allFileIds.filter(isR2FileId);
  if (r2Files.length) await r2TrashMedia(r2Files);
  const fileIds = allFileIds.filter(fileId => !isR2FileId(fileId));
  if (!fileIds.length) return;
  const results = await driveBatch(env, fileIds.map(fileId => ({ method: 'PATCH', path: filePath(fileId, '?supportsAllDrives=true&fields=id'), body: { trashed: true } })));
  const failed = results.find(result => !batchOk(result, [404]));
  if (failed) throw new DirectWriteError(`Drive trash failed (HTTP ${failed.status})`, 'MEDIA_UPLOAD_DRIVE_FAILED');
}

/**
 * Port of the legacy branch of shareRecordMedia_ (anyone-with-link for public, private otherwise),
 * for many files in two batches: read permissions, then change them.
 */
export async function setLegacyMediaSharingMany(env: DirectMediaEnv, items: { fileId: string; makePublic: boolean }[]): Promise<void> {
  if (!items.length) return;
  const listed = await driveBatch(env, items.map(item => ({ method: 'GET', path: filePath(item.fileId, '/permissions?supportsAllDrives=true&fields=permissions(id,type,role)') })));
  const failedRead = listed.find(result => !batchOk(result));
  if (failedRead) throw new DirectWriteError(`Drive GET failed (HTTP ${failedRead.status})`, 'MEDIA_UPLOAD_DRIVE_FAILED');
  const changes: DriveBatchCall[] = [];
  items.forEach((item, index) => {
    const anyone = ((listed[index].body?.permissions || []) as { id: string; type: string }[]).filter(permission => permission.type === 'anyone');
    if (item.makePublic && !anyone.length) changes.push({ method: 'POST', path: filePath(item.fileId, '/permissions?supportsAllDrives=true'), body: { type: 'anyone', role: 'reader' } });
    if (!item.makePublic) anyone.forEach(permission => changes.push({ method: 'DELETE', path: filePath(item.fileId, `/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`) }));
  });
  if (!changes.length) return;
  const failedChange = (await driveBatch(env, changes)).find(result => !batchOk(result));
  if (failedChange) throw new DirectWriteError(`Drive permission change failed (HTTP ${failedChange.status})`, 'MEDIA_UPLOAD_DRIVE_FAILED');
}

async function ensurePrivate(env: DirectMediaEnv, fileId: string): Promise<void> {
  const listed = await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&fields=permissions(id,type)`)).json() as { permissions?: { id: string; type: string }[] };
  for (const permission of listed.permissions || []) if (permission.type === 'anyone' || permission.type === 'domain') {
    await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`, { method: 'DELETE' });
  }
}

async function findSessionFile(env: DirectMediaEnv, folderId: string, uploadId: string): Promise<{ id: string; session: Json } | null> {
  const query = `'${quote(folderId)}' in parents and name = '${sessionFileName(uploadId)}' and trashed = false`;
  const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: { id: string }[] };
  const id = listed.files?.[0]?.id;
  if (!id) return null;
  return { id, session: await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).json() };
}

/**
 * Drive's name search can lag a few seconds behind a just-created session file, which made
 * busy uploads (dozens of images in one save) fail with "session not found". Chunk and
 * finalize look again a few times before giving up; begin keeps the single lookup.
 */
async function findSessionFileSettled(env: DirectMediaEnv, folderId: string, uploadId: string, waitMs = SESSION_LOOKUP_WAIT_MS): Promise<{ id: string; session: Json } | null> {
  for (let attempt = 0; ; attempt += 1) {
    const found = await findSessionFile(env, folderId, uploadId);
    if (found || attempt >= SESSION_LOOKUP_RETRIES) return found;
    await new Promise(resolve => setTimeout(resolve, waitMs * (attempt + 1)));
  }
}
const SESSION_LOOKUP_RETRIES = 4;
const SESSION_LOOKUP_WAIT_MS = 750;

// The declared mime type is not compared: browsers guess it from the file name (a WebP saved as .jpg is
// declared image/jpeg) while Drive records the real one. Checksum + size already pin the bytes.
function metadataMatches(stored: Json, input: Json, ownerUserId: string): boolean {
  return Boolean(stored) && String(stored.mediaId) === String(input.mediaId) && String(stored.workId) === String(input.workId)
    && String(stored.ownerUserId) === ownerUserId && Number(stored.totalFileSize) === Number(input.totalFileSize)
    && String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase()
    && String(stored.purpose) === String(input.purpose) && String(stored.contextId || '') === String(input.contextId || '')
    && Number(stored.sortOrder) === Number(input.sortOrder) && Boolean(stored.isCover) === Boolean(input.isCover);
}

/** Names of the upload fields that differ, for diagnosing identity conflicts (no values). */
function mismatchedFields(stored: Json, input: Json, ownerUserId: string): string[] {
  const checks: Array<[string, boolean]> = [
    ['workId', String(stored.workId) === String(input.workId)], ['owner', String(stored.ownerUserId) === ownerUserId],
    ['size', Number(stored.totalFileSize) === Number(input.totalFileSize)],
    ['sha256', String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase()], ['purpose', String(stored.purpose) === String(input.purpose)],
    ['contextId', String(stored.contextId || '') === String(input.contextId || '')], ['sortOrder', Number(stored.sortOrder) === Number(input.sortOrder)],
    ['isCover', Boolean(stored.isCover) === Boolean(input.isCover)]
  ];
  return checks.filter(([, same]) => !same).map(([name]) => name);
}

function sameImageOfSameWork(stored: Json, input: Json, ownerUserId: string): boolean {
  return String(stored.mediaId) === String(input.mediaId) && String(stored.workId) === String(input.workId)
    && String(stored.ownerUserId) === ownerUserId && Number(stored.totalFileSize) === Number(input.totalFileSize)
    && String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase();
}

/** appProperties view of a media file's upload metadata (the Apps Script manifest fields). */
export function mediaFileManifest(file: WorkMediaFile): Json {
  const p = file.props;
  return { mediaId: p.cxlMediaId, workId: p.cxlWorkId, ownerUserId: p.cxlOwner, sha256: p.cxlSha256, purpose: p.cxlPurpose, contextId: p.cxlContextId || null,
    sortOrder: Number(p.cxlSortOrder), isCover: p.cxlIsCover === 'true', mimeType: file.mimeType, totalFileSize: file.size, state: p.cxlState, drive_file_id: file.id };
}

async function uploadStatus(env: DirectMediaEnv, sessionUri: string, total: number): Promise<{ complete: boolean; received: number }> {
  const response = await fetch(sessionUri, { method: 'PUT', headers: { Authorization: `Bearer ${env.ownerToken}`, 'Content-Range': `bytes */${total}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 200 || response.status === 201) return { complete: true, received: total };
  if (response.status === 308) {
    const range = response.headers.get('range');
    const match = range?.match(/bytes=0-(\d+)/);
    return { complete: false, received: match ? Number(match[1]) + 1 : 0 };
  }
  if (response.status === 404 || response.status === 410) fail('MEDIA_UPLOAD_SESSION_EXPIRED', 'Work media upload session expired');
  fail('MEDIA_UPLOAD_DRIVE_FAILED', `Drive upload status failed (HTTP ${response.status})`);
  return { complete: false, received: 0 };
}

export async function directMediaBegin(input: Json, ownerUserId: string, env: DirectMediaEnv): Promise<Json> {
  if (input.contextId && String(input.contextId).length > 100) fail('INVALID_MEDIA_UPLOAD_REQUEST', 'Work media context is too long');
  if (r2UploadsEnabled()) return r2MediaBegin(input, ownerUserId);
  const existing = await findWorkMediaFile(env, input.mediaId);
  if (existing) {
    let manifest = mediaFileManifest(existing);
    // The same image of the same Work, only moved (reordered, other participant, cover changed) after an
    // earlier save failed: follow the new placement instead of refusing. A different image still conflicts.
    if (!metadataMatches(manifest, input, ownerUserId) && sameImageOfSameWork(manifest, input, ownerUserId)) {
      const placement = { cxlPurpose: String(input.purpose), cxlContextId: input.contextId || '', cxlSortOrder: String(input.sortOrder), cxlIsCover: String(Boolean(input.isCover)) };
      await markWorkMediaState(env, existing.id, placement);
      existing.props = { ...existing.props, ...placement };
      manifest = mediaFileManifest(existing);
    }
    if (!metadataMatches(manifest, input, ownerUserId)) {
      const differs = mismatchedFields(manifest, input, ownerUserId);
      console.warn(JSON.stringify({ event: 'cxl_media_identity_conflict', mediaId: String(input.mediaId), state: manifest.state, differs }));
      fail('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT', `Media identity is already bound to different Work data (${differs.join(', ')}; ${manifest.state})`);
    }
    if (['finalized', 'attached'].includes(manifest.state) && existing.size === input.totalFileSize) return { uploadId: input.uploadId, mediaId: input.mediaId, finalized: true };
    // Bytes already landed but finalize never ran (e.g. the earlier save timed out): finalize that file instead of uploading a second copy.
    if (manifest.state === 'uploading' && existing.size === Number(input.totalFileSize)) {
      await verifyAndFinalize(env, existing, String(input.sha256).toLowerCase());
      return { uploadId: input.uploadId, mediaId: input.mediaId, finalized: true };
    }
  }
  const folderId = await workMediaFolderId(env);
  const known = await findSessionFile(env, folderId, input.uploadId);
  if (known) {
    if (!metadataMatches(known.session, input, ownerUserId)) fail('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT', 'Upload identifier is already used for different Work data');
    return { uploadId: input.uploadId, mediaId: input.mediaId, finalized: false };
  }
  const props: Record<string, string> = { cxlMediaId: input.mediaId, cxlWorkId: input.workId, cxlOwner: ownerUserId, cxlSha256: String(input.sha256).toLowerCase(),
    cxlPurpose: input.purpose, cxlContextId: input.contextId || '', cxlSortOrder: String(input.sortOrder), cxlIsCover: String(Boolean(input.isCover)),
    cxlUploadId: input.uploadId, cxlState: 'uploading', cxlDelivery: 'vercel_proxy' };
  const started = await drive(env, `${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': input.mimeType, 'X-Upload-Content-Length': String(input.totalFileSize) },
    body: JSON.stringify({ name: canonicalMediaName(input.mediaId, input.mimeType), parents: [folderId], mimeType: input.mimeType, appProperties: props })
  });
  const sessionUri = started.headers.get('location');
  if (!sessionUri) fail('MEDIA_UPLOAD_DRIVE_FAILED', 'Drive did not open an upload session');
  const session = { uploadId: input.uploadId, mediaId: input.mediaId, workId: input.workId, ownerUserId, totalFileSize: input.totalFileSize, totalChunks: input.totalChunks,
    mimeType: input.mimeType, sha256: String(input.sha256).toLowerCase(), purpose: input.purpose, contextId: input.contextId || null, sortOrder: input.sortOrder,
    isCover: input.isCover, sessionUri, expiresAt: Date.now() + SESSION_TTL_MS };
  const boundary = `cxl-${input.uploadId}`;
  const body = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify({ name: sessionFileName(input.uploadId), parents: [folderId], mimeType: 'application/json' }),
    `--${boundary}`, 'Content-Type: application/json', '', JSON.stringify(session), `--${boundary}--`, ''].join('\r\n');
  await drive(env, `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return { uploadId: input.uploadId, mediaId: input.mediaId, finalized: false };
}

export async function directMediaChunk(input: Json, ownerUserId: string, env: DirectMediaEnv): Promise<Json> {
  // An upload begun in R2 stays in R2 even if the switch changes mid-upload.
  const r2Session = await r2UploadSession(input.uploadId);
  if (r2Session) return r2MediaChunk(input, r2Session, ownerUserId);
  const folderId = await workMediaFolderId(env);
  const known = await findSessionFileSettled(env, folderId, input.uploadId);
  if (!known) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  const session = known!.session;
  if (String(session.ownerUserId) !== ownerUserId) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  if (Number(session.expiresAt) <= Date.now()) fail('MEDIA_UPLOAD_SESSION_EXPIRED', 'Work media upload session expired');
  if (input.chunkIndex < 0 || input.chunkIndex >= Number(session.totalChunks)) fail('INVALID_MEDIA_UPLOAD_CHUNK', 'Invalid Work media chunk');
  const bytes = Buffer.from(input.base64, 'base64');
  const start = input.chunkIndex * CHUNK_BYTES;
  const expected = Math.min(CHUNK_BYTES, Number(session.totalFileSize) - start);
  if (bytes.toString('base64') !== input.base64 || bytes.length !== expected
    || createHash('sha256').update(bytes).digest('hex') !== String(input.sha256).toLowerCase())
    fail('MEDIA_UPLOAD_CHUNK_CHECKSUM', 'Work media chunk checksum or size did not match');
  const total = Number(session.totalFileSize);
  const status = await uploadStatus(env, session.sessionUri, total);
  if (status.complete || status.received >= start + bytes.length) return { uploadId: input.uploadId, chunkIndex: input.chunkIndex, stored: true, idempotent: true };
  if (status.received !== start) fail('MEDIA_UPLOAD_CHUNK_MISSING', 'An earlier Work media chunk is missing');
  const response = await fetch(session.sessionUri, {
    method: 'PUT', headers: { Authorization: `Bearer ${env.ownerToken}`, 'Content-Length': String(bytes.length), 'Content-Range': `bytes ${start}-${start + bytes.length - 1}/${total}` },
    body: bytes, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (![200, 201, 308].includes(response.status)) fail('MEDIA_UPLOAD_DRIVE_FAILED', `Drive upload chunk failed (HTTP ${response.status})`);
  return { uploadId: input.uploadId, chunkIndex: input.chunkIndex, stored: true, idempotent: false };
}

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;
const CLEANUP_MAX_ITEMS = 50;

async function listFiles(env: DirectMediaEnv, query: string): Promise<Json[]> {
  const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(${FILE_FIELDS},modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: Json[] };
  return listed.files || [];
}

/**
 * Port of mediaWorkCleanup_ for direct uploads: after 24 hours, trash media files a
 * Work stopped using ("retired"), uploads that were never attached ("finalized"),
 * and abandoned upload sessions. Trashed files stay recoverable in Drive for 30 days.
 */
export async function cleanupWorkMedia(env: DirectMediaEnv, now = Date.now()): Promise<{ trashed: number }> {
  const cutoff = now - CLEANUP_AFTER_MS;
  const stamp = (value: unknown) => Date.parse(String(value || '')) || 0;
  const candidates: string[] = [];
  // One query for all three states, one for stale sessions, one batch to trash: a cleanup rides
  // along with a save and must stay within the request's outbound call budget.
  const states = ['retired', 'finalized', 'uploading'].map(state => `appProperties has { key='cxlState' and value='${state}' }`).join(' or ');
  for (const file of await listFiles(env, `(${states}) and trashed = false`)) {
    const props = file.appProperties || {};
    const stale = props.cxlState === 'retired' ? Boolean(stamp(props.cxlRetiredAt)) && stamp(props.cxlRetiredAt) < cutoff
      : (props.cxlState === 'finalized' || props.cxlState === 'uploading') && stamp(props.cxlFinalizedAt || file.createdTime) < cutoff;
    if (stale) candidates.push(file.id);
  }
  for (const file of await listFiles(env, `name contains 'cxl-work-media-session-' and modifiedTime < '${new Date(cutoff).toISOString()}' and trashed = false`)) {
    candidates.push(file.id);
  }
  const chosen = candidates.slice(0, CLEANUP_MAX_ITEMS);
  await trashDriveFiles(env, chosen);
  const fromR2 = await r2CleanupWorkMedia(now);
  const trashed = chosen.length + fromR2.trashed;
  return { trashed };
}

function signatureMime(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

/**
 * Check the stored bytes (checksum + a supported image signature), make the file private and mark it
 * finalized. The signature may differ from the declared type (a WebP named .jpg); the bytes decide.
 */
async function verifyAndFinalize(env: DirectMediaEnv, file: WorkMediaFile, expectedSha256: string): Promise<void> {
  let sha256 = file.sha256;
  let head: Buffer;
  if (!sha256) {
    const bytes = Buffer.from(await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`)).arrayBuffer());
    sha256 = createHash('sha256').update(bytes).digest('hex'); head = bytes.subarray(0, 16);
  } else {
    head = Buffer.from(await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers: { Range: 'bytes=0-15' } }, [206])).arrayBuffer());
  }
  if (sha256 !== expectedSha256) fail('MEDIA_UPLOAD_FINAL_CHECKSUM', 'Work media checksum did not match');
  const detected = signatureMime(head);
  // GIF uploads are closed; a GIF declared as another type is caught here by its bytes.
  if (!EXTENSIONS[detected] || detected === 'image/gif') fail('MEDIA_UPLOAD_MIME_MISMATCH', 'Work media is not a supported image (JPEG, PNG or WebP)');
  await ensurePrivate(env, file.id);
  if (file.props.cxlState === 'uploading') await markWorkMediaState(env, file.id, { cxlState: 'finalized', cxlFinalizedAt: new Date().toISOString() });
}

export async function directMediaFinalize(input: Json, ownerUserId: string, env: DirectMediaEnv): Promise<Json> {
  const r2Session = await r2UploadSession(input.uploadId);
  if (r2Session) return r2MediaFinalize(input, r2Session, ownerUserId);
  // Finalized in R2 earlier (its session is gone): answer from the R2 manifest.
  if (mediaBucket() && input.mediaId) {
    const stored = (await r2FindWorkMediaFiles([input.mediaId])).get(input.mediaId);
    if (stored) return r2MediaFinalize(input, null, ownerUserId);
  }
  const folderId = await workMediaFolderId(env);
  const known = await findSessionFileSettled(env, folderId, input.uploadId);
  let file: WorkMediaFile | null;
  if (!known) {
    // Already finalized (session file removed): answer from the media file itself.
    file = input.mediaId ? await findWorkMediaFile(env, input.mediaId) : null;
    if (file && ['finalized', 'attached'].includes(file.props.cxlState) && file.props.cxlOwner === ownerUserId) return { uploadId: input.uploadId, mediaId: file.props.cxlMediaId, finalized: true };
    fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  }
  const session = known!.session;
  if (String(session.ownerUserId) !== ownerUserId) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  file = await findWorkMediaFile(env, session.mediaId);
  if (!file) {
    const status = await uploadStatus(env, session.sessionUri, Number(session.totalFileSize));
    if (!status.complete) fail('MEDIA_UPLOAD_CHUNK_MISSING', 'A Work media chunk is missing');
    file = await findWorkMediaFile(env, session.mediaId);
    if (!file) fail('MEDIA_UPLOAD_MEDIA_INVALID', 'Uploaded Work media could not be found');
  }
  if (file!.size !== Number(session.totalFileSize)) fail('MEDIA_UPLOAD_CHUNK_CHECKSUM', 'Work media upload size did not match');
  await verifyAndFinalize(env, file!, String(session.sha256));
  await drive(env, `${DRIVE_FILES}/${encodeURIComponent(known!.id)}?supportsAllDrives=true`, { method: 'DELETE' }, [404]);
  return { uploadId: input.uploadId, mediaId: session.mediaId, finalized: true };
}
