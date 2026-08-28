-- Phase 1 security migration for CXL Studio / Creator Vault.
-- REVIEW ONLY: do not apply automatically to the production project.
--
-- This migration is intentionally data-preserving. It replaces permissive and
-- duplicated RLS policies, adds relational likes, and introduces narrowly scoped
-- database functions for atomic like counts and forks.

begin;

-- ---------------------------------------------------------------------------
-- Tables and integrity helpers
-- ---------------------------------------------------------------------------

create table if not exists public.asset_likes (
  user_id text not null,
  asset_id text not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint asset_likes_pkey primary key (user_id, asset_id)
);

alter table public.assets
  add column if not exists legacy_likes_count integer;

-- Existing aggregate likes have no user attribution. Preserve them as a fixed
-- legacy baseline instead of discarding production engagement data.
update public.assets
set legacy_likes_count = greatest(coalesce(likes_count, 0), 0)
where legacy_likes_count is null;

alter table public.assets
  alter column legacy_likes_count set default 0;
alter table public.assets
  alter column legacy_likes_count set not null;

create index if not exists idx_assets_user_deleted
  on public.assets (user_id, deleted_at);
create index if not exists idx_assets_public_feed
  on public.assets (created_at desc)
  where visibility = 'public' and is_public = true and deleted_at is null;
create index if not exists idx_folders_user_id
  on public.folders (user_id);
create index if not exists idx_bookmarks_asset_id
  on public.bookmarks (asset_id);
create index if not exists idx_reports_reporter_id
  on public.reports (reporter_id);
