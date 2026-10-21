import {env as nativeEnv} from 'cloudflare:workers';import {createSupabaseAdapter} from './supabase-adapter';
let bindings:any;let migration:Promise<void>|null=null;
async function ensureMigration(){if((nativeEnv as any).FORMFLOW_PLATFORM==='supabase')return;if(!migration)migration=import('./supabase-migration').then(m=>m.migrateToSupabase(nativeEnv as any)).catch(e=>{migration=null;throw e});await migration}
export const env=new Proxy({} as Cloudflare.Env,{get(_t,k:string){const raw=nativeEnv as any;if(raw.FORMFLOW_DATA_BACKEND==='supabase'&&(k==='DB'||k==='BUCKET')){bindings??=createSupabaseAdapter(raw,ensureMigration);return bindings[k]}return raw[k]}});
