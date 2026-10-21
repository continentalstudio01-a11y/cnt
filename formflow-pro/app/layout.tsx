import './globals.css';
import {siteWorkspace} from '../lib/workspace';
import {workspaceDefaults,workspaceName} from './workspace-model';
export async function generateMetadata(){
  let settings=workspaceDefaults;try{settings=await siteWorkspace()}catch{}
  return {title:workspaceName(settings)+' — '+settings.agencyName,description:settings.homeDescription,icons:{icon:settings.favicon||'/favicon.svg'}};
}
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
