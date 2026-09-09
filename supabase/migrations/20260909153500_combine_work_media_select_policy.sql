drop policy if exists "Public media manifest is readable" on public.asset_media;
drop policy if exists "Owners read their media manifest" on public.asset_media;
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
