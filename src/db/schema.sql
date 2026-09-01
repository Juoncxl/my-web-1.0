-- ==============================================================================
-- 🌸 CREATOR VAULT - ADVANCED DATABASE SCHEMA & MIGRATION SCRIPT FOR SUPABASE
-- Supports: Visibility, Status, Bookmarks, Soft Delete/Trash, Reports, Forking, Version Proof
-- ==============================================================================

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT 'Creator',
    username TEXT,
    bio TEXT DEFAULT '',
    avatar_url TEXT,
    cover_url TEXT,
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
    legacy_likes_count INTEGER NOT NULL DEFAULT 0,
    fork_count INTEGER NOT NULL DEFAULT 0,
    forked_from_id TEXT,
    forked_from_author TEXT,
    linked_asset_ids TEXT[] DEFAULT '{}'::text[],
    versions JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ, -- Soft delete support
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT assets_visibility_check CHECK (visibility IN ('public', 'private', 'draft')),
    CONSTRAINT assets_status_check CHECK (status IN ('idea', 'draft', 'in_progress', 'finished', 'archived')),
    CONSTRAINT assets_counters_nonnegative_check CHECK (likes_count >= 0 AND legacy_likes_count >= 0 AND fork_count >= 0)
);

-- 2b. Profile social links. Public reads are restricted to visible links by RLS.
CREATE TABLE IF NOT EXISTS public.profile_social_links (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL DEFAULT 'custom',
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT profile_social_links_url_check CHECK (
        LEFT(LOWER(TRIM(url)), 8) = 'https://' OR LEFT(LOWER(TRIM(url)), 7) = 'mailto:'
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL AND LENGTH(TRIM(username)) > 0;
CREATE INDEX IF NOT EXISTS profile_social_links_profile_order_idx
    ON public.profile_social_links (profile_id, sort_order);

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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='legacy_likes_count') THEN
        ALTER TABLE public.assets ADD COLUMN legacy_likes_count INTEGER;
        UPDATE public.assets SET legacy_likes_count = GREATEST(COALESCE(likes_count, 0), 0);
        ALTER TABLE public.assets ALTER COLUMN legacy_likes_count SET DEFAULT 0;
        ALTER TABLE public.assets ALTER COLUMN legacy_likes_count SET NOT NULL;
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
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT reports_reason_check CHECK (reason IN ('copyright', 'inappropriate', 'spam', 'harassment', 'other')),
    CONSTRAINT reports_status_check CHECK (status IN ('pending', 'reviewed', 'resolved')),
    CONSTRAINT reports_authenticated_reporter_check CHECK (reporter_id IS NOT NULL)
);

-- 6. Relational Likes (one authenticated user per asset)
CREATE TABLE IF NOT EXISTS public.asset_likes (
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT asset_likes_pkey PRIMARY KEY (user_id, asset_id)
);

