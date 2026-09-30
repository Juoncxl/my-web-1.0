import { createHash, randomUUID } from 'node:crypto';

/**
 * Direct Work update (step 3.1 of the Apps Script → Google API migration).
 *
 * A faithful port of saveCxlWorkApi_('update') + saveOwnerWork_ +
 * finishCxlPublicProjection_ from apps-script/api-only-owner/Code.gs, limited
 * to the common case: an existing Work whose media references, gallery order,
 * visibility and trash state do not change. Anything else returns
 * `{ fallback: true }` so the caller keeps using Apps Script unchanged.
 *
 * Write order mirrors Apps Script: revision JSON → search chunks → private
 * index row (commit point) → public projection → stale search cleanup. If a
 * step after the commit point fails, the caller retries through Apps Script
 * with the same requestId; its idempotent path repairs the public projection.
 */

type Row = Record<string, unknown>;
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PRIVATE_HEADERS = ['id','title','category','status','visibility','is_public','deleted_at','folder_id','tags','updated_at','revision','file_id','has_collab_draft','media_count','cover_ref','create_request_id','user_id','created_at','summary_json','summary_version','search_version','search_chunk_count','search_index_token'];
const PUBLIC_HEADERS = ['id','title','category','status','updated_at','tags','short_description','file_id','active','cover_ref','summary_json'];
const OWNER_SEARCH_SHEET = 'OwnerSearchIndex';
const OWNER_SEARCH_VERSION = 1;
const OWNER_SEARCH_CHUNK_CHARS = 30000;
const OWNER_SEARCH_OVERLAP_CHARS = 256 - 1;
const PRIVATE_SUMMARY_VERSION = 1;
const PRIVATE_SUMMARY_MAX_CHARS = 45000;
const PUBLIC_SUMMARY_VERSION = 2;
const PUBLIC_SUMMARY_MAX_CHARS = 45000;
const CXL_WRITE_FIELDS = ['authorName','authorAvatar','title','icon','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','contentBlocks','content','uiCodeSnippet','previewImage','previewImages','folderId','isPublic','visibility','status','tags','linkedAssetIds','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','versions','media','collaboration'];
const TIMEOUT_MS = 10_000;

export class DirectWriteError extends Error {
  constructor(message: string, readonly code: string, readonly committed = false) { super(message); }
}
const fail = (code: string, message: string): never => { throw new DirectWriteError(message, code); };

export interface DirectWriteEnv {
  ownerToken: string;
  privateSheetId: string;
  publicSheetId: string;
  publicCreatorId: string;
  ownerFolderIds: () => Promise<string[]>;
}

export type DirectUpdateResult = { fallback: true; reason: string } | { fallback: false; data: { data: Json; error: null } };

// ---------------------------------------------------------------- Google I/O

async function google(env: DirectWriteEnv, url: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${env.ownerToken}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new DirectWriteError(`Google API ${init.method || 'GET'} failed (HTTP ${response.status})`, 'GOOGLE_API_FAILED');
  return response;
}

