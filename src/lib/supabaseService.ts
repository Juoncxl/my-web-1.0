import { Asset, Folder, User, AssetStatus, AssetVersion } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { formatFriendlyErrorMessage } from './apiHelper';
import { isLegacyGuestUserId } from './accessPolicy';
import { normalizeAssetVisibility } from './assetVisibility';

// Local Storage Keys
const LOCAL_STORAGE_ASSETS = 'creator_vault_local_assets';
const LOCAL_STORAGE_FOLDERS = 'creator_vault_local_folders';
const LEGACY_IMPORT_STORAGE_PREFIX = 'creator_vault_legacy_import_';

type CloudAuth = { userId: string; error: null } | { userId: null; error: string };

function logServiceError(context: string, error: unknown) {
  if ((import.meta as any).env?.DEV) {
    console.error(`[supabaseService:${context}]`, error);
  }
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
    return 'เชื่อมต่อระบบคลาวด์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }

  const friendly = formatFriendlyErrorMessage(error);
  return friendly === message && message ? fallback : friendly || fallback;
}

async function requireCloudUser(expectedUserId?: string): Promise<CloudAuth> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { userId: null, error: 'ระบบคลาวด์ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลเว็บไซต์' };
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
  if (asset.content !== undefined) dbPayload.content = asset.content;
  if (asset.uiCodeSnippet !== undefined) dbPayload.ui_code_snippet = asset.uiCodeSnippet || '';
  if (asset.previewImage !== undefined) dbPayload.preview_image = asset.previewImage || '';
  if (asset.previewImages !== undefined) dbPayload.preview_images = asset.previewImages || [];
  if (asset.folderId !== undefined) dbPayload.folder_id = asset.folderId || null;
  
  if (asset.visibility !== undefined) {
    dbPayload.visibility = asset.visibility;
    dbPayload.is_public = asset.visibility === 'public';
  } else if (asset.isPublic !== undefined) {
    dbPayload.is_public = asset.isPublic;
    dbPayload.visibility = asset.isPublic ? 'public' : 'private';
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

// DIRECT SUPABASE DATABASE SERVICE (CRUD & ADVANCED LOGIC)
export const supabaseService = {
  // 1. Fetch Assets (Public feed or personal vault)
  async fetchAssets(options?: {
    category?: string;
    userId?: string;
    folderId?: string | null;
    search?: string;
    currentUserId?: string;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  }): Promise<{ data: Asset[]; error: string | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { data: [], error: 'ระบบคลาวด์ยังไม่พร้อมใช้งาน จึงไม่สามารถโหลดคลังผลงานได้' };
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData.session?.user.id;
      let query = supabase.from('assets').select('*');

      if (options?.onlyDeleted) {
        if (!sessionUserId || (options.userId && options.userId !== sessionUserId)) {
          return { data: [], error: 'กรุณาเข้าสู่ระบบเพื่อดูถังขยะของคุณ' };
        }
        query = query.eq('user_id', sessionUserId).not('deleted_at', 'is', null);
      } else if (options?.userId) {
        query = query.eq('user_id', options.userId);
        if (sessionUserId !== options.userId) {
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

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        return { data: [], error: toServiceError(error, 'โหลดคลังผลงานไม่สำเร็จ') };
      }

      let list = (data || []).map(mapDbToAsset);
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(assetData.userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
      return { data: mapDbToAsset(data), error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'บันทึกผลงานบนคลาวด์ไม่สำเร็จ') };
    }
  },

  // 3. Update Asset
  async updateAsset(
    id: string,
    updates: Partial<Asset>
  ): Promise<{ data: Asset | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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

      const existing = mapDbToAsset(existingRow);
      const safeUpdates: Partial<Asset> = {};
      const mutableKeys: Array<keyof Asset> = [
        'authorName', 'authorAvatar', 'title', 'icon', 'category', 'content',
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

      return { data: mapDbToAsset(data), error: null };
    } catch (error) {
      return { data: null, error: toServiceError(error, 'บันทึกการแก้ไขไม่สำเร็จ') };
    }
  },

  // 4. Soft Delete Asset (Moves to Trash)
  async softDeleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser();
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(newUserId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        data: null,
        sourceForkCount: null,
        error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน'
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
    }

    try {
      const { data, error } = await supabase
        .from('asset_likes')
        .select('asset_id')
        .eq('user_id', auth.userId);
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        success: false,
        isLiked: !shouldLike,
        likesCount: null,
        error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน'
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return {
        success: false,
        isBookmarked: !shouldBookmark,
        error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน'
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
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: [], error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(folder.userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { data: null, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(userId);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
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
  async getProfile(userId: string): Promise<Partial<User> | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getProfile error:', error);
        return null;
      }

      if (data) {
        return {
          id: data.id,
          displayName: data.display_name || data.displayName,
          bio: data.bio || '',
          avatarUrl: data.avatar_url || data.avatarUrl,
          createdAt: data.created_at
        };
      }
    } catch (e) {
      console.warn('Profile fetch exception:', e);
    }
    return null;
  },

  async upsertProfile(user: User): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();
    const auth = await requireCloudUser(user.id);
    if (!supabase || auth.error || !auth.userId) {
      return { success: false, error: auth.error || 'ระบบคลาวด์ยังไม่พร้อมใช้งาน' };
    }

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: auth.userId,
        display_name: user.displayName,
        bio: user.bio,
        avatar_url: user.avatarUrl,
        is_guest: false,
        created_at: user.createdAt
      });

      if (error) {
        return { success: false, error: toServiceError(error, 'บันทึกโปรไฟล์ไม่สำเร็จ') };
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
