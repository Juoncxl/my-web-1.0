import { Asset, Folder, User, AssetVisibility, AssetStatus, ContentReport, AssetVersion } from '../types';
import { getSupabaseClient } from './supabaseClient';

// Initial Starter Sample Data
const SAMPLE_ASSETS: Asset[] = [
  {
    id: 'asset_init_1',
    userId: 'creator_mai',
    authorName: 'Mai (Creator)',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    title: '🌸 พลอยใส (Ploysai) — AI เพื่อนสนิทสายให้กำลังใจ',
    icon: { type: 'emoji', value: '🌸' },
    category: 'character',
    content: `# [Character Profile: Ploysai 🌸]
- **ชื่อ:** พลอยใส (Ploysai)
- **อายุ:** 22 ปี
- **อาชีพ:** บาริสต้า & นักวาดภาพประกอบอิสระ
- **บุคลิกภาพ:** อ่อนโยน ขี้เล่นเล็กน้อย ช่างสังเกต และพร้อมรับฟังเสมอ ไม่ตัดสินใคร
- **คำพูดติดปาก:** "วันนี้เหนื่อยไหมคะ? ดื่มโกโก้อุ่นๆ สักแก้วก่อนนะ~ (｡•̀ᴗ-)✧"

## [System Prompt Instructions]
1. จงสวมบทบาทเป็น "พลอยใส" อย่างเคร่งครัด
2. ใช้ภาษาไทยที่เป็นธรรมชาติ สุภาพแต่เป็นกันเอง มีอีโมจิดอกไม้หรือความน่ารักแทรกตามอารมณ์
3. เมื่อผู้ใช้เล่าเรื่องทุกข์ใจ ให้รับฟังและปลอบประโลมก่อนเสมอ`,
    uiCodeSnippet: '',
    previewImages: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80'
    ],
    folderId: null,
    isPublic: true,
    visibility: 'public',
    status: 'finished',
    tags: ['บอทเพื่อนสนิท', 'Roleplay', 'Healใจ', 'ThaiPrompt'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    likesCount: 24,
    forkCount: 6,
    linkedAssetIds: ['asset_init_3'],
    versions: [
      {
        version: 1,
        updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
        title: '🌸 พลอยใส (Ploysai) — ฉบับร่างแรก',
        summary: 'สร้างตัวละครและกำหนดบุคลิกภาพพื้นฐาน'
      },
      {
        version: 2,
        updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        title: '🌸 พลอยใส (Ploysai) — AI เพื่อนสนิทสายให้กำลังใจ',
        summary: 'เพิ่ม System Prompt ปลอบประโลม และเชื่อมต่อการแสดงผล UI'
      }
    ]
  },
  {
    id: 'asset_init_2',
    userId: 'creator_kenshi',
    authorName: 'Kenshi Lore Master',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    title: '📖 มหานครลอยฟ้า เอเธอเรีย (Aetheria World Lore)',
    icon: { type: 'emoji', value: '📖' },
    category: 'lore',
    content: `# [World Lore: มหานครลอยฟ้า Aetheria]
Aetheria คือทวีปเกาะลอยฟ้าที่ลอยอยู่เหนือก้อนเมฆพิษเบื้องล่างกว่า 3,000 เมตร พลังงานที่ค้ำจุนเมืองคือ "ผลึกแอร์เธอไรต์" (Aetherite Core)

## [Factions & Magic System]
- **Order of Celestia:** สภาผู้ควบคุมผลึกเวทมนตร์และกองเรือเหาะ
- **Cloud Walkers:** กลุ่มนักผจญภัยที่โรยตัวลงไปสำรวจซากอารยธรรมภาคพื้นดิน
- **The Resonance:** ระบบเวทมนตร์ที่ต้องสวดภาวนาด้วยเสียงดนตรีเพื่อสั่งการผลึก`,
    uiCodeSnippet: '',
    previewImages: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    ],
    folderId: null,
    isPublic: true,
    visibility: 'public',
    status: 'in_progress',
    tags: ['Worldbuilding', 'Fantasy', 'Lore', 'Steampunk'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    likesCount: 18,
    forkCount: 3,
    versions: [
      {
        version: 1,
        updatedAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
        title: '📖 มหานครลอยฟ้า เอเธอเรีย (Aetheria World Lore)',
        summary: 'โครงสร้างหลักของโลกและเวทมนตร์ผลึก'
      }
    ]
  },
  {
    id: 'asset_init_3',
    userId: 'creator_ui_dev',
    authorName: 'PastelCoder 💻',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    title: '💻 Glassmorphism Pastel Chat Bubble for SillyTavern',
    icon: { type: 'emoji', value: '💻' },
    category: 'ui_code',
    content: `โค้ด CSS สำหรับแต่งหน้าต่างแชทบอทแนว Pastel Frosted Glass พร้อมแอนิเมชัน Fade-in เมื่อบอทตอบ`,
    uiCodeSnippet: `<div class="chat-wrapper" style="font-family: 'Prompt', sans-serif; padding: 20px; background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); min-height: 240px; display: flex; flex-direction: column; gap: 14px;">
  <!-- User Message -->
  <div style="align-self: flex-end; max-width: 80%; background: linear-gradient(135deg, #a855f7, #ec4899); color: white; padding: 12px 18px; border-radius: 20px 20px 4px 20px; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.25);">
    <p style="margin: 0; font-size: 14px; font-weight: 500;">สวัสดีพลอยใส วันนี้มีเครื่องดื่มอะไรแนะนำบ้าง?</p>
  </div>
  
  <!-- AI Bot Message -->
  <div style="align-self: flex-start; max-width: 80%; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(233, 213, 255, 0.8); color: #334155; padding: 14px 18px; border-radius: 20px 20px 20px 4px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
      <span style="font-size: 16px;">🌸</span>
      <strong style="font-size: 13px; color: #9333ea;">พลอยใส (Ploysai)</strong>
    </div>
    <p style="margin: 0; font-size: 14px; line-height: 1.6;">
      ยินดีต้อนรับค่ะ! วันนี้พลอยใสแนะนำเป็น <em>"ลาเวนเดอร์มิลค์ทีอุ่นๆ"</em> ค่ะ หอมละมุนช่วยให้ผ่อนคลายจากความเหนื่อยล้าแน่นอนค่ะ~ (✿◠‿◠)
    </p>
  </div>
</div>`,
    previewImages: [],
    folderId: null,
    isPublic: true,
    visibility: 'public',
    status: 'finished',
    tags: ['CSS', 'HTML', 'SillyTavern', 'Glassmorphism', 'Pastel'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    likesCount: 39,
    forkCount: 12
  }
];

const LOCAL_STORAGE_ASSETS = 'creator_vault_local_assets';
const LOCAL_STORAGE_FOLDERS = 'creator_vault_local_folders';
const LOCAL_STORAGE_BOOKMARKS = 'creator_vault_bookmarks';
const LOCAL_STORAGE_RECENT_VIEWED = 'creator_vault_recent_viewed';
const LOCAL_STORAGE_REPORTS = 'creator_vault_reports';

// Helper to get local fallback assets
function getLocalAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSETS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Local assets read error:', e);
  }
  localStorage.setItem(LOCAL_STORAGE_ASSETS, JSON.stringify(SAMPLE_ASSETS));
  return SAMPLE_ASSETS;
}

