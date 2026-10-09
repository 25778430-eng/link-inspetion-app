-- Security hardening after the first review (2026-10-09).
-- 1. Only people with an active profile can read anything. A stray sign-up sees nothing.
-- 2. Staff details are visible to the person themselves and to supervisors and above, not to every user.
-- 3. The server checks the inspection outcome against the checklist, and raises the defects itself,
--    so a critical fail locks the asset out even if a device never uploads its defects.
-- 4. Inspection photos are readable only by people who can read that inspection.

-- 1 and 2 ------------------------------------------------------------------
drop policy if exists read_stations on stations;
drop policy if exists read_asset_types on asset_types;
drop policy if exists read_assets on assets;
drop policy if exists read_templates on checklist_templates;
drop policy if exists read_profiles on profiles;
drop policy if exists read_defects on defects;

create policy read_stations on stations for select to authenticated using (my_role() is not null);
create policy read_asset_types on asset_types for select to authenticated using (my_role() is not null);
create policy read_assets on assets for select to authenticated using (my_role() is not null);
create policy read_templates on checklist_templates for select to authenticated
  using ((published and my_role() is not null) or my_role() = 'admin');
create policy read_defects on defects for select to authenticated using (my_role() is not null);
create policy read_profiles on profiles for select to authenticated
  using (id = auth.uid() or my_role() in ('supervisor', 'manager', 'maintenance', 'admin', 'auditor'));

-- 3 ------------------------------------------------------------------------
-- One defect per failed item per inspection.
create unique index if not exists defects_one_per_item on defects (inspection_id, item_id);
alter table defects add column if not exists raised_by_server boolean not null default false;

create or replace function inspections_check_and_raise() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tpl_items jsonb;
  crit_fail boolean := false;
  any_fail boolean := false;
  missing int;
  r jsonb;
  item jsonb;
begin
  select items into tpl_items from checklist_templates
    where id = new.template_id and version = new.template_version;
  if tpl_items is null then raise exception 'Unknown checklist %/%', new.template_id, new.template_version; end if;

  -- Every checklist item needs a result.
  select count(*) into missing from jsonb_array_elements(tpl_items) t
    where not exists (
      select 1 from jsonb_array_elements(new.results) x
      where x->>'itemId' = t->>'id' and x->>'result' in ('pass', 'fail', 'na'));
  if missing > 0 then raise exception 'Inspection is missing % checklist results', missing; end if;

  for r in select * from jsonb_array_elements(new.results) loop
    if r->>'result' = 'fail' then
      select t into item from jsonb_array_elements(tpl_items) t where t->>'id' = r->>'itemId';
      if item is null then raise exception 'Result for unknown item %', r->>'itemId'; end if;
      any_fail := true;
      crit_fail := crit_fail or coalesce((item->>'critical')::boolean, false);
    end if;
  end loop;

  if crit_fail and new.outcome <> 'unserviceable' then
    raise exception 'A critical item failed, so the outcome must be unserviceable';
  end if;
  if any_fail and new.outcome = 'serviceable' then
    raise exception 'An item failed, so the outcome cannot be serviceable';
  end if;
  return new;
end $$;

drop trigger if exists inspections_before_insert on inspections;
create trigger inspections_before_insert before insert on inspections
  for each row execute function inspections_check_and_raise();

-- After the inspection is stored, raise a defect for every failed item.
-- The device usually uploads its own defect a moment later; that one then replaces this one.
create or replace function inspections_raise_defects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into defects (id, asset_id, inspection_id, item_id, item_text, critical, description,
                       raised_by, raised_at, photo_paths, raised_by_server)
  select gen_random_uuid(), new.asset_id, new.id, r->>'itemId', coalesce(t->>'text', r->>'itemId'), false,
         coalesce(nullif(trim(r->>'comment'), ''), 'Failed at inspection'),
         new.user_id, new.submitted_at,
         coalesce(array(select jsonb_array_elements_text(r->'photoPaths')), '{}'), true
  from jsonb_array_elements(new.results) r
  join checklist_templates ct on ct.id = new.template_id and ct.version = new.template_version
  cross join lateral jsonb_array_elements(ct.items) t
  where r->>'result' = 'fail' and t->>'id' = r->>'itemId'
  on conflict (inspection_id, item_id) do nothing;
  return new;
end $$;

drop trigger if exists inspections_after_insert_defects on inspections;
create trigger inspections_after_insert_defects after insert on inspections
  for each row execute function inspections_raise_defects();

-- When the device's own copy of a defect arrives, it replaces the server's placeholder
-- (same item, same inspection) so both sides keep the device's id. A placeholder that a
-- manager has already cleared is kept, and the late copy is dropped.
create or replace function defects_replace_placeholder() returns trigger
language plpgsql security definer set search_path = public as $$
declare existing defects;
begin
  if new.raised_by_server then return new; end if;
  select * into existing from defects where inspection_id = new.inspection_id and item_id = new.item_id;
  if not found then return new; end if;
  if existing.raised_by_server and existing.status <> 'closed' then
    delete from defects where id = existing.id;
    return new;
  end if;
  return null;  -- already have this defect; skip silently
end $$;

drop trigger if exists defects_before_insert_replace on defects;
create trigger defects_before_insert_replace before insert on defects
  for each row execute function defects_replace_placeholder();
-- Fires after defects_before_insert (triggers fire in name order), which sets the critical flag.

-- 4 ------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists read_photos on storage.objects';
    execute $p$create policy read_photos on storage.objects for select to authenticated
      using (bucket_id = 'inspection-photos' and exists (
        select 1 from public.inspections i where i.id::text = split_part(name, '/', 1)))$p$;
    execute 'drop policy if exists upload_photos on storage.objects';
    execute $p$create policy upload_photos on storage.objects for insert to authenticated
      with check (bucket_id = 'inspection-photos' and public.my_role() is not null)$p$;
  end if;
end $$;
