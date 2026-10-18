import { createHash } from 'node:crypto';
import { fail } from './cxlDirectErrors.js';
import type { WorkMediaFile } from './cxlDirectMedia.js';

/**
 * Work media uploads stored in Cloudflare R2 instead of Drive (CXL_MEDIA_UPLOAD_BACKEND=r2).
 *
 * The browser protocol is unchanged (begin, 2 MiB base64 chunks, finalize). Each image lives at
 * media/<mediaId>; its manifest (the same cxl* fields Drive kept in appProperties) at
 * upload/<mediaId>.json; an in-flight upload at session/<uploadId>.json plus chunk/<uploadId>/<n>.
 * Works reference the image with drive_file_id "r2:media/<mediaId>", so every caller that only
 * passes that ID around keeps working. R2 is read-after-write consistent, so no lookup retries.
 * R2 has no trash: images a Work dropped are marked "trashed" and deleted 30 days later.
 */

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MediaBucket {
  get(key: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  put(key: string, value: Buffer | string, contentType: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  list(prefix: string, cursor?: string): Promise<{ keys: { key: string; uploaded: number }[]; cursor?: string }>;
}

let bucket: MediaBucket | null = null;
export function setMediaBucket(next: MediaBucket | null): void { bucket = next; }
export function mediaBucket(): MediaBucket | null { return bucket; }

/** New uploads go to R2 only when the switch is on and the bucket is bound. */
export function r2UploadsEnabled(): boolean {
  return bucket !== null && String(process.env.CXL_MEDIA_UPLOAD_BACKEND || '').trim().toLowerCase() === 'r2';
}

export const R2_FILE_PREFIX = 'r2:';
export const isR2FileId = (fileId: string) => fileId.startsWith(R2_FILE_PREFIX);
const mediaKey = (mediaId: string) => `media/${mediaId}`;
const manifestKey = (mediaId: string) => `upload/${mediaId}.json`;
const sessionKey = (uploadId: string) => `session/${uploadId}.json`;
const chunkKey = (uploadId: string, index: number) => `chunk/${uploadId}/${index}`;
const mediaIdOf = (fileId: string) => fileId.slice(R2_FILE_PREFIX.length).replace(/^media\//, '');

const CHUNK_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;
const DELETE_AFTER_TRASH_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_MAX_ITEMS = 50;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function store(): MediaBucket {
  if (!bucket) fail('MEDIA_UPLOAD_NOT_CONFIGURED', 'Work media storage (R2) is not bound');
  return bucket!;
}

async function readJson(key: string): Promise<Json | null> {
  const object = await store().get(key);
  if (!object) return null;
  try { return JSON.parse(object.bytes.toString('utf8')); } catch { return null; }
}
const writeJson = (key: string, value: Json) => store().put(key, JSON.stringify(value), 'application/json');

interface Manifest { size: number; mimeType: string; sha256: string; createdTime: string; props: Record<string, string> }

function toFile(mediaId: string, manifest: Manifest): WorkMediaFile {
  return { id: `${R2_FILE_PREFIX}${mediaKey(mediaId)}`, name: `cxl-work-media-${mediaId}.${EXTENSIONS[manifest.mimeType] || 'bin'}`, size: Number(manifest.size || 0),
    mimeType: manifest.mimeType || '', sha256: String(manifest.sha256 || '').toLowerCase(), createdTime: manifest.createdTime || '', props: manifest.props || {} };
}

/** R2 media files for these mediaIds (trashed ones count as gone), keyed like findWorkMediaFiles. */
export async function r2FindWorkMediaFiles(mediaIds: string[]): Promise<Map<string, WorkMediaFile | null>> {
  const found = new Map<string, WorkMediaFile | null>();
  for (const id of new Set(mediaIds)) {
    const manifest = UUID_RE.test(id) ? await readJson(manifestKey(id)) as Manifest | null : null;
    found.set(id, manifest && manifest.props?.cxlState !== 'trashed' ? toFile(id, manifest) : null);
  }
  return found;
}

async function patchManifest(mediaId: string, props: Record<string, string>): Promise<boolean> {
  const manifest = await readJson(manifestKey(mediaId)) as Manifest | null;
  if (!manifest) return false;
  manifest.props = { ...manifest.props, ...props };
  await writeJson(manifestKey(mediaId), manifest);
  return true;
}

/** markWorkMediaState / patchDriveFiles for R2 media: merge into the manifest. */
export async function r2PatchMedia(fileId: string, props: Record<string, string>): Promise<boolean> {
  return patchManifest(mediaIdOf(fileId), props);
}

/** trashDriveFiles for R2 media: mark trashed now, delete after 30 days (see r2CleanupWorkMedia). */
export async function r2TrashMedia(fileIds: string[]): Promise<void> {
  const trashedAt = new Date().toISOString();
  for (const fileId of fileIds) await patchManifest(mediaIdOf(fileId), { cxlState: 'trashed', cxlTrashedAt: trashedAt });
}

/** The image bytes of an R2 media file (read path). */
export async function r2ReadMedia(fileId: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const object = await store().get(mediaKey(mediaIdOf(fileId)));
  return object ? { bytes: object.bytes, mimeType: object.contentType } : null;
}

function signatureMime(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

/** Placement and identity of an upload, compared like the Drive path's metadataMatches. */
function sameUpload(props: Record<string, string>, input: Json, ownerUserId: string, size: number, placement: boolean): boolean {
  const identity = props.cxlMediaId === String(input.mediaId) && props.cxlWorkId === String(input.workId) && props.cxlOwner === ownerUserId
    && size === Number(input.totalFileSize) && String(props.cxlSha256).toLowerCase() === String(input.sha256).toLowerCase();
  if (!placement) return identity;
  return identity && props.cxlPurpose === String(input.purpose) && (props.cxlContextId || '') === String(input.contextId || '')
    && Number(props.cxlSortOrder) === Number(input.sortOrder) && (props.cxlIsCover === 'true') === Boolean(input.isCover);
}

const placementProps = (input: Json) => ({ cxlPurpose: String(input.purpose), cxlContextId: input.contextId || '', cxlSortOrder: String(input.sortOrder), cxlIsCover: String(Boolean(input.isCover)) });

export async function r2MediaBegin(input: Json, ownerUserId: string): Promise<Json> {
  const result = (finalized: boolean) => ({ uploadId: input.uploadId, mediaId: input.mediaId, finalized });
  const manifest = await readJson(manifestKey(input.mediaId)) as Manifest | null;
  if (manifest && manifest.props?.cxlState !== 'trashed') {
    // The same image of the same Work, only moved after a failed save: follow the new placement.
    if (!sameUpload(manifest.props, input, ownerUserId, manifest.size, true) && sameUpload(manifest.props, input, ownerUserId, manifest.size, false)) {
      await patchManifest(input.mediaId, placementProps(input));
      manifest.props = { ...manifest.props, ...placementProps(input) };
    }
    if (!sameUpload(manifest.props, input, ownerUserId, manifest.size, true))
      fail('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT', `Media identity is already bound to different Work data (${manifest.props.cxlState})`);
    if (['finalized', 'attached'].includes(manifest.props.cxlState)) return result(true);
  }
  const session = await readJson(sessionKey(input.uploadId));
  if (session) {
    if (String(session.mediaId) !== String(input.mediaId) || String(session.ownerUserId) !== ownerUserId || Number(session.totalFileSize) !== Number(input.totalFileSize)
      || String(session.sha256) !== String(input.sha256).toLowerCase()) fail('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT', 'Upload identifier is already used for different Work data');
    return result(false);
  }
  await writeJson(sessionKey(input.uploadId), { uploadId: input.uploadId, mediaId: input.mediaId, workId: input.workId, ownerUserId,
    totalFileSize: Number(input.totalFileSize), totalChunks: Number(input.totalChunks), mimeType: input.mimeType, sha256: String(input.sha256).toLowerCase(),
    purpose: input.purpose, contextId: input.contextId || null, sortOrder: input.sortOrder, isCover: Boolean(input.isCover), expiresAt: Date.now() + SESSION_TTL_MS });
  return result(false);
}

/** The R2 session of an upload, or null when the upload went to Drive. */
export async function r2UploadSession(uploadId: string): Promise<Json | null> {
  return bucket ? readJson(sessionKey(uploadId)) : null;
}

export async function r2MediaChunk(input: Json, session: Json, ownerUserId: string): Promise<Json> {
  if (String(session.ownerUserId) !== ownerUserId) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  if (Number(session.expiresAt) <= Date.now()) fail('MEDIA_UPLOAD_SESSION_EXPIRED', 'Work media upload session expired');
  if (input.chunkIndex < 0 || input.chunkIndex >= Number(session.totalChunks)) fail('INVALID_MEDIA_UPLOAD_CHUNK', 'Invalid Work media chunk');
  const bytes = Buffer.from(input.base64, 'base64');
  const expected = Math.min(CHUNK_BYTES, Number(session.totalFileSize) - input.chunkIndex * CHUNK_BYTES);
  if (bytes.toString('base64') !== input.base64 || bytes.length !== expected || createHash('sha256').update(bytes).digest('hex') !== String(input.sha256).toLowerCase())
    fail('MEDIA_UPLOAD_CHUNK_CHECKSUM', 'Work media chunk checksum or size did not match');
  // Writing the same chunk again is harmless: the bytes are pinned by their checksum.
  await store().put(chunkKey(input.uploadId, input.chunkIndex), bytes, 'application/octet-stream');
  return { uploadId: input.uploadId, chunkIndex: input.chunkIndex, stored: true, idempotent: false };
}

export async function r2MediaFinalize(input: Json, session: Json | null, ownerUserId: string): Promise<Json> {
  const done = (mediaId: string) => ({ uploadId: input.uploadId, mediaId, finalized: true });
  if (!session) {
    // Already finalized (session removed): answer from the manifest.
    const manifest = input.mediaId ? await readJson(manifestKey(input.mediaId)) as Manifest | null : null;
    if (manifest && ['finalized', 'attached'].includes(manifest.props?.cxlState) && manifest.props.cxlOwner === ownerUserId) return done(String(input.mediaId));
    fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  }
  if (String(session.ownerUserId) !== ownerUserId) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'Work media upload session was not found');
  const parts: Buffer[] = [];
  for (let index = 0; index < Number(session.totalChunks); index += 1) {
    const part = await store().get(chunkKey(session.uploadId, index));
    if (!part) fail('MEDIA_UPLOAD_CHUNK_MISSING', 'A Work media chunk is missing');
    parts.push(part!.bytes);
  }
  const bytes = parts.length === 1 ? parts[0] : Buffer.concat(parts);
  if (bytes.length !== Number(session.totalFileSize)) fail('MEDIA_UPLOAD_CHUNK_CHECKSUM', 'Work media upload size did not match');
  if (createHash('sha256').update(bytes).digest('hex') !== session.sha256) fail('MEDIA_UPLOAD_FINAL_CHECKSUM', 'Work media checksum did not match');
  // The bytes decide the type (a WebP named .jpg is declared image/jpeg); GIF uploads are closed.
  const mimeType = signatureMime(bytes);
  if (!mimeType) fail('MEDIA_UPLOAD_MIME_MISMATCH', 'Work media is not a supported image (JPEG, PNG or WebP)');
  await store().put(mediaKey(session.mediaId), bytes, mimeType);
  const now = new Date().toISOString();
  await writeJson(manifestKey(session.mediaId), { size: bytes.length, mimeType, sha256: session.sha256, createdTime: now, props: {
    cxlMediaId: session.mediaId, cxlWorkId: session.workId, cxlOwner: ownerUserId, cxlSha256: session.sha256, ...placementProps(session),
    cxlUploadId: session.uploadId, cxlState: 'finalized', cxlFinalizedAt: now, cxlDelivery: 'vercel_proxy', cxlStorage: 'r2' } } satisfies Manifest);
  await store().delete([sessionKey(session.uploadId), ...parts.map((_, index) => chunkKey(session.uploadId, index))]);
  return done(String(session.mediaId));
}

async function listAll(prefix: string): Promise<{ key: string; uploaded: number }[]> {
  const keys: { key: string; uploaded: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await store().list(prefix, cursor);
    keys.push(...page.keys);
    cursor = page.cursor;
  } while (cursor && keys.length < 5000);
  return keys;
}

/**
 * Port of cleanupWorkMedia for R2: after 24 hours, images a Work stopped using ("retired") and
 * uploads never attached ("finalized"/"uploading") are marked trashed; trashed images are deleted
 * after 30 more days; abandoned sessions and chunks are deleted after 24 hours.
 */
export async function r2CleanupWorkMedia(now = Date.now()): Promise<{ trashed: number; deleted: number }> {
  if (!bucket) return { trashed: 0, deleted: 0 };
  const stamp = (value: unknown) => Date.parse(String(value || '')) || 0;
  let trashed = 0;
  let deleted = 0;
  for (const { key } of await listAll('upload/')) {
    if (trashed + deleted >= CLEANUP_MAX_ITEMS) break;
    const mediaId = key.replace(/^upload\//, '').replace(/\.json$/, '');
    const manifest = await readJson(key) as Manifest | null;
    const props = manifest?.props || {};
    if (props.cxlState === 'trashed') {
      if (stamp(props.cxlTrashedAt) && stamp(props.cxlTrashedAt) < now - DELETE_AFTER_TRASH_MS) { await store().delete([mediaKey(mediaId), key]); deleted += 1; }
      continue;
    }
    const stale = props.cxlState === 'retired' ? Boolean(stamp(props.cxlRetiredAt)) && stamp(props.cxlRetiredAt) < now - CLEANUP_AFTER_MS
      : (props.cxlState === 'finalized' || props.cxlState === 'uploading') && stamp(props.cxlFinalizedAt || manifest?.createdTime) < now - CLEANUP_AFTER_MS;
    if (stale) { await patchManifest(mediaId, { cxlState: 'trashed', cxlTrashedAt: new Date(now).toISOString() }); trashed += 1; }
  }
  const leftovers = [...await listAll('session/'), ...await listAll('chunk/')].filter(item => item.uploaded < now - CLEANUP_AFTER_MS).map(item => item.key);
  if (leftovers.length) await store().delete(leftovers.slice(0, 1000));
  return { trashed, deleted };
}
