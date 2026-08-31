import { AssetCategory, CategoryMeta } from '../types';

export const CATEGORIES: Record<AssetCategory, CategoryMeta> = {
  character: {
    id: 'character',
    name: 'โปรไฟล์ตัวละคร',
    nameEn: 'Character Profile',
    emoji: '🎭',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    description: 'โปรไฟล์ตัวละครบอท, บุคลิก, คำพูดติดปาก, และบทบาทสมมติ'
  },
  lore: {
    id: 'lore',
    name: 'เนื้อเรื่อง / โลกทัศน์',
    nameEn: 'Lore & Plot',
    emoji: '📖',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'ข้อมูลฉาก, ประวัติศาสตร์, กฎเวทมนตร์ และโครงเรื่อง'
  },
  ui_code: {
    id: 'ui_code',
    name: 'โค้ดหน้าตา UI',
    nameEn: 'UI Code',
    emoji: '💻',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    description: 'โค้ด HTML / CSS สำหรับตกแต่งหน้าจอแชทบอทและ Web'
  },
  prompts: {
    id: 'prompts',
    name: 'คำสั่งพรอมต์',
    nameEn: 'Prompts & System',
    emoji: '✨',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'System Prompts, Jailbreak-safe, Framework และสูตรสั่ง AI'
  },
  collab: {
    id: 'collab',
    name: 'คอลแลป',
    nameEn: 'Collab Notes',
    emoji: '🤝',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'บันทึกการประชุม, การประสานงาน และแผนพัฒนาโปรเจกต์'
  },
  app_data: {
    id: 'app_data',
    name: 'แอป / แพลตฟอร์ม',
    nameEn: 'App-Specific Data',
    emoji: '📦',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    description: 'SillyTavern Card V2, JSON Presets, และ Configs ต่างๆ'
  }
};

export const KAOMOJI_COLLECTIONS = [
  {
    group: 'น่ารัก & ทักทาย (Cute & Friendly)',
    items: [
      '(｡•̀ᴗ-)✧',
      '(づ ◕‿◕ )づ',
      '( ˘ ³˘)♥',
      '(๑>ᴗ<๑)',
      '(≧◡≦)',
      '(*•̀ᴗ•́*)و ̑̑',
      '(✿◠‿◠)',
      '(o^▽^o)',
      '( ´ ▽ ` ).｡ｏ♡'
    ]
  },
  {
    group: 'ซึนเดเระ & ขี้อาย (Tsundere & Shy)',
    items: [
      '(*/ω＼*)',
      '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
      '( > ﹏ < )',
      '(¬_¬")',
      '(눈_눈)',
      '(ᗒᗣᗕ)՞',
      '(｡・//ε//・｡)',
      '(¬‿¬)'
    ]
  },
  {
    group: 'มุ่งมั่น & ต่อสู้ (Determined & Cool)',
    items: [
      '( •̀ ω •́ )✧',
      '(ง •̀_•́)ง',
      '(๑•̀ㅂ•́)و✧',
      'ᕙ(  •̀ ᗜ •́  )ᕗ',
      '( ▀ ͜͞ʖ▀)',
      '(•̀ᴗ•́)൬',
      '(・`ω´・)'
    ]
  },
  {
    group: 'เวทมนตร์ & ลึกลับ (Magic & Cosmic)',
    items: [
      '✧ﾟ･: *ヽ(◕ヮ◕ヽ)',
      '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
      'ଘ(੭*ˊᵕˋ)੭* ੈ♡‧₊˚',
      '★~(◠‿◕✿)',
      '໒( ⊙ᴗ⊙ )७',
      '☽˙❀‿❀˙☾'
    ]
  },
  {
    group: 'สัตว์ & แมวเหมียว (Neko & Animals)',
    items: [
      '(=^･ω･^=)',
      '(^•ﻌ•^)',
      '(=｀ω´=)',
      '(＾• ω •＾)',
      '₍ᐢ. ̫.ᐢ₎',
      'ฅ(• ﻌ •)ฅ'
    ]
  }
];

export const POPULAR_EMOJIS = [
  '🌸', '✨', '💬', '🎭', '📖', '💻', '🌙', '🎴', '🍵', '🎀',
  '🍓', '🎨', '🚀', '🔮', '🧸', '🍰', '⭐', '🐾', '🔥', '💡'
];

