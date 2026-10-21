import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{try{
if(req.method!=='POST')return json({error:'Method not allowed'},405);
const secret=req.headers.get('x-formflow-key')||'';
if(secret.length!==64)return json({error:'Unauthorized'},401);
const conf=await db.from('formflow_gateway_config').select('hash').eq('id','gateway').single();
if(conf.error||await sha(secret)!==conf.data.hash)return json({error:'Unauthorized'},401);
if(Number(req.headers.get('content-length')||0)>12000000)return json({error:'Request too large'},413);
const b=await req.json();
if(b.op==='db'){const {data,error}=await db.rpc('formflow_query_batch',{statements:b.statements});if(error)throw error;return json({data})}
if(b.op==='invite'){
if(typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email))return json({error:'Invalid email'},400);
const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const {error}=await db.from('formflow_access_invites').insert({id:await sha(token),email:b.email.toLowerCase(),expires:new Date(Date.now()+3600000).toISOString()});if(error)throw error;
return json({token,expires_in:3600})}
if(b.op==='activate'){
if(typeof b.token!=='string'||b.token.length!==64||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return json({error:'Use uma senha de 12 a 128 caracteres.'},400);
const claim=await db.rpc('formflow_consume_invite',{token_hash:await sha(b.token)});if(claim.error||!claim.data?.email)return json({error:'Convite expirado ou utilizado. Gere outro no painel original.'},400);
const email=claim.data.email;let user:any=null;
for(let page=1;page<=100;page++){const list=await db.auth.admin.listUsers({page,perPage:1000});if(list.error)throw list.error;user=list.data.users.find(u=>u.email?.toLowerCase()===email);if(user||list.data.users.length<1000)break}
const result=user?await db.auth.admin.updateUserById(user.id,{password:b.password}):await db.auth.admin.createUser({email,password:b.password,email_confirm:true});if(result.error)throw result.error;
return json({ok:true,email})}
if(b.op==='storage'){
if(typeof b.key!=='string'||!/^[-a-zA-Z0-9_/.]{1,250}$/.test(b.key)||b.key.includes('..'))return json({error:'Invalid path'},400);
const bucket=db.storage.from('formflow-private');
if(b.action==='put'){const bytes=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));const {error}=await bucket.upload(b.key,bytes,{upsert:true,contentType:b.contentType||'application/octet-stream'});if(error)throw error;return json({ok:true})}
if(b.action==='get'){const {data,error}=await bucket.download(b.key);if(error){if((error as any).statusCode==='404')return json({missing:true});throw error}const bytes=new Uint8Array(await data.arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return json({data:btoa(out)})}
if(b.action==='delete'){const {error}=await bucket.remove([b.key]);if(error)throw error;return json({ok:true})}}
return json({error:'Unsupported operation'},400)
}catch(e){console.error('FormFlow gateway operation failed',String((e as any)?.code||'gateway_error'));return json({error:'Falha no serviço de dados.'},500)}});
