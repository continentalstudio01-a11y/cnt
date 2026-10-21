import {createSupabaseAdapter} from './supabase-adapter';import {encrypt,decrypt} from './privacy';import {secretKeys} from './workspace-validation';
export async function migrateToSupabase(source:any){
const target=createSupabaseAdapter(source),owner=source.APP_OWNER_USER_ID;if(!source.DB||!owner)throw Error('Migration source unavailable');
const mark='migration:sites-to-supabase:v1:'+owner;const existing=await target.DB.prepare('select id from records where id=?').bind(mark).first();if(existing)return;
const tables=['records','flow_sessions','delivery_jobs','workspace_members'];let count=0,objects=0;
for(const table of tables){let offset=0;for(;;){const page=await source.DB.prepare('select * from '+table+' order by id limit 500 offset ?').bind(offset).all();const rows=page.results||[];
for(const raw of rows){if(raw.owner!==owner)continue;const row={...raw};
if(table==='records'&&typeof row.data==='string'&&row.data.startsWith('enc:'))row.data=await encrypt(await decrypt(row.data));
if(table==='delivery_jobs'&&row.payload?.startsWith('enc:'))row.payload=await encrypt(await decrypt(row.payload));
if(table==='records'&&['file','media'].includes(row.kind)){const meta=JSON.parse(row.data),key=row.kind==='media'?'media/'+row.id:row.id;const object=await source.BUCKET.get(key);
if(object){let bytes:any=await object.arrayBuffer();if(row.kind==='file'){let plain=await decrypt(new TextDecoder().decode(bytes));
if(meta.purpose==='backup'){try{const json=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(plain),c=>c.charCodeAt(0))));if(Array.isArray(json.records)){for(const entry of json.records)if(entry.data?.startsWith('enc:'))entry.data=await encrypt(await decrypt(entry.data));const out=new TextEncoder().encode(JSON.stringify(json));let text='';for(let i=0;i<out.length;i+=8192)text+=String.fromCharCode(...out.subarray(i,i+8192));plain=btoa(text)}}catch{throw Error('Unable to migrate encrypted backup')}}
bytes=await encrypt(plain)}await target.BUCKET.put(key,bytes,{httpMetadata:{contentType:meta.type||'application/octet-stream'}});objects++}}
const columns=Object.keys(row);await target.DB.prepare('insert into '+table+' ('+columns.map(c=>'"'+c+'"').join(',')+') values ('+columns.map(()=>'?').join(',')+') on conflict(id) do nothing').bind(...columns.map(k=>row[k])).run();count++}
offset+=rows.length;if(rows.length<500)break}}
const secretsRow=await source.DB.prepare("select data from records where owner=? and kind='workspace_secrets' limit 1").bind(owner).first();const stored=secretsRow?JSON.parse(await decrypt(secretsRow.data)):{};
const secrets=Object.fromEntries(secretKeys.map(k=>[k,Object.hasOwn(stored,k)?stored[k]:String(source[k]||'')]));
const now=new Date().toISOString();await target.DB.prepare("insert into records(id,owner,kind,parent,data,created) values(?,?,'workspace_secrets','',?,?) on conflict(id) do update set data=excluded.data").bind('workspace-secrets:'+owner,owner,await encrypt(JSON.stringify(secrets)),now).run();
await target.DB.prepare("insert into records(id,owner,kind,parent,data,created) values(?,?,'workspace_owner','',?,?) on conflict(id) do nothing").bind('workspace-owner:'+owner,owner,JSON.stringify({email:source.APP_OWNER_EMAIL}),now).run();
await target.DB.prepare("insert into records(id,owner,kind,parent,data,created) values(?,?,'migration_state','',?,?) on conflict(id) do nothing").bind(mark,owner,JSON.stringify({completedAt:now,records:count,objects,version:1}),now).run();
}
