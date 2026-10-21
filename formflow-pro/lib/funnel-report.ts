import {getDb} from '../db';import {sessions,records} from '../db/schema';import {eq,and,gte,lte,asc} from 'drizzle-orm';import {aggregateFunnel} from './funnel';
export async function funnelReport(owner:string,p:any={}){
const days=Math.min(366,Math.max(1,Number(p.days)||30)),until=p.until?new Date(p.until).toISOString():new Date().toISOString(),since=p.since?new Date(p.since).toISOString():new Date(Date.parse(until)-days*86400000).toISOString();
if(Date.parse(since)>Date.parse(until)||Date.parse(until)-Date.parse(since)>366*86400000)throw Error('Escolha um período de até 366 dias.');
const db=getDb();const flows:any[]=[],events:any[]=[];let limited=false;
for(let offset=0;offset<=100000;offset+=1000){const page=await db.select().from(sessions).where(and(eq(sessions.owner,owner),gte(sessions.created,since),lte(sessions.created,until),p.form_id?eq(sessions.form,p.form_id):undefined)).orderBy(asc(sessions.id)).limit(1000).offset(offset);if(offset===100000){limited=page.length>0;break}flows.push(...page);if(page.length<1000)break}
for(let offset=0;offset<=100000;offset+=1000){const page=await db.select().from(records).where(and(eq(records.owner,owner),eq(records.kind,'event'),gte(records.created,since),p.form_id?eq(records.parent,p.form_id):undefined)).orderBy(asc(records.id)).limit(1000).offset(offset);if(offset===100000){limited=page.length>0||limited;break}events.push(...page);if(page.length<1000)break}
const forms=(await db.select().from(records).where(and(eq(records.owner,owner),eq(records.kind,'form')))).map(r=>JSON.parse(r.data));
const filtered=flows.filter(s=>{let source:any={};try{source=JSON.parse(s.source)}catch{}return (!p.source||source.utm_source===p.source)&&(!p.campaign||source.utm_campaign===p.campaign)&&(!p.device||s.device===p.device)});
return {...aggregateFunnel(filtered,events,forms),period:{since,until},limited,limit:100000,methodology:{abandonmentMinutes:30,unit:'sessões únicas',blocked:'Regra de desqualificação; motivos declarados antes do envio e verificados no envio.',legacy:'Sessões antigas não possuem motivos nem avanços detalhados. Nenhum motivo é estimado.'}};
}