function saveLocalAssets(assets: Asset[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ASSETS, JSON.stringify(assets));
  } catch (e) {
    console.warn('Local assets write error:', e);
  }
}

function getLocalFolders(userId: string): Folder[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS);
    if (raw) {
      const all: Folder[] = JSON.parse(raw);
      return all.filter(f => f.userId === userId);
    }
  } catch (e) {
    console.warn('Local folders read error:', e);
  }
  return [];
}

function saveLocalFolders(folders: Folder[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_FOLDERS, JSON.stringify(folders));
  } catch (e) {
    console.warn('Local folders write error:', e);
  }
}

// Convert Supabase DB snake_case record to Client Asset
function mapDbToAsset(row: any): Asset {
  const isPublicVal = row.is_public !== undefined ? row.is_public : (row.visibility === 'public');
  const visibilityVal: AssetVisibility = row.visibility || (isPublicVal ? 'public' : 'private');
  const statusVal: AssetStatus = row.status || 'finished';

  return {
    id: row.id,
    userId: row.user_id || row.userId,
    authorName: row.author_name || row.authorName || 'Creator',
    authorAvatar: row.author_avatar || row.authorAvatar,
    title: row.title || '',
    icon: typeof row.icon === 'string' ? JSON.parse(row.icon) : row.icon || { type: 'emoji', value: '✨' },
    category: row.category,
    content: row.content || '',
    uiCodeSnippet: row.ui_code_snippet || row.uiCodeSnippet || '',
    previewImage: row.preview_image || row.previewImage,
    previewImages: row.preview_images || (row.preview_image ? [row.preview_image] : []),
    folderId: row.folder_id || row.folderId || null,
    isPublic: visibilityVal === 'public',
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
    versions: typeof row.versions === 'string' ? JSON.parse(row.versions) : (row.versions || [])
  };
}