const sheetsBase = (id: string) => `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;

async function sheetValues(env: DirectWriteEnv, spreadsheetId: string, range: string): Promise<unknown[][]> {
  const url = `${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS`;
  return ((await (await google(env, url)).json()) as { values?: unknown[][] }).values || [];
}

async function writeRange(env: DirectWriteEnv, spreadsheetId: string, range: string, values: unknown[][]): Promise<void> {
  await google(env, `${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
}

function columnLetter(index: number): string {
  let n = index + 1, out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

/** Reads the header row and one column, returning the 1-based sheet row numbers whose cell equals `value`. */
async function findRows(env: DirectWriteEnv, spreadsheetId: string, sheetPrefix: string, headers: string[], column: string, value: string): Promise<number[]> {
  const index = headers.indexOf(column);
  if (index < 0) fail('SHEET_SCHEMA_INVALID', `Sheet is missing the ${column} column`);
  const letter = columnLetter(index);
  const values = await sheetValues(env, spreadsheetId, `${sheetPrefix}${letter}2:${letter}`);
  return values.map((row, i) => String(row[0] ?? '') === value ? i + 2 : 0).filter(Boolean);
}

async function sheetHeaders(env: DirectWriteEnv, spreadsheetId: string, sheetPrefix: string): Promise<string[]> {
  return ((await sheetValues(env, spreadsheetId, `${sheetPrefix}1:1`))[0] || []).map(value => String(value ?? ''));
}

async function readRow(env: DirectWriteEnv, spreadsheetId: string, sheetPrefix: string, headers: string[], rowNumber: number): Promise<Row> {
  const values = (await sheetValues(env, spreadsheetId, `${sheetPrefix}A${rowNumber}:${columnLetter(headers.length - 1)}${rowNumber}`))[0] || [];
  const row: Row = { _sheetRow: rowNumber };
  headers.forEach((header, index) => { if (header) row[header] = values[index] ?? ''; });
  return row;
}

async function driveJson(env: DirectWriteEnv, fileId: string): Promise<Json> {
  return (await google(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)).json();
}

async function driveParent(env: DirectWriteEnv, fileId: string): Promise<string> {
  const body = await (await google(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`)).json() as { parents?: string[] };
  return body.parents?.[0] || fail('DRIVE_PARENT_MISSING', 'Canonical Work file has no parent folder');
}

/** Port of putJsonRevision_: replace a same-named file in the folder, else create it. */
async function putJsonRevision(env: DirectWriteEnv, folderId: string, name: string, value: unknown): Promise<string> {
  const query = `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and name = '${name.replace(/['\\]/g, '\\$&')}' and trashed = false`;
  const listed = await (await google(env, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: { id: string }[] };
  if ((listed.files || []).length > 1) fail('DUPLICATE_REVISION_FILE', 'Duplicate Work revision file');
  const existingId = listed.files?.[0]?.id;
  const boundary = `cxl-${randomUUID()}`;
  const metadata = existingId ? {} : { name, parents: [folderId], mimeType: 'application/json' };
  const body = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json', '', JSON.stringify(value), `--${boundary}--`, ''].join('\r\n');
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=multipart&supportsAllDrives=true&fields=id`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id';
  const saved = await (await google(env, url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json() as { id?: string };
  return saved.id || fail('DRIVE_WRITE_FAILED', 'Drive did not return the saved file');
}

// ------------------------------------------------------------ Code.gs ports

const flag = (value: unknown) => value === true || String(value).toLowerCase() === 'true';
const isPublicRow = (r: Row) => r.visibility === 'public' && flag(r.is_public) && !r.deleted_at;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const privateText = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const summaryArray = (value: unknown): Json[] => Array.isArray(value) ? value : [];
const summaryStrings = (value: unknown): string[] => summaryArray(value).filter(x => typeof x === 'string');

function mediaFromRecord(record: Json, assetId?: string): Json[] {
  return (record.mediaRecords || []).map((m: Json) => ({ id: m.id, assetId: assetId ?? m.asset_id, storagePath: m.storage_path, delivery: m.delivery === 'vercel_proxy' ? 'vercel_proxy' : undefined,
    purpose: m.purpose, contextId: m.context_id || null, mimeType: m.mime_type, fileSize: Number(m.file_size || 0), sortOrder: Number(m.sort_order || 0), isCover: !!m.is_cover,
    naturalWidth: m.natural_width, naturalHeight: m.natural_height, createdAt: m.created_at, updatedAt: m.updated_at }));
}

/** Port of cxlAssetFromRecord_. */
export function cxlAssetFromRecord(record: Json): Json {
  if (record.cxlAsset) { const saved = clone(record.cxlAsset); saved.revision = Number(record.revision) || 1; saved.media = mediaFromRecord(record); return saved; }
  const r = record.row || {};
  return { id: r.id, userId: r.user_id || 'google-owner', authorName: r.author_name || 'Creator', authorAvatar: r.author_avatar,
    title: r.title || '', icon: r.icon || { type: 'emoji', value: '✨' }, category: r.category || 'character', shortDescription: r.short_description || '',
    contentTypeLabels: r.content_type_labels || [], contentTypes: r.content_types || [], presentationMetadata: r.presentation_metadata,
    publicCollaboration: r.public_collaboration || null, collaborationAssetId: r.collaboration_asset_id && r.collaboration_asset_id !== 'null' ? r.collaboration_asset_id : null, collaboration: record.collaborationDraft || null,
    contentBlocks: r.content_blocks || [], content: r.content || '', uiCodeSnippet: r.ui_code_snippet || '', previewImage: r.preview_image || '',
    previewImages: r.preview_images || [], media: mediaFromRecord(record, r.id),
    folderId: r.folder_id && r.folder_id !== 'null' ? r.folder_id : null, isPublic: isPublicRow(r), visibility: r.visibility || 'private', status: r.status || 'draft', tags: r.tags || [],
    createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at || null, likesCount: Number(r.likes_count || 0), forkCount: Number(r.fork_count || 0),
    forkedFromId: r.forked_from_id && r.forked_from_id !== 'null' ? r.forked_from_id : null, forkedFromAuthor: r.forked_from_author && r.forked_from_author !== 'null' ? r.forked_from_author : null,
    linkedAssetIds: r.linked_asset_ids || [], versions: r.versions || [], revision: Number(record.revision) || 1 };
}

/** Port of mediaWorkAllReferences_ (without its inline-media rejection, handled by the caller). */
function mediaReferences(asset: unknown): { refs: string[]; inline: boolean } {
  const refs: string[] = []; let inline = false;
  const walk = (value: unknown, key: string) => {
    if (typeof value === 'string') {
      if (/^\s*(?:data:image\/|blob:)/i.test(value) || key === 'localBlobKey' || key === 'storageKey') inline = true;
      const match = value.match(/^(media:[A-Za-z0-9_-]+|cxl-media:[a-f0-9]{64})$/i); if (match) refs.push(match[1]);
      return;
    }
    if (Array.isArray(value)) { value.forEach(item => walk(item, key)); return; }
    if (value && typeof value === 'object') Object.keys(value).forEach(child => walk((value as Row)[child], child));
  };
  walk(asset, '');
  return { refs, inline };
}

function ownerSearchText(asset: Json): string {
  const values: unknown[] = [asset.title, asset.shortDescription, asset.content, asset.authorName, asset.uiCodeSnippet];
  (asset.contentBlocks || []).forEach((block: Json) => { if (block) values.push(block.title, block.body); });
  (asset.tags || []).forEach((tag: unknown) => values.push(tag));
  return values.filter(value => typeof value === 'string' && value.length > 0).join('\n').toLowerCase();
}

function ownerSearchChunks(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [], step = OWNER_SEARCH_CHUNK_CHARS - OWNER_SEARCH_OVERLAP_CHARS;
  for (let start = 0; start < text.length; start += step) {
    let end = Math.min(text.length, start + OWNER_SEARCH_CHUNK_CHARS);
    if (end < text.length && end > start && /[\uD800-\uDBFF]/.test(text.charAt(end - 1)) && /[\uDC00-\uDFFF]/.test(text.charAt(end))) end--;
    chunks.push(text.slice(start, end)); if (end >= text.length) break;
  }
  return chunks;
}

function ownerSearchArtifacts(asset: Json) {
  const chunks = ownerSearchChunks(ownerSearchText(asset));
  return { chunks, version: OWNER_SEARCH_VERSION, token: randomUUID(), updatedAt: new Date().toISOString() };
}

const compactOwnerRef = (value: unknown) => typeof value === 'string' && value.length <= 1024 && !/^data:/i.test(value) ? value : '';

function publicCardCollaboration(value: Json): Json {
  if (!value || typeof value !== 'object') return null;
  return { name: String(value.name || ''), sharedTag: String(value.sharedTag || ''), platforms: summaryStrings(value.platforms),
    sharedInformation: summaryArray(value.sharedInformation).map(() => ({})),
    deadlines: summaryArray(value.deadlines).filter(x => x && typeof x === 'object' && (x.label || x.date)).map(x => ({ label: String(x.label || ''), date: String(x.date || '') })),
    participants: summaryArray(value.participants).map(() => ({})) };
}

function privateCardCollaboration(value: Json): Json {
  const card = publicCardCollaboration(value); if (!card) return null;
  card.name = privateText(card.name, 300); card.sharedTag = privateText(card.sharedTag, 120);
  card.platforms = card.platforms.slice(0, 12).map((x: string) => privateText(x, 80));
  card.deadlines = card.deadlines.slice(0, 20).map((x: Json) => ({ label: privateText(x.label, 80), date: privateText(x.date, 40) }));
  card.sharedInformation = card.sharedInformation.slice(0, 20); card.participants = card.participants.slice(0, 50);
  return card;
}

function privatePresentationMetadata(value: Json): Json {
  if (!value || typeof value !== 'object') return null;
  const strings = (items: unknown) => summaryStrings(items).slice(0, 12).map(x => privateText(x, 80));
  return { contentTypes: strings(value.contentTypes), appPlatforms: strings(value.appPlatforms), audienceRating: privateText(value.audienceRating || 'general', 40),
    contentWarnings: strings(value.contentWarnings), genres: strings(value.genres), imagePromptToolModel: privateText(value.imagePromptToolModel || '', 120), workStatus: privateText(value.workStatus || 'not_started', 40) };
}

/** Port of privateSummaryJson_. */
function privateSummaryJson(record: Json): string {
  const asset = cxlAssetFromRecord(record);
  let icon = asset.icon;
  if (icon && icon.type === 'image') { const ref = compactOwnerRef(icon.value); icon = ref ? { type: 'image', value: ref, mediaId: icon.mediaId || undefined } : { type: 'emoji', value: '✨' }; }
  else if (icon && typeof icon.value === 'string') icon = { type: icon.type, value: privateText(icon.value, 96) };
  const previewImage = compactOwnerRef(asset.previewImage || '');
  const previewImages = (asset.previewImages || []).map(compactOwnerRef).filter(Boolean).slice(0, 6);
  const coverMediaId = previewImage.indexOf('media:') === 0 ? previewImage.slice(6) : '';
  const media = (asset.media || []).filter((item: Json) => item && (item.purpose === 'icon' || !!item.isCover || String(item.id || '') === coverMediaId))
    .slice(0, 7).map((item: Json) => ({ id: String(item.id || ''), assetId: String(item.assetId || asset.id || ''), purpose: String(item.purpose || ''),
      contextId: item.contextId || null, mimeType: item.mimeType || '', fileSize: Number(item.fileSize || 0), sortOrder: Number(item.sortOrder || 0),
      isCover: !!item.isCover, delivery: item.delivery === 'vercel_proxy' ? 'vercel_proxy' : undefined }));
  const summary = { id: asset.id, userId: asset.userId, publicCreatorId: asset.publicCreatorId, authorName: privateText(asset.authorName || 'Creator', 200), title: privateText(asset.title || '', 1000),
    icon: icon || { type: 'emoji', value: '✨' }, category: asset.category, shortDescription: privateText(asset.shortDescription || '', 800),
    contentTypeLabels: (asset.contentTypeLabels || []).slice(0, 20).map((x: unknown) => privateText(x, 100)), contentTypes: (asset.contentTypes || []).slice(0, 20), presentationMetadata: privatePresentationMetadata(asset.presentationMetadata),
    publicCollaboration: asset.publicCollaboration ? privateCardCollaboration(asset.publicCollaboration) : null, collaborationAssetId: asset.collaborationAssetId || null,
    contentBlocks: (asset.contentBlocks || []).map((block: Json) => ({ id: privateText(block.id || '', 50), type: privateText(block.type || 'Text', 30), title: privateText(block.title || '', 100), body: '' })).slice(0, 24),
    content: String(asset.content || '').slice(0, 600), uiCodeSnippet: String(asset.uiCodeSnippet || '').slice(0, 600),
    previewImage, previewImages, media, folderId: asset.folderId || null, isPublic: !!asset.isPublic,
    visibility: asset.visibility || 'private', status: asset.status || 'draft', tags: (asset.tags || []).slice(0, 50).map((x: unknown) => privateText(x, 80)), createdAt: asset.createdAt || '', updatedAt: asset.updatedAt || '',
    deletedAt: asset.deletedAt || null, likesCount: Number(asset.likesCount) || 0, forkCount: Number(asset.forkCount) || 0,
    forkedFromId: asset.forkedFromId || null, forkedFromAuthor: asset.forkedFromAuthor || null, linkedAssetIds: asset.linkedAssetIds || [], revision: Number(asset.revision) || 1 };
  const serialized = JSON.stringify({ summaryVersion: PRIVATE_SUMMARY_VERSION, asset: summary });
  if (serialized.length > PRIVATE_SUMMARY_MAX_CHARS) fail('PRIVATE_SUMMARY_TOO_LARGE', 'Owner Work summary exceeds the configured size limit');
  return serialized;
}

function privateMeta(record: Json, fileId: string, artifacts: ReturnType<typeof ownerSearchArtifacts>): Row {
  const r = record.row, asset = cxlAssetFromRecord(record);
  return { id: r.id, title: r.title || '', category: r.category || 'character', status: r.status || 'draft', visibility: r.visibility || 'private', is_public: r.is_public === true ? 'true' : 'false', deleted_at: r.deleted_at || '', folder_id: r.folder_id || '', tags: JSON.stringify(r.tags || []), updated_at: r.updated_at || '', revision: record.revision || 1, file_id: fileId, has_collab_draft: record.collaborationDraft ? 'true' : 'false', media_count: (record.mediaRecords || []).length, cover_ref: r.preview_image || '', create_request_id: record.createRequestId || '', user_id: r.user_id || asset.userId || '', created_at: r.created_at || asset.createdAt || '', summary_json: privateSummaryJson(record), summary_version: PRIVATE_SUMMARY_VERSION, search_version: artifacts.version, search_chunk_count: artifacts.chunks.length, search_index_token: artifacts.token };
}

function sanitizeCxlAsset(asset: Json): Json {
  const copy = clone(asset); delete copy.userId; delete copy.revision; delete copy.authorEmail; delete copy.email; delete copy.collaboration;
  if (copy.publicCollaboration) (copy.publicCollaboration.participants || []).forEach((p: Json) => { delete p.contact; delete p.email; });
  return copy;
}

function publicSnapshot(d: Json): Json {
  if (!d) return null;
  const p = d.visibilityPolicy || {};
  const policy = { showParticipantStatuses: !!p.showParticipantStatuses, showParticipantNotes: !!p.showParticipantNotes, showParticipantDeadlineOverrides: !!p.showParticipantDeadlineOverrides };
  return { name: d.name || '', sharedTag: d.sharedTag || '', platforms: d.platforms || [],
    sharedInformation: (d.sharedInformation || []).filter((x: Json) => x.title || x.content).map((x: Json) => ({ id: x.id, title: x.title, type: x.type, content: x.content, appScope: x.appScope, platforms: x.platforms || [] })),
    deadlines: (d.deadlines || []).filter((x: Json) => x.label || x.date),
    participants: (d.participants || []).filter((x: Json) => x.creatorName || x.externalWorkName || (x.referenceImages || []).length).map((x: Json) => {
      const q: Json = { id: x.id, isOwner: !!x.isOwner, creatorName: x.creatorName || '', houseTag: x.houseTag || '', platforms: x.platforms || [], externalWorkName: x.externalWorkName || '', referenceImages: x.referenceImages || [], linkedWorkIds: x.linkedWorkIds || [] };
      if (policy.showParticipantStatuses) { q.dataStatus = x.dataStatus; q.imageStatus = x.imageStatus; }
      if (policy.showParticipantNotes) q.notes = x.notes || '';
      if (policy.showParticipantDeadlineOverrides && x.useDeadlineOverrides) q.deadlineOverrides = x.deadlineOverrides || {};
      return q;
    }), visibilityPolicy: policy };
}

/** Port of projection_. */
function projection(record: Json): Json {
  const r = record.row;
  const collab = r.category === 'collab' ? (record.collaborationDraft ? publicSnapshot(record.collaborationDraft) : (r.public_collaboration || null)) : null;
  const refs: string[] = [r.preview_image].concat(r.preview_images || []);
  if (r.icon && r.icon.type === 'image') refs.push(r.icon.value || '', r.icon.mediaId ? `media:${r.icon.mediaId}` : '');
  (r.content_blocks || []).forEach((block: Json) => { if (block && block.type === 'Image') refs.push(block.body || '', block.mediaId ? `media:${block.mediaId}` : ''); });
  if (collab) (collab.participants || []).forEach((p: Json) => (p.referenceImages || []).forEach((x: Json) => refs.push(typeof x === 'string' ? x : (x.src || x.storageKey || ''))));
  return { id: r.id, title: r.title, author_name: r.author_name, author_avatar: r.author_avatar, icon: r.icon, category: r.category, short_description: r.short_description, content_type_labels: r.content_type_labels || [], content_types: r.content_types || [], presentation_metadata: r.presentation_metadata || null, content: r.content || '', ui_code_snippet: r.ui_code_snippet || '', content_blocks: r.content_blocks || [], preview_image: r.preview_image || '', preview_images: r.preview_images || [], tags: r.tags || [], status: r.status, created_at: r.created_at, updated_at: r.updated_at, collaboration_asset_id: r.category === 'collab' ? null : (r.collaboration_asset_id || null), public_collaboration: collab,
    mediaRecords: (record.mediaRecords || []).filter((m: Json) => refs.indexOf(`media:${m.id}`) >= 0 || refs.indexOf(m.storage_path) >= 0).map((m: Json) => ({ id: m.id, storage_path: m.delivery === 'vercel_proxy' ? null : m.storage_path, purpose: m.purpose, mime_type: m.mime_type, sort_order: m.sort_order, is_cover: m.is_cover, delivery: m.delivery === 'vercel_proxy' ? 'vercel_proxy' : null, drive_file_id: m.delivery === 'vercel_proxy' ? null : (m.drive_file_id || null), drive_url: m.delivery === 'vercel_proxy' ? null : (m.drive_url || null), original_ref: m.original_ref || null })),
    cxlAsset: record.cxlAsset ? sanitizeCxlAsset(record.cxlAsset) : null };
}

function publicSummaryIcon(icon: Json, media: Json[]): Json {
  if (!icon || typeof icon !== 'object') return { type: 'emoji', value: '✨' };
  const type = String(icon.type || ''), value = typeof icon.value === 'string' ? icon.value : '';
  if ((type === 'emoji' || type === 'kaomoji') && value && value.length <= 96) return { type, value };
  if (type !== 'image') return { type: 'emoji', value: '✨' };
  let mediaId = String(icon.mediaId || '');
  if (!mediaId && value.indexOf('media:') === 0) mediaId = value.slice(6);
  const iconMedia = mediaId ? (media || []).filter(m => m.id === mediaId && m.purpose === 'icon')[0] : null;
  if (iconMedia) return { type: 'image', value: `media:${mediaId}`, mediaId, mimeType: iconMedia.mimeType || '' };
  if (/^cxl-media:[a-f0-9]{64}$/.test(value)) return { type: 'image', value };
  if (/^https:\/\//i.test(value) && value.length <= 2048) return { type: 'image', value };
  return { type: 'emoji', value: '✨' };
}

/** Port of publicSummaryEnvelope_ + publicSummaryJson_. */
function publicSummaryJson(pub: Json): string {
  const a = pub.cxlAsset && typeof pub.cxlAsset === 'object' ? pub.cxlAsset : {};
  const rawCollab = a.publicCollaboration || pub.public_collaboration || null;
  const presentation = a.presentationMetadata || pub.presentation_metadata || {};
  let cover = String(a.previewImage || pub.preview_image || ''); if (/^data:image\//i.test(cover)) cover = '';
  const mediaSource = summaryArray(a.media).concat(summaryArray(pub.mediaRecords || pub.media_records));
  const coverId = cover.indexOf('media:') === 0 ? cover.slice(6) : '';
  let media = mediaSource.filter(m => m && ((m.purpose || '') === 'icon' || !!(m.isCover || m.is_cover) || String(m.id || '') === coverId)).map(m => ({
    id: String(m.id || ''), assetId: String(m.assetId || m.asset_id || pub.id || a.id || ''), purpose: String(m.purpose || ''), contextId: m.contextId || m.context_id || null,
    mimeType: m.mimeType || m.mime_type || '', fileSize: Number(m.fileSize || m.file_size || 0), sortOrder: Number(m.sortOrder || m.sort_order || 0),
    delivery: m.delivery === 'vercel_proxy' ? 'vercel_proxy' : undefined,
    isCover: !!(m.isCover || m.is_cover), createdAt: m.createdAt || m.created_at || '', updatedAt: m.updatedAt || m.updated_at || '' }));
  const mediaById: Record<string, Json> = {}; media.forEach(item => { if (!mediaById[item.id] || item.delivery === 'vercel_proxy') mediaById[item.id] = item; });
  media = Object.keys(mediaById).map(id => mediaById[id]);
  const platforms = summaryStrings(presentation.appPlatforms);
  const asset = { id: String(a.id || pub.id || ''), title: String(a.title || pub.title || ''), authorName: String(a.authorName || pub.author_name || 'Creator'),
    category: String(a.category || pub.category || 'character'), shortDescription: String(a.shortDescription || pub.short_description || ''),
    contentTypeLabels: summaryStrings(a.contentTypeLabels || pub.content_type_labels), contentTypes: summaryStrings(a.contentTypes || pub.content_types),
    presentationMetadata: platforms.length ? { appPlatforms: platforms.map(String) } : undefined, publicCollaboration: publicCardCollaboration(rawCollab),
    collaborationAssetId: a.collaborationAssetId || pub.collaboration_asset_id || null, icon: publicSummaryIcon(a.icon || pub.icon, media), content: '', contentBlocks: [], uiCodeSnippet: '',
    previewImage: cover, previewImages: cover ? [cover] : [], media, folderId: null, isPublic: true, visibility: 'public',
    status: String(a.status || pub.status || 'finished'), tags: summaryStrings(a.tags || pub.tags), createdAt: String(a.createdAt || pub.created_at || ''),
    updatedAt: String(a.updatedAt || pub.updated_at || ''), deletedAt: null, likesCount: Number(a.likesCount || pub.likes_count || 0),
    forkedFromAuthor: a.forkedFromAuthor || pub.forked_from_author || null, versions: [] };
  const json = JSON.stringify({ summaryVersion: PUBLIC_SUMMARY_VERSION, asset });
  return json.length <= PUBLIC_SUMMARY_MAX_CHARS ? json : JSON.stringify({ summaryVersion: 0, error: 'summary_too_large', chars: json.length });
}

/** Port of writeFingerprint_: identical bytes let Apps Script recognise a direct write as the same request. */
export function writeFingerprint(operation: string, value: unknown): string {
  return createHash('sha256').update(JSON.stringify({ operation, value }), 'utf8').digest('base64');
}

function validateCollaborationDraft(draft: Json): void {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) fail('INVALID_COLLAB_DRAFT', 'Collaboration draft is invalid');
  if (JSON.stringify(draft).length > 600000) fail('INVALID_COLLAB_DRAFT', 'Collaboration draft is too large');
  if (typeof draft.name !== 'string' || typeof draft.sharedTag !== 'string' || !Array.isArray(draft.platforms)
    || !Array.isArray(draft.sharedInformation) || draft.sharedInformation.length > 100
    || !Array.isArray(draft.deadlines) || draft.deadlines.length > 100
    || !Array.isArray(draft.participants) || draft.participants.length > 500) fail('INVALID_COLLAB_DRAFT', 'Collaboration draft structure is invalid');
  draft.participants.forEach((participant: Json) => {
    if (!participant || typeof participant !== 'object' || Array.isArray(participant) || typeof participant.id !== 'string' || participant.id.length > 128
      || !Array.isArray(participant.referenceImages) || participant.referenceImages.length > 6) fail('INVALID_COLLAB_DRAFT', 'Collaboration participant data is invalid');
    participant.referenceImages.forEach((image: Json) => {
      if (!image || typeof image !== 'object' || Array.isArray(image) || typeof image.id !== 'string' || typeof image.src !== 'string') fail('INVALID_COLLAB_DRAFT', 'Collaboration reference image is invalid');
    });
  });
}

function validateUpdatePayload(asset: Json): void {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) fail('INVALID_WORK', 'Work payload is invalid');
  if (Object.keys(asset).some(key => !CXL_WRITE_FIELDS.includes(key))) fail('INVALID_WORK', 'Work payload contains unsupported fields');
  if ((asset.title !== undefined && !String(asset.title || '').trim()) || (asset.category !== undefined && typeof asset.category !== 'string') || (asset.tags !== undefined && !Array.isArray(asset.tags))) fail('INVALID_WORK', 'Work title, category, or tags are invalid');
  if (asset.collaboration !== undefined && asset.collaboration !== null) {
    if (asset.category !== 'collab') fail('INVALID_COLLAB_DRAFT', 'Collaboration draft belongs to a collaboration Work');
    validateCollaborationDraft(asset.collaboration);
  }
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ------------------------------------------------------------------ update

/**
 * works.update args: [workId, updates, { requestId, expectedRevision, mediaIds? }].
 * Returns `{ fallback: true }` for anything outside the supported case, before writing.
 */
export async function directUpdateWork(args: unknown[], ownerUserId: string, env: DirectWriteEnv): Promise<DirectUpdateResult> {
  const [workId, updates, options] = args as [string, Json, Json];
  const id = String(workId || '');
  if (!/^asset_[A-Za-z0-9_-]{1,96}$/.test(id)) return { fallback: true, reason: 'invalid_id' };
  if (!options || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(options.requestId || ''))) return { fallback: true, reason: 'invalid_request_id' };
  if (Array.isArray(options.mediaIds) && options.mediaIds.length) return { fallback: true, reason: 'media_upload' };
  validateUpdatePayload(updates);
  const requestId = String(options.requestId).toLowerCase();
  const fingerprint = writeFingerprint('update', { id, updates, expectedRevision: options.expectedRevision });

  // Private index row + canonical record.
  const privateHeaders = await sheetHeaders(env, env.privateSheetId, '');
  if (PRIVATE_HEADERS.some(header => !privateHeaders.includes(header))) return { fallback: true, reason: 'private_headers' };
  const rowNumbers = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', id);
  if (rowNumbers.length !== 1) return rowNumbers.length ? fail('INDEX_ROW_AMBIGUOUS', 'Private Index contains duplicate Work rows') : fail('WORK_NOT_FOUND', 'Work was not found for this Owner');
  const indexed = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
  const previousFileId = String(indexed.file_id || '');
  if (!previousFileId) return { fallback: true, reason: 'no_record_file' };
  const record = await driveJson(env, previousFileId);
  if (record.lastWriteRequestId === requestId) return { fallback: true, reason: 'idempotent_retry' };

  if (!Number.isInteger(Number(options.expectedRevision)) || Number(options.expectedRevision) < 1) fail('REVISION_REQUIRED', 'Expected revision is required for update');
  if (Number(options.expectedRevision) !== (Number(record.revision) || 1) || (Number(record.revision) || 1) !== (Number(indexed.revision) || 1)) fail('REVISION_CONFLICT', 'Work revision is stale; reload before saving');
  const existingAsset = cxlAssetFromRecord(record);
  if (String(existingAsset.userId || '') !== ownerUserId && String(record.row?.user_id || '') !== ownerUserId) fail('WORK_NOT_OWNED', 'Work is not owned by this authenticated Owner');
  const canonicalOwner = String(record.row?.user_id || record.cxlAsset?.userId || '');
  if (canonicalOwner !== ownerUserId) fail('WORK_NOT_OWNED', 'Work is not owned by this authenticated Owner');

  // Merge exactly like saveCxlWorkApi_('update').
  const now = new Date().toISOString();
  const asset: Json = Object.assign({}, existingAsset, updates);
  asset.id = id; asset.userId = ownerUserId; asset.createdAt = existingAsset.createdAt; asset.updatedAt = now;
  asset.visibility = updates.visibility || (updates.isPublic === undefined ? existingAsset.visibility : (updates.isPublic ? 'public' : 'private')); asset.isPublic = asset.visibility === 'public';
  asset.media = existingAsset.media || [];
  const changed = updates.title !== undefined || updates.content !== undefined || updates.uiCodeSnippet !== undefined;
  const lastVersion = (existingAsset.versions || []).at(-1);
  asset.versions = changed ? (existingAsset.versions || []).concat([{ version: (lastVersion?.version + 1) || 1, updatedAt: now, title: asset.title, summary: 'บันทึกการแก้ไขเนื้อหา' }]) : existingAsset.versions || [];

  // Supported case only: no media, gallery, visibility or trash transitions.
  const before = mediaReferences(existingAsset), after = mediaReferences(asset);
  if (after.inline) return { fallback: true, reason: 'inline_media' };
  if (!sameJson([...new Set(before.refs)].sort(), [...new Set(after.refs)].sort())) return { fallback: true, reason: 'media_changed' };
  if (!sameJson(existingAsset.previewImage || '', asset.previewImage || '') || !sameJson(existingAsset.previewImages || [], asset.previewImages || [])) return { fallback: true, reason: 'gallery_changed' };
  const wasPublic = isPublicRow(record.row || {});
  if (asset.visibility !== (record.row?.visibility || 'private') || String(asset.deletedAt || '') !== String(record.row?.deleted_at || '')) return { fallback: true, reason: 'visibility_or_trash_changed' };

  // A Work may still reference a folder deleted since; drop it unless this request chose it.
  if (asset.folderId) {
    const folders = await env.ownerFolderIds();
    if (!folders.includes(String(asset.folderId))) {
      if (updates.folderId === undefined) asset.folderId = null;
      else fail('INVALID_FOLDER', 'Selected folder is unavailable for this Owner');
    }
  }

  // Apply the saveOwnerWork_ row update.
  const r = record.row;
  const input = { title: asset.title, author_name: asset.authorName || '', author_avatar: asset.authorAvatar || '', icon: asset.icon,
    category: asset.category, status: asset.status, visibility: asset.visibility || (asset.isPublic ? 'public' : 'private'), short_description: asset.shortDescription || '',
    content_type_labels: asset.contentTypeLabels || [], content_types: asset.contentTypes || [], presentation_metadata: asset.presentationMetadata || null,
    public_collaboration: asset.publicCollaboration || null, folder_id: asset.folderId || '', tags: asset.tags || [], content: asset.content || '', ui_code_snippet: asset.uiCodeSnippet || '',
    content_blocks: asset.contentBlocks || [], preview_image: asset.previewImage || '', preview_images: asset.previewImages || [], collaboration_asset_id: asset.collaborationAssetId || null,
    deleted_at: asset.deletedAt || null };
  Object.assign(r, input);
  if (!String(r.title || '').trim()) fail('INVALID_WORK', 'ต้องระบุชื่อผลงาน');
  if (!['character','lore','ui_code','prompts','collab','app_data'].includes(r.category)) fail('INVALID_WORK', 'หมวดหมู่ไม่ถูกต้อง');
  if (!['idea','draft','in_progress','finished','archived'].includes(r.status)) fail('INVALID_WORK', 'สถานะไม่ถูกต้อง');
  if (!['public','private'].includes(r.visibility)) fail('INVALID_WORK', 'การมองเห็นไม่ถูกต้อง');
  if (r.category === 'collab') r.collaboration_asset_id = null;
  if (r.collaboration_asset_id) {
    const linkedRows = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', String(r.collaboration_asset_id));
    const linked = linkedRows.length === 1 ? await readRow(env, env.privateSheetId, '', privateHeaders, linkedRows[0]) : null;
    if (!linked || linked.category !== 'collab' || linked.id === r.id) fail('INVALID_WORK', 'คอลแลปที่เชื่อมไม่ถูกต้อง');
  }
  r.is_public = r.visibility === 'public'; r.updated_at = now;
  record.collaborationDraft = asset.category === 'collab' ? (asset.collaboration || null) : null;
  record.cxlAsset = asset;
  record.lastWriteRequestId = requestId; record.lastWriteOperation = 'update'; record.lastWriteFingerprint = fingerprint;
  record.mediaRecords = record.mediaRecords || [];
  record.revision = (Number(record.revision) || 1) + 1;
  const nowPublic = isPublicRow(r);

  // Public preconditions are checked before anything is written.
  let publicFolderId = '', publicRowNumber = 0, publicHeaders: string[] = [];
  if (nowPublic) {
    publicHeaders = await sheetHeaders(env, env.publicSheetId, '');
    if (PUBLIC_HEADERS.some((header, index) => publicHeaders[index] !== header)) return { fallback: true, reason: 'public_headers' };
    const publicRows = await findRows(env, env.publicSheetId, '', publicHeaders, 'id', id);
    if (publicRows.length !== 1) return { fallback: true, reason: 'public_row_missing' };
    publicRowNumber = publicRows[0];
    const publicRow = await readRow(env, env.publicSheetId, '', publicHeaders, publicRowNumber);
    if (!publicRow.file_id) return { fallback: true, reason: 'public_file_missing' };
    publicFolderId = await driveParent(env, String(publicRow.file_id));
    const mapHeaders = await sheetHeaders(env, env.publicSheetId, 'WorkCreatorMap!');
    const mapRows = await findRows(env, env.publicSheetId, 'WorkCreatorMap!', mapHeaders, 'workId', id);
    if (mapRows.length !== 1) return { fallback: true, reason: 'creator_map_missing' };
    const map = await readRow(env, env.publicSheetId, 'WorkCreatorMap!', mapHeaders, mapRows[0]);
    if (String(map.publicCreatorId || '') !== env.publicCreatorId) return { fallback: true, reason: 'creator_map_mismatch' };
  }
  const privateFolderId = await driveParent(env, previousFileId);

  // 1) canonical revision, 2) search chunks, 3) private index (commit point).
  const artifacts = ownerSearchArtifacts(cxlAssetFromRecord(record));
  const metadata = privateMeta(record, '', artifacts);
  const fileId = await putJsonRevision(env, privateFolderId, `${id}__r${record.revision}.json`, record);
  metadata.file_id = fileId;
  const searchHeaders = await sheetHeaders(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!`);
  if (artifacts.chunks.length) {
    const rows = artifacts.chunks.map((text, index) => {
      const item: Row = { work_id: id, chunk_index: index, search_text: text, search_version: artifacts.version, updated_at: artifacts.updatedAt, index_token: artifacts.token };
      return searchHeaders.map(key => item[key] === undefined ? '' : item[key]);
    });
    await google(env, `${sheetsBase(env.privateSheetId)}/values/${encodeURIComponent(`${OWNER_SEARCH_SHEET}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows })
    });
  }
  // Re-check the revision right before the commit point (Apps Script may have written meanwhile).
  const latest = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
  if (String(latest.id) !== id || (Number(latest.revision) || 1) !== (Number(indexed.revision) || 1)) fail('REVISION_CONFLICT', 'Work revision changed before save; reload before saving');
  const indexValues = privateHeaders.map(header => {
    if (header === 'search_text') return '';
    if (Object.prototype.hasOwnProperty.call(metadata, header)) return metadata[header] === undefined || metadata[header] === null ? '' : metadata[header];
    return latest[header] ?? '';
  });
  await writeRange(env, env.privateSheetId, `A${rowNumbers[0]}:${columnLetter(privateHeaders.length - 1)}${rowNumbers[0]}`, [indexValues]);

  // After the commit point: public projection, then stale search cleanup.
  try {
    if (nowPublic) {
      const pub = projection(record);
      const publicFileId = await putJsonRevision(env, publicFolderId, `${id}__r${record.revision}.json`, pub);
      const publicValues = PUBLIC_HEADERS.map(header => ({ id: pub.id, title: pub.title, category: pub.category, status: pub.status, updated_at: pub.updated_at, tags: JSON.stringify(pub.tags),
        short_description: pub.short_description || '', file_id: publicFileId, active: 'true', cover_ref: pub.preview_image || '', summary_json: publicSummaryJson(pub) } as Row)[header] ?? '');
      await writeRange(env, env.publicSheetId, `A${publicRowNumber}:${columnLetter(PUBLIC_HEADERS.length - 1)}${publicRowNumber}`, [publicValues]);
    }
    await removeStaleSearchChunks(env, id, artifacts.token, searchHeaders);
  } catch (error) {
    throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true);
  }
  void wasPublic;
  return { fallback: false, data: { data: cxlAssetFromRecord(record), error: null } };
}

