create schema if not exists formflow;
do $$ begin if not exists(select 1 from pg_roles where rolname='formflow_app') then create role formflow_app nologin noinherit; end if; end $$;
grant formflow_app to postgres;
create table if not exists formflow.records(id text primary key,owner text not null,kind text not null,parent text not null default '',data text not null,created text not null);
create index if not exists records_owner_kind on formflow.records(owner,kind,created);
create index if not exists records_parent_kind on formflow.records(parent,kind);
create table if not exists formflow.flow_sessions(id text primary key,form text not null,owner text not null,revision integer not null default 0,state text not null default 'active',path text not null default '[]',source text not null default '{}',device text not null default 'Computador',telemetry text not null default '{}',created text not null,updated text not null);
create index if not exists sessions_owner_created on formflow.flow_sessions(owner,created);
create index if not exists sessions_form_updated on formflow.flow_sessions(form,updated);
create table if not exists formflow.delivery_jobs(id text primary key,owner text not null,lead text not null,provider text not null,payload text not null,state text not null default 'pending',attempts integer not null default 0,next_at bigint not null default 0,status_code integer not null default 0,error text not null default '',created text not null);
create index if not exists jobs_due on formflow.delivery_jobs(state,next_at);
create index if not exists jobs_owner on formflow.delivery_jobs(owner,created);
create table if not exists formflow.flow_rates(id text primary key,count integer not null default 1,expires bigint not null);
create index if not exists rates_expiry on formflow.flow_rates(expires);
create table if not exists formflow.workspace_members(id text primary key,owner text not null,email text not null,role text not null,created text not null);
create index if not exists members_owner_email on formflow.workspace_members(owner,email);
grant usage on schema formflow to formflow_app;
grant select,insert,update,delete on all tables in schema formflow to formflow_app;
do $$ declare n text; begin foreach n in array array['records','flow_sessions','delivery_jobs','flow_rates','workspace_members'] loop
execute format('alter table formflow.%I enable row level security',n);
if not exists(select 1 from pg_policies where schemaname='formflow' and tablename=n and policyname='app_backend') then execute format('create policy app_backend on formflow.%I to formflow_app using (true) with check (true)',n);end if;
end loop; end $$;
revoke all on schema formflow from public,anon,authenticated;
create table if not exists public.formflow_gateway_config(id text primary key,hash text not null);
alter table public.formflow_gateway_config enable row level security;
revoke all on public.formflow_gateway_config from anon,authenticated;
create table if not exists public.formflow_access_invites(id text primary key,email text not null,expires timestamptz not null,consumed boolean not null default false);
alter table public.formflow_access_invites enable row level security;
revoke all on public.formflow_access_invites from anon,authenticated;
create or replace function public.formflow_consume_invite(token_hash text) returns jsonb language sql security invoker set search_path='' as $$
with claimed as (update public.formflow_access_invites set consumed=true where id=token_hash and not consumed and expires>now() returning email)
select coalesce((select jsonb_build_object('email',email) from claimed),'{}'::jsonb) $$;
revoke all on function public.formflow_consume_invite(text) from public,anon,authenticated;
grant execute on function public.formflow_consume_invite(text) to service_role;
create or replace function formflow.query_batch(statements jsonb) returns jsonb language plpgsql security definer set search_path=formflow,pg_catalog set statement_timeout='8s' as $$
declare st jsonb; q text; arg jsonb; value text; p integer; prior bigint:=0; changed bigint; r record; remaining text; compiled text; vals jsonb; cols jsonb; rows jsonb; answer jsonb:='[]'; i integer;
begin
if jsonb_array_length(statements)>500 then raise exception 'Batch too large'; end if;
for st in select * from jsonb_array_elements(statements) loop
q:=st->>'query';
if length(q)>100000 or q !~* '^\s*(select|insert|update|delete)\s' or strpos(q,';')>0 then raise exception 'Unsupported statement'; end if;
q:=replace(q,'changes()',prior::text);
if jsonb_array_length(coalesce(st->'params','[]'))>5000 then raise exception 'Too many parameters'; end if;
remaining:=q;compiled:='';
for arg in select * from jsonb_array_elements(coalesce(st->'params','[]')) loop
p:=strpos(remaining,'?');if p=0 then raise exception 'Invalid parameter count'; end if;
value:=case when arg='null'::jsonb then 'NULL' else quote_literal(arg#>>'{}') end;
compiled:=compiled||substr(remaining,1,p-1)||value;remaining:=substr(remaining,p+1);
end loop;
q:=compiled||remaining;
cols:='[]';rows:='[]';changed:=0;
if q ~* '^\s*select\s' or q ~* '\sreturning\s' then
for r in execute q loop
if changed=0 then select jsonb_agg(key) into cols from json_each(row_to_json(r)); end if;
select jsonb_agg(j.value) into vals from json_each(row_to_json(r)) as j;
rows:=rows||jsonb_build_array(vals);changed:=changed+1;
if changed>15000 then raise exception 'Query limit exceeded'; end if;
end loop;
else execute q;get diagnostics changed=row_count;
end if;
prior:=changed;answer:=answer||jsonb_build_array(jsonb_build_object('columns',cols,'rows',rows,'changes',changed));
end loop;return answer;end $$;
grant create on schema formflow to formflow_app;
alter function formflow.query_batch(jsonb) owner to formflow_app;
revoke create on schema formflow from formflow_app;
revoke all on function formflow.query_batch(jsonb) from public;
create or replace function public.formflow_query_batch(statements jsonb) returns jsonb language sql security invoker set search_path='' as $$ select formflow.query_batch(statements) $$;
grant usage on schema formflow to service_role;
grant execute on function formflow.query_batch(jsonb) to service_role;
revoke all on function public.formflow_query_batch(jsonb) from public,anon,authenticated;
grant execute on function public.formflow_query_batch(jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('formflow-private','formflow-private',false,8000000) on conflict(id) do nothing;

do $$ declare n text; begin foreach n in array array['formflow_gateway_config','formflow_access_invites'] loop if not exists(select 1 from pg_policies where schemaname='public' and tablename=n and policyname='no_client_access') then execute format('create policy no_client_access on public.%I to anon,authenticated using(false) with check(false)',n);end if;end loop;end $$;
