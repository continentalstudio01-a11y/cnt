import {env} from '../../../lib/platform';
import {access} from '../../../lib/access';
import {getDb} from '../../../db';
import {records,jobs} from '../../../db/schema';
import {and,eq,inArray} from 'drizzle-orm';
import {readWorkspace,readSecrets,settingsId,secretsId,settingsForRole} from '../../../lib/workspace';
import {workspaceSchema,secretChangesSchema,secretKeys} from '../../../lib/workspace-validation';
import {encrypt,decrypt} from '../../../lib/privacy';
import {sameOrigin} from '../../../lib/rate';
import {formDefaults,type WorkspaceSettings,type DefaultsGroup} from '../../workspace-model';
import {formSchema} from '../../../lib/validation';
import {formErrors} from '../../../lib/flow';

export async function GET(){
  try{
    const a=await access();if(!a)return Response.json({error:'Entre com uma conta autorizada.'},{status:401});
    const settings=await readWorkspace(a.owner);
    const secrets=a.role==='Administrador'?await readSecrets(a.owner):null;
    return Response.json({settings:settingsForRole(settings,a.role),canEdit:a.role==='Administrador',secrets:secrets?Object.fromEntries(secretKeys.map(k=>[k,!!secrets[k]])):{}},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Não foi possível carregar as configurações.'},{status:500})}
}
export async function POST(req:Request){
  try{
    if(!sameOrigin(req))return Response.json({error:'Origem não permitida.'},{status:403});
    const a=await access();if(!a)return Response.json({error:'Entre com uma conta autorizada.'},{status:401});
    if(a.role!=='Administrador')return Response.json({error:'Somente administradores podem alterar as configurações gerais.'},{status:403});
    const raw=await req.text();if(raw.length>180000)return Response.json({error:'Configuração muito grande.'},{status:413});
    const b=JSON.parse(raw),db=getDb(),now=new Date().toISOString();
    if(b.action==='applyDefaults'){
      const validGroups=['appearance','texts','privacy','integrations','scoring'];
      if(!Array.isArray(b.formIds)||!b.formIds.length||b.formIds.length>500||!b.formIds.every((id:unknown)=>typeof id==='string'&&id.length<=100)||!Array.isArray(b.groups)||!b.groups.length||!b.groups.every((g:string)=>validGroups.includes(g)))return Response.json({error:'Escolha formulários e grupos de configuração válidos.'},{status:400});
      const s=await readWorkspace(a.owner);if(b.revision!==s.revision)return Response.json({error:'Os padrões foram alterados. Atualize a página antes de aplicar.'},{status:409});
      const selected=await db.select().from(records).where(and(eq(records.owner,a.owner),eq(records.kind,'form'),inArray(records.id,b.formIds)));
      const saved:string[]=[],conflicts:string[]=[];
      for(const row of selected){
        const old=JSON.parse(row.data),next={...old,...formDefaults(s,b.groups as DefaultsGroup[]),revision:(old.revision||0)+1,live:old.live||(old.published?{...old,live:undefined}:undefined)};
        const parsed=formSchema.safeParse(next);const errors=parsed.success?formErrors(next):['Padrões incompatíveis.'];
        if(errors.length){conflicts.push(old.name);continue}
        const written=await env.DB!.batch([
          env.DB!.prepare('UPDATE records SET data=? WHERE id=? AND owner=? AND data=?').bind(JSON.stringify(next),row.id,a.owner,row.data),
          env.DB!.prepare("INSERT INTO records (id,owner,kind,parent,data,created) SELECT ?,?,'version',?,?,? WHERE changes()>0").bind(crypto.randomUUID(),a.owner,row.id,JSON.stringify({...next,live:undefined}),now),
          env.DB!.prepare("INSERT INTO records (id,owner,kind,parent,data,created) SELECT ?,?,'audit',?,?,? WHERE changes()>0").bind(crypto.randomUUID(),a.owner,row.id,JSON.stringify({action:'Padrões aplicados ao rascunho: '+b.groups.join(', '),user:a.user.email}),now),
        ]);
        if(written[0].meta.changes===1)saved.push(row.id);else conflicts.push(old.name);
      }
      return Response.json({ok:true,saved:saved.length,conflicts,message:'Os links publicados preservam a versão atual. Publique cada rascunho para atualizar o formulário público.'});
    }
    const parsed=workspaceSchema.safeParse(b.settings);
    if(!parsed.success)return Response.json({error:parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).slice(0,4).join(' ')},{status:400});
    const changes=secretChangesSchema.safeParse(b.secrets||{});
    if(!changes.success)return Response.json({error:'As credenciais informadas são inválidas.'},{status:400});
    const value=parsed.data as WorkspaceSettings;
    const prior=await db.select().from(records).where(and(eq(records.id,settingsId(a.owner)),eq(records.owner,a.owner))).limit(1);
    const previous=prior[0]?JSON.parse(prior[0].data):null;
    if(value.revision!==(previous?.revision||0))return Response.json({error:'Outra pessoa alterou as configurações. Recarregue os valores salvos antes de continuar.'},{status:409});
    const secretRows=await db.select().from(records).where(and(eq(records.id,secretsId(a.owner)),eq(records.owner,a.owner))).limit(1);
    const privateData=secretRows[0]?JSON.parse(await decrypt(secretRows[0].data)):{};
    for(const [k,v] of Object.entries(changes.data))privateData[k]=v===null?'':v;
    if(privateData.NOTIFY_FROM&&!/^[^<>\r\n]*<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(privateData.NOTIFY_FROM))return Response.json({error:'Remetente inválido. Use Nome <email@dominio.com> ou email@dominio.com.'},{status:400});
    value.revision++;
    const changed=Object.keys(value).filter(k=>k!=='revision'&&JSON.stringify((value as any)[k])!==JSON.stringify(previous?.[k]));
    const encrypted=await encrypt(JSON.stringify(privateData));
    const written=await env.DB!.batch([
      env.DB!.prepare("INSERT INTO records (id,owner,kind,parent,data,created) VALUES (?,?,'workspace_settings','',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.data=? AND records.owner=?").bind(settingsId(a.owner),a.owner,JSON.stringify(value),now,prior[0]?.data||'',a.owner),
      env.DB!.prepare("INSERT INTO records (id,owner,kind,parent,data,created) SELECT ?,?,'workspace_secrets','',?,? WHERE changes()>0 ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(secretsId(a.owner),a.owner,encrypted,now),
      env.DB!.prepare("INSERT INTO records (id,owner,kind,parent,data,created) SELECT ?,?,'audit','',?,? WHERE changes()>0").bind(crypto.randomUUID(),a.owner,JSON.stringify({action:'Configurações atualizadas',fields:changed,credentials:Object.keys(changes.data),user:a.user.email}),now),
    ]);
    if(written[0].meta.changes!==1)return Response.json({error:'Conflito de edição. Recarregue as configurações.'},{status:409});
    if(Object.keys(changes.data).length)await db.update(jobs).set({next:0,state:'pending'}).where(and(eq(jobs.owner,a.owner),eq(jobs.state,'waiting_config')));
    const secrets=await readSecrets(a.owner);
    return Response.json({ok:true,settings:value,secrets:Object.fromEntries(secretKeys.map(k=>[k,!!secrets[k]]))},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Falha ao salvar as configurações. Os valores não foram confirmados.'},{status:500})}
}