async function removeStaleSearchChunks(env: DirectWriteEnv, workId: string, keepToken: string, headers: string[]): Promise<void> {
  const workIndex = headers.indexOf('work_id'), tokenIndex = headers.indexOf('index_token');
  if (workIndex < 0 || tokenIndex < 0) return;
  const [works, tokens] = await Promise.all([
    sheetValues(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!${columnLetter(workIndex)}2:${columnLetter(workIndex)}`),
    sheetValues(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!${columnLetter(tokenIndex)}2:${columnLetter(tokenIndex)}`)
  ]);
  const stale = works.map((row, i) => String(row[0] ?? '') === workId && String(tokens[i]?.[0] ?? '') !== keepToken ? i + 1 : -1).filter(i => i >= 0);
  if (!stale.length) return;
  const meta = await (await google(env, `${sheetsBase(env.privateSheetId)}?fields=sheets.properties(sheetId,title)`)).json() as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  const sheetId = meta.sheets?.find(sheet => sheet.properties?.title === OWNER_SEARCH_SHEET)?.properties?.sheetId;
  if (sheetId === undefined) return;
  // Zero-based data rows (header is row 0); delete bottom-up so indices stay valid.
  const requests = stale.sort((a, b) => b - a).map(rowIndex => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }));
  await google(env, `${sheetsBase(env.privateSheetId)}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
}