export const FOLDER_COLOR_PRESETS = [
  { id: 'purple', name: 'ม่วงกาแล็กซี', swatch: '#7A5CC7', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  { id: 'pink', name: 'ชมพูเนบิวลา', swatch: '#C982A7', bg: 'bg-pink-100 dark:bg-pink-950/60', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  { id: 'indigo', name: 'น้ำเงินมหาสมุทร', swatch: '#356FA8', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  { id: 'emerald', name: 'มิ้นต์อควา', swatch: '#67B8C7', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  { id: 'amber', name: 'แสงจันทร์', swatch: '#A9B2D8', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  { id: 'rose', name: 'ชมพูคอสมิก', swatch: '#D08AAE', bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' }
];

export const STATUS_PRESETS = {
  idea: {
    id: 'idea',
    name: 'ไอเดีย',
    nameEn: 'Idea',
    emoji: '💡',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800'
  },
  draft: {
    id: 'draft',
    name: 'แบบร่าง',
    nameEn: 'Draft',
    emoji: '📝',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700'
  },
  in_progress: {
    id: 'in_progress',
    name: 'กำลังทำ',
    nameEn: 'In Progress',
    emoji: '⏳',
    bg: 'bg-sky-50 dark:bg-sky-950/60',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800'
  },
  finished: {
    id: 'finished',
    name: 'เสร็จสมบูรณ์',
    nameEn: 'Finished',
    emoji: '✨',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800'
  },
  archived: {
    id: 'archived',
    name: 'จัดเก็บแล้ว',
    nameEn: 'Archived',
    emoji: '📦',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800'
  }
} as const;

export const VISIBILITY_PRESETS = {
  public: {
    id: 'public',
    name: 'สาธารณะ (Public Feed)',
    desc: 'แสดงในหน้าแรก ให้ทุกคนได้อ่าน ค้นพบ และกดบุ๊กมาร์ก',
    icon: 'Globe',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800'
  },
  private: {
    id: 'private',
    name: 'ส่วนตัว (Private)',
    desc: 'มองเห็นได้เฉพาะคุณในคลังส่วนตัวเท่านั้น',
    icon: 'Lock',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800'
  },
  draft: {
    id: 'draft',
    name: 'ฉบับร่าง (Draft)',
    desc: 'ยังไม่เผยแพร่ กำลังเขียนหรือปรับแต่ง',
    icon: 'FileEdit',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700'
  }
} as const;

export const REPORT_REASONS = [
  { id: 'copyright', label: 'ละเมิดลิขสิทธิ์ / คัดลอกผลงานโดยไม่ได้รับอนุญาต (Copyright Infringement)' },
  { id: 'inappropriate', label: 'เนื้อหาไม่เหมาะสม / ลามกอนาจาร / ความรุนแรง (Inappropriate / NSFW)' },
  { id: 'spam', label: 'สแปม / หลอกลวง / โฆษณาที่ไม่เกี่ยวข้อง (Spam / Scam)' },
  { id: 'harassment', label: 'คุกคาม / สร้างความเกลียดชัง (Harassment / Hate Speech)' },
  { id: 'other', label: 'อื่นๆ (Other reasons)' }
] as const;

// Deprecated display-only reference. Never execute this string against an
// existing project; review src/db/schema.sql and the Phase 1 migration instead.
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- 🌸 CREATOR VAULT - ADVANCED DATABASE SCHEMA & MIGRATION SCRIPT
-- DEPRECATED REFERENCE: REVIEW src/db/schema.sql AND supabase/migrations/ INSTEAD
-- Supports: Visibility, Status, Bookmarks, Soft Delete/Trash, Reports, Forking, Version Proof
-- ==============================================================================

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT 'Creator',
    bio TEXT DEFAULT 'นักสร้างสรรค์ผลงาน 🌸',
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    is_guest BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Custom Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    color TEXT DEFAULT 'purple',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create Assets Table with Advanced Columns
CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT 'Creator',
    author_avatar TEXT,
    title TEXT NOT NULL,
    icon JSONB NOT NULL DEFAULT '{"type":"emoji","value":"✨"}'::jsonb,
    category TEXT NOT NULL DEFAULT 'character',
    content TEXT DEFAULT '',
    ui_code_snippet TEXT DEFAULT '',
    preview_image TEXT,
    preview_images TEXT[] DEFAULT '{}'::text[],
    folder_id TEXT REFERENCES public.folders(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    visibility TEXT NOT NULL DEFAULT 'public', -- 'public', 'private', 'draft'
    status TEXT NOT NULL DEFAULT 'finished', -- 'idea', 'draft', 'in_progress', 'finished', 'archived'
    tags TEXT[] DEFAULT '{}'::text[],
    likes_count INTEGER NOT NULL DEFAULT 0,
    fork_count INTEGER NOT NULL DEFAULT 0,
    forked_from_id TEXT,
    forked_from_author TEXT,
    linked_asset_ids TEXT[] DEFAULT '{}'::text[],
    versions JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ, -- Soft delete support
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Alter table if columns don't exist yet (Migration safety)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='visibility') THEN
        ALTER TABLE public.assets ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='status') THEN
        ALTER TABLE public.assets ADD COLUMN status TEXT NOT NULL DEFAULT 'finished';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='deleted_at') THEN
        ALTER TABLE public.assets ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='forked_from_id') THEN
        ALTER TABLE public.assets ADD COLUMN forked_from_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='forked_from_author') THEN
        ALTER TABLE public.assets ADD COLUMN forked_from_author TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='linked_asset_ids') THEN
        ALTER TABLE public.assets ADD COLUMN linked_asset_ids TEXT[] DEFAULT '{}'::text[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='versions') THEN
        ALTER TABLE public.assets ADD COLUMN versions JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. Create Bookmarks Table (Save favorite resources without duplicating)
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, asset_id)
);

-- 5. Create Content Reports Table (Reporting infringement/inappropriate content)
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    reporter_id TEXT,
    reporter_name TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Indexes for Maximum Performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_visibility ON public.assets(visibility);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON public.assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_asset_id ON public.reports(asset_id);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);

-- Folders
CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can create own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING (auth.uid()::text = user_id);

-- Assets (Non-deleted public assets or owner's assets)
CREATE POLICY "Public non-deleted assets are viewable" ON public.assets FOR SELECT 
USING ((visibility = 'public' AND is_public = true AND deleted_at IS NULL) OR auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can create assets" ON public.assets FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE 
USING (auth.uid()::text = user_id);

-- Bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid()::text = user_id);

-- Reports
CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT
WITH CHECK (reporter_id = auth.uid()::text AND status = 'pending');
-- Intentionally no SELECT policy. Moderation requires a trusted admin backend.
`;