-- 7. Indexes for Maximum Performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_visibility ON public.assets(visibility);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON public.assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_asset_id ON public.bookmarks(asset_id);
CREATE INDEX IF NOT EXISTS idx_reports_asset_id ON public.reports(asset_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_likes_asset_id ON public.asset_likes(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_deleted ON public.assets(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_assets_public_feed ON public.assets(created_at DESC)
WHERE visibility = 'public' AND is_public = true AND deleted_at IS NULL;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_likes ENABLE ROW LEVEL SECURITY;

-- 9. Replace every existing policy on Phase 1 tables. This also removes legacy
-- duplicate policies whose names differ from this setup file.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY (ARRAY['profiles', 'profile_social_links', 'folders', 'assets', 'bookmarks', 'reports', 'asset_likes'])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            policy_record.policyname,
            policy_record.schemaname,
            policy_record.tablename
        );
    END LOOP;
END $$;

-- Keep the duplicated visibility fields deterministic for legacy clients.
UPDATE public.assets
SET is_public = (visibility = 'public')
WHERE is_public IS DISTINCT FROM (visibility = 'public');

-- 10. Integrity and counter triggers
CREATE OR REPLACE FUNCTION public.enforce_asset_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.is_public := (NEW.visibility = 'public');

    IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.folders
        WHERE id = NEW.folder_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Folder must belong to the asset owner' USING ERRCODE = '23514';
    END IF;

    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' AND (
            COALESCE(NEW.likes_count, 0) <> 0
            OR COALESCE(NEW.legacy_likes_count, 0) <> 0
            OR COALESCE(NEW.fork_count, 0) <> 0
        ) THEN
            RAISE EXCEPTION 'Asset counters must start at zero' USING ERRCODE = '42501';
        END IF;

        IF TG_OP = 'UPDATE' AND (
            NEW.likes_count IS DISTINCT FROM OLD.likes_count
            OR NEW.legacy_likes_count IS DISTINCT FROM OLD.legacy_likes_count
            OR NEW.fork_count IS DISTINCT FROM OLD.fork_count
        ) THEN
            RAISE EXCEPTION 'Asset counters are managed by the database' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_asset_integrity_trigger ON public.assets;
CREATE TRIGGER enforce_asset_integrity_trigger
BEFORE INSERT OR UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_integrity();

CREATE OR REPLACE FUNCTION public.sync_asset_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_asset_id TEXT;
BEGIN
    target_asset_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_id ELSE NEW.asset_id END;

    IF TG_OP = 'DELETE' THEN
        UPDATE public.assets
        SET likes_count = GREATEST(legacy_likes_count, likes_count - 1)
        WHERE id = target_asset_id;
        RETURN OLD;
    END IF;

    UPDATE public.assets
    SET likes_count = likes_count + 1
    WHERE id = target_asset_id;

    RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sync_asset_likes_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_asset_likes_count_trigger ON public.asset_likes;
CREATE TRIGGER sync_asset_likes_count_trigger
AFTER INSERT OR DELETE ON public.asset_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_asset_likes_count();

-- 11. Atomic fork operation. It explicitly checks source visibility because the
-- function must update another creator's aggregate fork counter.
CREATE OR REPLACE FUNCTION public.fork_asset(
    p_source_asset_id TEXT,
    p_new_asset_id TEXT,
    p_author_name TEXT,
    p_author_avatar TEXT DEFAULT NULL
)
RETURNS SETOF public.assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_id TEXT := (SELECT auth.uid())::TEXT;
    created_asset public.assets;
BEGIN
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.assets (
        id, user_id, author_name, author_avatar, title, icon, category, content,
        ui_code_snippet, preview_image, preview_images, folder_id, is_public,
        visibility, status, tags, likes_count, legacy_likes_count, fork_count,
        forked_from_id, forked_from_author, linked_asset_ids, versions,
        deleted_at, created_at, updated_at
    )
    SELECT
        p_new_asset_id, caller_id,
        COALESCE(NULLIF(TRIM(p_author_name), ''), 'Creator'), p_author_avatar,
        '[สำเนา] ' || source.title, source.icon, source.category, source.content,
        source.ui_code_snippet, source.preview_image, source.preview_images, NULL,
        false, 'draft', 'draft', source.tags, 0, 0, 0, source.id,
        source.author_name, source.linked_asset_ids,
        jsonb_build_array(jsonb_build_object(
            'version', 1,
            'updatedAt', TIMEZONE('utc'::text, NOW()),
            'title', '[สำเนา] ' || source.title,
            'summary', 'โคลนมาจากผลงานของ ' || source.author_name
        )),
        NULL, TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW())
    FROM public.assets AS source
    WHERE source.id = p_source_asset_id
      AND source.deleted_at IS NULL
      AND (
          source.user_id = caller_id
          OR (source.visibility = 'public' AND source.is_public = true)
      )
    RETURNING * INTO created_asset;

    IF created_asset.id IS NULL THEN
        RAISE EXCEPTION 'Source asset is unavailable or private' USING ERRCODE = '42501';
    END IF;

    UPDATE public.assets SET fork_count = fork_count + 1
    WHERE id = p_source_asset_id;

    RETURN NEXT created_asset;
END $$;

