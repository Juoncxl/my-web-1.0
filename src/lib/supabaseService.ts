import type { Asset, Folder, User, AssetStatus, AssetVersion, ProfileSocialLink } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { formatFriendlyErrorMessage } from './apiHelper';
import { isLegacyGuestUserId } from './accessPolicy';
import { normalizeAssetVisibility } from './assetVisibility';
import { isMockPersistence } from './persistenceMode';
import { normalizeProfileUsername, resolveProfileBySlug, type ProfileLookupResult } from './profileIdentity';
import {
  hydrateQaProfileImages,
  saveQaProfileImage,
  validateQaProfileImage
} from './qaProfileImageStore';
import {
  dataUrlToQaWorkIconBlob,
  deleteQaWorkIcon,
  getQaWorkIcon,
  hydrateQaWorkIcons,
  isQaWorkIconKeyForAsset,
  saveQaWorkIcon
} from './qaWorkIconStore';
import {
  deleteQaWorkPayload,
  getQaWorkPayload,
  hydrateQaWorkPayloads,
  saveQaWorkPayload,
  stripQaWorkPayload
} from './qaWorkPayloadStore';
import {
  readMockAssets,
  readMockBookmarks,
  readMockFolders,
  readMockLikes,
  readMockProfiles,
  cacheMockProfileSnapshot,
  removeMockAsset,
  removeMockFolder,
  setMockAssetLike,
  writeMockAsset,
  writeMockBookmarks,
  writeMockFolder,
  readMockProfile,
  writeMockProfile
} from './creatorPersistence';

// Local Storage Keys
const LOCAL_STORAGE_ASSETS = 'creator_vault_local_assets';
const LOCAL_STORAGE_FOLDERS = 'creator_vault_local_folders';
const LEGACY_IMPORT_STORAGE_PREFIX = 'creator_vault_legacy_import_';

type CloudAuth = { userId: string; error: null } | { userId: null; error: string };

function logServiceError(context: string, error: unknown) {
  if (!((import.meta as any).env?.DEV || (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)))) return;
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  console.error(`[supabaseService:${context}]`, {
    code: typeof record.code === 'string' ? record.code : undefined,
    status: typeof record.status === 'number' ? record.status : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    message: typeof record.message === 'string' ? record.message.replace(/[\r\n]+/g, ' ').slice(0, 300) : String(error || 'Unknown service error')
  });
}

function toServiceError(error: any, fallback: string): string {
  logServiceError(fallback, error);
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');

  if (code === '42501' || code === 'PGRST301' || /row-level security|permission denied/i.test(message)) {
    return 'คุณไม่มีสิทธิ์ดำเนินการกับข้อมูลนี้ หรือ session หมดอายุแล้ว';
  }
  if (code === '23505') return 'ข้อมูลนี้มีอยู่แล้วในระบบ';
  if (/failed to fetch|network|connection/i.test(message)) {
    return 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }

  const friendly = formatFriendlyErrorMessage(error);
  return friendly === message && message ? fallback : friendly || fallback;
}

function isOptionalRelationUnavailable(error: unknown): boolean {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const code = String(record.code || '');
  const message = String(record.message || '');
  return code === 'PGRST205'
    || code === '42P01'
    || /could not find the table|relation .* does not exist|schema cache/i.test(message);
}

async function requireCloudUser(expectedUserId?: string): Promise<CloudAuth> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { userId: null, error: 'ระบบบัญชียังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return { userId: null, error: 'กรุณาเข้าสู่ระบบอีกครั้งก่อนบันทึกข้อมูล' };
    }
    if (expectedUserId && data.session.user.id !== expectedUserId) {
      return { userId: null, error: 'บัญชีปัจจุบันไม่ตรงกับเจ้าของข้อมูล' };
    }
    return { userId: data.session.user.id, error: null };
  } catch (error) {
    return { userId: null, error: toServiceError(error, 'ตรวจสอบ session ไม่สำเร็จ') };
  }
}

// Read-only access to legacy browser Guest data for explicit recovery after login.
function getLocalAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSETS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Local assets read error:', e);
  }
  return [];
}

function getAllLocalFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Local folders read error:', e);
  }
  return [];
}

function parseStoredJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type LegacyImportState = {
  assetIds: string[];
  folderIdMap: Record<string, string>;
};

