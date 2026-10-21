import {z} from 'zod';
import {formSchema} from './validation';
import {workspaceSchema,secretChangesSchema} from './workspace-validation';
import {types} from '../app/model';

const id=z.string().min(1).max(120),revision=z.number().int().nonnegative();
const operation=z.string().min(12).max(100).regex(/^[\w:-]+$/).describe('Identificador único desta alteração. Reutilize a mesma chave ao consultar uma tentativa repetida. Não inclua dados pessoais.');
const base={request_id:operation};
const image=z.string().max(2000),color=z.string().regex(/^#[\da-fA-F]{6}$/);
const formShape=formSchema.extend({background:color.optional(),textColor:color.optional(),logo:image.optional()}).omit({id:true,revision:true,published:true}).strict();
const formPatch=formShape.partial().describe('Campos do formulário a modificar. blocks substitui a lista completa, permitindo adicionar, remover, duplicar e reordenar etapas. rules substitui todas as regras. live e published são gerenciados pelo servidor.');
const workspacePatch=workspaceSchema.innerType().omit({revision:true}).partial().strict();
const filters={form_id:id.optional(),since:z.string().datetime().optional(),until:z.string().datetime().optional(),status:z.enum(['Quente','Morno','Frio']).optional(),query:z.string().max(200).optional()};
type Tool={name:string;title:string;description:string;group:string;schema:z.ZodTypeAny;roles:string[];write:boolean;destructive?:boolean;external?:boolean};
const all=['Administrador','Gestor','Atendente'],edit=['Administrador','Gestor'],admin=['Administrador'];
const tool=(name:string,title:string,description:string,group:string,schema:z.ZodTypeAny,roles=all,write=false,destructive=false,external=false):Tool=>({name:'formflow_'+name,title,description,group,schema,roles,write,destructive,external});
export const mcpTools:Tool[]=[
  tool('workspace_get','Consultar configurações','Retorna configurações, revisão, permissões e presença de credenciais. Valores de credenciais nunca são retornados.','Workspace',z.object({}).strict()),
  tool('workspace_update','Editar configurações','Modifica qualquer configuração administrativa: nomes, imagens, cores, textos, padrões, WhatsApp, Pixel, preferências e modo MCP. Exige a revisão atual de workspace_get.','Workspace',z.object({...base,expected_revision:revision,patch:workspacePatch}).strict(),admin,true),
  tool('credentials_update','Configurar credenciais','Substitui ou remove credenciais das integrações. Prefira a tela Configurações > Integrações para digitar segredos. Nunca solicite nem tente revelar valores salvos. null remove uma credencial.','Integrações',z.object({...base,expected_revision:revision,changes:secretChangesSchema}).strict(),admin,true,true),
  tool('schema_get','Consultar estrutura editável','Retorna schemas completos, tipos de blocos e exemplos para editar formulários, regras e configurações.','Workspace',z.object({entity:z.enum(['form','workspace','all']).default('all')}).strict()),
  tool('forms_list','Listar formulários','Lista formulários e seus estados, revisões e links. Não inclui respostas dos leads.','Formulários',z.object({query:z.string().max(200).optional(),lifecycle:z.enum(['active','paused','archived']).optional(),offset:z.number().int().min(0).max(10000).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict(),edit),
  tool('form_get','Consultar formulário completo','Retorna rascunho, versão publicada, perguntas, opções, pontos, regras, design e integrações.','Formulários',z.object({id}).strict(),edit),
  tool('form_create','Criar formulário','Cria um formulário com padrões do workspace e um template. Pode substituir perguntas, regras, imagens e integrações no mesmo comando. Cria um rascunho.','Formulários',z.object({...base,name:z.string().min(1).max(200),template:z.enum(['Agência de marketing','Clínica e saúde','Restaurante','Comércio local','Prestador de serviço']).default('Agência de marketing'),patch:formPatch.optional()}).strict(),edit,true),
  tool('form_update','Editar formulário completo','Atualiza campos, perguntas, pontuação, ramificações, design, textos, imagens, WhatsApp e Pixel. Preserva a versão publicada. Exige expected_revision de form_get.','Formulários',z.object({...base,id,expected_revision:revision,patch:formPatch}).strict(),edit,true),
  tool('form_action','Publicar e gerenciar formulário','Publica, despublica, pausa, reativa, arquiva ou duplica o formulário indicado. publish altera o link público; archive despublica.','Formulários',z.object({...base,id,expected_revision:revision,action:z.enum(['publish','unpublish','pause','activate','archive','duplicate']),name:z.string().min(1).max(200).optional()}).strict(),edit,true,true),
  tool('form_versions_list','Consultar versões','Lista versões e datas do formulário para restaurar um rascunho anterior.','Formulários',z.object({id,offset:z.number().int().min(0).max(10000).default(0),limit:z.number().int().min(1).max(100).default(30)}).strict(),edit),
  tool('form_version_restore','Restaurar versão','Restaura uma versão como rascunho. O link público continua usando a versão publicada até publish.','Formulários',z.object({...base,id,version_id:id,expected_revision:revision}).strict(),edit,true),
  tool('forms_apply_defaults','Aplicar padrões aos rascunhos','Aplica grupos de padrões salvos aos formulários indicados. As versões públicas são preservadas.','Formulários',z.object({...base,expected_revision:revision,form_ids:z.array(id).min(1).max(500),groups:z.array(z.enum(['appearance','texts','privacy','integrations','scoring'])).min(1).max(5)}).strict(),admin,true),
  tool('form_test','Testar ramificação e pontuação','Executa o fluxo com respostas de teste e retorna caminho, validação, pontos e qualificação. Não salva leads nem dispara integrações.','Formulários',z.object({id,answers:z.record(z.string().max(5000)),version:z.enum(['draft','published']).default('draft')}).strict(),edit),
  tool('leads_list','Listar e pesquisar leads','Consulta leads com paginação e filtros. Os filtros são aplicados à página examinada; use next_offset até esgotar os dados.','Leads',z.object({...filters,offset:z.number().int().min(0).max(1000000).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict()),
  tool('lead_get','Consultar lead completo','Retorna respostas, origem, consentimento, pontuação, classificação, responsável e observações de um lead.','Leads',z.object({id}).strict()),
  tool('lead_update','Editar atendimento do lead','Atualiza responsável, etapa e observações internas do lead. Respostas e consentimento originais são preservados.','Leads',z.object({...base,id,patch:z.object({assignedTo:z.string().max(200).optional(),stage:z.string().min(1).max(60).optional(),notes:z.string().max(10000).optional()}).strict()}).strict(),edit,true),
  tool('lead_delete','Apagar dados de um lead','Apaga permanentemente o lead, arquivos associados e fila de entregas. Use somente para o lead solicitado explicitamente pelo usuário.','Leads',z.object({...base,id,confirm:z.literal(true).describe('Confirma a exclusão permanente do lead indicado.')}).strict(),edit,true,true),
  tool('leads_export','Exportar leads em CSV','Gera CSV privado com respostas e dados comerciais. Pagina internamente até 5.000 leads examinados e informa se há mais. Link autenticado válido por 24 horas.','Leads',z.object({...base,...filters}).strict(),all,true),
  tool('analytics_get','Consultar relatório','Retorna totais, qualificação, origens, dispositivos, etapas e conversões de WhatsApp no período. Indica limites de leitura quando atingidos.','Analytics',z.object({form_id:id.optional(),since:z.string().datetime().optional(),until:z.string().datetime().optional()}).strict()),
  tool('team_list','Consultar equipe','Lista usuários e perfis de acesso cadastrados.','Equipe',z.object({}).strict(),admin),
  tool('team_upsert','Adicionar ou alterar usuário','Cadastra e-mail ou atualiza perfil Administrador, Gestor ou Atendente. Não envia convites.','Equipe',z.object({...base,email:z.string().email().max(200),role:z.enum(['Administrador','Gestor','Atendente'])}).strict(),admin,true,true),
  tool('team_remove','Remover acesso de usuário','Remove o perfil cadastrado indicado. O proprietário mantém o acesso administrativo.','Equipe',z.object({...base,id,confirm:z.literal(true)}).strict(),admin,true,true),
  tool('integrations_status','Consultar integrações e entregas','Retorna presença de credenciais e fila de entregas sem tokens nem payloads.','Integrações',z.object({}).strict(),edit),
  tool('delivery_retry','Reenviar integração','Reinicia uma entrega existente de webhook, e-mail ou Meta CAPI. Pode contatar um serviço externo; use apenas quando solicitado.','Integrações',z.object({...base,id}).strict(),edit,true,true,true),
  tool('media_upload','Enviar imagem','Envia PNG, JPG ou WebP em base64, até 2 MB, para uso em logos, banner e blocos. Retorna URL pública da imagem.','Mídia',z.object({...base,filename:z.string().min(1).max(120),mime:z.enum(['image/png','image/jpeg','image/webp']),base64:z.string().min(8).max(2800000)}).strict(),edit,true,false,true),
  tool('data_backup','Criar backup','Gera um arquivo privado com formulários, versões, leads e configurações. Dados sensíveis e credenciais permanecem criptografados. O arquivo de download expira em 24 horas.','Dados',z.object({...base}).strict(),admin,true),
  tool('data_restore','Restaurar backup','Restaura registros ausentes de um backup criado pelo sistema e pertencente ao workspace. Registros existentes são preservados.','Dados',z.object({...base,backup_id:id,confirm:z.literal(true)}).strict(),admin,true,true),
  tool('maintenance_run','Executar manutenção','Remove arquivos abandonados e limites expirados usando a rotina administrativa do sistema.','Dados',z.object({...base}).strict(),admin,true,true),
  tool('audit_list','Consultar histórico de alterações','Lista alterações, chamadas MCP e seus resultados de execução, sem expor credenciais.','Auditoria',z.object({offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict(),edit),
];

export function jsonSchema(schema:z.ZodTypeAny):Record<string,unknown>{
  if(schema instanceof z.ZodOptional||schema instanceof z.ZodNullable||schema instanceof z.ZodDefault)return jsonSchema(schema instanceof z.ZodDefault?schema.removeDefault():schema.unwrap());
  if(schema instanceof z.ZodEffects)return jsonSchema(schema.innerType());
  let result:Record<string,unknown>={};
  if(schema instanceof z.ZodObject){const properties=Object.fromEntries(Object.entries(schema.shape as Record<string,z.ZodTypeAny>).map(([k,v])=>[k,jsonSchema(v)])),required=Object.entries(schema.shape as Record<string,z.ZodTypeAny>).filter(([,v])=>!v.isOptional()).map(([k])=>k);result={type:'object',properties,additionalProperties:false,...(required.length?{required}:{})}}
  else if(schema instanceof z.ZodArray)result={type:'array',items:jsonSchema(schema.element)};
  else if(schema instanceof z.ZodRecord)result={type:'object',additionalProperties:jsonSchema(schema.valueSchema)};
  else if(schema instanceof z.ZodEnum)result={type:'string',enum:schema.options};
  else if(schema instanceof z.ZodLiteral)result={type:schema.value===null?'null':typeof schema.value,const:schema.value};
  else if(schema instanceof z.ZodUnion)result={anyOf:schema.options.map(jsonSchema)};
  else if(schema instanceof z.ZodString)result={type:'string'};
  else if(schema instanceof z.ZodNumber)result={type:'number'};
  else if(schema instanceof z.ZodBoolean)result={type:'boolean'};
  else if(schema instanceof z.ZodNull)result={type:'null'};
  if(schema.description)result.description=schema.description;
  return result;
}
export function advertisedTools(role?:string){return mcpTools.filter(t=>!role||t.roles.includes(role)).map(t=>({name:t.name,title:t.title,description:t.description,inputSchema:jsonSchema(t.schema),annotations:{readOnlyHint:!t.write,destructiveHint:!!t.destructive,idempotentHint:true,openWorldHint:!!t.external},_meta:{'formflow/group':t.group}}))}
export function editableSchemas(){return {form:jsonSchema(formShape),workspace:jsonSchema(workspaceSchema),block_types:types,managed_fields:['id','revision','published','live'],templates:['Agência de marketing','Clínica e saúde','Restaurante','Comércio local','Prestador de serviço']}}
