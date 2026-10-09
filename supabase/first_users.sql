-- Run after creating each user in Supabase: Authentication > Users > Add user.
-- Replace the email, name, staff number, role and divisions, then run once per person.
-- Roles: operator, supervisor, manager, maintenance, admin, auditor
insert into profiles (id, name, staff_number, role, divisions, station)
select id, 'Full Name', '12345', 'admin', '{maintenance,towing,ramp}', 'JNB'
from auth.users where email = 'name@airlink.co.za';

-- Add assets (one row per piece of equipment). asset_type_id must be one of:
-- gpu, asu, hyd-cart, tow-tractor, towbar, belt-loader, pax-steps, dolly, high-loader
insert into assets (fleet_number, asset_type_id, station, description) values
  ('GPU-101', 'gpu', 'JNB', ''),
  ('TB-E190', 'towbar', 'CPT', '');
