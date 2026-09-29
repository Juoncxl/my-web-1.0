import { createSign } from 'node:crypto';

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

async function googleGet(url: string): Promise<globalThis.Response> {
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

/** Port of cxlAssetFromRecord_. */
function assetFromRecord(record: Row): Row {
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
