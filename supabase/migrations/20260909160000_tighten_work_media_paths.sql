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
