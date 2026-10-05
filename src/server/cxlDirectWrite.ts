import { createHash, randomUUID } from 'node:crypto';
import { DirectWriteError, fail } from './cxlDirectErrors.js';
import { findWorkMediaFile, markWorkMediaState, setLegacyMediaSharing, trashDriveFile, type WorkMediaFile } from './cxlDirectMedia.js';

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

export { DirectWriteError };

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
  // Collab name, tag, apps, shared info and participant names (never contact details).
  [asset.publicCollaboration, asset.collaboration].forEach((collab: Json) => {
    if (!collab) return;
    values.push(collab.name, collab.sharedTag, ...(collab.platforms || []));
    (collab.sharedInformation || []).forEach((item: Json) => { if (item) values.push(item.title, item.content); });
    (collab.participants || []).forEach((p: Json) => { if (p) values.push(p.creatorName, p.houseTag, p.externalWorkName); });
  });
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
  const mediaIds: string[] = Array.isArray(options.mediaIds) ? options.mediaIds.map(String) : [];
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
  if (record.lastWriteRequestId === requestId) {
    // Retried request that already committed (Apps Script's idempotent path): answer it again.
    if (record.lastWriteFingerprint !== fingerprint) fail('IDEMPOTENCY_KEY_REUSED', 'Update requestId was already used with different Work data');
    if (isPublicRow(record.row || {})) await publishWork(env, record).catch(error => { throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true); });
    return { fallback: false, data: { data: cxlAssetFromRecord(record), error: null } };
  }

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

  // Trash changes go through works.softDelete / works.restore.
  if (String(asset.deletedAt || '') !== String(record.row?.deleted_at || '')) return { fallback: true, reason: 'trash_changed' };
  rejectUnsupportedWorkMedia(asset, existingAsset, mediaIds);
  const wasPublic = isPublicRow(record.row || {});
  record.mediaRecords = record.mediaRecords || [];
  const previousMediaRecords = record.mediaRecords.slice();
  const previousMediaIds = referencedMediaIds(cxlAssetFromRecord(record));
  const attachedMedia = await attachWorkMedia(record, asset, mediaIds, id, ownerUserId, env);

  // A Work may still reference a folder deleted since; drop it unless this request chose it.
  if (asset.folderId) {
    const folders = await env.ownerFolderIds();
    if (!folders.includes(String(asset.folderId))) {
      if (updates.folderId === undefined) asset.folderId = null;
      else fail('INVALID_FOLDER', 'Selected folder is unavailable for this Owner');
    }
  }

  // Apply the saveOwnerWork_ row update.
  applyRowInput(record, asset);
  const r = record.row;
  if (r.collaboration_asset_id) {
    const linkedRows = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', String(r.collaboration_asset_id));
    const linked = linkedRows.length === 1 ? await readRow(env, env.privateSheetId, '', privateHeaders, linkedRows[0]) : null;
    if (!linked || linked.category !== 'collab' || linked.id === r.id) fail('INVALID_WORK', 'คอลแลปที่เชื่อมไม่ถูกต้อง');
  }
  r.is_public = r.visibility === 'public'; r.updated_at = now;
  record.collaborationDraft = asset.category === 'collab' ? (asset.collaboration || null) : null;
  record.cxlAsset = asset;
  record.lastWriteRequestId = requestId; record.lastWriteOperation = 'update'; record.lastWriteFingerprint = fingerprint;
  const retiredMediaIds = await settleRecordMedia(record, previousMediaIds, env, new Set(previousMediaRecords.map((m: Json) => String(m.id))));
  record.revision = (Number(record.revision) || 1) + 1;
  const nowPublic = isPublicRow(r);
  const privateFolderId = await driveParent(env, previousFileId);

  // 1) canonical revision, 2) search chunks, 3) private index (commit point).
  const artifacts = ownerSearchArtifacts(cxlAssetFromRecord(record));
  const metadata = privateMeta(record, '', artifacts);
  metadata.file_id = await putJsonRevision(env, privateFolderId, `${id}__r${record.revision}.json`, record);
  const searchHeaders = await appendSearchChunks(env, id, artifacts);
  // Re-check the revision right before the commit point (Apps Script may have written meanwhile).
  const latest = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
  if (String(latest.id) !== id || (Number(latest.revision) || 1) !== (Number(indexed.revision) || 1)) fail('REVISION_CONFLICT', 'Work revision changed before save; reload before saving');
  await writeRange(env, env.privateSheetId, `A${rowNumbers[0]}:${columnLetter(privateHeaders.length - 1)}${rowNumbers[0]}`, [privateIndexValues(privateHeaders, metadata, latest)]);

  // After the commit point: media state, public projection, stale search cleanup.
  try {
    await markMediaAfterCommit(env, attachedMedia, retiredMediaIds, previousMediaRecords, id, record.revision);
    if (nowPublic) await publishWork(env, record);
    else if (wasPublic) await deactivatePublicWork(env, id);
    await removeStaleSearchChunks(env, id, artifacts.token, searchHeaders);
  } catch (error) {
    throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true);
  }
  return { fallback: false, data: { data: cxlAssetFromRecord(record), error: null } };
}

