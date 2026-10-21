-- Preserve the restricted owner, search path and existing RPC access.
create or replace function formflow.query_batch(statements jsonb) returns jsonb language plpgsql security definer set search_path=formflow,pg_catalog set statement_timeout='8s' as $$
declare st jsonb; q text; arg jsonb; value text; p integer; prior bigint:=0; changed bigint; r record; remaining text; compiled text; vals jsonb; cols jsonb; rows jsonb; answer jsonb:='[]'; i integer;
begin
if jsonb_array_length(statements)>500 then raise exception 'Batch too large'; end if;
for st in select * from jsonb_array_elements(statements) loop
q:=st->>'query';
if length(q)>100000 or q !~* '^\s*(select|insert|update|delete)\s' or strpos(q,';')>0 then raise exception 'Unsupported statement'; end if;
-- Drizzle's SQLite dialect qualifies conflict columns; PostgreSQL requires bare columns.
-- Normalize the SQL template before binding so parameter values are never rewritten.
q:=regexp_replace(q,'(on\s+conflict\s*\(\s*)"[^"]+"\."([^"]+)"(\s*\))','\1"\2"\3','gi');
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
alter function formflow.query_batch(jsonb) owner to formflow_app;
revoke all on function formflow.query_batch(jsonb) from public,anon,authenticated;
grant execute on function formflow.query_batch(jsonb) to service_role;
