import { createSign } from 'node:crypto';
import { getOwnerAuthConfig } from '../../src/server/cxlOwnerAuth.js';
import { loadSealedOwnerDriveCredential, OWNER_DRIVE_CREDENTIAL_FILE, ownerDriveAccessToken } from '../../src/server/cxlOwnerDrive.js';

/**
 * Direct, read-only Google Sheets/Drive access with a Service Account.
 * The Apps Script Web App sometimes finishes but never delivers its response,
 * so Owner reads use the Google REST APIs instead and fall back to Apps Script
 * when this is not configured or fails. Writes still go through Apps Script.
 * Mirrors fetchCxlWorks_ / cxlAssetFromRecord_ in apps-script/api-only-owner/Code.gs.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly';
const DIRECT_TIMEOUT_MS = 8_000;
const PRIVATE_SUMMARY_VERSION = 1;

type Row = Record<string, unknown>;
type Options = Record<string, unknown>;

function config() {
  const email = process.env.CXL_GOOGLE_SA_EMAIL?.trim();
  // Vercel stores the PEM on one line; restore the escaped newlines.
  const privateKey = process.env.CXL_GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const privateSheetId = process.env.CXL_PRIVATE_SHEET_ID?.trim();
  return email && privateKey && privateSheetId ? { email, privateKey, privateSheetId } : null;
}

export function directOwnerReadsEnabled(): boolean {
  return config() !== null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

// Short-lived, in-flight-deduplicated cache for public/media reads. A page asks for
// dozens of images at once; without it each image re-read the Sheets and hit the
// 60 reads/minute quota (HTTP 429). Owner list/detail reads never use it.
const readCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
function cachedRead<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = readCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;
  const value = load();
  readCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  value.catch(() => { if (readCache.get(key)?.value === value) readCache.delete(key); });
  if (readCache.size > 500) for (const [cacheKey, entry] of readCache) if (entry.expiresAt <= Date.now()) readCache.delete(cacheKey);
  return value;
}
const PUBLIC_READ_CACHE_MS = 60_000;

/** Drop this instance's cached public list so the next read reflects a just-saved change. */
export function invalidatePublicReadCache(): void {
  readCache.delete('public-index');
  readCache.delete('public-projection-ids');
}
// Canonical record files are written under a new name per revision, so a file ID's content is stable.
const RECORD_FILE_CACHE_MS = 5 * 60_000;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const cfg = config();
  if (!cfg) throw new Error('Google direct reads are not configured');
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: cfg.email, scope: SCOPES, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(cfg.privateKey).toString('base64url');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !body?.access_token) throw new Error(`Google token request failed (HTTP ${response.status})`);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

/** Service Account Drive GET for server modules (e.g. reading the sealed Owner Drive credential). */
export function directDriveGet(url: string): Promise<globalThis.Response> {
  return googleGet(url);
}

async function googleGet(url: string): Promise<globalThis.Response> {
  let response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS) });
  // The Service Account's Sheets quota is per user (~60 reads/min). When it runs out,
  // retry once as the Owner (connected Drive grant), whose quota is separate.
  if (response.status === 429 && !url.includes(OWNER_DRIVE_CREDENTIAL_FILE)) {
    const ownerToken = await ownerFallbackToken().catch(() => null);
    if (ownerToken) {
      console.info(JSON.stringify({ event: 'cxl_direct_read_owner_quota_fallback', api: url.includes('sheets.googleapis.com') ? 'sheets' : 'drive' }));
      response = await fetch(url, { headers: { Authorization: `Bearer ${ownerToken}` }, signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS) });
    }
  }
  if (!response.ok) throw new Error(`Google API request failed (HTTP ${response.status})`);
  return response;
}

let sealedOwnerCredential: { value: string | null; expiresAt: number } | null = null;

/** Owner access token from the connected Drive grant, or null when not connected. */
async function ownerFallbackToken(): Promise<string | null> {
  const config = getOwnerAuthConfig();
  const folderId = process.env.CXL_INCOMING_FOLDER_ID?.trim();
  if (!config || !folderId) return null;
  if (!sealedOwnerCredential || sealedOwnerCredential.expiresAt <= Date.now()) {
    // Reading the credential is a Drive call, which has its own (much larger) quota.
    sealedOwnerCredential = { value: await loadSealedOwnerDriveCredential(folderId, serviceAccountGet), expiresAt: Date.now() + 10 * 60_000 };
  }
  return sealedOwnerCredential.value ? ownerDriveAccessToken(sealedOwnerCredential.value, config) : null;
}