// ------------------------------------------------------------- Work media

type Placement = { id: string; purpose: string; contextId: string | null; sortOrder: number; isCover: boolean; references: Placement[] };

/** Port of mediaWorkReferenceMap_. */
export function mediaReferenceMap(asset: Json): Record<string, Placement> {
  const refs: Record<string, Placement> = {};
  const add = (value: unknown, purpose: string, contextId: unknown, sortOrder: number, isCover: boolean, declaredMediaId?: unknown) => {
    const match = typeof value === 'string' ? value.match(/^media:([A-Za-z0-9_-]+)$/i) : null;
    if (!match) return;
    const id = match[1];
    if (declaredMediaId && String(declaredMediaId) !== id) fail('UNSUPPORTED_MEDIA_MUTATION', 'Work media identity does not match its canonical reference.');
    const placement = { id, purpose, contextId: (contextId as string) || null, sortOrder: Number(sortOrder) || 0, isCover: !!isCover, references: [] as Placement[] };
    if (!refs[id]) refs[id] = { ...placement, references: [placement] }; else refs[id].references.push(placement);
  };
  const icon = asset?.icon;
  if (icon && icon.type === 'image') add(icon.value, 'icon', null, 0, false, icon.mediaId);
  const preview: unknown[] = Array.isArray(asset?.previewImages) ? asset.previewImages : [];
  preview.forEach((value, index) => add(value, 'gallery', null, index, value === asset.previewImage));
  if (typeof asset?.previewImage === 'string' && asset.previewImage && !preview.includes(asset.previewImage)) add(asset.previewImage, 'gallery', null, preview.length, true);
  (Array.isArray(asset?.contentBlocks) ? asset.contentBlocks : []).forEach((block: Json, index: number) => {
    if (block && block.type === 'Image') add(block.body, 'prompt_example', block.id, index, false, block.mediaId);
  });
  const collaboration = asset && (asset.collaboration || asset.publicCollaboration);
  (Array.isArray(collaboration?.participants) ? collaboration.participants : []).forEach((participant: Json) => {
    (Array.isArray(participant?.referenceImages) ? participant.referenceImages : []).forEach((image: Json, index: number) => {
      if (typeof image === 'string') add(image, 'collab_reference', participant.id, index, false, null);
      else if (image) add(image.src, 'collab_reference', participant.id, index, false, image.mediaId);
    });
  });
  return refs;
}

/** Port of mediaWorkReferencedIds_: every `media:<id>` string anywhere in the asset. */
function referencedMediaIds(asset: Json): Set<string> {
  return new Set(mediaReferences(asset).refs.filter(ref => ref.startsWith('media:')).map(ref => ref.slice(6)));
}

/** Port of rejectUnsupportedWorkMedia_. */
export function rejectUnsupportedWorkMedia(asset: Json, existing: Json | null, mediaIds: string[]): void {
  const now = mediaReferences(asset);
  if (now.inline) fail('UNSUPPORTED_MEDIA_MUTATION', 'Inline media must be uploaded before saving a Work.');
  const uniqueRefs = [...new Set(now.refs)];
  const oldRefs = existing ? [...new Set(mediaReferences(existing).refs)] : [];
  // Any image may leave the Work (legacy ones included). Only the reference goes:
  // legacy files stay in Drive/Supabase and their media records are kept.
  const newRefs = uniqueRefs.filter(ref => !oldRefs.includes(ref));
  if (newRefs.some(ref => !ref.startsWith('media:'))) fail('UNSUPPORTED_MEDIA_MUTATION', 'New legacy media references are not supported.');
  const newIds = newRefs.map(ref => ref.slice(6)).sort();
  if (newIds.join('|') !== [...mediaIds].sort().join('|')) fail('UNSUPPORTED_MEDIA_MUTATION', 'Every new Work media reference must match a finalized upload.');
  const placements = mediaReferenceMap(asset);
  if (newIds.some(id => !placements[id])) fail('UNSUPPORTED_MEDIA_MUTATION', 'New Work media must use an icon, gallery, or content image placement.');
}

