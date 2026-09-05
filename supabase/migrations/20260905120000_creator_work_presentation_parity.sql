-- Persist the same public presentation used by Creator Review and published Works.
-- Private Collaboration management data is isolated from the public assets table.

alter table public.assets
  add column if not exists short_description text not null default '',
  add column if not exists content_type_labels jsonb not null default '[]'::jsonb,
  add column if not exists content_types jsonb not null default '[]'::jsonb,
  add column if not exists presentation_metadata jsonb,
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists public_collaboration jsonb,
  add column if not exists collaboration_asset_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_collaboration_asset_id_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_collaboration_asset_id_fkey
      foreign key (collaboration_asset_id)
      references public.assets(id)
      on delete set null;
  end if;
end
$$;

create index if not exists assets_collaboration_asset_id_idx
  on public.assets(collaboration_asset_id)
  where collaboration_asset_id is not null;

create table if not exists public.asset_collaboration_drafts (
  asset_id text primary key references public.assets(id) on delete cascade,
  owner_id text not null,
  draft jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.asset_collaboration_drafts enable row level security;

drop policy if exists "Owners read collaboration drafts" on public.asset_collaboration_drafts;
create policy "Owners read collaboration drafts"
  on public.asset_collaboration_drafts for select
  to authenticated
  using (owner_id = (select auth.uid())::text);

drop policy if exists "Owners insert collaboration drafts" on public.asset_collaboration_drafts;
create policy "Owners insert collaboration drafts"
  on public.asset_collaboration_drafts for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.assets
      where assets.id = asset_collaboration_drafts.asset_id
        and assets.user_id = (select auth.uid())::text
        and assets.category = 'collab'
    )
  );

drop policy if exists "Owners update collaboration drafts" on public.asset_collaboration_drafts;
create policy "Owners update collaboration drafts"
  on public.asset_collaboration_drafts for update
  to authenticated
  using (owner_id = (select auth.uid())::text)
  with check (
    owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.assets
      where assets.id = asset_collaboration_drafts.asset_id
        and assets.user_id = (select auth.uid())::text
        and assets.category = 'collab'
    )
  );

drop policy if exists "Owners delete collaboration drafts" on public.asset_collaboration_drafts;
create policy "Owners delete collaboration drafts"
  on public.asset_collaboration_drafts for delete
  to authenticated
  using (owner_id = (select auth.uid())::text);

revoke all on table public.asset_collaboration_drafts from anon;
grant select, insert, update, delete on table public.asset_collaboration_drafts to authenticated;

create or replace function public.validate_asset_collaboration_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_owner text;
  target_category text;
  target_deleted_at timestamptz;
begin
  if new.category = 'collab' then
    new.collaboration_asset_id := null;
    return new;
  end if;

  if new.collaboration_asset_id is null then
    return new;
  end if;

  select user_id, category, deleted_at
    into target_owner, target_category, target_deleted_at
  from public.assets
  where id = new.collaboration_asset_id;

  if target_owner is distinct from new.user_id
    or target_category is distinct from 'collab'
    or target_deleted_at is not null then
    raise exception 'Invalid Collaboration link' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_asset_collaboration_link on public.assets;
create trigger validate_asset_collaboration_link
before insert or update of category, collaboration_asset_id, user_id
on public.assets
for each row execute function public.validate_asset_collaboration_link();

-- The public assets projection is intentionally limited to the whitelisted
-- public_collaboration snapshot. Contact details never enter that column.
