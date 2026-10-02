import { createHash } from 'node:crypto';
import { DirectWriteError, fail } from './cxlDirectErrors.js';

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
  if (!UUID_RE.test(mediaId)) return null;
  const query = `appProperties has { key='cxlMediaId' and value='${quote(mediaId)}' } and trashed = false`;
  const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(${FILE_FIELDS})&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: Json[] };
  const files = (listed.files || []).filter(file => !String(file.name || '').includes('session')).map(toMediaFile);
  if (files.length <= 1) return files[0] || null;
  // A retried save could upload the same image twice. Identical copies are healed: keep the
  // furthest-along (then oldest) and move the rest to Drive trash. Anything else stays an error.
  const [first] = files;
  const identical = files.every(file => file.sha256 && file.sha256 === first.sha256 && file.size === first.size && file.mimeType === first.mimeType
    && SAME_UPLOAD_PROPS.every(key => (file.props[key] || '') === (first.props[key] || '')) && file.props.cxlState in STATE_RANK);
  if (!identical) fail('MEDIA_UPLOAD_DUPLICATE_FILE', 'Work media storage contains duplicate upload files');
  const [keep, ...extra] = [...files].sort((a, b) => STATE_RANK[a.props.cxlState] - STATE_RANK[b.props.cxlState] || a.createdTime.localeCompare(b.createdTime));
  for (const file of extra) await trashDriveFile(env, file.id);
  return keep;
}

export async function markWorkMediaState(env: DirectMediaEnv, fileId: string, props: Record<string, string>): Promise<void> {
  await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: props })
  });
}

/** Port of the legacy branch of shareRecordMedia_: anyone-with-link for public, private otherwise. */
export async function setLegacyMediaSharing(env: DirectMediaEnv, fileId: string, makePublic: boolean): Promise<void> {
  const listed = await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&fields=permissions(id,type,role)`)).json() as { permissions?: { id: string; type: string }[] };
  const anyone = (listed.permissions || []).filter(permission => permission.type === 'anyone');
  if (makePublic && !anyone.length) {
    await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'anyone', role: 'reader' })
    });
  }
  if (!makePublic) for (const permission of anyone) {
    await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`, { method: 'DELETE' });
  }
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

function metadataMatches(stored: Json, input: Json, ownerUserId: string): boolean {
  return Boolean(stored) && String(stored.mediaId) === String(input.mediaId) && String(stored.workId) === String(input.workId)
    && String(stored.ownerUserId) === ownerUserId && Number(stored.totalFileSize) === Number(input.totalFileSize)
    && String(stored.mimeType) === String(input.mimeType) && String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase()
    && String(stored.purpose) === String(input.purpose) && String(stored.contextId || '') === String(input.contextId || '')
    && Number(stored.sortOrder) === Number(input.sortOrder) && Boolean(stored.isCover) === Boolean(input.isCover);
}

/** Names of the upload fields that differ, for diagnosing identity conflicts (no values). */
function mismatchedFields(stored: Json, input: Json, ownerUserId: string): string[] {
  const checks: Array<[string, boolean]> = [
    ['workId', String(stored.workId) === String(input.workId)], ['owner', String(stored.ownerUserId) === ownerUserId],
    ['size', Number(stored.totalFileSize) === Number(input.totalFileSize)], ['mimeType', String(stored.mimeType) === String(input.mimeType)],
    ['sha256', String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase()], ['purpose', String(stored.purpose) === String(input.purpose)],
    ['contextId', String(stored.contextId || '') === String(input.contextId || '')], ['sortOrder', Number(stored.sortOrder) === Number(input.sortOrder)],
    ['isCover', Boolean(stored.isCover) === Boolean(input.isCover)]
  ];
  return checks.filter(([, same]) => !same).map(([name]) => name);
}

