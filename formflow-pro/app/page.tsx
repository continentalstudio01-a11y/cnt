import Studio from './studio';
import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import {access} from '../lib/access';
import {siteWorkspace,publicBranding,settingsForRole} from '../lib/workspace';
import {workspaceName} from './workspace-model';
export const dynamic='force-dynamic';
export default async function Page(){
  const settings=await siteWorkspace(),brand=publicBranding(settings),name=workspaceName(settings);
  const user=await getChatGPTUser();
  if(!user)return <main className="auth-gate">{brand.systemLogo?<img className="gate-logo" src={brand.systemLogo} alt={name}/>:<span className="brand-icon" style={{background:brand.primaryColor}}>ϟ</span>}<h1>Seu workspace {name}</h1><p>Entre para criar formulários e gerenciar seus leads.</p><a className="primary" style={{background:brand.primaryColor,borderColor:brand.primaryColor}} href={chatGPTSignInPath('/')} target="_top">Entrar no painel →</a><p>Se o login apresentar erro, abra este endereço diretamente no navegador com a sua conta ChatGPT conectada.</p>{brand.website&&<a href={brand.website} rel="noopener noreferrer" target="_blank">{brand.agencyName} ↗</a>}{brand.instagram&&<p><a href={'https://www.instagram.com/'+brand.instagram.slice(1)} target="_blank" rel="noopener noreferrer">{brand.instagram}</a></p>}{brand.contactEmail&&<p><a href={'mailto:'+brand.contactEmail}>{brand.contactEmail}</a></p>}</main>;
  const permission=await access();
  if(!permission)return <main className="auth-gate"><h1>Acesso restrito à equipe</h1><p>Peça ao administrador para cadastrar seu e-mail no workspace.</p></main>;
  return <Studio initialSettings={settingsForRole(settings,permission.role)} initialUser={user.displayName||user.email} initialRole={permission.role} isOwner={permission.owner===user.userId}/>;
}
