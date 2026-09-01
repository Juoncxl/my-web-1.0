-- Unify legacy Supabase Auth users with the Phase 1 Creator Profile contract.
-- Additive and idempotent: preserves existing profile rows and user IDs.

begin;

alter table public.profiles
  add column if not exists username text,
  add column if not exists cover_url text;

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

-- Backfill only missing profiles. Existing valid rows are deliberately left
-- untouched so legacy display names, avatars, bios, and timestamps survive.
insert into public.profiles (
  id, display_name, bio, avatar_url, is_guest, created_at, updated_at
)
select
  u.id::text,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'displayName', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Creator'
  ),
  coalesce(u.raw_user_meta_data ->> 'bio', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(u.raw_user_meta_data ->> 'avatarUrl', '')
  ),
  false,
  coalesce(u.created_at, timezone('utc'::text, now())),
  coalesce(u.updated_at, timezone('utc'::text, now()))
from auth.users as u
left join public.profiles as p on p.id = u.id::text
where p.id is null
  and coalesce(u.is_anonymous, false) = false
on conflict (id) do nothing;

-- Keep future signups on the same profile contract and make the privileged
-- trigger independent of the caller's search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, display_name, bio, avatar_url, is_guest, created_at, updated_at
  )
  values (
    new.id::text,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'displayName', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Creator'
    ),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'avatarUrl', '')
    ),
    false,
    coalesce(new.created_at, timezone('utc'::text, now())),
    coalesce(new.updated_at, timezone('utc'::text, now()))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

commit;