function sameImageOfSameWork(stored: Json, input: Json, ownerUserId: string): boolean {
  return String(stored.mediaId) === String(input.mediaId) && String(stored.workId) === String(input.workId)
    && String(stored.ownerUserId) === ownerUserId && Number(stored.totalFileSize) === Number(input.totalFileSize)
    && String(stored.mimeType) === String(input.mimeType) && String(stored.sha256).toLowerCase() === String(input.sha256).toLowerCase();
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
      await verifyAndFinalize(env, existing, String(input.sha256).toLowerCase(), String(input.mimeType));
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
  const folderId = await workMediaFolderId(env);
  const known = await findSessionFile(env, folderId, input.uploadId);
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

/** Move a Drive file to the Owner's trash (recoverable for 30 days). */
export async function trashDriveFile(env: DirectMediaEnv, fileId: string): Promise<void> {
  await drive(env, `${DRIVE_FILES}/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true })
  }, [404]);
}

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;
const CLEANUP_MAX_ITEMS = 10;

async function listFiles(env: DirectMediaEnv, query: string): Promise<Json[]> {
  const listed = await (await drive(env, `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(${FILE_FIELDS},modifiedTime)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: Json[] };
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
  for (const file of await listFiles(env, "appProperties has { key='cxlState' and value='retired' } and trashed = false")) {
    if (stamp(file.appProperties?.cxlRetiredAt) && stamp(file.appProperties?.cxlRetiredAt) < cutoff) candidates.push(file.id);
  }
  for (const state of ['finalized', 'uploading']) {
    for (const file of await listFiles(env, `appProperties has { key='cxlState' and value='${state}' } and trashed = false`)) {
      if (stamp(file.appProperties?.cxlFinalizedAt || file.createdTime) < cutoff) candidates.push(file.id);
    }
  }
  for (const file of await listFiles(env, `name contains 'cxl-work-media-session-' and modifiedTime < '${new Date(cutoff).toISOString()}' and trashed = false`)) {
    candidates.push(file.id);
  }
  let trashed = 0;
  for (const id of candidates.slice(0, CLEANUP_MAX_ITEMS)) { await trashDriveFile(env, id); trashed++; }
  return { trashed };
}

function signatureMime(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

/** Check the stored bytes (checksum + image signature), make the file private and mark it finalized. */
async function verifyAndFinalize(env: DirectMediaEnv, file: WorkMediaFile, expectedSha256: string, mimeType: string): Promise<void> {
  let sha256 = file.sha256;
  let head: Buffer;
  if (!sha256) {
    const bytes = Buffer.from(await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`)).arrayBuffer());
    sha256 = createHash('sha256').update(bytes).digest('hex'); head = bytes.subarray(0, 16);
  } else {
    head = Buffer.from(await (await drive(env, `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers: { Range: 'bytes=0-15' } }, [206])).arrayBuffer());
  }
  if (sha256 !== expectedSha256) fail('MEDIA_UPLOAD_FINAL_CHECKSUM', 'Work media checksum did not match');
  if (signatureMime(head) !== mimeType) fail('MEDIA_UPLOAD_MIME_MISMATCH', 'Work media type did not match its binary signature');
  await ensurePrivate(env, file.id);
  if (file.props.cxlState === 'uploading') await markWorkMediaState(env, file.id, { cxlState: 'finalized', cxlFinalizedAt: new Date().toISOString() });
}

export async function directMediaFinalize(input: Json, ownerUserId: string, env: DirectMediaEnv): Promise<Json> {
  const folderId = await workMediaFolderId(env);
  const known = await findSessionFile(env, folderId, input.uploadId);
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
  await verifyAndFinalize(env, file!, String(session.sha256), String(session.mimeType));
  await drive(env, `${DRIVE_FILES}/${encodeURIComponent(known!.id)}?supportsAllDrives=true`, { method: 'DELETE' }, [404]);
  return { uploadId: input.uploadId, mediaId: session.mediaId, finalized: true };
}
