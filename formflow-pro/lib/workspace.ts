import {getDb} from '../db';
import {records} from '../db/schema';
import {eq,and} from 'drizzle-orm';
import {env} from './platform';
import {decrypt} from './privacy';
import {workspaceDefaults,type WorkspaceSettings} from '../app/workspace-model';
import {secretKeys,type SecretKey} from './workspace-validation';

export const settingsId=(owner:string)=>'workspace-settings:'+owner;
export const secretsId=(owner:string)=>'workspace-secrets:'+owner;
export async function readWorkspace(owner:string):Promise<WorkspaceSettings>{
  const rows=await getDb().select().from(records).where(and(eq(records.id,settingsId(owner)),eq(records.owner,owner),eq(records.kind,'workspace_settings'))).limit(1);
  return {...workspaceDefaults,...(rows[0]?JSON.parse(rows[0].data):{})};
}
export async function siteWorkspace(){
  const owner=(env as any).APP_OWNER_USER_ID;
  return owner?readWorkspace(owner):{...workspaceDefaults};
}
export async function readSecrets(owner:string):Promise<Record<SecretKey,string>>{
  const rows=await getDb().select().from(records).where(and(eq(records.id,secretsId(owner)),eq(records.owner,owner),eq(records.kind,'workspace_secrets'))).limit(1);
  const stored=rows[0]?JSON.parse(await decrypt(rows[0].data)):{};
  return Object.fromEntries(secretKeys.map(k=>[k,Object.hasOwn(stored,k)?stored[k]:String((env as any)[k]||'')])) as Record<SecretKey,string>;
}
export function publicBranding(s:WorkspaceSettings){return {systemName:s.systemName,systemBadge:s.systemBadge,agencyName:s.agencyName,systemLogo:s.systemLogo,favicon:s.favicon,primaryColor:s.primaryColor,font:s.font,headingFont:s.headingFont,background:s.background,textColor:s.textColor,website:s.website,contactEmail:s.contactEmail,privacyUrl:s.privacyUrl,instagram:s.instagram};}

export function settingsForRole(s:WorkspaceSettings,role:string):WorkspaceSettings{return role==='Atendente'?{...s,defaultWebhook:'',defaultNotifyEmail:'',defaultCaptchaSiteKey:'',defaultMessage:'',defaultAssignee:''}:s}
