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
    name: 'โน้ตทำงานร่วมกัน',
    nameEn: 'Collab Notes',
    emoji: '🤝',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'บันทึกการประชุม, การประสานงาน และแผนพัฒนาโปรเจกต์'
  },
  app_data: {
    id: 'app_data',
    name: 'ข้อมูลเฉพาะแอพ',
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
  { id: 'purple', name: 'Lavender Pastel', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  { id: 'pink', name: 'Sakura Pink', bg: 'bg-pink-100 dark:bg-pink-950/60', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  { id: 'indigo', name: 'Dreamy Indigo', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  { id: 'emerald', name: 'Matcha Green', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  { id: 'amber', name: 'Honey Warm', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  { id: 'rose', name: 'Ruby Rose', bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' }
];

export const SUPABASE_SQL_SCHEMA = `-- Supabase Schema for Creator Vault (Chatbot Creators & Writers Hub)
-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Custom Folders Table (Personal Dashboard Organization)
CREATE TABLE IF NOT EXISTS public.folders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT 'purple',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Assets Table (with folder_id & multiple preview_images)
CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  icon JSONB NOT NULL DEFAULT '{"type":"emoji","value":"✨"}'::jsonb,
  category TEXT NOT NULL CHECK (category IN ('character', 'lore', 'ui_code', 'prompts', 'collab', 'app_data')),
  content TEXT,
  ui_code_snippet TEXT,
  preview_image TEXT,
  preview_images TEXT[] DEFAULT '{}',
  folder_id TEXT REFERENCES public.folders(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes_count INT DEFAULT 0
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. RLS Policies for Folders (Strict Owner Privacy)
CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- 7. RLS Policies for Assets
CREATE POLICY "Public assets are viewable by everyone" ON public.assets FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view their own private assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);
`;
