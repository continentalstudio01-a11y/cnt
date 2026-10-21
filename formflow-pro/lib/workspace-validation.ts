import {z} from 'zod';
import {workspaceDefaults} from '../app/workspace-model';
import {httpsUrl} from './validation';import {validate} from './flow';
const color=z.string().regex(/^#[\da-fA-F]{6}$/,'Use uma cor hexadecimal com seis dígitos.');
const url=z.string().max(2000).refine(v=>!v||httpsUrl(v),'Informe uma URL HTTPS pública.');
const image=z.string().max(2000).refine(v=>!v||httpsUrl(v)||/^\/api\/media\?id=[\w-]+$/.test(v),'Envie uma imagem ou use uma URL HTTPS.');
const font=z.enum(['DM Sans','Manrope','Arial','Georgia']);
const shape:Record<string,z.ZodTypeAny>={};
for(const [key,value] of Object.entries(workspaceDefaults))shape[key]=typeof value==='boolean'?z.boolean():typeof value==='number'?z.number().finite():Array.isArray(value)?z.array(z.string().trim().max(500)).max(30):z.string().trim().max(5000);
Object.assign(shape,{
  mcpMode:z.enum(['full','read_only','disabled']),revision:z.number().int().nonnegative(),systemName:z.string().trim().min(1).max(40),systemBadge:z.string().trim().max(12),agencyName:z.string().trim().min(1).max(100),
  profileName:z.string().trim().max(100),workspaceDescription:z.string().trim().max(120),
  ...Object.fromEntries(['systemLogo','agencyLogo','favicon','profileImage','bannerImage'].map(k=>[k,image])),
  ...Object.fromEntries(['primaryColor','accentColor','background','surfaceColor','textColor','sidebarColor','formColor','formBackground','formTextColor'].map(k=>[k,color])),
  font,headingFont:font,formFont:font,radius:z.number().int().min(0).max(24),formRadius:z.number().int().min(0).max(30),formSpacing:z.number().int().min(12).max(48),
  contactEmail:z.union([z.string().trim().email(),z.literal('')]),defaultNotifyEmail:z.union([z.string().trim().email(),z.literal('')]),
  website:url,helpUrl:url,privacyUrl:url,defaultWebhook:url,instagram:z.string().regex(/^$|^@[\w.]{1,30}$/,'Use @usuario.'),
  defaultWhatsApp:z.string().regex(/^$|^55\d{10,11}$/,'Use 55 + DDD + número.').refine(v=>!v||!validate({id:'whatsapp',type:'Telefone e WhatsApp',title:'WhatsApp',required:false,options:[]},v),'Informe DDD e número válidos.'),defaultPixel:z.string().regex(/^$|^\d{5,25}$/,'O Pixel ID deve conter somente números.'),
  timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('pt-BR',{timeZone:v});return true}catch{return false}},'Fuso horário inválido.'),
  autosaveSeconds:z.number().int().min(1).max(30),leadPageSize:z.union([z.literal(50),z.literal(100),z.literal(200),z.literal(300)]),csvDelimiter:z.enum([';',',']),
  sessionHours:z.number().int().min(1).max(168),hot:z.number().int().min(1).max(10000),warm:z.number().int().min(0).max(9999),
  pipelineStages:z.array(z.string().trim().min(1).max(60)).min(1).max(20).refine(v=>new Set(v).size===v.length,'As etapas precisam ter nomes diferentes.'),
  defaultTags:z.array(z.string().trim().min(1).max(80)).max(30),formBenefits:z.array(z.string().trim().min(1).max(200)).max(12),
  formPrivacy:z.string().trim().min(20).max(10000),metaTestEventCode:z.string().trim().max(100),defaultCaptchaSiteKey:z.string().trim().max(200),
  formTitle:z.string().trim().min(1).max(500),marketingText:z.string().trim().min(10).max(1000),formSuccessTitle:z.string().trim().min(1).max(500),formColdTitle:z.string().trim().min(1).max(500),
  homeTitle:z.string().trim().min(1).max(200),bannerTitle:z.string().trim().max(300),formStartLabel:z.string().trim().min(1).max(100),formWhatsAppLabel:z.string().trim().min(1).max(100),
});
export const workspaceSchema=z.object(shape).strict().superRefine((v,ctx)=>{
  if(v.hot<=v.warm)ctx.addIssue({code:'custom',path:['hot'],message:'A pontuação de lead quente deve ser maior que a de lead morno.'});
  if(!v.pipelineStages.includes(v.defaultStage))ctx.addIssue({code:'custom',path:['defaultStage'],message:'Escolha uma etapa existente para novos leads.'});
});
export const secretKeys=['META_CAPI_TOKEN','RESEND_API_KEY','NOTIFY_FROM','TURNSTILE_SECRET','WEBHOOK_SIGNING_SECRET'] as const;
export type SecretKey=typeof secretKeys[number];
export const secretChangesSchema=z.object(Object.fromEntries(secretKeys.map(k=>[k,z.union([z.string().trim().min(1).max(20000),z.null()]).optional()]))).strict();
