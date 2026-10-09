\set ON_ERROR_STOP 0
grant usage on schema public, auth to authenticated; grant select, insert on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;
revoke update on defects from authenticated; grant update (trax_exported_at) on defects to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000009');
insert into profiles values ('00000000-0000-0000-0000-000000000001','Op','1','operator','{towing}','JNB',true),
 ('00000000-0000-0000-0000-000000000002','Sup','2','supervisor','{towing}','JNB',true);
insert into asset_types values ('towbar','Towbar','towing');
insert into assets (id, fleet_number, asset_type_id, station) values ('10000000-0000-0000-0000-000000000001','TB-01','towbar','JNB');
insert into checklist_templates values ('tpl-towbar',1,'towbar','[{"id":"tb-1","text":"Shear pins","critical":true},{"id":"tb-5","text":"Wheels","critical":false}]',true,null,now());
set role authenticated;
-- A signed-in account with no profile sees nothing
set request.jwt.sub = '00000000-0000-0000-0000-000000000009';
select 'stray user sees assets/profiles', (select count(*) from assets), (select count(*) from profiles);
-- An operator sees only their own profile; a supervisor sees everyone
set request.jwt.sub = '00000000-0000-0000-0000-000000000001';
select 'operator sees profiles', count(*) from profiles;
-- Missing results rejected
insert into inspections (id, asset_id, template_id, template_version, user_id, station, started_at, submitted_at, outcome, results, signature)
 values ('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','tpl-towbar',1,'00000000-0000-0000-0000-000000000001','JNB',now(),now(),'serviceable','[]','sig');
-- Critical fail claimed as serviceable: rejected
insert into inspections (id, asset_id, template_id, template_version, user_id, station, started_at, submitted_at, outcome, results, signature)
 values ('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','tpl-towbar',1,'00000000-0000-0000-0000-000000000001','JNB',now(),now(),'serviceable',
 '[{"itemId":"tb-1","result":"fail","comment":"Sheared"},{"itemId":"tb-5","result":"pass"}]','sig');
-- Honest critical fail, device never uploads its defect: asset still locks out
insert into inspections (id, asset_id, template_id, template_version, user_id, station, started_at, submitted_at, outcome, results, signature)
 values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','tpl-towbar',1,'00000000-0000-0000-0000-000000000001','JNB',now(),now(),'unserviceable',
 '[{"itemId":"tb-1","result":"fail","comment":"Sheared","photoPaths":["x/tb-1/1.jpg"]},{"itemId":"tb-5","result":"pass"}]','sig');
select 'after inspection only', status from assets;
select 'server defect', critical, raised_by_server, description, photo_paths from defects;
-- Device's own defect arrives: replaces the placeholder, keeps device id
insert into defects (id, asset_id, inspection_id, item_id, item_text, critical, description, raised_by, raised_at)
 values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','tb-1','Shear pins',false,'Sheared pin','00000000-0000-0000-0000-000000000001',now());
select 'after device defect', id, critical, raised_by_server from defects;
select 'still locked', status from assets;
-- Uploading the same defect again (retry) is a no-op
insert into defects (id, asset_id, inspection_id, item_id, item_text, critical, description, raised_by, raised_at)
 values ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','tb-1','Shear pins',false,'dup','00000000-0000-0000-0000-000000000001',now());
select 'defect count', count(*) from defects;
set request.jwt.sub = '00000000-0000-0000-0000-000000000002';
select 'supervisor sees profiles', count(*) from profiles;