REVOKE ALL ON FUNCTION public.fork_asset(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fork_asset(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Auth trigger helper. Keep privileged trigger functions non-callable from the
-- Data API and pin the search path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, display_name, bio, avatar_url, is_guest, created_at, updated_at
    )
    VALUES (
        NEW.id::TEXT,
        COALESCE(
            NEW.raw_user_meta_data ->> 'displayName',
            NEW.raw_user_meta_data ->> 'display_name',
            split_part(COALESCE(NEW.email, ''), '@', 1),
            'Creator'
        ),
        COALESCE(NEW.raw_user_meta_data ->> 'bio', ''),
        COALESCE(
            NEW.raw_user_meta_data ->> 'avatar_url',
            NEW.raw_user_meta_data ->> 'avatarUrl'
        ),
        false,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 12. Least-privilege grants
REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.profile_social_links FROM anon, authenticated;
REVOKE ALL ON public.folders FROM anon, authenticated;
REVOKE ALL ON public.assets FROM anon, authenticated;
REVOKE ALL ON public.bookmarks FROM anon, authenticated;
REVOKE ALL ON public.reports FROM anon, authenticated;
REVOKE ALL ON public.asset_likes FROM anon, authenticated;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profile_social_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_social_links TO authenticated;
GRANT SELECT ON public.assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT INSERT ON public.reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.asset_likes TO authenticated;

-- 13. Canonical RLS policies
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT
TO anon, authenticated USING (true);
CREATE POLICY profiles_owner_insert ON public.profiles FOR INSERT
TO authenticated WITH CHECK ((SELECT auth.uid())::TEXT = id AND COALESCE(is_guest, false) = false);
CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE
TO authenticated USING ((SELECT auth.uid())::TEXT = id)
WITH CHECK ((SELECT auth.uid())::TEXT = id AND COALESCE(is_guest, false) = false);

CREATE POLICY profile_social_links_visible_read ON public.profile_social_links FOR SELECT
TO anon, authenticated USING (visible = true OR (SELECT auth.uid())::TEXT = profile_id);
CREATE POLICY profile_social_links_owner_insert ON public.profile_social_links FOR INSERT
TO authenticated WITH CHECK ((SELECT auth.uid())::TEXT = profile_id);
CREATE POLICY profile_social_links_owner_update ON public.profile_social_links FOR UPDATE
TO authenticated USING ((SELECT auth.uid())::TEXT = profile_id)
WITH CHECK ((SELECT auth.uid())::TEXT = profile_id);
CREATE POLICY profile_social_links_owner_delete ON public.profile_social_links FOR DELETE
TO authenticated USING ((SELECT auth.uid())::TEXT = profile_id);

CREATE POLICY folders_owner_read ON public.folders FOR SELECT
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY folders_owner_insert ON public.folders FOR INSERT
TO authenticated WITH CHECK ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY folders_owner_update ON public.folders FOR UPDATE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id)
WITH CHECK ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY folders_owner_delete ON public.folders FOR DELETE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);

CREATE POLICY assets_visible_read ON public.assets FOR SELECT
TO anon, authenticated USING (
    (visibility = 'public' AND is_public = true AND deleted_at IS NULL)
    OR (SELECT auth.uid())::TEXT = user_id
);
CREATE POLICY assets_owner_insert ON public.assets FOR INSERT
TO authenticated WITH CHECK ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY assets_owner_update ON public.assets FOR UPDATE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id)
WITH CHECK ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY assets_owner_delete ON public.assets FOR DELETE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);

CREATE POLICY bookmarks_owner_read ON public.bookmarks FOR SELECT
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY bookmarks_owner_insert ON public.bookmarks FOR INSERT
TO authenticated WITH CHECK (
    (SELECT auth.uid())::TEXT = user_id
    AND EXISTS (
        SELECT 1 FROM public.assets
        WHERE id = asset_id AND deleted_at IS NULL
          AND (visibility = 'public' OR user_id = (SELECT auth.uid())::TEXT)
    )
);
CREATE POLICY bookmarks_owner_delete ON public.bookmarks FOR DELETE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);

CREATE POLICY asset_likes_owner_read ON public.asset_likes FOR SELECT
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);
CREATE POLICY asset_likes_owner_insert ON public.asset_likes FOR INSERT
TO authenticated WITH CHECK (
    (SELECT auth.uid())::TEXT = user_id
    AND EXISTS (
        SELECT 1 FROM public.assets
        WHERE id = asset_id AND deleted_at IS NULL
          AND (visibility = 'public' OR user_id = (SELECT auth.uid())::TEXT)
    )
);
CREATE POLICY asset_likes_owner_delete ON public.asset_likes FOR DELETE
TO authenticated USING ((SELECT auth.uid())::TEXT = user_id);

CREATE POLICY reports_authenticated_insert ON public.reports FOR INSERT
TO authenticated WITH CHECK (
    reporter_id = (SELECT auth.uid())::TEXT
    AND status = 'pending'
    AND EXISTS (
        SELECT 1 FROM public.assets
        WHERE id = asset_id AND visibility = 'public'
          AND is_public = true AND deleted_at IS NULL
    )
);

-- Reports intentionally have no SELECT policy. A future moderation dashboard
-- must use a trusted server-side admin authorization mechanism.
