-- Creator Space Phase 1 profile foundation.
-- REVIEW ONLY: apply manually after testing in a Supabase development project.
-- This migration is additive and preserves all existing profile, asset, and folder data.

begin;

alter table public.profiles
  add column if not exists username text,
  add column if not exists cover_url text;

alter table public.profiles alter column bio set default '';
alter table public.profiles alter column avatar_url set default null;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

create table if not exists public.profile_social_links (
  id text primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  platform text not null default 'custom',
  label text not null,
  url text not null,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint profile_social_links_url_check check (
    left(lower(trim(url)), 8) = 'https://' or left(lower(trim(url)), 7) = 'mailto:'
  )
);

create index if not exists profile_social_links_profile_order_idx
  on public.profile_social_links (profile_id, sort_order);

alter table public.profile_social_links enable row level security;

revoke all on public.profile_social_links from anon, authenticated;
grant select on public.profile_social_links to anon, authenticated;
grant insert, update, delete on public.profile_social_links to authenticated;

drop policy if exists profile_social_links_visible_read on public.profile_social_links;
create policy profile_social_links_visible_read
on public.profile_social_links for select
to anon, authenticated
using (visible = true or (select auth.uid())::text = profile_id);

drop policy if exists profile_social_links_owner_insert on public.profile_social_links;
create policy profile_social_links_owner_insert
on public.profile_social_links for insert
to authenticated
with check ((select auth.uid())::text = profile_id);

drop policy if exists profile_social_links_owner_update on public.profile_social_links;
create policy profile_social_links_owner_update
on public.profile_social_links for update
to authenticated
using ((select auth.uid())::text = profile_id)
with check ((select auth.uid())::text = profile_id);

drop policy if exists profile_social_links_owner_delete on public.profile_social_links;
create policy profile_social_links_owner_delete
on public.profile_social_links for delete
to authenticated
using ((select auth.uid())::text = profile_id);

-- Create the bucket only when it does not already exist. If a project already
-- has a profile-media bucket, keep its existing dashboard configuration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'profile-media');

drop policy if exists profile_media_owner_insert on storage.objects;
create policy profile_media_owner_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists profile_media_owner_update on storage.objects;
create policy profile_media_owner_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists profile_media_owner_delete on storage.objects;
create policy profile_media_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