async function serviceAccountGet(url: string): Promise<globalThis.Response> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Google API request failed (HTTP ${response.status})`);
  return response;
}

/** First tab of the private Index sheet, as header-keyed objects (like objectRows_). */
async function privateIndexRows(): Promise<Row[]> {
  const cfg = config()!;
  // A1 notation without a sheet name targets the first sheet, matching sheet_() in Apps Script.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.privateSheetId)}/values/A:ZZ`
    + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS';
  const body = await (await googleGet(url)).json() as { values?: unknown[][] };
  const [headers = [], ...rows] = body.values || [];
  return rows.map(values => {
    const row: Row = {};
    headers.forEach((key, index) => { row[String(key)] = values[index] ?? ''; });
    return row;
  });
}

async function driveJson(fileId: string): Promise<Row> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  return await (await googleGet(url)).json() as Row;
}

const flag = (value: unknown) => value === true || String(value).toLowerCase() === 'true';
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const nullable = (value: unknown) => (value && value !== 'null' ? value : null);

function summaryAsset(row: Row): Row {
  let saved: { summaryVersion?: unknown; asset?: unknown } | null = null;
  try { saved = JSON.parse(text(row.summary_json)); } catch { saved = null; }
  if (Number(row.summary_version) !== PRIVATE_SUMMARY_VERSION || !saved || saved.summaryVersion !== PRIVATE_SUMMARY_VERSION
    || !saved.asset || typeof saved.asset !== 'object') throw new Error('Owner Work summary index is incomplete');
  return saved.asset as Row;
}

type MediaRecord = Record<string, unknown>;
function mediaProjection(record: Row, assetId: unknown) {
  return ((record.mediaRecords as MediaRecord[] | undefined) || []).map(m => ({
    id: m.id, assetId: assetId ?? m.asset_id, storagePath: m.storage_path, delivery: m.delivery === 'vercel_proxy' ? 'vercel_proxy' : undefined,
    purpose: m.purpose, contextId: m.context_id || null, mimeType: m.mime_type, fileSize: Number(m.file_size || 0), sortOrder: Number(m.sort_order || 0),
    isCover: !!m.is_cover, naturalWidth: m.natural_width, naturalHeight: m.natural_height, createdAt: m.created_at, updatedAt: m.updated_at
  }));
}

/** Port of publicSnapshot_: the public Collaboration Apps Script publishes from a draft. */
function publicSnapshotFromDraft(draft: Row): Row {
  const p = (draft.visibilityPolicy || {}) as Row;
  const policy = { showParticipantStatuses: !!p.showParticipantStatuses, showParticipantNotes: !!p.showParticipantNotes, showParticipantDeadlineOverrides: !!p.showParticipantDeadlineOverrides };
  const list = (value: unknown) => (Array.isArray(value) ? value : []) as Row[];
  return {
    name: draft.name || '', sharedTag: draft.sharedTag || '', platforms: draft.platforms || [],
    sharedInformation: list(draft.sharedInformation).filter(x => x && (x.title || x.content))
      .map(x => ({ id: x.id, title: x.title, type: x.type, content: x.content, appScope: x.appScope, platforms: x.platforms || [] })),
    deadlines: list(draft.deadlines).filter(x => x && (x.label || x.date)),
    participants: list(draft.participants).filter(x => x && (x.creatorName || x.externalWorkName || list(x.referenceImages).length)).map(x => {
      const q: Row = { id: x.id, isOwner: !!x.isOwner, creatorName: x.creatorName || '', houseTag: x.houseTag || '', platforms: x.platforms || [],
        externalWorkName: x.externalWorkName || '', referenceImages: x.referenceImages || [], linkedWorkIds: x.linkedWorkIds || [] };
      if (policy.showParticipantStatuses) { q.dataStatus = x.dataStatus; q.imageStatus = x.imageStatus; }
      if (policy.showParticipantNotes) q.notes = x.notes || '';
      if (policy.showParticipantDeadlineOverrides && x.useDeadlineOverrides) q.deadlineOverrides = x.deadlineOverrides || {};
      return q;
    }),
    visibilityPolicy: policy
  };
}

/** Port of cxlAssetFromRecord_, with a Collaboration's public view built from its current draft (as projection_ does). */
function assetFromRecord(record: Row): Row {
  const asset = assetFromRecordBase(record);
  if (asset.category === 'collab' && isObject(record.collaborationDraft)) asset.publicCollaboration = publicSnapshotFromDraft(record.collaborationDraft);
  return asset;
}

