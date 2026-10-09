do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean); create table storage.objects(id serial, bucket_id text);
alter table storage.objects enable row level security;