/** Port of mediaWorkAttach_, with the manifest read from the media file's appProperties. */
async function attachWorkMedia(record: Json, asset: Json, mediaIds: string[], workId: string, ownerUserId: string, env: DirectWriteEnv): Promise<WorkMediaFile[]> {
  const placements = mediaReferenceMap(asset);
  if (new Set(mediaIds).size !== mediaIds.length || mediaIds.some(id => !REQUEST_ID_RE.test(id))) fail('UNSUPPORTED_MEDIA_MUTATION', 'Work media attachment list is invalid');
  // Look the files up a few at a time: a Collab save can attach dozens of images.
  const found = new Map<string, WorkMediaFile | null>();
  for (let start = 0; start < mediaIds.length; start += 8) {
    const batch = mediaIds.slice(start, start + 8);
    (await Promise.all(batch.map(id => findWorkMediaFile(env, id)))).forEach((file, index) => found.set(batch[index], file));
  }
  const attached: WorkMediaFile[] = [];
  for (const id of mediaIds) {
    const placement = placements[id];
    const file = found.get(id) || null;
    const p = file?.props || {};
    const matches = placement && placement.references.some(ref => ref.purpose === p.cxlPurpose && String(ref.contextId || '') === String(p.cxlContextId || '')
      && Number(ref.sortOrder) === Number(p.cxlSortOrder) && Boolean(ref.isCover) === (p.cxlIsCover === 'true'));
    if (!file || !placement || p.cxlOwner !== ownerUserId || p.cxlWorkId !== workId || p.cxlMediaId !== id || p.cxlDelivery !== 'vercel_proxy'
      || !['finalized', 'attached'].includes(p.cxlState) || !matches)
      fail('UNSUPPORTED_MEDIA_MUTATION', 'Work media upload does not match this Owner, Work, or image placement.');
    const existing = (record.mediaRecords || []).find((m: Json) => m.id === id);
    if (existing && String(existing.drive_file_id || '') !== file!.id) fail('UNSUPPORTED_MEDIA_MUTATION', 'Work media identity is already attached to a different file.');
    if (!existing) record.mediaRecords.push({ id, asset_id: workId, storage_path: `google-work-media/${id}`, purpose: p.cxlPurpose, context_id: p.cxlContextId || null,
      mime_type: file!.mimeType, file_size: file!.size, sort_order: Number(p.cxlSortOrder), is_cover: p.cxlIsCover === 'true',
      drive_file_id: file!.id, drive_url: null, delivery: 'vercel_proxy', sharing_access: 'private', sha256: p.cxlSha256,
      created_at: file!.createdTime, updated_at: new Date().toISOString() });
    attached.push(file!);
  }
  return attached;
}

/** saveOwnerWork_ media steps after the row fields are applied. Returns vercel_proxy media IDs no longer referenced. */
async function settleRecordMedia(record: Json, previousIds: Set<string>, env: DirectWriteEnv, existingRecordIds: Set<string> = new Set()): Promise<string[]> {
  const r = record.row;
  // Proxy media no longer referenced anywhere is retired below, not orphaned.
  const stillReferenced = referencedMediaIds(cxlAssetFromRecord(record));
  // A public Work may not carry unassigned or orphaned collaboration images.
  if (r.visibility === 'public' && (record.mediaRecords || []).some((m: Json) => {
    if (!m.drive_file_id) return false;
    if (m.delivery === 'vercel_proxy' && !stillReferenced.has(m.id)) return false;
    // An image this save removed (e.g. replaced by a smaller copy) was assigned before; dropping it is not an orphan.
    if (previousIds.has(m.id) && !stillReferenced.has(m.id)) return false;
    // Only images attached by this save are judged. Older records (e.g. migrated Collaboration
    // images that were never assigned) would otherwise block every later save of the Work.
    if (existingRecordIds.has(String(m.id))) return false;
    if (m.purpose === 'unassigned') return true;
    if (m.purpose !== 'collab' && m.purpose !== 'collab_reference') return false;
    return !(record.collaborationDraft?.participants || []).some((p: Json) => (p.referenceImages || []).some((x: Json) => (typeof x === 'string' ? x : (x.src || x.storageKey || '')) === `media:${m.id}`));
  })) fail('INVALID_WORK', 'ยังมีรูปที่ไม่ได้ระบุว่าเป็นภาพรวมงานหรือของผู้เข้าร่วม');
  // mediaWorkSyncPlacementMetadata_
  const placements = mediaReferenceMap(cxlAssetFromRecord(record));
  (record.mediaRecords || []).forEach((item: Json) => {
    if (item.delivery !== 'vercel_proxy' || !placements[item.id]) return;
    const gallery = placements[item.id].references.filter(ref => ref.purpose === 'gallery');
    item.is_cover = gallery.some(ref => ref.isCover);
    if (gallery.length) item.sort_order = Math.min(...gallery.map(ref => Number(ref.sortOrder) || 0));
  });
  // shareRecordMedia_ (legacy media only; proxy media is private by construction)
  const refs: string[] = [r.preview_image].concat(r.preview_images || []);
  (record.collaborationDraft?.participants || []).forEach((p: Json) => (p.referenceImages || []).forEach((x: Json) => refs.push(typeof x === 'string' ? x : (x.src || x.storageKey || ''))));
  const publicAccess = isPublicRow(r);
  for (const m of record.mediaRecords || []) {
    if (!m.drive_file_id || m.delivery === 'vercel_proxy') continue;
    const visible = publicAccess && (refs.includes(`media:${m.id}`) || refs.includes(m.storage_path));
    const access = visible ? 'public' : 'private';
    if (m.sharing_access === access) continue;
    await setLegacyMediaSharing(env, String(m.drive_file_id), visible);
    m.sharing_access = access;
  }
  const nextIds = referencedMediaIds(cxlAssetFromRecord(record));
  const retired = [...previousIds].filter(id => !nextIds.has(id) && (record.mediaRecords || []).some((m: Json) => m.id === id && m.delivery === 'vercel_proxy'));
  record.mediaRecords = (record.mediaRecords || []).filter((m: Json) => m.delivery !== 'vercel_proxy' || nextIds.has(m.id));
  return retired;
}

