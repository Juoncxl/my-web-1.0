-- Private, RLS-protected media for Composer-created Works.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-media',
  'work-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.asset_media (
  id uuid primary key,
  asset_id text not null references public.assets(id) on delete cascade,
  storage_path text not null unique,
  purpose text not null check (purpose in ('icon', 'gallery', 'prompt_example', 'collab_reference')),
  context_id text,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  natural_width integer check (natural_width is null or natural_width > 0),
  natural_height integer check (natural_height is null or natural_height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_media_asset_id_idx on public.asset_media(asset_id);
create index if not exists asset_media_asset_purpose_order_idx on public.asset_media(asset_id, purpose, sort_order);
create index if not exists asset_media_cover_idx on public.asset_media(asset_id, is_cover);

alter table public.asset_media enable row level security;

revoke all on table public.asset_media from anon, authenticated;
grant select on table public.asset_media to anon, authenticated;
grant insert, update, delete on table public.asset_media to authenticated;

drop policy if exists "Work media manifest is readable" on public.asset_media;
create policy "Work media manifest is readable"
on public.asset_media for select
to anon, authenticated
using (
  exists (
    select 1 from public.assets a
    where a.id = asset_media.asset_id
      and (
        a.user_id = (select auth.uid())::text
        or (a.visibility = 'public' and a.is_public = true and a.deleted_at is null)
      )
  )
);

drop policy if exists "Owners insert their media manifest" on public.asset_media;
create policy "Owners insert their media manifest"
on public.asset_media for insert
to authenticated
with check (
  (storage.foldername(storage_path))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.assets a
    where a.id = asset_media.asset_id
      and a.user_id = (select auth.uid())::text
  )
);

drop policy if exists "Owners update their media manifest" on public.asset_media;
create policy "Owners update their media manifest"
on public.asset_media for update
to authenticated
using (
  exists (select 1 from public.assets a where a.id = asset_media.asset_id and a.user_id = (select auth.uid())::text)
)
with check (
  (storage.foldername(storage_path))[1] = (select auth.uid())::text
  and exists (select 1 from public.assets a where a.id = asset_media.asset_id and a.user_id = (select auth.uid())::text)
);

drop policy if exists "Owners delete their media manifest" on public.asset_media;
create policy "Owners delete their media manifest"
on public.asset_media for delete
to authenticated
using (
  exists (select 1 from public.assets a where a.id = asset_media.asset_id and a.user_id = (select auth.uid())::text)
);

create or replace function public.validate_asset_media_owner()
returns trigger
language plpgsql
security invoker
set search_path = public, storage, pg_temp
as $$
begin
  if (storage.foldername(new.storage_path))[1] is distinct from (select auth.uid())::text then
    raise exception 'asset media path must begin with the authenticated user id' using errcode = '42501';
  end if;
  if (storage.foldername(new.storage_path))[2] is distinct from new.asset_id then
    raise exception 'asset media path must contain its asset id' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.assets a
    where a.id = new.asset_id and a.user_id = (select auth.uid())::text
  ) then
    raise exception 'asset media owner does not match asset owner' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.validate_asset_media_owner() from public, anon, authenticated;

drop trigger if exists validate_asset_media_owner_trigger on public.asset_media;
create trigger validate_asset_media_owner_trigger
before insert or update on public.asset_media
for each row execute function public.validate_asset_media_owner();

drop policy if exists "Work media public or owner read" on storage.objects;
create policy "Work media public or owner read"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'work-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.asset_media m
      join public.assets a on a.id = m.asset_id
      where m.storage_path = name
        and a.visibility = 'public'
        and a.is_public = true
        and a.deleted_at is null
    )
  )
);

drop policy if exists "Work media owner insert" on storage.objects;
create policy "Work media owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'work-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.assets a
    where a.id = (storage.foldername(name))[2]
      and a.user_id = (select auth.uid())::text
  )
);

drop policy if exists "Work media owner update" on storage.objects;
create policy "Work media owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'work-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'work-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Work media owner delete" on storage.objects;
create policy "Work media owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'work-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
