import {readSecrets,readWorkspace} from '../../../lib/workspace';
import {access} from '../../../lib/access';import {jobs,records} from '../../../db/schema';import {getDb} from '../../../db';
import {eq,and,desc,like} from 'drizzle-orm';import {processJobs,jobPayload} from '../../../lib/outbox';import {sameOrigin,limit} from '../../../lib/rate';import {env} from '../../../lib/platform';
import {integrationStatus} from '../../../lib/integration-status';
import type {Form} from '../../model';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
function current(data:string){const draft=JSON.parse(data);const form:Form=draft.published?(draft.live||draft):draft;form.published=!!draft.published;form.lifecycle=draft.lifecycle;if(form.id===(env as any).DEFAULT_META_FORM_ID&&!Object.hasOwn(form,'pixel'))form.pixel=(env as any).DEFAULT_META_PIXEL_ID||'';return {draft,form}}
export async function GET(req:Request){
  try{
    const a=await access();if(!a)return new Response('Unauthorized',{status:401});
    const credentials=await readSecrets(a.owner),flags={capi:!!credentials.META_CAPI_TOKEN,email:!!credentials.RESEND_API_KEY&&!!credentials.NOTIFY_FROM,captcha:!!credentials.TURNSTILE_SECRET,webhookSignature:!!credentials.WEBHOOK_SIGNING_SECRET};
    if(a.role==='Atendente')return Response.json({...flags,forms:[],deliveries:[]},{headers});
    const formId=new URL(req.url).searchParams.get('formId')||'';
    const db=getDb(),workspace=await readWorkspace(a.owner);
    const [formRows,deliveries]=await Promise.all([
      db.select().from(records).where(and(eq(records.owner,a.owner),eq(records.kind,'form'),formId?eq(records.id,formId):undefined)).orderBy(desc(records.created)).limit(500),
      db.select({id:jobs.id,lead:jobs.lead,provider:jobs.provider,state:jobs.state,attempts:jobs.attempts,status:jobs.status,error:jobs.error,created:jobs.created,next:jobs.next}).from(jobs).where(and(eq(jobs.owner,a.owner),formId?like(jobs.lead,formId+':%'):undefined)).orderBy(desc(jobs.created)).limit(100)
    ]);
    const forms=formRows.map(r=>current(r.data)).filter(x=>x.draft.lifecycle!=='archived').map(({form,draft})=>({id:form.id,name:form.name,published:!!draft.published,revision:draft.revision||0,source:draft.published?'Versão publicada':'Rascunho salvo',checks:integrationStatus(form,credentials,workspace.metaTestEventCode||'').map(c=>({...c,lastDelivery:deliveries.find(d=>d.provider===c.provider&&d.lead.startsWith(form.id+':'))||null}))}));
    if(formId&&!forms.length)return Response.json({error:'Formulário não encontrado.'},{status:404,headers});
    return Response.json({...flags,forms,deliveries},{headers});
  }catch{return Response.json({error:'Não foi possível verificar as integrações.'},{status:500,headers})}
}
export async function POST(req:Request){
  try{
    const a=await access();if(!a||a.role==='Atendente'||!sameOrigin(req))return new Response('Forbidden',{status:403});
    const b=await req.json() as any,db=getDb();
    if(b.action==='test'){
      if(!await limit(req,'integration-test',6))return Response.json({error:'Aguarde um minuto antes de enviar mais testes.'},{status:429});
      if(typeof b.formId!=='string'||!['Webhook','E-mail','Meta CAPI'].includes(b.provider))return new Response('Teste inválido',{status:400});
      const [row]=await db.select().from(records).where(and(eq(records.id,b.formId),eq(records.owner,a.owner),eq(records.kind,'form'))).limit(1);
      if(!row)return new Response('Formulário não encontrado',{status:404});
      const {form,draft}=current(row.data);if(draft.lifecycle==='archived')return new Response('Formulário excluído',{status:410});
      const [credentials,workspace]=await Promise.all([readSecrets(a.owner),readWorkspace(a.owner)]);
      const check=integrationStatus(form,credentials,workspace.metaTestEventCode||'').find(c=>c.provider===b.provider);
      if(!check?.testable)return Response.json({error:check?.detail||'Complete a configuração antes de testar.'},{status:422});
      const id='test:'+crypto.randomUUID(),now=new Date().toISOString();let payload:any;
      if(b.provider==='Webhook')payload={url:form.webhook,body:{event:'integration.test',test:true,id,formId:form.id,createdAt:now},test:true};
      else if(b.provider==='E-mail')payload={to:form.notifyEmail,formName:form.name,status:'Teste',test:true};
      else{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id));payload={pixel:form.pixel,body:{test_event_code:workspace.metaTestEventCode,data:[{event_name:'Lead',event_id:id,event_time:Math.floor(Date.now()/1000),action_source:'website',event_source_url:new URL('/f/'+encodeURIComponent(form.id),req.url).href,user_data:{external_id:[Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')]},custom_data:{form_id:form.id,test:true}}]},test:true}}
      await db.insert(jobs).values({id,owner:a.owner,lead:form.id+':'+id,provider:b.provider,payload:await jobPayload(payload),created:now});
      await processJobs(a.owner,{jobId:id});
      const [delivery]=await db.select({id:jobs.id,state:jobs.state,status:jobs.status,error:jobs.error}).from(jobs).where(and(eq(jobs.id,id),eq(jobs.owner,a.owner))).limit(1);
      return Response.json({ok:delivery?.state==='sent',delivery,message:delivery?.state==='sent'?'O provedor confirmou o recebimento do teste.':delivery?.error||'Teste agendado. Consulte o histórico de entregas.'},{headers});
    }
    if(b.id){
      const [job]=await db.select().from(jobs).where(and(eq(jobs.id,String(b.id)),eq(jobs.owner,a.owner))).limit(1);
      if(!job)return new Response('Entrega não encontrada',{status:404});
      if(job.state==='sent')return Response.json({error:'Esta entrega já foi confirmada. Nenhum reenvio foi realizado.'},{status:409});
      if(job.state==='processing'&&job.next>Date.now())return Response.json({error:'A entrega já está em processamento.'},{status:409});
      const changed=await db.update(jobs).set({state:'pending',attempts:0,next:0,error:''}).where(and(eq(jobs.id,job.id),eq(jobs.owner,a.owner),eq(jobs.state,job.state),eq(jobs.attempts,job.attempts),eq(jobs.next,job.next))).returning({id:jobs.id});
      if(!changed.length)return Response.json({error:'A entrega mudou. Atualize o histórico.'},{status:409});
      await processJobs(a.owner,{jobId:job.id});
    }else await processJobs(a.owner);
    return Response.json({ok:true,message:'Histórico de entregas atualizado.'},{headers});
  }catch{return Response.json({error:'Não foi possível processar a integração. Revise a configuração e tente novamente.'},{status:500,headers})}
}