/** After the commit point: record attach/retire state on the media files (best effort, like Apps Script manifests). */
async function markMediaAfterCommit(env: DirectWriteEnv, attached: WorkMediaFile[], retiredIds: string[], previousRecords: Json[], workId: string, revision: number): Promise<void> {
  for (let start = 0; start < attached.length; start += 8) {
    await Promise.all(attached.slice(start, start + 8).map(file => markWorkMediaState(env, file.id, { cxlState: 'attached', cxlAttachedWorkId: workId, cxlAttachedRevision: String(revision) })));
  }
  for (const id of retiredIds) {
    const media = previousRecords.find(m => m.id === id);
    if (media?.drive_file_id) await markWorkMediaState(env, String(media.drive_file_id), { cxlState: 'retired', cxlRetiredAt: new Date().toISOString(), cxlRetiredRevision: String(revision) }).catch(() => undefined);
  }
}

// ------------------------------------------------------- shared write steps

async function appendRows(env: DirectWriteEnv, spreadsheetId: string, sheetPrefix: string, rows: unknown[][]): Promise<void> {
  if (!rows.length) return;
  await google(env, `${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(`${sheetPrefix}A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows })
  });
}

async function appendSearchChunks(env: DirectWriteEnv, workId: string, artifacts: ReturnType<typeof ownerSearchArtifacts>): Promise<string[]> {
  const searchHeaders = await sheetHeaders(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!`);
  await appendRows(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!`, artifacts.chunks.map((text, index) => {
    const item: Row = { work_id: workId, chunk_index: index, search_text: text, search_version: artifacts.version, updated_at: artifacts.updatedAt, index_token: artifacts.token };
    return searchHeaders.map(key => item[key] === undefined ? '' : item[key]);
  }));
  return searchHeaders;
}

function privateIndexValues(headers: string[], metadata: Row, previous: Row | null): unknown[] {
  return headers.map(header => {
    if (header === 'search_text') return '';
    if (Object.prototype.hasOwnProperty.call(metadata, header)) return metadata[header] === undefined || metadata[header] === null ? '' : metadata[header];
    return previous?.[header] ?? '';
  });
}

/** Parent folder of the first index row that has a file, i.e. where Apps Script keeps these JSON files. */
async function folderOfIndexedFiles(env: DirectWriteEnv, spreadsheetId: string, headers: string[]): Promise<string | null> {
  const index = headers.indexOf('file_id');
  if (index < 0) return null;
  const letter = columnLetter(index);
  const fileId = (await sheetValues(env, spreadsheetId, `${letter}2:${letter}`)).map(row => String(row[0] ?? '')).find(Boolean);
  return fileId ? driveParent(env, fileId) : null;
}