// Convert Client Asset to Supabase DB snake_case payload
function mapAssetToDb(asset: Partial<Asset>) {
  const dbPayload: any = {};
  if (asset.id) dbPayload.id = asset.id;
  if (asset.userId) dbPayload.user_id = asset.userId;
  if (asset.authorName) dbPayload.author_name = asset.authorName;
  if (asset.authorAvatar !== undefined) dbPayload.author_avatar = asset.authorAvatar;
  if (asset.title !== undefined) dbPayload.title = asset.title;
  if (asset.icon) dbPayload.icon = asset.icon;
  if (asset.category) dbPayload.category = asset.category;
  if (asset.content !== undefined) dbPayload.content = asset.content;
  if (asset.uiCodeSnippet !== undefined) dbPayload.ui_code_snippet = asset.uiCodeSnippet;
  if (asset.previewImage !== undefined) dbPayload.preview_image = asset.previewImage;
  if (asset.previewImages !== undefined) dbPayload.preview_images = asset.previewImages;
  if (asset.folderId !== undefined) dbPayload.folder_id = asset.folderId;
  
  if (asset.visibility !== undefined) {
    dbPayload.visibility = asset.visibility;
    dbPayload.is_public = asset.visibility === 'public';
  } else if (asset.isPublic !== undefined) {
    dbPayload.is_public = asset.isPublic;
    dbPayload.visibility = asset.isPublic ? 'public' : 'private';
  }

  if (asset.status !== undefined) dbPayload.status = asset.status;
  if (asset.tags !== undefined) dbPayload.tags = asset.tags;
  if (asset.likesCount !== undefined) dbPayload.likes_count = asset.likesCount;
  if (asset.forkCount !== undefined) dbPayload.fork_count = asset.forkCount;
  if (asset.forkedFromId !== undefined) dbPayload.forked_from_id = asset.forkedFromId;
  if (asset.forkedFromAuthor !== undefined) dbPayload.forked_from_author = asset.forkedFromAuthor;
  if (asset.linkedAssetIds !== undefined) dbPayload.linked_asset_ids = asset.linkedAssetIds;
  if (asset.versions !== undefined) dbPayload.versions = asset.versions;
  if (asset.deletedAt !== undefined) dbPayload.deleted_at = asset.deletedAt;

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

    if (supabase) {
      try {
        let query = supabase.from('assets').select('*');

        if (options?.onlyDeleted) {
          query = query.not('deleted_at', 'is', null);
        } else if (!options?.includeDeleted) {
          query = query.is('deleted_at', null);
        }

        if (options?.category && options.category !== 'all') {
          query = query.eq('category', options.category);
        }

        if (options?.userId) {
          // Specific user profile or personal vault
          query = query.eq('user_id', options.userId);
          if (options.folderId !== undefined) {
            if (options.folderId === null) {
              query = query.is('folder_id', null);
            } else {
              query = query.eq('folder_id', options.folderId);
            }
          }
        } else {
          // Public community exploration: show public assets OR user's own items
          if (options?.currentUserId) {
            query = query.or(`visibility.eq.public,is_public.eq.true,user_id.eq.${options.currentUserId}`);
          } else {
            query = query.or('visibility.eq.public,is_public.eq.true');
          }
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.warn('Supabase fetchAssets error:', error);
        } else if (data) {
          const assets = data.map(mapDbToAsset);
          return { data: assets, error: null };
        }
      } catch (err: any) {
        console.warn('Supabase query error, fallback to local:', err);
      }
    }

    // Local fallback for guest or when Supabase is offline
    let list = getLocalAssets();

    if (options?.onlyDeleted) {
      list = list.filter(a => !!a.deletedAt);
    } else if (!options?.includeDeleted) {
      list = list.filter(a => !a.deletedAt);
    }

    if (options?.category && options.category !== 'all') {
      list = list.filter(a => a.category === options.category);
    }
    if (options?.userId) {
      list = list.filter(a => a.userId === options.userId);
      if (options.folderId !== undefined) {
        list = list.filter(a => a.folderId === options.folderId);
      }
    } else {
      if (options?.currentUserId) {
        list = list.filter(a => a.visibility === 'public' || a.isPublic || a.userId === options.currentUserId);
      } else {
        list = list.filter(a => a.visibility === 'public' || a.isPublic);
      }
    }

    if (options?.search?.trim()) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    return { data: list, error: null };
  },

  // 2. Create Asset
  async createAsset(
    assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ data: Asset | null; error: string | null }> {
    const supabase = getSupabaseClient();
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

    if (supabase) {
      try {
        const dbPayload = mapAssetToDb(newAsset);
        dbPayload.id = newId;
        dbPayload.created_at = now;

        const { data, error } = await supabase
          .from('assets')
          .insert(dbPayload)
          .select()
          .single();

        if (error) {
          console.warn('Supabase createAsset error:', error);
        } else if (data) {
          return { data: mapDbToAsset(data), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase insert error, saving locally:', err);
      }
    }

    // Local fallback
    const list = getLocalAssets();
    list.unshift(newAsset);
    saveLocalAssets(list);
    return { data: newAsset, error: null };
  },

  // 3. Update Asset
  async updateAsset(
    id: string,
    updates: Partial<Asset>
  ): Promise<{ data: Asset | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Prepare version tracking
    const list = getLocalAssets();
    const existing = list.find(a => a.id === id);

    let updatedVersions = updates.versions || existing?.versions || [];
    if (updates.title || updates.content || updates.uiCodeSnippet) {
      const nextVerNum = (updatedVersions[updatedVersions.length - 1]?.version || 1) + 1;
      const newVersion: AssetVersion = {
        version: nextVerNum,
        updatedAt: now,
        title: updates.title || existing?.title || 'Updated Asset',
        summary: updates.status ? `อัปเดตสถานะเป็น ${updates.status}` : 'บันทึกการแก้ไขเนื้อหา'
      };
      updatedVersions = [...updatedVersions, newVersion];
    }

    const payloadWithVersions = {
      ...updates,
      versions: updatedVersions,
      updatedAt: now
    };

    if (supabase) {
      try {
        const dbPayload = mapAssetToDb(payloadWithVersions);
        const { data, error } = await supabase
          .from('assets')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.warn('Supabase updateAsset error:', error);
        } else if (data) {
          return { data: mapDbToAsset(data), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase update error:', err);
      }
    }

    // Local fallback
    const idx = list.findIndex(a => a.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...payloadWithVersions
      };
      saveLocalAssets(list);
      return { data: list[idx], error: null };
    }

    return { data: null, error: 'Asset not found' };
  },

  // 4. Soft Delete Asset (Moves to Trash)
  async softDeleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (supabase) {
      try {
        const { error } = await supabase
          .from('assets')
          .update({ deleted_at: now })
          .eq('id', id);

        if (error) {
          console.warn('Supabase softDelete error:', error);
        } else {
          return { success: true, error: null };
        }
      } catch (err: any) {
        console.warn('Supabase soft delete error:', err);
      }
    }

    // Local fallback
    const list = getLocalAssets();
    const idx = list.findIndex(a => a.id === id);
    if (idx !== -1) {
      list[idx].deletedAt = now;
      saveLocalAssets(list);
      return { success: true, error: null };
    }
    return { success: false, error: 'Asset not found' };
  },

  // 5. Restore Asset (From Trash)
  async restoreAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { error } = await supabase
          .from('assets')
          .update({ deleted_at: null })
          .eq('id', id);

        if (error) {
          console.warn('Supabase restoreAsset error:', error);
        } else {
          return { success: true, error: null };
        }
      } catch (err: any) {
        console.warn('Supabase restore error:', err);
      }
    }

    // Local fallback
    const list = getLocalAssets();
    const idx = list.findIndex(a => a.id === id);
    if (idx !== -1) {
      list[idx].deletedAt = null;
      saveLocalAssets(list);
      return { success: true, error: null };
    }
    return { success: false, error: 'Asset not found' };
  },

  // 6. Hard Delete Asset (Permanent Deletion)
  async permanentDeleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) {
          console.warn('Supabase permanentDelete error:', error);
        } else {
          return { success: true, error: null };
        }
      } catch (err: any) {
        console.warn('Supabase delete error:', err);
      }
    }

    // Local fallback
    let list = getLocalAssets();
    list = list.filter(a => a.id !== id);
    saveLocalAssets(list);
    return { success: true, error: null };
  },

  // 7. Empty Trash
  async emptyTrash(userId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();

    if (supabase && userId) {
      try {
        const { error } = await supabase
          .from('assets')
          .delete()
          .eq('user_id', userId)
          .not('deleted_at', 'is', null);

        if (error) {
          console.warn('Supabase emptyTrash error:', error);
        }
      } catch (e) {
        console.warn('Supabase emptyTrash exception:', e);
      }
    }

    // Local fallback
    let list = getLocalAssets();
    list = list.filter(a => !(a.userId === userId && a.deletedAt));
    saveLocalAssets(list);
    return { success: true, error: null };
  },

  // 8. Fork / Duplicate Asset
  async forkAsset(
    originalAsset: Asset,
    newUserId: string,
    newAuthorName: string,
    newAuthorAvatar?: string
  ): Promise<{ data: Asset | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const newId = `asset_fork_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const forkedAsset: Asset = {
      ...originalAsset,
      id: newId,
      userId: newUserId,
      authorName: newAuthorName,
      authorAvatar: newAuthorAvatar,
      title: `[สำเนา] ${originalAsset.title}`,
      visibility: 'draft',
      isPublic: false,
      status: 'draft',
      folderId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      likesCount: 0,
      forkCount: 0,
      forkedFromId: originalAsset.id,
      forkedFromAuthor: originalAsset.authorName,
      versions: [
        {
          version: 1,
          updatedAt: now,
          title: `[สำเนา] ${originalAsset.title}`,
          summary: `โคลนมาจากผลงานของ ${originalAsset.authorName}`
        }
      ]
    };

    // Increment original asset fork count
    await this.incrementForkCount(originalAsset.id, originalAsset.forkCount || 0);

    if (supabase) {
      try {
        const dbPayload = mapAssetToDb(forkedAsset);
        dbPayload.id = newId;
        dbPayload.created_at = now;

        const { data, error } = await supabase
          .from('assets')
          .insert(dbPayload)
          .select()
          .single();

        if (error) {
          console.warn('Supabase forkAsset insert error:', error);
        } else if (data) {
          return { data: mapDbToAsset(data), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase fork error:', err);
      }
    }

    // Local fallback
    const list = getLocalAssets();
    list.unshift(forkedAsset);
    saveLocalAssets(list);
    return { data: forkedAsset, error: null };
  },

  async incrementForkCount(assetId: string, currentCount: number = 0): Promise<void> {
    const supabase = getSupabaseClient();
    const newCount = (currentCount || 0) + 1;

    if (supabase) {
      try {
        await supabase
          .from('assets')
          .update({ fork_count: newCount })
          .eq('id', assetId);
      } catch (e) {
        console.warn('Increment fork count error:', e);
      }
    }

    const list = getLocalAssets();
    const item = list.find(a => a.id === assetId);
    if (item) {
      item.forkCount = newCount;
      saveLocalAssets(list);
    }
  },

  // 9. Like Asset
  async likeAsset(assetId: string, currentLikes: number = 0): Promise<number> {
    const supabase = getSupabaseClient();
    const newCount = (currentLikes || 0) + 1;

    if (supabase) {
      try {
        await supabase
          .from('assets')
          .update({ likes_count: newCount })
          .eq('id', assetId);
      } catch (e) {
        console.warn('Supabase like error:', e);
      }
    }

    const list = getLocalAssets();
    const item = list.find(a => a.id === assetId);
    if (item) {
      item.likesCount = newCount;
      saveLocalAssets(list);
    }
    return newCount;
  },

  // 10. Bookmarks / Saved Resources System
  async fetchBookmarks(userId: string): Promise<string[]> {
    if (!userId) return [];
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .select('asset_id')
          .eq('user_id', userId);

        if (error) {
          console.warn('Supabase fetchBookmarks error:', error);
        } else if (data) {
          return data.map((r: any) => r.asset_id);
        }
      } catch (e) {
        console.warn('Supabase fetchBookmarks exception:', e);
      }
    }

    // Local fallback
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_BOOKMARKS}_${userId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async toggleBookmark(userId: string, assetId: string): Promise<{ isBookmarked: boolean }> {
    if (!userId) return { isBookmarked: false };
    const supabase = getSupabaseClient();

    let isCurrentlySaved = false;
    let localList: string[] = [];

    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_BOOKMARKS}_${userId}`);
      localList = raw ? JSON.parse(raw) : [];
      isCurrentlySaved = localList.includes(assetId);
    } catch (e) {
      console.warn('Local bookmark read error:', e);
    }

    if (supabase) {
      try {
        if (isCurrentlySaved) {
          await supabase.from('bookmarks').delete().eq('user_id', userId).eq('asset_id', assetId);
        } else {
          await supabase.from('bookmarks').insert({
            id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            user_id: userId,
            asset_id: assetId,
            created_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('Supabase bookmark toggle error:', e);
      }
    }

    const nextSaved = !isCurrentlySaved;
    const nextList = nextSaved
      ? [...localList, assetId]
      : localList.filter(id => id !== assetId);

    try {
      localStorage.setItem(`${LOCAL_STORAGE_BOOKMARKS}_${userId}`, JSON.stringify(nextList));
    } catch (e) {
      console.warn('Local bookmark write error:', e);
    }

    return { isBookmarked: nextSaved };
  },

  // 11. Content Reporting System
  async submitReport(report: {
    assetId: string;
    reporterId?: string;
    reporterName?: string;
    reason: string;
    details?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    const newReport: ContentReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      assetId: report.assetId,
      reporterId: report.reporterId,
      reporterName: report.reporterName,
      reason: report.reason as any,
      details: report.details || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { error } = await supabase.from('reports').insert({
          id: newReport.id,
          asset_id: newReport.assetId,
          reporter_id: newReport.reporterId,
          reporter_name: newReport.reporterName,
          reason: newReport.reason,
          details: newReport.details,
          status: newReport.status,
          created_at: newReport.createdAt
        });

        if (error) {
          console.warn('Supabase report submit error:', error);
        } else {
          return true;
        }
      } catch (e) {
        console.warn('Supabase report exception:', e);
      }
    }

    // Local fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS);
      const list: ContentReport[] = raw ? JSON.parse(raw) : [];
      list.push(newReport);
      localStorage.setItem(LOCAL_STORAGE_REPORTS, JSON.stringify(list));
      return true;
    } catch {
      return true;
    }
  },

  // 12. Recently Viewed History (Local Cache)
  getRecentlyViewed(): string[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_RECENT_VIEWED);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addRecentlyViewed(assetId: string): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_RECENT_VIEWED);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const updated = [assetId, ...list.filter(id => id !== assetId)].slice(0, 15);
      localStorage.setItem(LOCAL_STORAGE_RECENT_VIEWED, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving recently viewed:', e);
    }
  },

  // 13. Folders CRUD
  async fetchFolders(userId: string): Promise<{ data: Folder[]; error: string | null }> {
    if (!userId) return { data: [], error: null };
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Supabase fetchFolders error:', error);
        } else if (data) {
          return { data: data.map(mapDbToFolder), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase folders error:', err);
      }
    }

    // Local fallback
    const list = getLocalFolders(userId);
    return { data: list, error: null };
  },

  async createFolder(
    folder: { name: string; icon?: string; color?: string; userId: string }
  ): Promise<{ data: Folder | null; error: string | null }> {
    const supabase = getSupabaseClient();
    const newId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newFolder: Folder = {
      id: newId,
      userId: folder.userId,
      name: folder.name.trim(),
      icon: folder.icon || '📁',
      color: folder.color || 'purple',
      createdAt: now,
      updatedAt: now
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('folders')
          .insert({
            id: newId,
            user_id: folder.userId,
            name: folder.name.trim(),
            icon: folder.icon || '📁',
            color: folder.color || 'purple',
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (error) {
          console.warn('Supabase createFolder error:', error);
        } else if (data) {
          return { data: mapDbToFolder(data), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase insert folder error:', err);
      }
    }

    // Local fallback
    const all = getLocalFolders(folder.userId);
    all.push(newFolder);
    saveLocalFolders(all);
    return { data: newFolder, error: null };
  },

  async updateFolder(
    id: string,
    userId: string,
    updates: { name?: string; icon?: string; color?: string }
  ): Promise<{ data: Folder | null; error: string | null }> {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('folders')
          .update({
            ...(updates.name ? { name: updates.name.trim() } : {}),
            ...(updates.icon ? { icon: updates.icon } : {}),
            ...(updates.color ? { color: updates.color } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.warn('Supabase updateFolder error:', error);
        } else if (data) {
          return { data: mapDbToFolder(data), error: null };
        }
      } catch (err: any) {
        console.warn('Supabase update folder error:', err);
      }
    }

    // Local fallback
    const all = getLocalFolders(userId);
    const idx = all.findIndex(f => f.id === id);
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        ...(updates.name ? { name: updates.name.trim() } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
        ...(updates.color ? { color: updates.color } : {}),
        updatedAt: new Date().toISOString()
      };
      saveLocalFolders(all);
      return { data: all[idx], error: null };
    }

    return { data: null, error: 'Folder not found' };
  },

  async deleteFolder(id: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (error) {
          console.warn('Supabase deleteFolder error:', error);
        } else {
          return { success: true, error: null };
        }
      } catch (err: any) {
        console.warn('Supabase delete folder error:', err);
      }
    }

    // Local fallback
    let all = getLocalFolders(userId);
    all = all.filter(f => f.id !== id);
    saveLocalFolders(all);
    return { success: true, error: null };
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

  async upsertProfile(user: User): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase || user.isGuest) return false;

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: user.displayName,
        bio: user.bio,
        avatar_url: user.avatarUrl,
        is_guest: false,
        created_at: user.createdAt
      });

      if (error) {
        console.warn('Supabase upsertProfile error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Profile upsert exception:', e);
      return false;
    }
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
