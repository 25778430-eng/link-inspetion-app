\set ON_ERROR_STOP 0
grant usage on schema public, auth to authenticated; grant select, insert on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;
-- re-apply the column restriction after the broad grants above (Supabase grants table-wide by default)
revoke update on defects from authenticated; grant update (trax_exported_at) on defects to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into profiles values ('00000000-0000-0000-0000-000000000001','Op','1','operator','{towing}','JNB',true),
 ('00000000-0000-0000-0000-000000000002','Sup','2','supervisor','{towing}','JNB',true),
 ('00000000-0000-0000-0000-000000000003','Mgr','3','manager','{towing}','JNB',true);
insert into asset_types values ('towbar','Towbar','towing');
insert into assets (id, fleet_number, asset_type_id, station) values ('10000000-0000-0000-0000-000000000001','TB-01','towbar','JNB');
insert into checklist_templates values ('tpl-towbar',1,'towbar','[{"id":"tb-1","text":"Shear pins","critical":true},{"id":"tb-5","text":"Wheels","critical":false}]',true,null,now());
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-000000000001';
insert into inspections (id, asset_id, template_id, template_version, user_id, station, started_at, submitted_at, outcome, results, signature)
 values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','tpl-towbar',1,'00000000-0000-0000-0000-000000000001','JNB',now(),now(),'unserviceable','[{"itemId":"tb-1","result":"fail","comment":"Sheared"},{"itemId":"tb-5","result":"pass"}]','sig');
-- device claims not critical; server must correct it
insert into defects (id, asset_id, inspection_id, item_id, item_text, critical, description, raised_by, raised_at)
 values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','tb-1','Shear pins',false,'Sheared','00000000-0000-0000-0000-000000000001',now());
select 'after fail', status from assets;
update defects set status='closed';  -- should be denied
set request.jwt.sub = '00000000-0000-0000-0000-000000000002';
select clear_defect('30000000-0000-0000-0000-000000000001','fixed'); -- supervisor: denied
set request.jwt.sub = '00000000-0000-0000-0000-000000000003';
select clear_defect('30000000-0000-0000-0000-000000000001',''); -- needs note
select clear_defect('30000000-0000-0000-0000-000000000001','New shear pin fitted, WO 123');
select 'after manager clear', status from assets;
update defects set trax_exported_at = now(); select 'exported', count(*) from defects where trax_exported_at is not null;
