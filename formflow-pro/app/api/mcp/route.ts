import {access} from '../../../lib/access';
import {readWorkspace} from '../../../lib/workspace';
import {advertisedTools} from '../../../lib/mcp-catalog';
import {getDb} from '../../../db';
import {records} from '../../../db/schema';
import {eq,and,desc,like} from 'drizzle-orm';
export async function GET(req:Request){
  const a=await access();if(!a)return Response.json({error:'Entre com uma conta autorizada.'},{status:401});
  const ws=await readWorkspace(a.owner),tools=advertisedTools(a.role),audit=a.role==='Atendente'?[]:await getDb().select().from(records).where(and(eq(records.owner,a.owner),eq(records.kind,'audit'),like(records.data,'%"tool":"formflow_%'))).orderBy(desc(records.created)).limit(20);
  return Response.json({status:ws.mcpMode==='disabled'?'disabled':'ready',mode:ws.mcpMode,protocol:'2026-07-28',endpoint:new URL('/mcp',req.url).href,role:a.role,canConfigure:a.role==='Administrador',tools:tools.map(t=>({name:t.name,title:t.title,description:t.description,group:t._meta['formflow/group'],readOnly:t.annotations.readOnlyHint,destructive:t.annotations.destructiveHint,enabled:ws.mcpMode==='full'||ws.mcpMode==='read_only'&&t.annotations.readOnlyHint})),history:audit.map(r=>({id:r.id,created:r.created,...JSON.parse(r.data)})),connection:{method:'Plugin privado provisionado pelo Sites',verified:false,help:'No ChatGPT ou Codex, abra Plugins → Personal → Created by you e conecte o plugin deste Site. A instalação é independente do status do servidor.'}},{headers:{'Cache-Control':'private, no-store'}});
}