function assetFromRecordBase(record: Row): Row {
  if (record.cxlAsset && typeof record.cxlAsset === 'object') {
    const saved = JSON.parse(JSON.stringify(record.cxlAsset)) as Row;
    saved.revision = Number(record.revision) || 1;
    saved.media = mediaProjection(record, undefined);
    return saved;
  }
  const r = (record.row || {}) as Row;
  return {
    id: r.id, userId: r.user_id || 'google-owner', authorName: r.author_name || 'Creator', authorAvatar: r.author_avatar,
    title: r.title || '', icon: r.icon || { type: 'emoji', value: '✨' }, category: r.category || 'character', shortDescription: r.short_description || '',
    contentTypeLabels: r.content_type_labels || [], contentTypes: r.content_types || [], presentationMetadata: r.presentation_metadata,
    publicCollaboration: r.public_collaboration || null, collaborationAssetId: nullable(r.collaboration_asset_id), collaboration: record.collaborationDraft || null,
    contentBlocks: r.content_blocks || [], content: r.content || '', uiCodeSnippet: r.ui_code_snippet || '', previewImage: r.preview_image || '',
    previewImages: r.preview_images || [], media: mediaProjection(record, r.id),
    folderId: nullable(r.folder_id), isPublic: r.visibility === 'public' && flag(r.is_public) && !r.deleted_at,
    visibility: r.visibility || 'private', status: r.status || 'draft', tags: r.tags || [],
    createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at || null, likesCount: Number(r.likes_count || 0), forkCount: Number(r.fork_count || 0),
    forkedFromId: nullable(r.forked_from_id), forkedFromAuthor: nullable(r.forked_from_author), linkedAssetIds: r.linked_asset_ids || [],
    versions: r.versions || [], revision: Number(record.revision) || 1
  };
}

// ---- Work media (legacy drive_file_id records and new vercel_proxy records) ----

const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function mediaSignatureMatches(mimeType: string, bytes: Buffer) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

/**
 * Read one Work image straight from Drive. `public` requires a public Work whose
 * sanitized public projection references the image; `owner` trusts the caller's
 * verified Owner session. `requireProxy` limits to new vercel_proxy uploads.
 * Returns null when the image is not found/allowed (caller answers 404 or falls back).
 */
export async function directWorkMedia(workId: string, ref: string, scope: 'public' | 'owner', requireProxy: boolean): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!/^media:[A-Za-z0-9_-]{1,128}$/.test(ref)) return null;
  const authKey = `${scope}|${requireProxy}|${workId}|${ref}`;
  const authorized = mediaAuthorizations.get(authKey);
  const media = authorized && authorized.expiresAt > Date.now() ? authorized.media : await authorizeWorkMedia(workId, ref, scope, requireProxy);
  if (!media) return null;
  if (!authorized || authorized.expiresAt <= Date.now()) {
    mediaAuthorizations.set(authKey, { media, expiresAt: Date.now() + MEDIA_AUTHORIZATION_CACHE_MS });
    if (mediaAuthorizations.size > 2000) for (const [key, entry] of mediaAuthorizations) if (entry.expiresAt <= Date.now()) mediaAuthorizations.delete(key);
  }
  const response = await googleGet(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(text(media.drive_file_id))}?alt=media&supportsAllDrives=true`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MEDIA_MAX_BYTES) throw new Error('Work media exceeds the size limit');
  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType = (response.headers.get('content-type') || text(media.mime_type)).split(';')[0].trim().toLowerCase();
  if (!bytes.length || bytes.length > MEDIA_MAX_BYTES || !MEDIA_MIME_TYPES.has(mimeType) || !mediaSignatureMatches(mimeType, bytes))
    throw new Error('Work media file is invalid');
  return { bytes, mimeType };
}

// A media reference resolves to the same Drive file for its lifetime, so a successful
// authorization is reused briefly per instance instead of re-reading the Sheets index.
// Short enough that a Work turned private stops serving its images within minutes.
const MEDIA_AUTHORIZATION_CACHE_MS = 5 * 60_000;
const mediaAuthorizations = new Map<string, { media: Row; expiresAt: number }>();

async function authorizeWorkMedia(workId: string, ref: string, scope: 'public' | 'owner', requireProxy: boolean): Promise<Row | null> {
  const mediaId = ref.slice('media:'.length);
  let mediaRecords: Row[];
  if (scope === 'public' && !requireProxy) {
    // Legacy images: authorize against the published projection alone, exactly as the
    // Temporary Public site does. One cached Sheets range per instance instead of three,
    // so a page of images no longer exhausts the Sheets per-minute quota.
    if (!directPublicReadsEnabled()) return null;
    const fileId = (await publicProjectionFileIds()).get(workId);
    if (!fileId) return null;
    const projection = await cachedRead(`file:${fileId}`, PUBLIC_READ_CACHE_MS, () => driveJson(fileId));
    if (text(projection.id) !== workId || !JSON.stringify(projection).includes(ref)) return null;
    mediaRecords = ((projection.mediaRecords as Row[] | undefined) || []).filter(isObject);
  } else if (scope === 'public') {
    if (!directPublicReadsEnabled()) return null;
    const sources = await publicWorkSources(workId);
    if (!sources || !JSON.stringify(sources.asset).includes(ref)) return null;
    mediaRecords = sources.mediaRecords;
  } else {
    const row = (await cachedRead('private-index', PUBLIC_READ_CACHE_MS, privateIndexRows)).find(item => text(item.id) === workId);
    if (!row || !text(row.file_id)) return null;
    const record = await cachedRead(`file:${text(row.file_id)}`, RECORD_FILE_CACHE_MS, () => driveJson(text(row.file_id)));
    if (text(((record.row || {}) as Row).id) !== workId || !JSON.stringify(record).includes(ref)) return null;
    mediaRecords = ((record.mediaRecords as Row[] | undefined) || []).filter(isObject);
  }
  // A record with a Drive file wins over a duplicate entry without one.
  const matches = mediaRecords.filter(item => text(item.id) === mediaId || item.storage_path === ref || item.original_ref === ref);
  const media = matches.find(item => text(item.drive_file_id)) || matches[0];
  if (!media || !text(media.drive_file_id)) return null;
  if (requireProxy && (media.delivery !== 'vercel_proxy' || text(media.asset_id) !== workId)) return null;
  return media;
}

/**
 * After a stalled media.upload.finalize, confirm from Drive that the canonical file
 * (cxl-work-media-<mediaId>.<ext>, written by finalize) exists. Returns the finalize
 * result shape, or null when it is not there yet.
 */
export async function verifyWorkMediaFinalized(uploadId: string, mediaId: string): Promise<Row | null> {
  if (!/^[a-f0-9-]{36}$/i.test(mediaId)) return null;
  const query = `name contains 'cxl-work-media-${mediaId}.' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const listed = await (await googleGet(url)).json() as { files?: { name?: string; size?: string }[] };
  const found = (listed.files || []).some(file => new RegExp(`^cxl-work-media-${mediaId}\\.(jpg|jpeg|png|gif|webp)$`, 'i').test(file.name || '') && Number(file.size) > 0);
  return found ? { uploadId, mediaId, finalized: true } : null;
}