/** Port of upsertWorkCreatorMap_ + syncPublic_ for a public Work. */
async function publishWork(env: DirectWriteEnv, record: Json): Promise<void> {
  const id = String(record.row.id);
  const mapHeaders = await sheetHeaders(env, env.publicSheetId, 'WorkCreatorMap!');
  const schemaIndex = mapHeaders.indexOf('schemaVersion'), workIndex = mapHeaders.indexOf('workId'), creatorIndex = mapHeaders.indexOf('publicCreatorId');
  if (schemaIndex < 0 || workIndex < 0 || creatorIndex < 0) fail('CREATOR_MAPPING_MISSING', 'Public Work creator map schema is invalid');
  const mapRows = await findRows(env, env.publicSheetId, 'WorkCreatorMap!', mapHeaders, 'workId', id);
  if (mapRows.length > 1) fail('CREATOR_MAPPING_AMBIGUOUS', 'Work has duplicate public creator mappings');
  if (mapRows.length) {
    const map = await readRow(env, env.publicSheetId, 'WorkCreatorMap!', mapHeaders, mapRows[0]);
    if (String(map.publicCreatorId || '') && String(map.publicCreatorId) !== env.publicCreatorId) fail('CREATOR_MAPPING_CONFLICT', 'Work is mapped to a different public creator');
  } else {
    const row = mapHeaders.map(() => '' as unknown); row[schemaIndex] = 1; row[workIndex] = id; row[creatorIndex] = env.publicCreatorId;
    await appendRows(env, env.publicSheetId, 'WorkCreatorMap!', [row]);
  }
  const publicHeaders = await sheetHeaders(env, env.publicSheetId, '');
  if (PUBLIC_HEADERS.some((header, index) => publicHeaders[index] !== header)) fail('PUBLIC_SYNC_PENDING', 'Public index headers are unexpected');
  const publicRows = await findRows(env, env.publicSheetId, '', publicHeaders, 'id', id);
  if (publicRows.length > 1) fail('PUBLIC_SYNC_PENDING', 'Public index contains duplicate Work rows');
  const existing = publicRows.length ? await readRow(env, env.publicSheetId, '', publicHeaders, publicRows[0]) : null;
  const publicFolderId = existing?.file_id ? await driveParent(env, String(existing.file_id)) : await folderOfIndexedFiles(env, env.publicSheetId, publicHeaders);
  if (!publicFolderId) fail('PUBLIC_SYNC_PENDING', 'Public projection folder is unknown');
  const pub = projection(record);
  const publicFileId = await putJsonRevision(env, publicFolderId!, `${id}__r${record.revision}.json`, pub);
  const values = PUBLIC_HEADERS.map(header => ({ id: pub.id, title: pub.title, category: pub.category, status: pub.status, updated_at: pub.updated_at, tags: JSON.stringify(pub.tags),
    short_description: pub.short_description || '', file_id: publicFileId, active: 'true', cover_ref: pub.preview_image || '', summary_json: publicSummaryJson(pub) } as Row)[header] ?? '');
  if (publicRows.length) await writeRange(env, env.publicSheetId, `A${publicRows[0]}:${columnLetter(PUBLIC_HEADERS.length - 1)}${publicRows[0]}`, [values]);
  else await appendRows(env, env.publicSheetId, '', [values]);
}

/** Port of deactivatePublicWork_. */
async function deactivatePublicWork(env: DirectWriteEnv, workId: string): Promise<void> {
  const publicHeaders = await sheetHeaders(env, env.publicSheetId, '');
  const activeIndex = publicHeaders.indexOf('active');
  if (activeIndex < 0) return;
  const rows = await findRows(env, env.publicSheetId, '', publicHeaders, 'id', workId);
  for (const rowNumber of rows) await writeRange(env, env.publicSheetId, `${columnLetter(activeIndex)}${rowNumber}`, [['false']]);
}

const REQUEST_ID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function applyRowInput(record: Json, asset: Json): void {
  Object.assign(record.row, { title: asset.title, author_name: asset.authorName || '', author_avatar: asset.authorAvatar || '', icon: asset.icon,
    category: asset.category, status: asset.status, visibility: asset.visibility || (asset.isPublic ? 'public' : 'private'), short_description: asset.shortDescription || '',
    content_type_labels: asset.contentTypeLabels || [], content_types: asset.contentTypes || [], presentation_metadata: asset.presentationMetadata || null,
    public_collaboration: asset.publicCollaboration || null, folder_id: asset.folderId || '', tags: asset.tags || [], content: asset.content || '', ui_code_snippet: asset.uiCodeSnippet || '',
    content_blocks: asset.contentBlocks || [], preview_image: asset.previewImage || '', preview_images: asset.previewImages || [], collaboration_asset_id: asset.collaborationAssetId || null,
    deleted_at: asset.deletedAt || null });
  const r = record.row;
  if (!String(r.title || '').trim()) fail('INVALID_WORK', 'ต้องระบุชื่อผลงาน');
  if (!['character','lore','ui_code','prompts','collab','app_data'].includes(r.category)) fail('INVALID_WORK', 'หมวดหมู่ไม่ถูกต้อง');
  if (!['idea','draft','in_progress','finished','archived'].includes(r.status)) fail('INVALID_WORK', 'สถานะไม่ถูกต้อง');
  if (!['public','private'].includes(r.visibility)) fail('INVALID_WORK', 'การมองเห็นไม่ถูกต้อง');
  if (r.category === 'collab') r.collaboration_asset_id = null;
}

// ------------------------------------------------------------------ create

/**
 * works.create args as Apps Script receives them: [assetInput (userId injected), { requestId, mediaIds? }].
 * Media-bearing creates fall back to Apps Script.
 */
