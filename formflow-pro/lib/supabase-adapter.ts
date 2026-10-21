export function createSupabaseAdapter(config:Record<string,any>,before?:()=>Promise<void>){
async function gateway(body:unknown){const r=await fetch(config.SUPABASE_URL+'/functions/v1/formflow-gateway',{method:'POST',headers:{'Content-Type':'application/json','x-formflow-key':config.FORMFLOW_GATEWAY_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const v=await r.json() as any;if(!r.ok)throw Error(v.error||'Falha no serviço de dados');return v}
class Statement{
 params:unknown[]=[];constructor(public query:string){}
 bind(...params:unknown[]){const s=new Statement(this.query);s.params=params;return s}
 async result(){return (await execute([this]))[0]}
 async all(){const r=await this.result();return {success:true,results:r.rows.map((row:unknown[])=>Object.fromEntries(r.columns.map((name:string,i:number)=>[name,row[i]]))),meta:{changes:r.changes}}}
 async raw(options?:{columnNames?:boolean}){const r=await this.result();return options?.columnNames?[r.columns,...r.rows]:r.rows}
 async run(){const r=await this.result();return {success:true,results:[],meta:{changes:r.changes}}}
 async first(column?:string){const r=(await this.all()).results[0];return column?r?.[column]??null:r??null}
}
async function execute(ss:Statement[]){if(before)await before();return (await gateway({op:'db',statements:ss.map(s=>({query:s.query,params:s.params}))})).data}
const DB={prepare:(sql:string)=>new Statement(sql),batch:async(ss:Statement[])=>{const rr=await execute(ss);return rr.map((r:any)=>({success:true,results:r.rows.map((row:unknown[])=>Object.fromEntries(r.columns.map((c:string,i:number)=>[c,row[i]]))),meta:{changes:r.changes}}))}};
function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
const BUCKET={
 async put(key:string,data:any,options?:any){let bytes:Uint8Array;if(typeof data==='string')bytes=new TextEncoder().encode(data);else if(data instanceof ArrayBuffer)bytes=new Uint8Array(data);else if(data instanceof ReadableStream)bytes=new Uint8Array(await new Response(data).arrayBuffer());else bytes=new Uint8Array(data);return gateway({op:'storage',action:'put',key,data:base64(bytes),contentType:options?.httpMetadata?.contentType})},
 async get(key:string){const r=await gateway({op:'storage',action:'get',key});if(r.missing)return null;const bytes=Uint8Array.from(atob(r.data),x=>x.charCodeAt(0));return {body:bytes,text:async()=>new TextDecoder().decode(bytes),arrayBuffer:async()=>bytes.buffer}},
 async delete(key:string){return gateway({op:'storage',action:'delete',key})}
};
return {DB,BUCKET};
}
