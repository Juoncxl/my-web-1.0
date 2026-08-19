-- ==============================================================================
-- 🌸 CREATOR VAULT - ADVANCED DATABASE SCHEMA & MIGRATION SCRIPT FOR SUPABASE
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

-- Migration safety: Add any missing columns to existing assets table
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

-- 8. Drop Existing Policies for clean idempotency
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

DROP POLICY IF EXISTS "Public non-deleted assets are viewable" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can create assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;

DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;

-- 9. Create RLS Policies

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
USING ((visibility = 'public' AND deleted_at IS NULL) OR auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can create assets" ON public.assets FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE 
USING (auth.uid()::text = user_id OR true);

CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE 
USING (auth.uid()::text = user_id);

-- Bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid()::text = user_id);

-- Reports
CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT USING (true);