export async function directCreateWork(args: unknown[], ownerUserId: string, env: DirectWriteEnv): Promise<DirectUpdateResult> {
  const [assetInput, options] = args as [Json, Json];
  if (!options || !REQUEST_ID_RE.test(String(options.requestId || ''))) return { fallback: true, reason: 'invalid_request_id' };
  const mediaIds: string[] = Array.isArray(options.mediaIds) ? options.mediaIds.map(String) : [];
  if (!assetInput || typeof assetInput !== 'object' || Array.isArray(assetInput)) fail('INVALID_WORK', 'Work payload is invalid');
  if (Object.keys(assetInput).some(key => !CXL_WRITE_FIELDS.includes(key) && key !== 'userId')) fail('INVALID_WORK', 'Work payload contains unsupported fields');
  if (!String(assetInput.title || '').trim()) fail('INVALID_WORK', 'Work title is required');
  validateUpdatePayload(Object.fromEntries(Object.entries(assetInput).filter(([key]) => key !== 'userId')));
  const requestId = String(options.requestId).toLowerCase();
  const id = `asset_${requestId.replace(/-/g, '')}`;
  const fingerprint = writeFingerprint('create', assetInput);

  const privateHeaders = await sheetHeaders(env, env.privateSheetId, '');
  if (PRIVATE_HEADERS.some(header => !privateHeaders.includes(header))) return { fallback: true, reason: 'private_headers' };
  // A retried create (same requestId) that already committed is answered again, like Apps Script.
  const retried = await findRows(env, env.privateSheetId, '', privateHeaders, 'create_request_id', requestId);
  if (retried.length) {
    const row = await readRow(env, env.privateSheetId, '', privateHeaders, retried[0]);
    const existing = await driveJson(env, String(row.file_id));
    if (existing.createRequestId !== requestId || existing.lastWriteFingerprint !== fingerprint) fail('IDEMPOTENCY_KEY_REUSED', 'Create requestId was already used with different Work data');
    if (isPublicRow(existing.row || {})) await publishWork(env, existing).catch(error => { throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true); });
    return { fallback: false, data: { data: cxlAssetFromRecord(existing), error: null } };
  }
  if ((await findRows(env, env.privateSheetId, '', privateHeaders, 'id', id)).length) fail('IDEMPOTENCY_KEY_REUSED', 'Create requestId conflicts with an existing Work');

  const now = new Date().toISOString();
  const asset: Json = clone(assetInput);
  asset.id = id; asset.userId = ownerUserId; asset.authorName = asset.authorName || 'Creator'; asset.createdAt = now; asset.updatedAt = now;
  asset.visibility = asset.visibility || (asset.isPublic === false ? 'private' : 'public'); asset.isPublic = asset.visibility === 'public'; asset.status = asset.status || 'finished'; asset.deletedAt = null;
  asset.likesCount = 0; asset.forkCount = 0; asset.forkedFromId = null; asset.forkedFromAuthor = null; asset.linkedAssetIds = [];
  asset.versions = [{ version: 1, updatedAt: now, title: asset.title, summary: 'สร้างผลงานเริ่มต้น' }]; asset.media = [];
  rejectUnsupportedWorkMedia(asset, null, mediaIds);
  if (asset.folderId && !(await env.ownerFolderIds()).includes(String(asset.folderId))) fail('INVALID_FOLDER', 'Selected folder is unavailable for this Owner');

  const record: Json = { schemaVersion: 1, sourceSha256: null, revision: 0, row: { id, user_id: ownerUserId, created_at: now, versions: [] }, collaborationDraft: null, collaborationDraftMeta: null, mediaRecords: [] };
  const attachedMedia = await attachWorkMedia(record, asset, mediaIds, id, ownerUserId, env);
  applyRowInput(record, asset);
  const r = record.row;
  if (r.collaboration_asset_id) {
    const linkedRows = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', String(r.collaboration_asset_id));
    const linked = linkedRows.length === 1 ? await readRow(env, env.privateSheetId, '', privateHeaders, linkedRows[0]) : null;
    if (!linked || linked.category !== 'collab') fail('INVALID_WORK', 'คอลแลปที่เชื่อมไม่ถูกต้อง');
  }
  r.is_public = r.visibility === 'public'; r.updated_at = now;
  record.collaborationDraft = asset.category === 'collab' ? (asset.collaboration || null) : null;
  record.cxlAsset = asset;
  record.createRequestId = requestId;
  record.lastWriteRequestId = requestId; record.lastWriteOperation = 'create'; record.lastWriteFingerprint = fingerprint;
  await settleRecordMedia(record, new Set(), env);
  record.revision = 1;

  const privateFolderId = await folderOfIndexedFiles(env, env.privateSheetId, privateHeaders);
  if (!privateFolderId) return { fallback: true, reason: 'private_folder_unknown' };
  const artifacts = ownerSearchArtifacts(cxlAssetFromRecord(record));
  const metadata = privateMeta(record, '', artifacts);
  metadata.file_id = await putJsonRevision(env, privateFolderId, `${id}__r1.json`, record);
  await appendSearchChunks(env, id, artifacts);
  await appendRows(env, env.privateSheetId, '', [privateIndexValues(privateHeaders, metadata, null)]);

  try {
    await markMediaAfterCommit(env, attachedMedia, [], [], id, record.revision);
    if (isPublicRow(r)) await publishWork(env, record);
  } catch (error) {
    throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true);
  }
  return { fallback: false, data: { data: cxlAssetFromRecord(record), error: null } };
}