create index if not exists idx_asset_likes_asset_id
  on public.asset_likes (asset_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_visibility_check'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_visibility_check
      check (visibility in ('public', 'private', 'draft')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_status_check'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_status_check
      check (status in ('idea', 'draft', 'in_progress', 'finished', 'archived')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_counters_nonnegative_check'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_counters_nonnegative_check
      check (likes_count >= 0 and legacy_likes_count >= 0 and fork_count >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_reason_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_reason_check
      check (reason in ('copyright', 'inappropriate', 'spam', 'harassment', 'other')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_status_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_status_check
      check (status in ('pending', 'reviewed', 'resolved')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_authenticated_reporter_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_authenticated_reporter_check
      check (reporter_id is not null) not valid;
  end if;
end
$$;

-- Canonicalize the duplicated visibility fields before enforcing new writes.
update public.assets
set is_public = (visibility = 'public')
where is_public is distinct from (visibility = 'public');

create or replace function public.enforce_asset_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.is_public := (new.visibility = 'public');

  if new.folder_id is not null and not exists (
    select 1
    from public.folders
    where id = new.folder_id
      and user_id = new.user_id
  ) then
    raise exception 'Folder must belong to the asset owner'
      using errcode = '23514';
  end if;

  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and (
      coalesce(new.likes_count, 0) <> 0
      or coalesce(new.legacy_likes_count, 0) <> 0
      or coalesce(new.fork_count, 0) <> 0
    ) then
      raise exception 'Asset counters must start at zero'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and (
      new.likes_count is distinct from old.likes_count
      or new.legacy_likes_count is distinct from old.legacy_likes_count
      or new.fork_count is distinct from old.fork_count
    ) then
      raise exception 'Asset counters are managed by the database'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists enforce_asset_integrity_trigger on public.assets;
create trigger enforce_asset_integrity_trigger
before insert or update on public.assets
for each row execute function public.enforce_asset_integrity();

create or replace function public.sync_asset_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_asset_id text;
begin
  target_asset_id := case when tg_op = 'DELETE' then old.asset_id else new.asset_id end;

  if tg_op = 'DELETE' then
    update public.assets
    set likes_count = greatest(legacy_likes_count, likes_count - 1)
    where id = target_asset_id;
    return old;
  end if;

  update public.assets
  set likes_count = likes_count + 1
  where id = target_asset_id;

  return new;
end
$$;

revoke all on function public.sync_asset_likes_count() from public, anon, authenticated;

drop trigger if exists sync_asset_likes_count_trigger on public.asset_likes;
create trigger sync_asset_likes_count_trigger
after insert or delete on public.asset_likes
for each row execute function public.sync_asset_likes_count();

-- Recalculate legacy counters from the relational source of truth.
update public.assets as asset
set likes_count = asset.legacy_likes_count + (
  select count(*)::integer
  from public.asset_likes as asset_like
  where asset_like.asset_id = asset.id
);

create or replace function public.fork_asset(
  p_source_asset_id text,
  p_new_asset_id text,
  p_author_name text,
  p_author_avatar text default null
)
returns setof public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id text := (select auth.uid())::text;
  created_asset public.assets;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.assets (
    id,
    user_id,
    author_name,
    author_avatar,
    title,
    icon,
    category,
    content,
    ui_code_snippet,
    preview_image,
    preview_images,
    folder_id,
    is_public,
    visibility,
    status,
    tags,
    likes_count,
    fork_count,
    forked_from_id,
    forked_from_author,
    linked_asset_ids,
    versions,
    deleted_at,
    created_at,
    updated_at
  )
  select
    p_new_asset_id,
    caller_id,
    coalesce(nullif(trim(p_author_name), ''), 'Creator'),
    p_author_avatar,
    '[สำเนา] ' || source.title,
    source.icon,
    source.category,
    source.content,
    source.ui_code_snippet,
    source.preview_image,
    source.preview_images,
    null,
    false,
    'draft',
    'draft',
    source.tags,
    0,
    0,
    source.id,
    source.author_name,
    source.linked_asset_ids,
    jsonb_build_array(
      jsonb_build_object(
        'version', 1,
        'updatedAt', timezone('utc'::text, now()),
        'title', '[สำเนา] ' || source.title,
        'summary', 'โคลนมาจากผลงานของ ' || source.author_name
      )
    ),
    null,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  from public.assets as source
  where source.id = p_source_asset_id
    and source.deleted_at is null
    and (
      source.user_id = caller_id
      or (source.visibility = 'public' and source.is_public = true)
    )
  returning * into created_asset;

  if created_asset.id is null then
    raise exception 'Source asset is unavailable or private'
      using errcode = '42501';
  end if;

  update public.assets
  set fork_count = fork_count + 1
  where id = p_source_asset_id;

  return next created_asset;
end
$$;

revoke all on function public.fork_asset(text, text, text, text) from public, anon;
grant execute on function public.fork_asset(text, text, text, text) to authenticated;

-- Harden the existing auth trigger helper. The auth trigger itself is preserved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, bio, avatar_url, is_guest, created_at, updated_at)
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data ->> 'displayName', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), 'Creator'),
    coalesce(new.raw_user_meta_data ->> 'bio', 'นักสร้างสรรค์ผลงาน 🌸'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'avatarUrl'),
    false,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (id) do nothing;

  return new;
end
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Least-privilege grants and canonical RLS policies
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.assets enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reports enable row level security;
alter table public.asset_likes enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['profiles', 'folders', 'assets', 'bookmarks', 'reports', 'asset_likes'])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

revoke all on public.profiles from anon, authenticated;
revoke all on public.folders from anon, authenticated;
revoke all on public.assets from anon, authenticated;
revoke all on public.bookmarks from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.asset_likes from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.assets to anon, authenticated;
grant insert, update, delete on public.assets to authenticated;

grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
grant insert on public.reports to authenticated;
grant select, insert, delete on public.asset_likes to authenticated;

create policy profiles_public_read
on public.profiles for select
to anon, authenticated
using (true);

create policy profiles_owner_insert
on public.profiles for insert
to authenticated
with check ((select auth.uid())::text = id and coalesce(is_guest, false) = false);

create policy profiles_owner_update
on public.profiles for update
to authenticated
using ((select auth.uid())::text = id)
with check ((select auth.uid())::text = id and coalesce(is_guest, false) = false);

create policy folders_owner_read
on public.folders for select
to authenticated
using ((select auth.uid())::text = user_id);

create policy folders_owner_insert
on public.folders for insert
to authenticated
with check ((select auth.uid())::text = user_id);

create policy folders_owner_update
on public.folders for update
to authenticated
using ((select auth.uid())::text = user_id)
with check ((select auth.uid())::text = user_id);

create policy folders_owner_delete
on public.folders for delete
to authenticated
using ((select auth.uid())::text = user_id);

create policy assets_visible_read
on public.assets for select
to anon, authenticated
using (
  (visibility = 'public' and is_public = true and deleted_at is null)
  or (select auth.uid())::text = user_id
);

create policy assets_owner_insert
on public.assets for insert
to authenticated
with check ((select auth.uid())::text = user_id);

create policy assets_owner_update
on public.assets for update
to authenticated
using ((select auth.uid())::text = user_id)
with check ((select auth.uid())::text = user_id);

create policy assets_owner_delete
on public.assets for delete
to authenticated
using ((select auth.uid())::text = user_id);

create policy bookmarks_owner_read
on public.bookmarks for select
to authenticated
using ((select auth.uid())::text = user_id);

create policy bookmarks_owner_insert
on public.bookmarks for insert
to authenticated
with check (
  (select auth.uid())::text = user_id
  and exists (
    select 1
    from public.assets
    where id = asset_id
      and deleted_at is null
      and (visibility = 'public' or user_id = (select auth.uid())::text)
  )
);

create policy bookmarks_owner_delete
on public.bookmarks for delete
to authenticated
using ((select auth.uid())::text = user_id);

create policy asset_likes_owner_read
on public.asset_likes for select
to authenticated
using ((select auth.uid())::text = user_id);

create policy asset_likes_owner_insert
on public.asset_likes for insert
to authenticated
with check (
  (select auth.uid())::text = user_id
  and exists (
    select 1
    from public.assets
    where id = asset_id
      and deleted_at is null
      and (visibility = 'public' or user_id = (select auth.uid())::text)
  )
);

create policy asset_likes_owner_delete
on public.asset_likes for delete
to authenticated
using ((select auth.uid())::text = user_id);

create policy reports_authenticated_insert
on public.reports for insert
to authenticated
with check (
  reporter_id = (select auth.uid())::text
  and status = 'pending'
  and exists (
    select 1
    from public.assets
    where id = asset_id
      and visibility = 'public'
      and is_public = true
      and deleted_at is null
  )
);

-- No SELECT policy is intentionally created for reports. Moderation access must
-- be implemented later with a trusted server/admin authorization mechanism.

commit;
