import type {Form} from '../app/model';
type Telemetry={v:number;reached:string[];answered:string[];advanced:string[];errors:string[];current:string;order:string[];labels:Record<string,string>;stop:null|{ruleId:string;blockId:string;action:string;verified:boolean};final:boolean};
const parse=(v:any)=>{try{return typeof v==='string'?JSON.parse(v):v||{}}catch{return {}}};
export function navigation(form:Form,input:any,previous:any,path:string[],flow:any=null):Telemetry{
const old=parse(previous),b=input&&typeof input==='object'?input:{},ids=new Set(form.blocks.map(x=>x.id));
const list=(a:any)=>Array.isArray(a)?a.filter((x:any)=>typeof x==='string'&&ids.has(x)).slice(0,200):[];
const union=(...parts:any[])=>[...new Set(parts.flatMap(list))];
const reached=union(old.reached,path,b.reached),answered=union(old.answered,b.answered,Object.keys(flow?.answers||{})),advanced=union(old.advanced,b.advanced);
const labels={...old.labels,...Object.fromEntries(form.blocks.filter(x=>reached.includes(x.id)).map(x=>[x.id,x.title.slice(0,300)]))};
let stop=old.stop||null;const s=flow?.stop||b.stop;
if(s&&typeof s.ruleId==='string'&&ids.has(s.blockId)){const rule=(form.rules||[]).find(r=>r.id===s.ruleId);if(rule&&['Desqualificar','Encerrar'].includes(rule.action)&&rule.conditions.some(c=>c.blockId===s.blockId))stop={ruleId:rule.id,blockId:s.blockId,action:rule.action,verified:!!flow}}
if(old.final&&!flow)return {...old,reached,answered,advanced,labels};
return {order:form.blocks.map(b=>b.id),v:1,reached,answered,advanced,errors:union(old.errors,b.errors),current:flow?'__result':ids.has(b.current)||['__intro','__consent','__result'].includes(b.current)?b.current:old.current||path.at(-1)||'__intro',labels,stop,final:!!flow};
}
export function aggregateFunnel(flows:any[],events:any[],forms:any[],now=Date.now()){
const formNames=Object.fromEntries(forms.map(f=>[f.id,f.name])),stepMap=new Map<string,any>(),groups:Record<string,Record<string,any>>={source:{},campaign:{},device:{},form:{}};
let started=0,completed=0,qualified=0,blocked=0,abandoned=0,active=0,legacy=0,verifiedBlocked=0;
const wa=new Set(events.filter(e=>parse(e.data).event==='whatsapp').map(e=>parse(e.data).session));const seenWa=new Set<string>();
for(const s of flows){const t=parse(s.telemetry),source=parse(s.source),path=parse(s.path),isComplete=['completed','disqualified'].includes(s.state),isBlocked=s.state==='disqualified'||t.stop?.action==='Desqualificar',isQualified=s.state==='completed'&&!isBlocked,isAbandoned=!isComplete&&!isBlocked&&!['closed'].includes(s.state)&&now-Date.parse(s.updated)>1800000;
const hasWa=wa.has(s.id);if(hasWa)seenWa.add(s.id);if(s.state!=='viewed')started++;if(isComplete)completed++;if(isQualified)qualified++;if(isBlocked){blocked++;if(t.stop?.verified)verifiedBlocked++}if(isAbandoned)abandoned++;if(!isComplete&&!isBlocked&&!isAbandoned&&s.state!=='closed')active++;if(!t.v)legacy++;
const reached=new Set<string>(t.reached||path||[]),answered=new Set(t.answered||[]),advanced=new Set(t.advanced||[]);
const current=t.current||path.at(-1)||'__intro';if(['__intro','__consent'].includes(current))reached.add(current);
for(const blockId of reached){const key=s.form+':'+s.revision+':'+blockId;let r=stepMap.get(key);if(!r){const title=blockId==='__intro'?'Apresentação':blockId==='__consent'?'Consentimento e envio':t.labels?.[blockId]||forms.find(f=>f.id===s.form&&f.revision===s.revision)?.blocks?.find((b:any)=>b.id===blockId)?.title||'Etapa histórica';r={position:blockId==='__intro'?-1:blockId==='__consent'?1000:Math.max(0,(t.order||[]).indexOf(blockId)),key,formId:s.form,form:formNames[s.form]||s.form,revision:s.revision,blockId,title,reached:0,answered:0,advanced:0,blocked:0,blockedVerified:0,abandoned:0,completed:0,qualified:0,errors:0,whatsapp:0};stepMap.set(key,r)}r.reached++;if(answered.has(blockId))r.answered++;if(advanced.has(blockId))r.advanced++;if(isBlocked&&t.stop?.blockId===blockId){r.blocked++;if(t.stop?.verified)r.blockedVerified++}if(isAbandoned&&current===blockId)r.abandoned++;if(isComplete)r.completed++;if(isQualified)r.qualified++;if((t.errors||[]).includes(blockId))r.errors++;if(hasWa)r.whatsapp++}
for(const [dimension,value] of Object.entries({source:source.utm_source||'Direto',campaign:source.utm_campaign||'Sem campanha',device:s.device||'Desconhecido',form:formNames[s.form]||s.form})){const r=groups[dimension][value as string]||={label:value,sessions:0,completed:0,qualified:0,blocked:0,abandoned:0,whatsapp:0};r.sessions++;if(isComplete)r.completed++;if(isQualified)r.qualified++;if(isBlocked)r.blocked++;if(isAbandoned)r.abandoned++;if(hasWa)r.whatsapp++}
}
return {totals:{sessions:flows.length,started,completed,qualified,blocked,verifiedBlocked,abandoned,active,whatsapp:seenWa.size,legacy,completionRate:started?completed/started*100:0,qualificationRate:started?qualified/started*100:0},steps:[...stepMap.values()].sort((a,b)=>a.form.localeCompare(b.form)||a.revision-b.revision||a.position-b.position).map(r=>({...r,advanceRate:r.reached?r.advanced/r.reached*100:0,qualifiedRate:r.reached?r.qualified/r.reached*100:0})),segments:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,Object.values(v).sort((a:any,b:any)=>b.qualified/b.sessions-a.qualified/a.sessions)]))};
}