// -------------------------------------------------------- trash / restore

/** Port of mutateCxlWorkDeletionApi_ for works.softDelete and works.restore. */
export async function directSetTrash(action: 'works.softDelete' | 'works.restore', workId: unknown, ownerUserId: string, env: DirectWriteEnv): Promise<{ fallback: true; reason: string } | { fallback: false; data: { success: true; error: null } }> {
  const id = String(workId || '');
  if (!/^asset_[A-Za-z0-9_-]{1,96}$/.test(id)) fail('INVALID_WORK', 'Work ID is invalid');
  const privateHeaders = await sheetHeaders(env, env.privateSheetId, '');
  if (PRIVATE_HEADERS.some(header => !privateHeaders.includes(header))) return { fallback: true, reason: 'private_headers' };
  const rowNumbers = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', id);
  if (rowNumbers.length !== 1) return rowNumbers.length ? fail('INDEX_ROW_AMBIGUOUS', 'Private Index contains duplicate Work rows') : fail('WORK_NOT_FOUND', 'Work was not found');
  const indexed = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
  const previousFileId = String(indexed.file_id || '');
  if (!previousFileId) return { fallback: true, reason: 'no_record_file' };
  const record = await driveJson(env, previousFileId);
  const asset = cxlAssetFromRecord(record);
  if (String(record.row?.user_id || asset.userId || '') !== ownerUserId) fail('WORK_NOT_OWNED', 'Work is not owned by this authenticated Owner');
  if (String(record.row?.id) !== id) fail('WORK_NOT_FOUND', 'Work was not found');
  const wasPublic = isPublicRow(record.row);

  const deleting = action === 'works.softDelete';
  const now = new Date().toISOString();
  if (deleting && !record.row.deleted_at) record.row.deleted_at = now;
  if (!deleting && record.row.deleted_at) record.row.deleted_at = '';
  record.row.updated_at = now; record.revision = (Number(record.revision) || 0) + 1;
  record.cxlAsset = Object.assign({}, asset, { deletedAt: record.row.deleted_at || null, updatedAt: now, revision: record.revision });

  const privateFolderId = await driveParent(env, previousFileId);
  const artifacts = ownerSearchArtifacts(cxlAssetFromRecord(record));
  const searchHeaders = await appendSearchChunks(env, id, artifacts);
  const metadata = privateMeta(record, '', artifacts);
  metadata.file_id = await putJsonRevision(env, privateFolderId, `${id}__r${record.revision}.json`, record);
  const latest = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
  if (String(latest.id) !== id || (Number(latest.revision) || 1) !== (Number(indexed.revision) || 1)) fail('REVISION_CONFLICT', 'Work changed before this update; reload and try again');
  await writeRange(env, env.privateSheetId, `A${rowNumbers[0]}:${columnLetter(privateHeaders.length - 1)}${rowNumbers[0]}`, [privateIndexValues(privateHeaders, metadata, latest)]);

  try {
    await removeStaleSearchChunks(env, id, artifacts.token, searchHeaders);
    if (deleting) await deactivatePublicWork(env, id);
    // finishCxlPublicProjection_: republish a public Work; deactivate one that stopped being public.
    else if (isPublicRow(record.row)) await publishWork(env, record);
    else if (wasPublic) await deactivatePublicWork(env, id);
  } catch (error) {
    throw new DirectWriteError(error instanceof Error ? error.message : 'Public projection failed', 'PUBLIC_SYNC_PENDING', true);
  }
  return { fallback: false, data: { success: true, error: null } };
}

// --------------------------------------------------------- permanent delete

/** Sheet tab IDs by title; '' is the first tab (where the Index lives). */
async function sheetTabIds(env: DirectWriteEnv, spreadsheetId: string): Promise<Record<string, number>> {
  const meta = await (await google(env, `${sheetsBase(spreadsheetId)}?fields=sheets.properties(sheetId,title,index)`)).json() as { sheets?: { properties?: { sheetId?: number; title?: string; index?: number } }[] };
  const ids: Record<string, number> = {};
  (meta.sheets || []).forEach(sheet => {
    const p = sheet.properties || {};
    if (p.title !== undefined && p.sheetId !== undefined) ids[p.title] = p.sheetId;
    if (p.index === 0 && p.sheetId !== undefined) ids[''] = p.sheetId;
  });
  return ids;
}