// ---- Owner folders (port of getFolders_ + cxlOwnerFolders_) ----

export function directFoldersEnabled(): boolean {
  return config() !== null && Boolean(process.env.CXL_INCOMING_FOLDER_ID?.trim());
}

/** Returns the Apps Script folders.fetch data shape: { data: Folder[], error: null }. */
export async function directOwnerFolders(ownerUserId: string): Promise<{ data: Row[]; error: null }> {
  if (!ownerUserId) throw new Error('Authenticated Owner is required');
  const folderId = process.env.CXL_INCOMING_FOLDER_ID!.trim();
  const query = `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and name = 'folders.jsonl' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const listed = await (await googleGet(listUrl)).json() as { files?: { id?: string }[] };
  const fileId = listed.files?.[0]?.id;
  if (!fileId) return { data: [], error: null };
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const lines = (await (await googleGet(url)).text()).split(/\r?\n/).filter(Boolean);
  const folders = lines.map(line => JSON.parse(line) as Row)
    .filter(folder => folder && text(folder.user_id) === ownerUserId)
    .map(folder => {
      if (!folder.id || !folder.name || !folder.created_at || !folder.updated_at) throw new Error('Folder source does not match the CXL Folder contract');
      return { id: text(folder.id), userId: ownerUserId, name: text(folder.name), icon: folder.icon || '📁', color: folder.color || 'purple',
        createdAt: text(folder.created_at), updatedAt: text(folder.updated_at) };
    });
  return { data: folders, error: null };
}

/**
 * Confirm a folder write from folders.jsonl after its Apps Script response stalls.
 * `args` are the Apps Script arguments (create carries the server-chosen ID).
 */
export async function verifyOwnerFolderCommitted(action: string, args: unknown[], ownerUserId: string): Promise<unknown | null> {
  const { data: folders } = await directOwnerFolders(ownerUserId);
  if (action === 'folders.delete') return folders.some(folder => folder.id === text(args[0])) ? null : { success: true, error: null };
  const input = (action === 'folders.create' ? args[0] : args[1]) as Row | undefined;
  const id = action === 'folders.create' ? text(input?.id) : text(args[0]);
  const folder = folders.find(item => item.id === id);
  if (!folder) return null;
  if (action === 'folders.update') {
    const same = (key: string) => typeof input?.[key] !== 'string' || !(input[key] as string).trim() || folder[key] === (input[key] as string).trim().slice(0, key === 'name' ? 100 : key === 'icon' ? 16 : 32);
    if (!same('name') || !same('icon') || !same('color')) return null;
  }
  return { data: folder, error: null };
}

// ---- Public reads (port of publicReadSnapshotBuildPayload_ works + public.works.detail) ----

const PUBLIC_SUMMARY_VERSIONS = [1, 2];
const PUBLIC_CREATOR_ID_RE = /^cxlc_[a-f0-9]{32}$/i;
const PUBLIC_ASSET_FIELDS = ['id','title','authorName','authorAvatar','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','icon','content','contentBlocks','uiCodeSnippet','previewImage','previewImages','media','isPublic','visibility','status','tags','createdAt','updatedAt','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','linkedAssetIds','versions','publicCreatorId'];
const MEDIA_REF_RE = /^media:[A-Za-z0-9_-]{1,128}$/;
const HASH_REF_RE = /^cxl-media:[a-f0-9]{64}$/i;
const IMAGE_MIME_RE = /^(image\/(?:jpeg|png|webp|gif))$/i;
const WORK_ID_RE = /^asset_[A-Za-z0-9_-]{1,96}$/;

export function directPublicReadsEnabled(): boolean {
  return config() !== null && Boolean(process.env.CXL_PUBLIC_SHEET_ID?.trim());
}

async function sheetRows(spreadsheetId: string, range: string): Promise<Row[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS';
  const body = await (await googleGet(url)).json() as { values?: unknown[][] };
  const [headers = [], ...rows] = body.values || [];
  const names = headers.map(value => text(value));
  if (new Set(names.filter(Boolean)).size !== names.filter(Boolean).length) throw new Error('Public snapshot source has duplicate columns');
  return rows.filter(values => values.some(value => value !== '' && value !== null && value !== undefined)).map(values => {
    const row: Row = {};
    names.forEach((key, index) => { if (key) row[key] = values[index] ?? ''; });
    return row;
  });
}

/** Port of publicReadSafeUrl_. */
function safeUrl(value: unknown, withoutQuery: boolean): string {
  const url = text(value);
  if (!url || url.length > 2048 || /^data:/i.test(url)) return '';
  const match = url.match(/^https:\/\/([^/?#@]+)(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i);
  if (!match) return '';
  const host = match[1].toLowerCase();
  if (/(^|\.)drive\.google\.com$/.test(host) || /(^|\.)googleusercontent\.com$/.test(host) || /(^|\.)script\.google\.com$/.test(host)) return '';
  return withoutQuery && /[?#]/.test(url) ? '' : url;
}
const mediaOrSafe = (value: unknown) => { const ref = text(value); return MEDIA_REF_RE.test(ref) || HASH_REF_RE.test(ref) ? ref : safeUrl(ref, false); };
const strings = (value: unknown, max: number) => (Array.isArray(value) ? value : []).filter(item => typeof item === 'string').slice(0, max) as string[];
const isObject = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Port of sanitizePublicReadWork_. */
function sanitizePublicWork(asset: Row | null, fullDetail: boolean): Row | null {
  if (!isObject(asset)) return null;
  const safe: Row = {};
  PUBLIC_ASSET_FIELDS.forEach(key => { if (Object.prototype.hasOwnProperty.call(asset, key)) safe[key] = asset[key]; });
  safe.isPublic = true; safe.visibility = 'public'; safe.authorName = text(safe.authorName || 'Creator').slice(0, 200);
  if (safe.authorAvatar) safe.authorAvatar = safeUrl(safe.authorAvatar, false) || undefined;
  if (isObject(safe.icon)) {
    const icon = safe.icon, iconValue = text(icon.value), iconType = text(icon.type || 'emoji');
    if (iconType === 'image' && (MEDIA_REF_RE.test(iconValue) || HASH_REF_RE.test(iconValue) || safeUrl(iconValue, false))) {
      const safeIcon: Row = { type: 'image', value: iconValue };
      if (MEDIA_REF_RE.test(iconValue)) safeIcon.mediaId = iconValue.slice(6);
      else if (MEDIA_REF_RE.test(text(icon.mediaId))) safeIcon.mediaId = text(icon.mediaId);
      if (typeof icon.mimeType === 'string' && IMAGE_MIME_RE.test(icon.mimeType)) safeIcon.mimeType = icon.mimeType;
      safe.icon = safeIcon;
    } else safe.icon = { type: 'emoji', value: iconType === 'emoji' ? iconValue.slice(0, 32) : '✨' };
  }
  if (safe.previewImage) safe.previewImage = mediaOrSafe(safe.previewImage) || '';
  safe.previewImages = (Array.isArray(safe.previewImages) ? safe.previewImages : []).map(mediaOrSafe).filter(Boolean).slice(0, 12);
  safe.media = (Array.isArray(safe.media) ? safe.media : []).filter(isObject).map(media => {
    const out: Row = {};
    ['id','assetId','purpose','contextId','mimeType','fileSize','sortOrder','isCover','createdAt','updatedAt'].forEach(key => { if (media[key] !== undefined) out[key] = media[key]; });
    if (media.delivery === 'vercel_proxy') out.delivery = 'vercel_proxy';
    return out;
  });
  if (isObject(safe.publicCollaboration)) {
    const collab = safe.publicCollaboration, policy = isObject(collab.visibilityPolicy) ? collab.visibilityPolicy : {};
    safe.publicCollaboration = {
      name: text(collab.name), sharedTag: text(collab.sharedTag), platforms: strings(collab.platforms, 20),
      sharedInformation: (Array.isArray(collab.sharedInformation) ? collab.sharedInformation : []).slice(0, 20).map((item: unknown) => {
        const out: Row = {};
        if (isObject(item)) {
          ['id','title','type','content','appScope'].forEach(key => { if (typeof item[key] === 'string') out[key] = (item[key] as string).slice(0, key === 'content' ? 4000 : 160); });
          if (Array.isArray(item.platforms)) out.platforms = strings(item.platforms, 20);
        }
        return out;
      }),
      deadlines: (Array.isArray(collab.deadlines) ? collab.deadlines : []).map((item: unknown) => isObject(item) ? { label: text(item.label), date: text(item.date) } : null).filter(Boolean),
      participants: (Array.isArray(collab.participants) ? collab.participants : []).map((raw: unknown) => {
        const item = isObject(raw) ? raw : {};
        const p: Row = {};
        ['isOwner','creatorName','houseTag','platforms','externalWorkName'].forEach(key => { if (item[key] !== undefined) p[key] = item[key]; });
        p.referenceImages = (Array.isArray(item.referenceImages) ? item.referenceImages : []).map((ref: unknown, index: number) => {
          const refObject = isObject(ref) ? ref : null;
          let value = typeof ref === 'string' ? ref : text(refObject?.src || refObject?.storageKey);
          if (!MEDIA_REF_RE.test(value) && !HASH_REF_RE.test(value)) value = safeUrl(value, false);
          if (!value) return null;
          const mediaId = MEDIA_REF_RE.test(value) ? value.slice(6) : '';
          const mimeType = refObject && IMAGE_MIME_RE.test(text(refObject.mimeType)) ? text(refObject.mimeType) : undefined;
          const image: Row = { id: text(refObject?.id || mediaId || `reference-${index}`).slice(0, 160), src: value, kind: mimeType === 'image/gif' ? 'gif' : 'image' };
          if (mediaId) image.mediaId = mediaId;
          if (mimeType) image.mimeType = mimeType;
          if (refObject && Number(refObject.naturalWidth) > 0) image.naturalWidth = Number(refObject.naturalWidth);
          if (refObject && Number(refObject.naturalHeight) > 0) image.naturalHeight = Number(refObject.naturalHeight);
          return image;
        }).filter(Boolean).slice(0, 12);
        p.linkedWorkIds = (Array.isArray(item.linkedWorkIds) ? item.linkedWorkIds : []).filter((id: unknown) => WORK_ID_RE.test(text(id))).slice(0, 24);
        if (policy.showParticipantStatuses) ['dataStatus','imageStatus'].forEach(key => { if (item[key] !== undefined) p[key] = item[key]; });
        if (policy.showParticipantNotes && item.notes !== undefined) p.notes = item.notes;
        if (policy.showParticipantDeadlineOverrides && item.useDeadlineOverrides && isObject(item.deadlineOverrides)) {
          const overrides: Row = {};
          Object.keys(item.deadlineOverrides).slice(0, 20).forEach(key => {
            const value = (item.deadlineOverrides as Row)[key];
            if (/^[A-Za-z0-9_-]{1,128}$/.test(key) && typeof value === 'string') overrides[key] = value.slice(0, 40);
          });
          p.deadlineOverrides = overrides;
        }
        return p;
      }),
      visibilityPolicy: { showParticipantStatuses: !!policy.showParticipantStatuses, showParticipantNotes: !!policy.showParticipantNotes, showParticipantDeadlineOverrides: !!policy.showParticipantDeadlineOverrides }
    };
  }
  if (!fullDetail) {
    safe.content = text(safe.content).slice(0, 600); safe.uiCodeSnippet = text(safe.uiCodeSnippet).slice(0, 600);
    safe.contentBlocks = (Array.isArray(safe.contentBlocks) ? safe.contentBlocks : []).slice(0, 24).map((block: unknown) => {
      const b = isObject(block) ? block : {};
      return { id: text(b.id).slice(0, 50), type: text(b.type || 'Text').slice(0, 30), title: text(b.title).slice(0, 100), body: '' };
    });
  }
  if (Array.isArray(safe.linkedAssetIds)) safe.linkedAssetIds = safe.linkedAssetIds.filter((id: unknown) => WORK_ID_RE.test(text(id))).slice(0, 50);
  return safe;
}

/** Works part of publicReadSnapshotBuildPayload_: the anonymous public list. */
export async function directPublicWorksList(): Promise<Row[]> {
  return (await publicWorksIndex()).works;
}

/** Active public Index rows → published projection file ID (first tab, one range). */
function publicProjectionFileIds(): Promise<Map<string, string>> {
  return cachedRead('public-projection-ids', PUBLIC_READ_CACHE_MS, async () => {
    const rows = await sheetRows(process.env.CXL_PUBLIC_SHEET_ID!.trim(), 'A:K');
    const ids = new Map<string, string>();
    rows.forEach(row => { if (flag(row.active) && text(row.file_id)) ids.set(text(row.id), text(row.file_id)); });
    return ids;
  });
}

function publicWorksIndex(): Promise<{ works: Row[]; projectionFileIds: Map<string, string> }> {
  return cachedRead('public-index', PUBLIC_READ_CACHE_MS, loadPublicWorksIndex);
}

async function loadPublicWorksIndex(): Promise<{ works: Row[]; projectionFileIds: Map<string, string> }> {
  const sheetId = process.env.CXL_PUBLIC_SHEET_ID!.trim();
  // The Index tab is the first sheet (A:K = PUBLIC_HEADERS); A1 without a sheet name targets it.
  const [indexRows, mapRows] = await Promise.all([sheetRows(sheetId, 'A:K'), sheetRows(sheetId, 'WorkCreatorMap!A:ZZ').catch((error: unknown) => {
    // Apps Script treats a missing tab as empty; any other failure must surface.
    if (error instanceof Error && /HTTP 400/.test(error.message)) return [] as Row[];
    throw error;
  })]);
  const creatorMap = new Map<string, string>(), duplicates = new Set<string>();
  mapRows.forEach(row => {
    const id = text(row.workId), creator = text(row.publicCreatorId);
    if (!/^asset_[A-Za-z0-9_-]+$/.test(id) || !PUBLIC_CREATOR_ID_RE.test(creator) || Number(row.schemaVersion) !== 1) return;
    if (creatorMap.has(id)) duplicates.add(id); else creatorMap.set(id, creator);
  });
  duplicates.forEach(id => creatorMap.delete(id));
  const works: Row[] = [], publicIds = new Set<string>(), projectionFileIds = new Map<string, string>();
  indexRows.forEach(row => {
    if (!flag(row.active)) return;
    if (text(row.file_id)) projectionFileIds.set(text(row.id), text(row.file_id));
    let envelope: { summaryVersion?: unknown; asset?: Row } | null = null;
    try { envelope = JSON.parse(text(row.summary_json)); } catch { throw new Error('Public summary index is not ready'); }
    const asset = envelope?.asset;
    if (!envelope || !PUBLIC_SUMMARY_VERSIONS.includes(Number(envelope.summaryVersion)) || !isObject(asset) || asset.id !== text(row.id)
      || asset.visibility !== 'public' || asset.isPublic !== true || typeof asset.title !== 'string' || typeof asset.category !== 'string'
      || typeof asset.status !== 'string' || !Array.isArray(asset.tags) || !Array.isArray(asset.media)) throw new Error('Public summary index is not ready');
    const safe = sanitizePublicWork(asset, false);
    if (!safe) throw new Error('Public summary index is not ready');
    safe.id = text(row.id); safe.publicCreatorId = creatorMap.get(text(row.id)) || undefined;
    works.push(safe); publicIds.add(text(row.id));
  });
  works.forEach(work => { if (work.collaborationAssetId && !publicIds.has(text(work.collaborationAssetId))) work.collaborationAssetId = null; });
  return { works, projectionFileIds };
}

/**
 * Public view of one Work plus every media record that may back it. The published
 * projection (the file the public Index row points to) carries the Collaboration
 * built from the current draft; the private record's own copy can be stale.
 */
async function publicWorkSources(assetId: string): Promise<{ asset: Row; mediaRecords: Row[] } | null> {
  const [{ works, projectionFileIds }, rows] = await Promise.all([publicWorksIndex(), cachedRead('private-index', PUBLIC_READ_CACHE_MS, privateIndexRows)]);
  const summary = works.find(work => work.id === assetId);
  if (!summary) return null;
  const row = rows.find(item => text(item.id) === assetId);
  if (!row || !text(row.file_id)) return null;
  const projectionFileId = projectionFileIds.get(assetId);
  const readFile = (fileId: string, ttlMs: number) => cachedRead(`file:${fileId}`, ttlMs, () => driveJson(fileId));
  // The projection may be rewritten in place, so it gets the short public TTL.
  const [record, projection] = await Promise.all([
    readFile(text(row.file_id), RECORD_FILE_CACHE_MS),
    projectionFileId ? readFile(projectionFileId, PUBLIC_READ_CACHE_MS).catch(() => null) : Promise.resolve(null)
  ]);
  const recordRow = (record.row || {}) as Row;
  if (!(recordRow.visibility === 'public' && flag(recordRow.is_public) && !recordRow.deleted_at)) return null;
  const source = assetFromRecord(record);
  if (source.category === 'collab' && projection && isObject(projection.public_collaboration)) source.publicCollaboration = projection.public_collaboration;
  const asset = sanitizePublicWork(source, true);
  if (!asset || asset.id !== assetId) return null;
  asset.publicCreatorId = summary.publicCreatorId || undefined;
  if (asset.collaborationAssetId && !works.some(work => work.id === asset.collaborationAssetId)) asset.collaborationAssetId = null;
  const mediaRecords = [...((record.mediaRecords as Row[] | undefined) || []), ...((projection?.mediaRecords as Row[] | undefined) || [])].filter(isObject);
  return { asset, mediaRecords };
}

/** Port of the public.works.detail branch of publicReadDispatch_. Returns null when not public. */
export async function directPublicWorkDetail(assetId: string): Promise<Row | null> {
  return (await publicWorkSources(assetId))?.asset || null;
}

/**
 * After an Apps Script write times out, check whether it was actually committed.
 * Update/create match the request's own requestId (Apps Script stores it as
 * lastWriteRequestId / create_request_id); deletion actions match the row state.
 * Returns the same `data` shape Apps Script would have returned, or null.
 */
export async function verifyOwnerWriteCommitted(action: string, args: unknown[]): Promise<unknown | null> {
  const rows = await privateIndexRows();
  if (action === 'works.update' || action === 'works.create') {
    const options = (action === 'works.update' ? args[2] : args[1]) as { requestId?: unknown } | undefined;
    const requestId = text(options?.requestId).toLowerCase();
    if (!requestId) return null;
    const row = action === 'works.update'
      ? rows.find(item => text(item.id) === text(args[0]))
      : rows.find(item => text(item.create_request_id).toLowerCase() === requestId);
    if (!row || !text(row.file_id)) return null;
    const record = await driveJson(text(row.file_id));
    if (text(record.lastWriteRequestId).toLowerCase() !== requestId) return null;
    return { data: assetFromRecord(record), error: null };
  }
  const id = text(args[0]);
  const row = rows.find(item => text(item.id) === id);
  if (action === 'works.permanentDelete') return row ? null : { success: true, error: null };
  if (action === 'works.softDelete') return row && row.deleted_at ? { success: true, error: null } : null;
  if (action === 'works.restore') return row && !row.deleted_at ? { success: true, error: null } : null;
  return null;
}

/**
 * Port of fetchCxlWorks_ for the Owner scope. Returns null when the request needs
 * behaviour not ported here (search), so the caller uses Apps Script instead.
 */
export async function directOwnerWorksFetch(options: Options): Promise<Row[] | null> {
  if (typeof options.search === 'string' && options.search.trim()) return null;
  const rows = await privateIndexRows();
  if (typeof options.assetId === 'string' && options.assetId) {
    const row = rows.find(item => text(item.id) === options.assetId);
    if (!row || !text(row.file_id)) throw new Error('Work was not found');
    return [assetFromRecord(await driveJson(text(row.file_id)))];
  }
  if (options.detail === 'full') throw new Error('Full Work reads require one assetId');
  let index = rows.map(x => ({
    id: text(x.id), category: text(x.category), isPublic: flag(x.is_public), deletedAt: x.deleted_at || null, folderId: x.folder_id || null,
    userId: text(x.user_id), createdAt: text(x.created_at), row: x
  }));
  if (index.some(item => {
    try { return summaryAsset(item.row).id !== item.id; } catch { return true; }
  })) throw new Error('Owner Work summary index is incomplete');
  if (options.userId) index = index.filter(item => item.userId === options.userId);
  if (options.onlyDeleted && options.currentUserId) index = index.filter(item => item.userId === options.currentUserId);
  if (options.category && options.category !== 'all') index = index.filter(item => item.category === options.category);
  if (options.userId && options.folderId !== undefined) index = index.filter(item => item.folderId === options.folderId);
  if (options.publicOnly) index = index.filter(item => item.isPublic && !item.deletedAt);
  else if (options.onlyDeleted) index = index.filter(item => !!item.deletedAt);
  else if (!options.includeDeleted) index = index.filter(item => !item.deletedAt);
  // Sheet cells may render dates in display format; the summary JSON always holds the ISO value.
  const created = (item: typeof index[number]) => Date.parse(text(summaryAsset(item.row).createdAt) || item.createdAt) || 0;
  index.sort((a, b) => created(b) - created(a));
  if (options.limit) index = index.slice(0, Math.min(100, Math.max(1, Number(options.limit) || 100)));
  return index.map(item => summaryAsset(item.row));
}
