-- Persist Creator Space layout and widget presentation across origins/devices.
-- The settings payload is presentation data. Public profiles need read access,
-- while only the authenticated profile owner may write it.

create table if not exists public.creator_space_settings (
  profile_id text primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.creator_space_settings enable row level security;

revoke all on table public.creator_space_settings from anon, authenticated;
grant select on table public.creator_space_settings to anon, authenticated;
grant insert, update, delete on table public.creator_space_settings to authenticated;

drop policy if exists creator_space_settings_public_read on public.creator_space_settings;
create policy creator_space_settings_public_read
on public.creator_space_settings for select
to anon, authenticated
using (true);

drop policy if exists creator_space_settings_owner_insert on public.creator_space_settings;
create policy creator_space_settings_owner_insert
on public.creator_space_settings for insert
to authenticated
with check ((select auth.uid())::text = profile_id);

drop policy if exists creator_space_settings_owner_update on public.creator_space_settings;
create policy creator_space_settings_owner_update
on public.creator_space_settings for update
to authenticated
using ((select auth.uid())::text = profile_id)
with check ((select auth.uid())::text = profile_id);

drop policy if exists creator_space_settings_owner_delete on public.creator_space_settings;
create policy creator_space_settings_owner_delete
on public.creator_space_settings for delete
to authenticated
using ((select auth.uid())::text = profile_id);