/** Delete 1-based sheet rows, bottom-up so earlier indices stay valid. */
async function deleteSheetRows(env: DirectWriteEnv, spreadsheetId: string, sheetId: number | undefined, rowNumbers: number[]): Promise<void> {
  if (sheetId === undefined || !rowNumbers.length) return;
  const requests = [...new Set(rowNumbers)].sort((a, b) => b - a).map(row => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }));
  await google(env, `${sheetsBase(spreadsheetId)}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
}

/** Port of trashWorkRevisionFiles_: every `<workId>__r*.json` in the folder. */
async function trashRevisionFiles(env: DirectWriteEnv, folderId: string | null, workId: string): Promise<void> {
  if (!folderId) return;
  const query = `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and name contains '${workId}__r' and trashed = false`;
  const listed = await (await google(env, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: { id: string; name: string }[] };
  for (const file of listed.files || []) if (file.name.startsWith(`${workId}__r`) && /\.json$/i.test(file.name)) await trashDriveFile(env, file.id);
}

/** Port of mutateCxlWorkDeletionApi_('works.permanentDelete') + finishPermanentWorkDelete_. */
export async function directPermanentDelete(workId: unknown, ownerUserId: string, env: DirectWriteEnv): Promise<{ fallback: false; data: { success: true; error: null; alreadyMissing: boolean } }> {
  const id = String(workId || '');
  if (!/^asset_[A-Za-z0-9_-]{1,96}$/.test(id)) fail('INVALID_WORK', 'Work ID is invalid');
  const privateHeaders = await sheetHeaders(env, env.privateSheetId, '');
  const rowNumbers = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', id);
  if (rowNumbers.length > 1) fail('INDEX_ROW_AMBIGUOUS', 'Private Index contains duplicate Work rows');
  let record: Json = null;
  let privateFolderId: string | null = null;
  if (rowNumbers.length) {
    const indexed = await readRow(env, env.privateSheetId, '', privateHeaders, rowNumbers[0]);
    const fileId = String(indexed.file_id || '');
    record = fileId ? await driveJson(env, fileId) : null;
    if (!record) fail('WORK_NOT_FOUND', 'Work was not found');
    const asset = cxlAssetFromRecord(record);
    if (String(record.row?.user_id || asset.userId || '') !== ownerUserId) fail('WORK_NOT_OWNED', 'Work is not owned by this authenticated Owner');
    if (String(record.row?.id) !== id) fail('WORK_NOT_FOUND', 'Work was not found');
    if (!record.row.deleted_at) fail('WORK_NOT_IN_TRASH', 'Move the Work to Trash before permanent deletion');
    privateFolderId = await driveParent(env, fileId);
    // Commit point: remove the search rows, then the index row.
    const tabs = await sheetTabIds(env, env.privateSheetId);
    const searchHeaders = await sheetHeaders(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!`);
    if (searchHeaders.includes('work_id')) await deleteSheetRows(env, env.privateSheetId, tabs[OWNER_SEARCH_SHEET], await findRows(env, env.privateSheetId, `${OWNER_SEARCH_SHEET}!`, searchHeaders, 'work_id', id));
    const confirm = await findRows(env, env.privateSheetId, '', privateHeaders, 'id', id);
    await deleteSheetRows(env, env.privateSheetId, tabs[''], confirm);
  } else {
    privateFolderId = await folderOfIndexedFiles(env, env.privateSheetId, privateHeaders);
  }

  try {
    // Media first, while the record still says which files belonged to this Work.
    for (const media of record?.mediaRecords || []) {
      if (media?.delivery === 'vercel_proxy' && media.drive_file_id && String(media.asset_id || id) === id) await trashDriveFile(env, String(media.drive_file_id));
    }
    await deactivatePublicWork(env, id);
    const mapHeaders = await sheetHeaders(env, env.publicSheetId, 'WorkCreatorMap!');
    if (mapHeaders.includes('workId')) {
      const publicTabs = await sheetTabIds(env, env.publicSheetId);
      await deleteSheetRows(env, env.publicSheetId, publicTabs.WorkCreatorMap, await findRows(env, env.publicSheetId, 'WorkCreatorMap!', mapHeaders, 'workId', id));
    }
    const publicHeaders = await sheetHeaders(env, env.publicSheetId, '');
    const publicFolderId = await folderOfIndexedFiles(env, env.publicSheetId, publicHeaders);
    await trashRevisionFiles(env, privateFolderId, id);
    await trashRevisionFiles(env, publicFolderId, id);
  } catch (error) {
    throw new DirectWriteError(error instanceof Error ? error.message : 'Permanent delete cleanup failed', 'PUBLIC_SYNC_PENDING', true);
  }
  return { fallback: false, data: { success: true, error: null, alreadyMissing: rowNumbers.length === 0 } };
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
