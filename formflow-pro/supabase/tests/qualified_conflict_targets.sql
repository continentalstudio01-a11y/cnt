-- The nested subtransaction rolls back every synthetic row.
do $test$
declare r jsonb; i integer; marker text:='regression:qualified-conflict:20261021'; weird text:='literal ? on conflict ("flow_rates"."id")'; denied boolean:=false;
begin
  begin
    for i in 1..9 loop
      r:=public.formflow_query_batch(jsonb_build_array(jsonb_build_object(
        'query','insert into "flow_rates" ("id", "count", "expires") values (?, ?, ?) on conflict ("flow_rates"."id") do update set "count" = "flow_rates"."count"+1 returning "count"',
        'params',jsonb_build_array(marker,1,0))));
      if (r->0->'rows'->0->>0)::integer<>i then raise exception 'Rate increment failed at %',i; end if;
    end loop;
    r:=public.formflow_query_batch(jsonb_build_array(jsonb_build_object(
      'query','insert into "flow_rates" ("id", "count", "expires") values (?, ?, ?) on conflict ("flow_rates"."id") do update set "count" = "flow_rates"."count"+1 returning "id"',
      'params',jsonb_build_array(weird,1,0))));
    if r->0->'rows'->0->>0<>weird then raise exception 'Parameter was rewritten';end if;
    r:=public.formflow_query_batch(jsonb_build_array(
      jsonb_build_object('query','insert into "workspace_members" ("id","owner","email","role","created") values (?,?,?,?,?) on conflict ("workspace_members"."id") do update set "role" = ? returning "role"','params',jsonb_build_array(marker,marker,'test@example.invalid','Atendente','2026-10-21','Atendente')),
      jsonb_build_object('query','insert into "workspace_members" ("id","owner","email","role","created") values (?,?,?,?,?) on conflict ("workspace_members"."id") do update set "role" = ? returning "role"','params',jsonb_build_array(marker,marker,'test@example.invalid','Gestor','2026-10-21','Gestor'))));
    if r->1->'rows'->0->>0<>'Gestor' then raise exception 'Member upsert failed';end if;
    r:=public.formflow_query_batch(jsonb_build_array(
      jsonb_build_object('query','insert into "flow_sessions" ("id","form","owner","state","created","updated") values (?,?,?,?,?,?) on conflict ("flow_sessions"."id") do update set "state" = ? returning "state"','params',jsonb_build_array(marker,marker,marker,'active','2026-10-21','2026-10-21','active')),
      jsonb_build_object('query','insert into "flow_sessions" ("id","form","owner","state","created","updated") values (?,?,?,?,?,?) on conflict ("flow_sessions"."id") do update set "state" = ? returning "state"','params',jsonb_build_array(marker,marker,marker,'completed','2026-10-21','2026-10-21','completed'))));
    if r->1->'rows'->0->>0<>'completed' then raise exception 'Session upsert failed';end if;
    r:=public.formflow_query_batch(jsonb_build_array(
      jsonb_build_object('query','update "flow_rates" set "count" = ? where "id" = ?','params',jsonb_build_array(3,marker)),
      jsonb_build_object('query','select changes() as changed','params','[]'::jsonb)));
    if (r->1->'rows'->0->>0)::integer<>1 then raise exception 'Batch changes broken';end if;
    raise exception using errcode='PZ001',message='Rollback successful regression data';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from formflow.flow_rates where id in(marker,weird)) or exists(select 1 from formflow.workspace_members where id=marker) or exists(select 1 from formflow.flow_sessions where id=marker) then raise exception 'Test data leaked';end if;
  if has_function_privilege('anon','public.formflow_query_batch(jsonb)','execute') or has_function_privilege('authenticated','public.formflow_query_batch(jsonb)','execute') then raise exception 'RPC access widened';end if;
end $test$;
select 'PASS: rate increments, literal parameters, member/session upserts, batch changes, access restrictions; no test data persisted' as result;