function getLegacyImportState(userId: string): LegacyImportState {
  try {
    const raw = localStorage.getItem(`${LEGACY_IMPORT_STORAGE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      assetIds: Array.isArray(parsed?.assetIds) ? parsed.assetIds : [],
      folderIdMap: parsed?.folderIdMap && typeof parsed.folderIdMap === 'object'
        ? parsed.folderIdMap
        : {}
    };
  } catch {
    return { assetIds: [], folderIdMap: {} };
  }
}

function saveLegacyImportState(userId: string, state: LegacyImportState): void {
  localStorage.setItem(`${LEGACY_IMPORT_STORAGE_PREFIX}${userId}`, JSON.stringify(state));
}

// Convert Supabase DB snake_case record to Client Asset
function mapDbToAsset(row: any): Asset {
  const { visibility: visibilityVal, isPublic } = normalizeAssetVisibility(row);
  const statusVal: AssetStatus = row.status || 'finished';

  return {
    id: row.id,
    userId: row.user_id || row.userId,
    authorName: row.author_name || row.authorName || 'Creator',
    authorAvatar: row.author_avatar || row.authorAvatar,
    title: row.title || '',
    icon: typeof row.icon === 'string'
      ? parseStoredJson(row.icon, { type: 'emoji', value: row.icon || '✨' })
      : row.icon || { type: 'emoji', value: '✨' },
    category: row.category,
    shortDescription: row.short_description ?? row.shortDescription,
    contentTypeLabels: parseStoredJson(row.content_type_labels ?? row.contentTypeLabels, []),
    contentTypes: parseStoredJson(row.content_types ?? row.contentTypes, []),
    presentationMetadata: parseStoredJson(row.presentation_metadata ?? row.presentationMetadata, undefined),
    publicCollaboration: parseStoredJson(row.public_collaboration ?? row.publicCollaboration, null),
    collaborationAssetId: row.collaboration_asset_id ?? row.collaborationAssetId ?? null,
    collaboration: parseStoredJson(row.private_collaboration ?? row.collaboration, null),
    contentBlocks: parseStoredJson(row.content_blocks ?? row.contentBlocks, []),
    content: row.content || '',
    uiCodeSnippet: row.ui_code_snippet || row.uiCodeSnippet || '',
    previewImage: row.preview_image || row.previewImage,
    previewImages: row.preview_images || (row.preview_image ? [row.preview_image] : []),
    folderId: row.folder_id || row.folderId || null,
    isPublic,
    visibility: visibilityVal,
    status: statusVal,
    tags: row.tags || [],
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    deletedAt: row.deleted_at || row.deletedAt || null,
    likesCount: row.likes_count || row.likesCount || 0,
    forkCount: row.fork_count || row.forkCount || 0,
    forkedFromId: row.forked_from_id || row.forkedFromId || null,
    forkedFromAuthor: row.forked_from_author || row.forkedFromAuthor || null,
    linkedAssetIds: row.linked_asset_ids || row.linkedAssetIds || [],
    versions: parseStoredJson(row.versions, [])
  };
}

// Convert Client Asset to Supabase DB snake_case payload
function mapAssetToDb(asset: Partial<Asset>) {
  const dbPayload: any = {};
  if (asset.id) dbPayload.id = asset.id;
  if (asset.userId) dbPayload.user_id = asset.userId;
  if (asset.authorName !== undefined) dbPayload.author_name = asset.authorName;
  if (asset.authorAvatar !== undefined) dbPayload.author_avatar = asset.authorAvatar || '';
  if (asset.title !== undefined) dbPayload.title = asset.title;
  if (asset.icon !== undefined) dbPayload.icon = asset.icon;
  if (asset.category !== undefined) dbPayload.category = asset.category;
  if (asset.shortDescription !== undefined) dbPayload.short_description = asset.shortDescription || '';
  if (asset.contentTypeLabels !== undefined) dbPayload.content_type_labels = asset.contentTypeLabels || [];
  if (asset.contentTypes !== undefined) dbPayload.content_types = asset.contentTypes || [];
  if (asset.presentationMetadata !== undefined) dbPayload.presentation_metadata = asset.presentationMetadata || null;
  if (asset.publicCollaboration !== undefined) dbPayload.public_collaboration = asset.publicCollaboration || null;
  if (asset.collaborationAssetId !== undefined) dbPayload.collaboration_asset_id = asset.collaborationAssetId || null;
  if (asset.contentBlocks !== undefined) dbPayload.content_blocks = asset.contentBlocks || [];
  if (asset.content !== undefined) dbPayload.content = asset.content;
  if (asset.uiCodeSnippet !== undefined) dbPayload.ui_code_snippet = asset.uiCodeSnippet || '';
  if (asset.previewImage !== undefined) dbPayload.preview_image = asset.previewImage || '';
  if (asset.previewImages !== undefined) dbPayload.preview_images = asset.previewImages || [];
  if (asset.folderId !== undefined) dbPayload.folder_id = asset.folderId || null;
  
  if (asset.visibility !== undefined || asset.isPublic !== undefined) {
    const normalizedVisibility = normalizeAssetVisibility({
      visibility: asset.visibility,
      isPublic: asset.isPublic
    });
    dbPayload.visibility = normalizedVisibility.visibility;
    dbPayload.is_public = normalizedVisibility.isPublic;
  }

  if (asset.status !== undefined) dbPayload.status = asset.status;
  if (asset.tags !== undefined) dbPayload.tags = asset.tags || [];
  if (asset.likesCount !== undefined) dbPayload.likes_count = asset.likesCount ?? 0;
  if (asset.forkCount !== undefined) dbPayload.fork_count = asset.forkCount ?? 0;
  if (asset.forkedFromId !== undefined) dbPayload.forked_from_id = asset.forkedFromId || null;
  if (asset.forkedFromAuthor !== undefined) dbPayload.forked_from_author = asset.forkedFromAuthor || null;
  if (asset.linkedAssetIds !== undefined) dbPayload.linked_asset_ids = asset.linkedAssetIds || [];
  if (asset.versions !== undefined) dbPayload.versions = asset.versions || [];
  if (asset.deletedAt !== undefined) dbPayload.deleted_at = asset.deletedAt || null;

  dbPayload.updated_at = new Date().toISOString();
  return dbPayload;
}

// Convert Supabase DB folder to Client Folder
function mapDbToFolder(row: any): Folder {
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    name: row.name,
    icon: row.icon || '📁',
    color: row.color || 'purple',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
}

function mapDbToSocialLink(row: any): ProfileSocialLink {
  return {
    id: row.id,
    platform: row.platform || 'custom',
    label: row.label || row.platform || 'ลิงก์',
    url: row.url || '',
    visible: row.visible !== false,
    sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 0
  };
}

function mapProfileBio(value: unknown): string {
  const bio = typeof value === 'string' ? value : '';
  return bio === 'นักสร้างสรรค์ผลงาน 🌸' ? '' : bio;
}

function createClientId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildMockAsset(assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Asset {
  const now = new Date().toISOString();
  const normalizedVisibility = normalizeAssetVisibility({ visibility: assetData.visibility, isPublic: assetData.isPublic });
  return {
    ...assetData,
    id: createClientId('qa_asset'),
    visibility: normalizedVisibility.visibility,
    isPublic: normalizedVisibility.isPublic,
    status: assetData.status || 'finished',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    likesCount: 0,
    forkCount: 0,
    forkedFromId: assetData.forkedFromId || null,
    forkedFromAuthor: assetData.forkedFromAuthor || null,
    linkedAssetIds: assetData.linkedAssetIds || [],
    versions: [{ version: 1, updatedAt: now, title: assetData.title || 'Untitled Asset', summary: 'สร้างผลงานใน QA Sandbox' }],
    previewImages: assetData.previewImages || (assetData.previewImage ? [assetData.previewImage] : [])
  };
}

/** Store binary Work Icon media outside the JSON QA state before writing it. */
async function prepareQaWorkIconForWrite(asset: Asset): Promise<{ asset: Asset; createdStorageKey?: string }> {
  if (asset.icon.type !== 'image') {
    const { storageKey: _storageKey, mimeType: _mimeType, ...icon } = asset.icon;
    return { asset: { ...asset, icon } };
  }

  const blob = dataUrlToQaWorkIconBlob(asset.icon.value);
  if (blob) {
    const stored = await saveQaWorkIcon({ assetId: asset.id, blob });
    return {
      asset: {
        ...asset,
        icon: { type: 'image', value: stored.url, storageKey: stored.key, mimeType: stored.mimeType }
      },
      createdStorageKey: stored.key
    };
  }

  // A fork must own an independent binary key instead of sharing its source
  // Work's icon. Existing Work updates retain their own key untouched.
  if (asset.icon.storageKey && !isQaWorkIconKeyForAsset(asset.icon.storageKey, asset.id)) {
    const source = await getQaWorkIcon(asset.icon.storageKey);
    if (source) {
      const stored = await saveQaWorkIcon({ assetId: asset.id, blob: source.blob });
      return {
        asset: {
          ...asset,
          icon: { type: 'image', value: stored.url, storageKey: stored.key, mimeType: stored.mimeType }
        },
        createdStorageKey: stored.key
      };
    }
  }

  return { asset };
}

/** Keep HTML, preview data and Collaboration reference media out of QA JSON storage. */
async function prepareQaWorkAssetForWrite(asset: Asset): Promise<{ asset: Asset; storageAsset: Asset; createdIconKey?: string; createdPayloadKey: string }> {
  const iconPrepared = await prepareQaWorkIconForWrite(asset);
  try {
    const payload = await saveQaWorkPayload({ assetId: iconPrepared.asset.id, asset: iconPrepared.asset });
    return {
      asset: iconPrepared.asset,
      storageAsset: stripQaWorkPayload(iconPrepared.asset, payload.key),
      createdIconKey: iconPrepared.createdStorageKey,
      createdPayloadKey: payload.key
    };
  } catch (error) {
    await removeQaWorkIconQuietly(iconPrepared.createdStorageKey);
    throw error;
  }
}

/** One-time compaction for pre-overflow QA records created by older builds. */
async function compactLegacyQaWorkPayloads(): Promise<void> {
  const legacyAssets = readMockAssets().filter(asset => {
    if (asset.qaStorageKey) return false;
    try { return JSON.stringify(getQaWorkPayload(asset)).length > 50000; } catch { return false; }
  });
  for (const legacyAsset of legacyAssets) {
    try {
      const prepared = await prepareQaWorkAssetForWrite(legacyAsset);
      if (writeMockAsset(prepared.storageAsset)) {
        // The old record had no external key, so there is no payload to clean up.
      } else {
        await removeQaWorkIconQuietly(prepared.createdIconKey);
        await removeQaWorkPayloadQuietly(prepared.createdPayloadKey);
      }
    } catch {
      // Keep the original record intact; the current mutation will return its
      // normal persistence error if the browser has no remaining storage.
    }
  }
}

async function removeQaWorkIconQuietly(storageKey?: string): Promise<void> {
  if (!storageKey) return;
  try { await deleteQaWorkIcon(storageKey); } catch { /* orphan cleanup must not undo a saved Work mutation */ }
}

async function removeQaWorkPayloadQuietly(storageKey?: string): Promise<void> {
  if (!storageKey) return;
  try { await deleteQaWorkPayload(storageKey); } catch { /* orphan cleanup must not undo a saved Work mutation */ }
}

async function getSessionUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id || null;
  } catch {
    return null;
  }
}

export interface FetchAssetsOptions {
  userId?: string;
  currentUserId?: string;
  creatorSlug?: string;
  assetId?: string;
  category?: string;
  folderId?: string | null;
  search?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  publicOnly?: boolean;
  limit?: number;
  detail?: 'summary' | 'full';
}

const ASSET_SUMMARY_COLUMNS = [
  // Legacy Google AI Studio rows may contain multi-megabyte base64 values in
  // both author_avatar and icon. Repeating those blobs for every card caused
  // 30+ MB Feed responses and PostgREST statement timeouts. List cards use
  // their profile/category fallbacks; opening one Work hydrates its icon.
  'id', 'user_id', 'author_name', 'title', 'category',
  'short_description', 'content_type_labels', 'content_types', 'presentation_metadata',
  'public_collaboration', 'collaboration_asset_id', 'preview_image', 'folder_id',
  'is_public', 'visibility', 'status', 'tags', 'created_at', 'updated_at',
  'deleted_at', 'likes_count', 'fork_count', 'forked_from_id', 'forked_from_author',
  'linked_asset_ids'
].join(',');

const ASSET_DETAIL_COLUMNS = [
  // Author presentation belongs to profiles. Never download the legacy base64
  // avatar duplicated on each Work row, even for a detail request.
  'id', 'user_id', 'author_name', 'title', 'icon', 'category',
  'short_description', 'content_type_labels', 'content_types', 'presentation_metadata',
  'public_collaboration', 'collaboration_asset_id', 'content_blocks', 'content',
  'ui_code_snippet', 'preview_image', 'preview_images', 'folder_id', 'is_public',
  'visibility', 'status', 'tags', 'created_at', 'updated_at', 'deleted_at',
  'likes_count', 'fork_count', 'forked_from_id', 'forked_from_author',
  'linked_asset_ids', 'versions'
].join(',');

function normalizeAssetQueryLimit(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(1, Math.trunc(value!)));
}

async function fetchAssetsFromMock(options?: FetchAssetsOptions): Promise<{ data: Asset[]; error: string | null }> {
  // QA Sandbox is intentionally local-only. Cloud migration is an explicit
  // Settings action; a normal read must never wait on or merge remote tables.
  let list = await hydrateQaWorkPayloads(await hydrateQaWorkIcons(readMockAssets().map(asset => ({
    ...asset,
    ...normalizeAssetVisibility({ visibility: asset.visibility, isPublic: asset.isPublic })
  }))));

  let scopedUserId = options?.userId;
  if (!scopedUserId && options?.creatorSlug) {
    let cleanSlug = '';
    try { cleanSlug = decodeURIComponent(options.creatorSlug).trim(); } catch { cleanSlug = ''; }
    scopedUserId = resolveProfileBySlug(readMockProfiles(), cleanSlug)?.id;
    if (!scopedUserId) return { data: [], error: null };
  }

  if (options?.assetId) list = list.filter(asset => asset.id === options.assetId);
  if (options?.publicOnly) list = list.filter(asset => asset.visibility === 'public' && asset.isPublic && !asset.deletedAt);
  else if (scopedUserId) list = list.filter(asset => asset.userId === scopedUserId);
  else if (options?.currentUserId) list = list.filter(asset => asset.userId === options.currentUserId || (asset.visibility === 'public' && asset.isPublic && !asset.deletedAt));
  else list = list.filter(asset => asset.visibility === 'public' && asset.isPublic && !asset.deletedAt);

  if (scopedUserId && options?.currentUserId !== scopedUserId) list = list.filter(asset => asset.visibility === 'public' && asset.isPublic && !asset.deletedAt);
  if (options?.onlyDeleted) list = list.filter(asset => Boolean(asset.deletedAt));
  else if (!options?.includeDeleted) list = list.filter(asset => !asset.deletedAt);
  if (options?.category && options.category !== 'all') list = list.filter(asset => asset.category === options.category);
  if (options?.userId && options.folderId !== undefined) list = list.filter(asset => options.folderId === null ? !asset.folderId : asset.folderId === options.folderId);
  if (options?.search?.trim()) {
    const search = options.search.toLowerCase().trim();
    list = list.filter(asset => asset.title.toLowerCase().includes(search) || asset.shortDescription?.toLowerCase().includes(search) || asset.content.toLowerCase().includes(search) || asset.contentBlocks?.some(block => block.title.toLowerCase().includes(search) || block.body.toLowerCase().includes(search)) || asset.tags?.some(tag => tag.toLowerCase().includes(search)));
  }
  // The payload store contains owner-only Collaboration drafts for edit flows.
  // Never hand that field to a public profile/feed consumer.
  if (options?.currentUserId !== undefined) {
    list = list.map(asset => asset.userId === options.currentUserId
      ? asset
      : { ...asset, collaboration: null, qaStorageKey: undefined });
  } else {
    list = list.map(asset => ({ ...asset, collaboration: null, qaStorageKey: undefined }));
  }
  const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const limit = normalizeAssetQueryLimit(options?.limit);
  return { data: limit ? sorted.slice(0, limit) : sorted, error: null };
}

async function fetchFoldersFromMock(userId: string): Promise<{ data: Folder[]; error: string | null }> {
  const folders = readMockFolders(userId);
  return { data: folders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), error: null };
}

function isSafeProfileLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

async function fetchProfileSocialLinks(userId: string): Promise<ProfileSocialLink[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('profile_social_links')
      .select('id, platform, label, url, visible, sort_order')
      .eq('profile_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      logServiceError('fetchProfileSocialLinks', error);
      return [];
    }

    return (data || []).map(mapDbToSocialLink);
  } catch (error) {
    logServiceError('fetchProfileSocialLinks:exception', error);
    return [];
  }
}

// DIRECT SUPABASE DATABASE SERVICE (CRUD & ADVANCED LOGIC)
export const supabaseService = {
  // 1. Fetch Assets (Public feed or personal vault)
  async fetchAssets(options?: FetchAssetsOptions): Promise<{ data: Asset[]; error: string | null }> {
    if (isMockPersistence) return fetchAssetsFromMock(options);
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: [], error: 'ยังโหลดผลงานไม่ได้ กรุณาลองใหม่อีกครั้ง' };
    }

    try {
      // Public discovery does not depend on the current session. Avoid an
      // Auth read here so restoring a signed-in user cannot trigger a second
      // copy of the exact same public list request.
      const sessionUserId = options?.publicOnly
        ? undefined
        : options?.currentUserId || (await supabase.auth.getSession()).data.session?.user.id;
      let query = supabase
        .from('assets')
        .select(options?.detail === 'summary' ? ASSET_SUMMARY_COLUMNS : ASSET_DETAIL_COLUMNS);

      let scopedUserId = options?.userId;
      if (!scopedUserId && options?.creatorSlug) {
        let cleanSlug = '';
        try { cleanSlug = decodeURIComponent(options.creatorSlug).trim(); } catch { cleanSlug = ''; }
        if (!cleanSlug || cleanSlug.length > 128) return { data: [], error: null };
        const isProfileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanSlug);
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq(isProfileId ? 'id' : 'username', isProfileId ? cleanSlug : normalizeProfileUsername(cleanSlug) || cleanSlug)
          .maybeSingle();
        if (profileError) {
          return { data: [], error: toServiceError(profileError, 'โหลดเจ้าของโปรไฟล์ไม่สำเร็จ') };
        }
        if (!profileRow?.id) return { data: [], error: null };
        scopedUserId = profileRow.id;
      }

      if (options?.assetId) {
        query = query.eq('id', options.assetId);
      }

      if (options?.publicOnly) {
        query = query
          .eq('visibility', 'public')
          .eq('is_public', true)
          .is('deleted_at', null);
      } else if (options?.onlyDeleted) {
        if (!sessionUserId || (scopedUserId && scopedUserId !== sessionUserId)) {
          return { data: [], error: 'กรุณาเข้าสู่ระบบเพื่อดูถังขยะของคุณ' };
        }
        query = query.eq('user_id', sessionUserId).not('deleted_at', 'is', null);
      } else if (scopedUserId) {
        query = query.eq('user_id', scopedUserId);
        if (sessionUserId !== scopedUserId) {
          query = query
            .eq('visibility', 'public')
            .eq('is_public', true)
            .is('deleted_at', null);
        } else if (!options.includeDeleted) {
          query = query.is('deleted_at', null);
        }
      } else if (sessionUserId) {
        const ownerClause = options?.includeDeleted
          ? `user_id.eq.${sessionUserId}`
          : `and(user_id.eq.${sessionUserId},deleted_at.is.null)`;
        query = query.or(
          `and(visibility.eq.public,is_public.eq.true,deleted_at.is.null),${ownerClause}`
        );
      } else {
        query = query
          .eq('visibility', 'public')
          .eq('is_public', true)
          .is('deleted_at', null);
      }

      if (options?.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }
      if (options?.userId && options.folderId !== undefined) {
        query = options.folderId === null
          ? query.is('folder_id', null)
          : query.eq('folder_id', options.folderId);
      }

      query = query.order('created_at', { ascending: false });
      const limit = normalizeAssetQueryLimit(options?.limit);
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) {
        return { data: [], error: toServiceError(error, 'โหลดคลังผลงานไม่สำเร็จ') };
      }

      let list = (data || []).map(mapDbToAsset);
      const ownedCollaborationIds = list
        .filter(asset => asset.userId === sessionUserId && asset.category === 'collab')
        .map(asset => asset.id);
      if (options?.detail !== 'summary' && sessionUserId && ownedCollaborationIds.length > 0) {
        const { data: privateDraftRows, error: privateDraftError } = await supabase
          .from('asset_collaboration_drafts')
          .select('asset_id,draft')
          .eq('owner_id', sessionUserId)
          .in('asset_id', ownedCollaborationIds);
        if (!privateDraftError && privateDraftRows) {
          const privateByAssetId = new Map(privateDraftRows.map(row => [row.asset_id, row.draft]));
          list = list.map(asset => privateByAssetId.has(asset.id)
            ? { ...asset, collaboration: parseStoredJson(privateByAssetId.get(asset.id), null) }
            : asset);
        }
      }
      if (options?.search?.trim()) {
        const search = options.search.toLowerCase().trim();
        list = list.filter(asset =>
          asset.title.toLowerCase().includes(search) ||
          asset.content.toLowerCase().includes(search) ||
          asset.tags?.some(tag => tag.toLowerCase().includes(search))
        );
      }

      return { data: list, error: null };
    } catch (error) {
      return { data: [], error: toServiceError(error, 'โหลดคลังผลงานไม่สำเร็จ') };
    }
  },

  // 2. Create Asset
  async createAsset(
    assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ data: Asset | null; error: string | null }> {
    if (isMockPersistence) {
      await compactLegacyQaWorkPayloads();
      const asset = buildMockAsset(assetData);
      let prepared: { asset: Asset; storageAsset: Asset; createdIconKey?: string; createdPayloadKey: string };
      try {
        prepared = await prepareQaWorkAssetForWrite(asset);
      } catch (error) {
        return { data: null, error: toServiceError(error, 'บันทึกข้อมูลผลงานใน QA Sandbox ไม่สำเร็จ') };
      }
      if (!writeMockAsset(prepared.storageAsset)) {
        await removeQaWorkIconQuietly(prepared.createdIconKey);
        await removeQaWorkPayloadQuietly(prepared.createdPayloadKey);
        return { data: null, error: 'บันทึกผลงานใน QA Sandbox ไม่สำเร็จ กรุณาลองใหม่' };
      }
      return { data: prepared.asset, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(assetData.userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const newId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const visibility = assetData.visibility || (assetData.isPublic === false ? 'private' : 'public');
    const status = assetData.status || 'finished';

    const initialVersion: AssetVersion = {
      version: 1,
      updatedAt: now,
      title: assetData.title || 'Untitled Asset',
      summary: 'สร้างผลงานเริ่มต้น'
    };

    const newAsset: Asset = {
      ...assetData,
      id: newId,
      userId: auth.userId,
      visibility,
      isPublic: visibility === 'public',
      status,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      likesCount: 0,
      forkCount: 0,
      forkedFromId: assetData.forkedFromId || null,
      forkedFromAuthor: assetData.forkedFromAuthor || null,
      linkedAssetIds: assetData.linkedAssetIds || [],
      versions: [initialVersion],
      previewImages: assetData.previewImages || (assetData.previewImage ? [assetData.previewImage] : [])
    };

    try {
      if (newAsset.folderId) {
        const { data: folder, error: folderError } = await supabase
          .from('folders')
          .select('id')
          .eq('id', newAsset.folderId)
          .eq('user_id', auth.userId)
          .maybeSingle();
        if (folderError || !folder) {
          return { data: null, error: 'โฟลเดอร์ปลายทางไม่อยู่ในบัญชีของคุณ' };
        }
      }
      if (newAsset.collaborationAssetId) {
        const { data: collaborationAsset, error: collaborationError } = await supabase
          .from('assets')
          .select('id')
          .eq('id', newAsset.collaborationAssetId)
          .eq('user_id', auth.userId)
          .eq('category', 'collab')
          .is('deleted_at', null)
          .maybeSingle();
        if (collaborationError || !collaborationAsset) {
          return { data: null, error: 'คอลแลปที่เลือกไม่อยู่ในบัญชีของคุณหรือไม่พร้อมใช้งาน' };
        }
      }

      const dbPayload = mapAssetToDb(newAsset);
      dbPayload.id = newId;
      dbPayload.user_id = auth.userId;
      dbPayload.created_at = now;
      dbPayload.likes_count = 0;
      dbPayload.fork_count = 0;

      const { data, error } = await supabase
        .from('assets')
        .insert(dbPayload)
        .select()
        .single();

      if (error || !data) {
        return { data: null, error: toServiceError(error, 'บันทึกผลงานบนคลาวด์ไม่สำเร็จ') };
      }
      if (newAsset.collaboration) {
        const { error: privateDraftError } = await supabase.from('asset_collaboration_drafts').upsert({
          asset_id: newAsset.id,
          owner_id: auth.userId,
          draft: newAsset.collaboration,
          updated_at: now
        }, { onConflict: 'asset_id' });
        if (privateDraftError) {
          await supabase.from('assets').delete().eq('id', newAsset.id).eq('user_id', auth.userId);
          return { data: null, error: toServiceError(privateDraftError, 'บันทึกข้อมูลจัดการคอลแลปไม่สำเร็จ') };
        }
      }
      return { data: { ...mapDbToAsset(data), collaboration: newAsset.collaboration || null }, error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'บันทึกผลงานบนคลาวด์ไม่สำเร็จ') };
    }
  },

  // 3. Update Asset
  async updateAsset(
    id: string,
    updates: Partial<Asset>
  ): Promise<{ data: Asset | null; error: string | null }> {
    if (isMockPersistence) {
      await compactLegacyQaWorkPayloads();
      const userId = await getSessionUserId();
      if (!userId) return { data: null, error: 'กรุณาเข้าสู่ระบบอีกครั้งก่อนบันทึกข้อมูล' };
      const result = await fetchAssetsFromMock({ userId, currentUserId: userId, includeDeleted: true });
      const existing = result.data.find(asset => asset.id === id);
      if (!existing) return { data: null, error: 'ไม่พบผลงานของคุณที่ต้องการแก้ไข' };
      const now = new Date().toISOString();
      const next: Asset = {
        ...existing,
        ...updates,
        id: existing.id,
        userId: existing.userId,
        updatedAt: now,
        isPublic: updates.visibility ? updates.visibility === 'public' : updates.isPublic ?? existing.isPublic,
        visibility: updates.visibility || (updates.isPublic !== undefined ? (updates.isPublic ? 'public' : 'private') : existing.visibility),
        versions: updates.title !== undefined || updates.content !== undefined || updates.uiCodeSnippet !== undefined
          ? [...(existing.versions || []), { version: (existing.versions?.at(-1)?.version || 0) + 1, updatedAt: now, title: updates.title || existing.title, summary: 'บันทึกการแก้ไขใน QA Sandbox' }]
          : existing.versions
      };
      const previousStorageKey = existing.icon.type === 'image' ? existing.icon.storageKey : undefined;
      const previousPayloadKey = existing.qaStorageKey;
      let prepared: { asset: Asset; storageAsset: Asset; createdIconKey?: string; createdPayloadKey: string };
      try {
        prepared = await prepareQaWorkAssetForWrite(next);
      } catch (error) {
        return { data: null, error: toServiceError(error, 'บันทึกข้อมูลผลงานใน QA Sandbox ไม่สำเร็จ') };
      }
      if (!writeMockAsset(prepared.storageAsset)) {
        await removeQaWorkIconQuietly(prepared.createdIconKey);
        await removeQaWorkPayloadQuietly(prepared.createdPayloadKey);
        return { data: null, error: 'บันทึกการแก้ไขใน QA Sandbox ไม่สำเร็จ กรุณาลองใหม่' };
      }
      if (previousStorageKey && previousStorageKey !== prepared.asset.icon.storageKey) {
        await removeQaWorkIconQuietly(previousStorageKey);
      }
      if (previousPayloadKey && previousPayloadKey !== prepared.createdPayloadKey) {
        await removeQaWorkPayloadQuietly(previousPayloadKey);
      }
      return { data: prepared.asset, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const now = new Date().toISOString();

    try {
      const { data: existingRow, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .eq('user_id', auth.userId)
        .maybeSingle();
      if (fetchError) {
        return { data: null, error: toServiceError(fetchError, 'ตรวจสอบผลงานไม่สำเร็จ') };
      }
      if (!existingRow) {
        return { data: null, error: 'ไม่พบผลงานของคุณที่ต้องการแก้ไข' };
      }

      if (updates.folderId) {
        const { data: folder, error: folderError } = await supabase
          .from('folders')
          .select('id')
          .eq('id', updates.folderId)
          .eq('user_id', auth.userId)
          .maybeSingle();
        if (folderError || !folder) {
          return { data: null, error: 'โฟลเดอร์ปลายทางไม่อยู่ในบัญชีของคุณ' };
        }
      }
      if (updates.collaborationAssetId) {
        const { data: collaborationAsset, error: collaborationError } = await supabase
          .from('assets')
          .select('id')
          .eq('id', updates.collaborationAssetId)
          .eq('user_id', auth.userId)
          .eq('category', 'collab')
          .is('deleted_at', null)
          .maybeSingle();
        if (collaborationError || !collaborationAsset) {
          return { data: null, error: 'คอลแลปที่เลือกไม่อยู่ในบัญชีของคุณหรือไม่พร้อมใช้งาน' };
        }
      }

      const existing = mapDbToAsset(existingRow);
      const safeUpdates: Partial<Asset> = {};
      const mutableKeys: Array<keyof Asset> = [
        'authorName', 'authorAvatar', 'title', 'icon', 'category', 'shortDescription',
        'contentTypeLabels', 'contentTypes', 'presentationMetadata', 'publicCollaboration',
        'collaborationAssetId', 'contentBlocks', 'collaboration', 'content',
        'uiCodeSnippet', 'previewImage', 'previewImages', 'folderId', 'isPublic',
        'visibility', 'status', 'tags', 'linkedAssetIds'
      ];
      mutableKeys.forEach(key => {
        if (updates[key] !== undefined) (safeUpdates as any)[key] = updates[key];
      });

      let updatedVersions = existing.versions || [];
      if (updates.title !== undefined || updates.content !== undefined || updates.uiCodeSnippet !== undefined) {
        const nextVersion = (updatedVersions.at(-1)?.version || 0) + 1;
        updatedVersions = [
          ...updatedVersions,
          {
            version: nextVersion,
            updatedAt: now,
            title: updates.title || existing.title,
            summary: updates.status ? `อัปเดตสถานะเป็น ${updates.status}` : 'บันทึกการแก้ไขเนื้อหา'
          }
        ];
      }

      const dbPayload = mapAssetToDb({
        ...safeUpdates,
        versions: updatedVersions,
        updatedAt: now
      });
      delete dbPayload.user_id;
      delete dbPayload.likes_count;
      delete dbPayload.fork_count;
      delete dbPayload.forked_from_id;
      delete dbPayload.forked_from_author;

      const { data, error } = await supabase
        .from('assets')
        .update(dbPayload)
        .eq('id', id)
        .eq('user_id', auth.userId)
        .select()
        .maybeSingle();
      if (error) return { data: null, error: toServiceError(error, 'บันทึกการแก้ไขไม่สำเร็จ') };
      if (!data) return { data: null, error: 'ไม่พบผลงานของคุณที่ต้องการแก้ไข' };

      if (updates.collaboration !== undefined) {
        const privateDraftMutation = updates.collaboration
          ? supabase.from('asset_collaboration_drafts').upsert({ asset_id: id, owner_id: auth.userId, draft: updates.collaboration, updated_at: now }, { onConflict: 'asset_id' })
          : supabase.from('asset_collaboration_drafts').delete().eq('asset_id', id).eq('owner_id', auth.userId);
        const { error: privateDraftError } = await privateDraftMutation;
        if (privateDraftError) return { data: null, error: toServiceError(privateDraftError, 'บันทึกข้อมูลจัดการคอลแลปไม่สำเร็จ') };
      }

      return { data: { ...mapDbToAsset(data), collaboration: updates.collaboration ?? existing.collaboration ?? null }, error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'บันทึกการแก้ไขไม่สำเร็จ') };
    }
  },

  // 4. Soft Delete Asset (Moves to Trash)
  async softDeleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      const userId = await getSessionUserId();
      if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้งก่อนดำเนินการ' };
      const result = await fetchAssetsFromMock({ userId, currentUserId: userId, includeDeleted: true });
      const existing = result.data.find(asset => asset.id === id && !asset.deletedAt);
      if (!existing) return { success: false, error: 'ไม่พบผลงานของคุณ หรือผลงานอยู่ในถังขยะแล้ว' };
      writeMockAsset({ ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return { success: true, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('assets')
        .update({ deleted_at: now })
        .eq('id', id)
        .eq('user_id', auth.userId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (error) return { success: false, error: toServiceError(error, 'ย้ายผลงานไปถังขยะไม่สำเร็จ') };
      if (!data) return { success: false, error: 'ไม่พบผลงานของคุณ หรือผลงานอยู่ในถังขยะแล้ว' };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'ย้ายผลงานไปถังขยะไม่สำเร็จ') };
    }
  },

  // 5. Restore Asset (From Trash)
  async restoreAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      const userId = await getSessionUserId();
      if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้งก่อนดำเนินการ' };
      const result = await fetchAssetsFromMock({ userId, currentUserId: userId, includeDeleted: true });
      const existing = result.data.find(asset => asset.id === id && asset.deletedAt);
      if (!existing) return { success: false, error: 'ไม่พบผลงานของคุณในถังขยะ' };
      writeMockAsset({ ...existing, deletedAt: null, updatedAt: new Date().toISOString() });
      return { success: true, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('assets')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', auth.userId)
        .not('deleted_at', 'is', null)
        .select('id')
        .maybeSingle();
      if (error) return { success: false, error: toServiceError(error, 'กู้คืนผลงานไม่สำเร็จ') };
      if (!data) return { success: false, error: 'ไม่พบผลงานของคุณในถังขยะ' };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'กู้คืนผลงานไม่สำเร็จ') };
    }
  },

  // 6. Hard Delete Asset (Permanent Deletion)
  async permanentDeleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      const userId = await getSessionUserId();
      if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้งก่อนดำเนินการ' };
      const result = await fetchAssetsFromMock({ userId, currentUserId: userId, includeDeleted: true });
      const existing = result.data.find(asset => asset.id === id && asset.deletedAt);
      if (!existing) return { success: false, error: 'ไม่พบผลงานของคุณในถังขยะ' };
      if (!removeMockAsset(id, userId)) return { success: false, error: 'ลบผลงานใน QA Sandbox ไม่สำเร็จ' };
      await removeQaWorkIconQuietly(existing.icon.type === 'image' ? existing.icon.storageKey : undefined);
      await removeQaWorkPayloadQuietly(existing.qaStorageKey);
      return { success: true, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId)
        .not('deleted_at', 'is', null)
        .select('id')
        .maybeSingle();
      if (error) return { success: false, error: toServiceError(error, 'ลบผลงานถาวรไม่สำเร็จ') };
      if (!data) return { success: false, error: 'ไม่พบผลงานของคุณในถังขยะ' };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'ลบผลงานถาวรไม่สำเร็จ') };
    }
  },

  // 7. Empty Trash
  async emptyTrash(userId: string): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      const result = await fetchAssetsFromMock({ userId, currentUserId: userId, includeDeleted: true, onlyDeleted: true });
      result.data.forEach(asset => {
        removeMockAsset(asset.id, userId);
        void removeQaWorkIconQuietly(asset.icon.type === 'image' ? asset.icon.storageKey : undefined);
        void removeQaWorkPayloadQuietly(asset.qaStorageKey);
      });
      return { success: true, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('user_id', auth.userId)
        .not('deleted_at', 'is', null);
      if (error) return { success: false, error: toServiceError(error, 'ล้างถังขยะไม่สำเร็จ') };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'ล้างถังขยะไม่สำเร็จ') };
    }
  },

  // 8. Fork / Duplicate Asset
  async forkAsset(
    originalAsset: Asset,
    newUserId: string,
    newAuthorName: string,
    newAuthorAvatar?: string
  ): Promise<{ data: Asset | null; sourceForkCount: number | null; error: string | null }> {
    if (isMockPersistence) {
      const copy: Asset = buildMockAsset({
        ...originalAsset,
        userId: newUserId,
        authorName: newAuthorName,
        authorAvatar: newAuthorAvatar,
        title: `${originalAsset.title} (สำเนา)`,
        visibility: 'private',
        isPublic: false,
        deletedAt: null,
        forkedFromId: originalAsset.id,
        forkedFromAuthor: originalAsset.authorName,
        forkCount: 0,
        likesCount: 0
      });
      try {
        const prepared = await prepareQaWorkAssetForWrite(copy);
        if (!writeMockAsset(prepared.storageAsset)) {
          await removeQaWorkIconQuietly(prepared.createdIconKey);
          await removeQaWorkPayloadQuietly(prepared.createdPayloadKey);
          return { data: null, sourceForkCount: null, error: 'สร้างสำเนาผลงานใน QA Sandbox ไม่สำเร็จ กรุณาลองใหม่' };
        }
        return { data: prepared.asset, sourceForkCount: (originalAsset.forkCount || 0) + 1, error: null };
      } catch (error) {
        return { data: null, sourceForkCount: null, error: toServiceError(error, 'สร้างสำเนาผลงานใน QA Sandbox ไม่สำเร็จ') };
      }
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(newUserId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        data: null,
        sourceForkCount: null,
        error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }
    const newId = `asset_fork_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const { data, error } = await supabase
        .rpc('fork_asset', {
          p_source_asset_id: originalAsset.id,
          p_new_asset_id: newId,
          p_author_name: newAuthorName,
          p_author_avatar: newAuthorAvatar || null
        })
        .single();
      if (error || !data) {
        return {
          data: null,
          sourceForkCount: null,
          error: toServiceError(error, 'สร้างสำเนาผลงานไม่สำเร็จ')
        };
      }

      const { data: source, error: sourceError } = await supabase
        .from('assets')
        .select('fork_count')
        .eq('id', originalAsset.id)
        .maybeSingle();
      if (sourceError) logServiceError('fetch source fork count', sourceError);

      return {
        data: mapDbToAsset(data),
        sourceForkCount: source?.fork_count ?? null,
        error: null
      };
    } catch (error) {
      return {
        data: null,
        sourceForkCount: null,
        error: toServiceError(error, 'สร้างสำเนาผลงานไม่สำเร็จ')
      };
    }
  },

  // 9. Like Asset
  async fetchLikedAssetIds(userId: string): Promise<{ data: string[]; error: string | null }> {
    if (isMockPersistence) return { data: readMockLikes(userId), error: null };
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('asset_likes')
        .select('asset_id')
        .eq('user_id', auth.userId);
      // Older Creator Vault databases predate the optional relational Likes
      // table. Treat that capability as unavailable instead of turning an
      // otherwise healthy Feed into a global error state.
      if (error && isOptionalRelationUnavailable(error)) return { data: [], error: null };
      if (error) return { data: [], error: toServiceError(error, 'โหลดรายการถูกใจไม่สำเร็จ') };
      return { data: (data || []).map((row: any) => row.asset_id), error: null };
    } catch (error) {
      return { data: [], error: toServiceError(error, 'โหลดรายการถูกใจไม่สำเร็จ') };
    }
  },

  async setAssetLike(
    userId: string,
    assetId: string,
    shouldLike: boolean
  ): Promise<{ success: boolean; isLiked: boolean; likesCount: number | null; error: string | null }> {
    if (isMockPersistence) {
      return setMockAssetLike(userId, assetId, shouldLike);
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        success: false,
        isLiked: !shouldLike,
        likesCount: null,
        error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    try {
      if (shouldLike) {
        const { error } = await supabase
          .from('asset_likes')
          .upsert(
            { user_id: auth.userId, asset_id: assetId },
            { onConflict: 'user_id,asset_id', ignoreDuplicates: true }
          );
        if (error) {
          return { success: false, isLiked: false, likesCount: null, error: toServiceError(error, 'กดถูกใจไม่สำเร็จ') };
        }
      } else {
        const { error } = await supabase
          .from('asset_likes')
          .delete()
          .eq('user_id', auth.userId)
          .eq('asset_id', assetId);
        if (error) {
          return { success: false, isLiked: true, likesCount: null, error: toServiceError(error, 'ยกเลิกถูกใจไม่สำเร็จ') };
        }
      }

      const { data: assetRow, error: countError } = await supabase
        .from('assets')
        .select('likes_count')
        .eq('id', assetId)
        .maybeSingle();
      if (countError) logServiceError('fetch like count after mutation', countError);

      return {
        success: true,
        isLiked: shouldLike,
        likesCount: assetRow?.likes_count ?? null,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        isLiked: !shouldLike,
        likesCount: null,
        error: toServiceError(error, 'อัปเดตสถานะถูกใจไม่สำเร็จ')
      };
    }
  },

  // 10. Bookmarks / Saved Resources System
  async fetchBookmarks(userId: string): Promise<{ data: string[]; error: string | null }> {
    if (isMockPersistence) return { data: readMockBookmarks(userId), error: null };
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('asset_id')
        .eq('user_id', auth.userId);
      if (error) return { data: [], error: toServiceError(error, 'โหลดบุ๊กมาร์กไม่สำเร็จ') };
      return { data: (data || []).map((row: any) => row.asset_id), error: null };
    } catch (error) {
      return { data: [], error: toServiceError(error, 'โหลดบุ๊กมาร์กไม่สำเร็จ') };
    }
  },

  async setBookmark(
    userId: string,
    assetId: string,
    shouldBookmark: boolean
  ): Promise<{ success: boolean; isBookmarked: boolean; error: string | null }> {
    if (isMockPersistence) {
      const ids = readMockBookmarks(userId);
      writeMockBookmarks(userId, shouldBookmark ? [...ids, assetId] : ids.filter(id => id !== assetId));
      return { success: true, isBookmarked: shouldBookmark, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        success: false,
        isBookmarked: !shouldBookmark,
        error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
      };
    }

    try {
      if (shouldBookmark) {
        const { error } = await supabase
          .from('bookmarks')
          .upsert(
            {
              id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              user_id: auth.userId,
              asset_id: assetId,
              created_at: new Date().toISOString()
            },
            { onConflict: 'user_id,asset_id', ignoreDuplicates: true }
          );
        if (error) {
          return { success: false, isBookmarked: false, error: toServiceError(error, 'เพิ่มบุ๊กมาร์กไม่สำเร็จ') };
        }
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', auth.userId)
          .eq('asset_id', assetId);
        if (error) {
          return { success: false, isBookmarked: true, error: toServiceError(error, 'ยกเลิกบุ๊กมาร์กไม่สำเร็จ') };
        }
      }

      return { success: true, isBookmarked: shouldBookmark, error: null };
    } catch (error) {
      return {
        success: false,
        isBookmarked: !shouldBookmark,
        error: toServiceError(error, 'อัปเดตบุ๊กมาร์กไม่สำเร็จ')
      };
    }
  },

  // 11. Content Reporting System
  async submitReport(report: {
    assetId: string;
    reporterId?: string;
    reporterName?: string;
    reason: string;
    details?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(report.reporterId);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { error } = await supabase.from('reports').insert({
        id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        asset_id: report.assetId,
        reporter_id: auth.userId,
        reporter_name: report.reporterName || 'Creator',
        reason: report.reason,
        details: report.details || '',
        status: 'pending',
        created_at: new Date().toISOString()
      });
      if (error) return { success: false, error: toServiceError(error, 'ส่งรายงานไม่สำเร็จ') };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'ส่งรายงานไม่สำเร็จ') };
    }
  },

  // 12. Folders CRUD
  async fetchFolders(userId: string): Promise<{ data: Folder[]; error: string | null }> {
    if (isMockPersistence) return fetchFoldersFromMock(userId);
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: true });
      if (error) return { data: [], error: toServiceError(error, 'โหลดโฟลเดอร์ไม่สำเร็จ') };
      return { data: (data || []).map(mapDbToFolder), error: null };
    } catch (error) {
      return { data: [], error: toServiceError(error, 'โหลดโฟลเดอร์ไม่สำเร็จ') };
    }
  },

  async createFolder(
    folder: { name: string; icon?: string; color?: string; userId: string }
  ): Promise<{ data: Folder | null; error: string | null }> {
    if (isMockPersistence) {
      if (!folder.name.trim()) return { data: null, error: 'กรุณาตั้งชื่อโฟลเดอร์' };
      const now = new Date().toISOString();
      const next: Folder = { id: createClientId('qa_folder'), userId: folder.userId, name: folder.name.trim(), icon: folder.icon || '📁', color: folder.color || 'purple', createdAt: now, updatedAt: now };
      writeMockFolder(next);
      return { data: next, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(folder.userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    if (!folder.name.trim()) return { data: null, error: 'กรุณาตั้งชื่อโฟลเดอร์' };
    const newId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          id: newId,
          user_id: auth.userId,
          name: folder.name.trim(),
          icon: folder.icon || '📁',
          color: folder.color || 'purple',
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
      if (error || !data) {
        return { data: null, error: toServiceError(error, 'สร้างโฟลเดอร์ไม่สำเร็จ') };
      }
      return { data: mapDbToFolder(data), error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'สร้างโฟลเดอร์ไม่สำเร็จ') };
    }
  },

  async updateFolder(
    id: string,
    userId: string,
    updates: { name?: string; icon?: string; color?: string }
  ): Promise<{ data: Folder | null; error: string | null }> {
    if (isMockPersistence) {
      if (updates.name !== undefined && !updates.name.trim()) return { data: null, error: 'ชื่อโฟลเดอร์ต้องไม่เป็นค่าว่าง' };
      const result = await fetchFoldersFromMock(userId);
      const existing = result.data.find(folder => folder.id === id);
      if (!existing) return { data: null, error: 'ไม่พบโฟลเดอร์ของคุณที่ต้องการแก้ไข' };
      const next = { ...existing, ...updates, name: updates.name?.trim() || existing.name, updatedAt: new Date().toISOString() };
      writeMockFolder(next);
      return { data: next, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }
    if (updates.name !== undefined && !updates.name.trim()) {
      return { data: null, error: 'ชื่อโฟลเดอร์ต้องไม่เป็นค่าว่าง' };
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .update({
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
          ...(updates.color !== undefined ? { color: updates.color } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', auth.userId)
        .select()
        .maybeSingle();
      if (error) return { data: null, error: toServiceError(error, 'แก้ไขโฟลเดอร์ไม่สำเร็จ') };
      if (!data) return { data: null, error: 'ไม่พบโฟลเดอร์ของคุณที่ต้องการแก้ไข' };
      return { data: mapDbToFolder(data), error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'แก้ไขโฟลเดอร์ไม่สำเร็จ') };
    }
  },

  async deleteFolder(id: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      if (!removeMockFolder(id, userId)) return { success: false, error: 'ไม่พบโฟลเดอร์ของคุณที่ต้องการลบ' };
      return { success: true, error: null };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId)
        .select('id')
        .maybeSingle();
      if (error) return { success: false, error: toServiceError(error, 'ลบโฟลเดอร์ไม่สำเร็จ') };
      if (!data) return { success: false, error: 'ไม่พบโฟลเดอร์ของคุณที่ต้องการลบ' };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'ลบโฟลเดอร์ไม่สำเร็จ') };
    }
  },

  // 14. Profiles
  getProfileSnapshot(userId: string): User | null {
    if (!userId || !isMockPersistence) return null;
    const profile = readMockProfile(userId, null);
    return profile?.id === userId ? profile : null;
  },

  getCreatorProfileSnapshot(slug: string): User | null {
    if (!slug || !isMockPersistence) return null;
    try {
      return resolveProfileBySlug(readMockProfiles(), decodeURIComponent(slug).trim());
    } catch {
      return null;
    }
  },

  async getProfile(userId: string): Promise<Partial<User> | null> {
    if (!userId) return null;
    const localProfile = isMockPersistence ? readMockProfile(userId, null) : null;
    // QA Profile is the highest-priority presentation source for its owner.
    // Returning it before constructing/querying Supabase prevents a known
    // canonical identity from regressing behind a slower cloud lookup.
    if (localProfile?.id === userId) return isMockPersistence ? hydrateQaProfileImages(localProfile) : localProfile;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const [profileResult, socialLinks] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        fetchProfileSocialLinks(userId)
      ]);
      const { data, error } = profileResult;

      if (error) {
        logServiceError('getProfile', error);
        return localProfile;
      }

      if (data) {
        const profile: User = {
          id: data.id,
          displayName: data.display_name || data.displayName || 'Creator',
          username: data.username || undefined,
          bio: mapProfileBio(data.bio),
          avatarUrl: data.avatar_url || data.avatarUrl,
          coverUrl: data.cover_url || data.coverUrl,
          socialLinks,
          createdAt: data.created_at || new Date().toISOString()
        };
        if (isMockPersistence) cacheMockProfileSnapshot(profile);
        return isMockPersistence ? hydrateQaProfileImages(readMockProfile(userId, profile) || profile) : profile;
      }
    } catch (error) {
      logServiceError('getProfile:exception', error);
    }
    return localProfile;
  },

  async getCreatorProfile(slug: string): Promise<ProfileLookupResult> {
    const supabase = getSupabaseClient();
    let cleanSlug = '';
    try {
      cleanSlug = decodeURIComponent(slug).trim();
    } catch {
      return { data: null, error: 'ไม่พบ Creator ที่ต้องการ', reason: 'not-found' };
    }
    if (isMockPersistence) {
      const localProfile = resolveProfileBySlug(readMockProfiles(), cleanSlug);
      if (localProfile) return { data: await hydrateQaProfileImages(localProfile), error: null, reason: null };
    }
    if (!supabase) return { data: null, error: 'ระบบโปรไฟล์ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง', reason: 'unavailable' };
    if (!cleanSlug || cleanSlug.length > 128) return { data: null, error: 'ไม่พบ Creator ที่ต้องการ', reason: 'not-found' };

    try {
      const isProfileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanSlug);
      const socialLinksRequest = isProfileId ? fetchProfileSocialLinks(cleanSlug) : null;
      let { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, bio, avatar_url, cover_url, created_at')
        .eq(isProfileId ? 'id' : 'username', isProfileId ? cleanSlug : normalizeProfileUsername(cleanSlug) || cleanSlug)
        .maybeSingle();

      if (error) return { data: null, error: toServiceError(error, 'โหลดโปรไฟล์ไม่สำเร็จ'), reason: 'error' };
      if (!data && !isProfileId) {
        const result = await supabase
          .from('profiles')
          .select('id, display_name, username, bio, avatar_url, cover_url, created_at')
          .eq('id', cleanSlug)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      if (error) return { data: null, error: toServiceError(error, 'โหลดโปรไฟล์ไม่สำเร็จ'), reason: 'error' };
      if (!data) return { data: null, error: 'ไม่พบ Creator ที่ต้องการ', reason: 'not-found' };

      const socialLinks = socialLinksRequest && data.id === cleanSlug
        ? await socialLinksRequest
        : await fetchProfileSocialLinks(data.id);
      const profile: User = {
        id: data.id,
        displayName: data.display_name || 'Creator',
        username: data.username || undefined,
        bio: mapProfileBio(data.bio),
        avatarUrl: data.avatar_url || undefined,
        coverUrl: data.cover_url || undefined,
        socialLinks,
        createdAt: data.created_at || new Date().toISOString()
      };
      if (isMockPersistence) cacheMockProfileSnapshot(profile);
      const resolvedProfile = isMockPersistence ? await hydrateQaProfileImages(readMockProfile(profile.id, profile) || profile) : profile;
      return { data: resolvedProfile, error: null, reason: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'โหลดโปรไฟล์ไม่สำเร็จ'), reason: 'error' };
    }
  },

  async uploadProfileImage(
    userId: string,
    file: File,
    kind: 'avatar' | 'cover'
  ): Promise<{ data: string | null; imageKey?: string; previousBlob?: Blob | null; error: string | null }> {
    if (isMockPersistence) {
      const validationError = validateQaProfileImage(file);
      if (validationError) return { data: null, error: validationError };
      try {
        const saved = await saveQaProfileImage({ ownerId: userId, kind, blob: file });
        return { data: saved.url, imageKey: saved.key, previousBlob: saved.previousBlob, error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error.message : `บันทึก ${kind === 'cover' ? 'ภาพปก' : 'รูปโปรไฟล์'} ใน QA Sandbox ไม่สำเร็จ` };
      }
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const maxFileSize = 5 * 1024 * 1024;
    if (!supabase || auth.error || !auth.userId) return { data: null, error: auth.error || 'ระบบจัดเก็บรูปภาพยังไม่พร้อมใช้งาน' };
    if (!allowedTypes.has(file.type)) return { data: null, error: 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF' };
    if (file.size <= 0 || file.size > maxFileSize) return { data: null, error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' };

    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${auth.userId}/${kind}-${Date.now()}-${createClientId('image').slice(-8)}.${extension}`;
    try {
      const { error } = await supabase.storage
        .from('profile-media')
        .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (error) return { data: null, error: toServiceError(error, 'อัปโหลดรูปภาพไม่สำเร็จ') };
      const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
      return { data: data.publicUrl, error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'อัปโหลดรูปภาพไม่สำเร็จ') };
    }
  },

  async upsertProfile(user: User): Promise<{ success: boolean; error: string | null }> {
    if (isMockPersistence) {
      const persisted = writeMockProfile({
        ...user,
        username: normalizeProfileUsername(user.username),
        avatarUrl: user.avatarImageKey ? undefined : (user.avatarUrl?.startsWith('blob:') || user.avatarUrl?.startsWith('data:') ? undefined : user.avatarUrl),
        coverUrl: user.coverImageKey ? undefined : (user.coverUrl?.startsWith('blob:') || user.coverUrl?.startsWith('data:') ? undefined : user.coverUrl),
        socialLinks: user.socialLinks || []
      });
      return persisted.success
        ? { success: true, error: null }
        : { success: false, error: persisted.error || 'บันทึกโปรไฟล์ใน QA Sandbox ไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกเปลี่ยน' };
    }
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(user.id);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' };
    }

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: auth.userId,
        display_name: user.displayName,
        username: user.username || null,
        bio: user.bio,
        avatar_url: user.avatarUrl,
        cover_url: user.coverUrl || null,
        is_guest: false,
        updated_at: new Date().toISOString()
      });

      if (error) {
        return { success: false, error: toServiceError(error, 'บันทึกโปรไฟล์ไม่สำเร็จ') };
      }

      if (user.socialLinks !== undefined) {
        const links = user.socialLinks
          .map((link, index) => ({
            id: link.id || createClientId('social'),
            profile_id: auth.userId,
            platform: link.platform || 'custom',
            label: link.label.trim(),
            url: link.url.trim(),
            visible: link.visible !== false,
            sort_order: link.sortOrder ?? index,
            updated_at: new Date().toISOString()
          }))
          .filter(link => link.label && isSafeProfileLink(link.url));

        const { data: existingLinks, error: existingError } = await supabase
          .from('profile_social_links')
          .select('id')
          .eq('profile_id', auth.userId);
        if (existingError) return { success: false, error: toServiceError(existingError, 'บันทึกลิงก์โปรไฟล์ไม่สำเร็จ') };

        const nextIds = new Set(links.map(link => link.id));
        const idsToDelete = (existingLinks || []).map(link => link.id).filter(id => !nextIds.has(id));
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('profile_social_links')
            .delete()
            .in('id', idsToDelete)
            .eq('profile_id', auth.userId);
          if (deleteError) return { success: false, error: toServiceError(deleteError, 'บันทึกลิงก์โปรไฟล์ไม่สำเร็จ') };
        }
        if (links.length > 0) {
          const { error: linksError } = await supabase.from('profile_social_links').upsert(links);
          if (linksError) return { success: false, error: toServiceError(linksError, 'บันทึกลิงก์โปรไฟล์ไม่สำเร็จ') };
        }
      }
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toServiceError(error, 'บันทึกโปรไฟล์ไม่สำเร็จ') };
    }
  },

  // Legacy browser Guest data is preserved and can be explicitly imported after login.
  getLegacyGuestDataSummary(userId: string): { assets: number; folders: number } {
    if (!userId) return { assets: 0, folders: 0 };
    const state = getLegacyImportState(userId);
    const assets = getLocalAssets().filter(asset =>
      isLegacyGuestUserId(asset.userId) && !state.assetIds.includes(asset.id)
    );
    const folders = getAllLocalFolders().filter(folder =>
      isLegacyGuestUserId(folder.userId) && !state.folderIdMap[folder.id]
    );
    return { assets: assets.length, folders: folders.length };
  },

  async importLegacyGuestData(user: User): Promise<{
    success: boolean;
    importedAssets: number;
    importedFolders: number;
    remainingAssets: number;
    remainingFolders: number;
    error: string | null;
  }> {
    const auth = await requireCloudUser(user.id);
    if (auth.error || !auth.userId) {
      const summary = this.getLegacyGuestDataSummary(user.id);
      return {
        success: false,
        importedAssets: 0,
        importedFolders: 0,
        remainingAssets: summary.assets,
        remainingFolders: summary.folders,
        error: auth.error || 'กรุณาเข้าสู่ระบบก่อนนำเข้าข้อมูลเก่า'
      };
    }

    const state = getLegacyImportState(auth.userId);
    const legacyFolders = getAllLocalFolders().filter(folder => isLegacyGuestUserId(folder.userId));
    const legacyAssets = getLocalAssets().filter(asset => isLegacyGuestUserId(asset.userId));
    let importedFolders = 0;
    let importedAssets = 0;
    const errors: string[] = [];

    for (const folder of legacyFolders) {
      if (state.folderIdMap[folder.id]) continue;
      const result = await this.createFolder({
        userId: auth.userId,
        name: folder.name || 'โฟลเดอร์ที่กู้คืน',
        icon: folder.icon,
        color: folder.color
      });
      if (result.data) {
        state.folderIdMap[folder.id] = result.data.id;
        importedFolders += 1;
        try {
          saveLegacyImportState(auth.userId, state);
        } catch (error) {
          errors.push(toServiceError(error, 'บันทึกสถานะการนำเข้าโฟลเดอร์ไม่สำเร็จ'));
          break;
        }
      } else {
        errors.push(result.error || `นำเข้าโฟลเดอร์ “${folder.name}” ไม่สำเร็จ`);
      }
    }

    for (const asset of legacyAssets) {
      if (state.assetIds.includes(asset.id)) continue;
      const result = await this.createAsset({
        userId: auth.userId,
        authorName: user.displayName,
        authorAvatar: user.avatarUrl,
        title: asset.title || 'ผลงานที่กู้คืน',
        icon: asset.icon || { type: 'emoji', value: '✨' },
        category: asset.category || 'character',
        content: asset.content || '',
        uiCodeSnippet: asset.uiCodeSnippet || '',
        previewImage: asset.previewImage,
        previewImages: asset.previewImages || [],
        folderId: asset.folderId ? state.folderIdMap[asset.folderId] || null : null,
        isPublic: false,
        visibility: 'draft',
        status: asset.status || 'draft',
        tags: asset.tags || [],
        deletedAt: null,
        likesCount: 0,
        forkCount: 0,
        forkedFromId: asset.forkedFromId || null,
        forkedFromAuthor: asset.forkedFromAuthor || null,
        linkedAssetIds: [],
        versions: []
      });
      if (result.data) {
        state.assetIds.push(asset.id);
        importedAssets += 1;
        try {
          saveLegacyImportState(auth.userId, state);
        } catch (error) {
          errors.push(toServiceError(error, 'บันทึกสถานะการนำเข้าผลงานไม่สำเร็จ'));
          break;
        }
      } else {
        errors.push(result.error || `นำเข้าผลงาน “${asset.title}” ไม่สำเร็จ`);
      }
    }

    const remaining = this.getLegacyGuestDataSummary(auth.userId);
    return {
      success: errors.length === 0 && remaining.assets === 0 && remaining.folders === 0,
      importedAssets,
      importedFolders,
      remainingAssets: remaining.assets,
      remainingFolders: remaining.folders,
      error: errors.length > 0
        ? `นำเข้าได้บางส่วน: ${errors[0]}${errors.length > 1 ? ` (และอีก ${errors.length - 1} รายการ)` : ''}`
        : null
    };
  },

  // 15. Export & Backup Vault Data
  exportVaultData(user: User, userAssets: Asset[], userFolders: Folder[], bookmarks: string[]): string {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl
      },
      folders: userFolders,
      assets: userAssets,
      bookmarkedAssetIds: bookmarks
    };
    return JSON.stringify(backup, null, 2);
  }
};
