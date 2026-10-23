import {access} from '../../../lib/access';
import {getDb} from '../../../db';
import {records} from '../../../db/schema';
import {and,eq,gt,lt,or,desc,count,inArray} from 'drizzle-orm';
import {decrypt} from '../../../lib/privacy';
import {sameOrigin} from '../../../lib/rate';

const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  try{
    const a=await access();if(!a)return Response.json({error:'Entre com uma conta autorizada.'},{status:401});
    const db=getDb(),key='notifications:'+a.owner+':'+a.user.userId;
    const [read]=await db.select().from(records).where(and(eq(records.id,key),eq(records.owner,a.owner),eq(records.kind,'notification_state'))).limit(1);
    const base=and(eq(records.owner,a.owner),eq(records.kind,'lead'));
    const unread=read?or(gt(records.created,read.created),and(eq(records.created,read.created),gt(records.id,read.parent))):undefined;
    const [latest,totals]=await Promise.all([
      db.select().from(records).where(base).orderBy(desc(records.created),desc(records.id)).limit(30),
      db.select({total:count()}).from(records).where(and(base,unread))
    ]);
    const ids=[...new Set(latest.map(l=>l.parent))];
    const forms=ids.length?await db.select({id:records.id,data:records.data}).from(records).where(and(eq(records.owner,a.owner),eq(records.kind,'form'),inArray(records.id,ids))):[];
    const names=new Map(forms.map(f=>{try{return [f.id,JSON.parse(f.data).name]}catch{return [f.id,'Formulário']}}));
    const items=await Promise.all(latest.map(async l=>{
      const data=JSON.parse(await decrypt(l.data));
      return {id:l.id,formId:l.parent,formName:names.get(l.parent)||'Formulário',created:l.created,status:data.status||'Recebido',qualified:!!data.qualified,read:!!read&&(l.created<read.created||(l.created===read.created&&l.id<=read.parent))};
    }));
    return Response.json({items,unreadCount:Number(totals[0]?.total||0),latest:items[0]?{id:items[0].id,created:items[0].created}:null,channel:a.user.userId},{headers});
  }catch{return Response.json({error:'Não foi possível buscar as notificações.'},{status:500,headers})}
}
export async function POST(req:Request){
  try{
    if(!sameOrigin(req))return new Response('Origem inválida',{status:403});
    const a=await access();if(!a)return new Response('Não autorizado',{status:401});
    const body=await req.json() as any;if(typeof body.id!=='string'||body.id.length>250)return Response.json({error:'Notificação inválida.'},{status:400});
    const db=getDb(),[lead]=await db.select().from(records).where(and(eq(records.id,body.id),eq(records.owner,a.owner),eq(records.kind,'lead'))).limit(1);
    if(!lead)return new Response('Notificação não encontrada',{status:404});
    await db.insert(records).values({id:'notifications:'+a.owner+':'+a.user.userId,owner:a.owner,kind:'notification_state',parent:lead.id,created:lead.created,data:'{}'}).onConflictDoUpdate({target:records.id,set:{created:lead.created,parent:lead.id},setWhere:or(lt(records.created,lead.created),and(eq(records.created,lead.created),lt(records.parent,lead.id)))});
    return Response.json({ok:true},{headers});
  }catch{return Response.json({error:'Não foi possível marcar as notificações.'},{status:500,headers})}
}
