-- Link pre-use inspection app: core schema.
-- Inspections are immutable once submitted; asset status is derived from open defects.

create type division as enum ('maintenance', 'towing', 'ramp');
create type user_role as enum ('operator', 'supervisor', 'manager', 'maintenance', 'admin', 'auditor');
create type asset_status as enum ('serviceable', 'serviceable_with_defects', 'locked_out', 'out_of_service');
create type inspection_outcome as enum ('serviceable', 'serviceable_with_defects', 'unserviceable');
create type defect_status as enum ('open', 'deferred', 'in_work', 'closed');

create table stations (
  code text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_km double precision not null
);

insert into stations values
  ('JNB', 'O.R. Tambo International', -26.1337, 28.242, 6),
  ('CPT', 'Cape Town International', -33.9696, 18.5972, 5);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  staff_number text not null unique,
  role user_role not null default 'operator',
  divisions division[] not null default '{}',
  station text references stations,
  active boolean not null default true
);

create table asset_types (
  id text primary key,
  name text not null,
  division division not null
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  fleet_number text not null unique,
  asset_type_id text not null references asset_types,
  station text not null references stations,
  description text not null default '',
  out_of_service boolean not null default false,
  status asset_status not null default 'serviceable',
  last_inspected_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Checklist items live in jsonb so administrators edit them without a release.
-- A new version is a new row; inspections point at the exact version used.
create table checklist_templates (
  id text not null,
  version int not null,
  asset_type_id text not null references asset_types,
  items jsonb not null,
  published boolean not null default false,
  published_by uuid references profiles,
  published_at timestamptz,
  primary key (id, version)
);

create table inspections (
  id uuid primary key,
  asset_id uuid not null references assets,
  template_id text not null,
  template_version int not null,
  user_id uuid not null references profiles,
  station text references stations,
  outside_geofence boolean generated always as (station is null) stored,
  latitude double precision,
  longitude double precision,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  meter_reading numeric,
  outcome inspection_outcome not null,
  -- [{itemId, result, readingValue, comment, naReason, photoPaths[]}]
  results jsonb not null,
  signature text not null,
  device_id text,
  received_at timestamptz not null default now(),
  foreign key (template_id, template_version) references checklist_templates (id, version)
);

create index inspections_asset_day on inspections (asset_id, submitted_at desc);

-- Lets every device see whether today's daily inspection is done, whoever did it.
create function inspections_touch_asset() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update assets set last_inspected_at = greatest(coalesce(last_inspected_at, new.submitted_at), new.submitted_at), updated_at = now()
    where id = new.asset_id;
  return new;
end $$;

create trigger inspections_after_insert after insert on inspections
  for each row execute function inspections_touch_asset();

create table defects (
  id uuid primary key,
  asset_id uuid not null references assets,
  inspection_id uuid not null references inspections,
  item_id text not null,
  item_text text not null,
  critical boolean not null,
  description text not null,
  status defect_status not null default 'open',
  raised_by uuid not null references profiles,
  raised_at timestamptz not null,
  photo_paths text[] not null default '{}',
  cleared_by uuid references profiles,
  cleared_at timestamptz,
  clearance_note text,
  trax_exported_at timestamptz
);

create index defects_open on defects (asset_id) where status <> 'closed';

-- Asset status follows its open defects: any open critical defect locks the asset out.
create function recompute_asset_status(p_asset uuid) returns void
language sql security definer set search_path = public as $$
  update assets a set
    status = case
      when a.out_of_service then 'out_of_service'::asset_status
      when exists (select 1 from defects d where d.asset_id = a.id and d.status <> 'closed' and d.critical) then 'locked_out'
      when exists (select 1 from defects d where d.asset_id = a.id and d.status <> 'closed') then 'serviceable_with_defects'
      else 'serviceable'
    end,
    updated_at = now()
  where a.id = p_asset;
$$;

create function defects_status_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_asset_status(new.asset_id);
  return new;
end $$;

-- Take the critical flag from the template version the inspection used, not from the device.
create function defects_set_critical() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce((item->>'critical')::boolean, false) into new.critical
  from inspections i
  join checklist_templates t on t.id = i.template_id and t.version = i.template_version,
  jsonb_array_elements(t.items) item
  where i.id = new.inspection_id and item->>'id' = new.item_id;
  if not found then raise exception 'Defect item % is not on the inspection checklist', new.item_id; end if;
  return new;
end $$;

create trigger defects_before_insert before insert on defects
  for each row execute function defects_set_critical();

create trigger defects_after_change after insert or update on defects
  for each row execute function defects_status_trigger();

create function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

-- Clearing a defect. Only a manager may clear a critical defect (which returns the asset to service).
create function clear_defect(p_defect uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare d defects;
begin
  select * into d from defects where id = p_defect for update;
  if not found then raise exception 'Defect not found'; end if;
  if d.critical and my_role() is distinct from 'manager' then
    raise exception 'Only a manager can clear a critical defect';
  end if;
  if not d.critical and my_role() not in ('manager', 'supervisor', 'maintenance') then
    raise exception 'Not permitted to clear defects';
  end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'A clearance note is required'; end if;
  update defects set status = 'closed', cleared_by = auth.uid(), cleared_at = now(), clearance_note = p_note
    where id = p_defect;
end $$;

-- Row-level security
alter table stations enable row level security;
alter table profiles enable row level security;
alter table asset_types enable row level security;
alter table assets enable row level security;
alter table checklist_templates enable row level security;
alter table inspections enable row level security;
alter table defects enable row level security;

create policy read_stations on stations for select to authenticated using (true);
create policy read_asset_types on asset_types for select to authenticated using (true);
create policy read_assets on assets for select to authenticated using (true);
create policy read_templates on checklist_templates for select to authenticated using (published or my_role() = 'admin');
create policy read_profiles on profiles for select to authenticated using (true);

create policy admin_assets on assets for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_asset_types on asset_types for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_templates on checklist_templates for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_profiles on profiles for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');

-- Inspections: insert your own, never update or delete.
create policy insert_own_inspection on inspections for insert to authenticated
  with check (user_id = auth.uid() and my_role() in ('operator', 'supervisor', 'manager', 'maintenance', 'admin'));
create policy read_inspections on inspections for select to authenticated
  using (user_id = auth.uid() or my_role() in ('supervisor', 'manager', 'maintenance', 'admin', 'auditor'));

-- Defects: raised by the inspector with their inspection; cleared only through clear_defect().
create policy insert_own_defect on defects for insert to authenticated
  with check (raised_by = auth.uid() and status = 'open');
create policy read_defects on defects for select to authenticated using (true);
-- The only column clients may update directly is the TRAX export stamp.
revoke update on defects from authenticated;
grant update (trax_exported_at) on defects to authenticated;
create policy mark_exported on defects for update to authenticated
  using (my_role() in ('manager', 'maintenance', 'admin'))
  with check (my_role() in ('manager', 'maintenance', 'admin'));

-- Photo storage: private bucket, path = <inspection id>/<item id>/<n>.jpg
insert into storage.buckets (id, name, public) values ('inspection-photos', 'inspection-photos', false);
create policy upload_photos on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos');
create policy read_photos on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos');
