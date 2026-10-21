import type {Form} from './model';

export type WorkspaceSettings = {
  mcpMode:'full'|'read_only'|'disabled'; revision:number; systemName:string; systemBadge:string; agencyName:string; workspaceDescription:string;
  systemLogo:string; agencyLogo:string; favicon:string; profileImage:string; profileName:string; bannerImage:string;
  primaryColor:string; accentColor:string; background:string; surfaceColor:string; textColor:string; sidebarColor:string;
  font:string; headingFont:string; radius:number; compact:boolean; showWelcomeBanner:boolean; showTips:boolean;
  homeEyebrow:string; homeTitle:string; homeDescription:string; bannerTag:string; bannerTitle:string; bannerText:string;
  bannerButton:string; helpTitle:string; helpText:string; helpUrl:string; footerText:string;
  contactEmail:string; website:string; instagram:string; timezone:string; autosaveSeconds:number; leadPageSize:number;
  csvDelimiter:';'|','; pipelineStages:string[]; defaultStage:string; defaultAssignee:string; defaultTags:string[];
  formColor:string; formBackground:string; formTextColor:string; formFont:string; formRadius:number; formSpacing:number;
  formProgress:boolean; formTitle:string; formIntro:string; formBenefits:string[]; formStartLabel:string; formIntroNote:string;
  formSuccessTitle:string; formSuccessText:string; formColdTitle:string; formColdText:string;
  formRevenueText:string; formBudgetText:string; formWhatsAppLabel:string; formPrivacy:string; privacyUrl:string;
  marketingText:string; sessionHours:number; showPoweredBy:boolean; defaultWhatsApp:string; defaultMessage:string;
  defaultPixel:string; defaultWebhook:string; defaultNotifyEmail:string; defaultCaptchaSiteKey:string; metaTestEventCode:string;
  hot:number; warm:number;
};
export const workspaceDefaults:WorkspaceSettings = {
  mcpMode:'full',revision:0,systemName:'FormFlow',systemBadge:'PRO',agencyName:'Continental MKT',workspaceDescription:'Workspace da agência',
  systemLogo:'',agencyLogo:'',favicon:'',profileImage:'',profileName:'',bannerImage:'',
  primaryColor:'#2563eb',accentColor:'#f97316',background:'#f7f8fa',surfaceColor:'#ffffff',textColor:'#20252e',sidebarColor:'#ffffff',
  font:'DM Sans',headingFont:'Manrope',radius:8,compact:false,showWelcomeBanner:true,showTips:true,
  homeEyebrow:'SEU CENTRO DE CONVERSÃO',homeTitle:'Boas ideias viram bons leads.',homeDescription:'Crie experiências que conectam. Transforme respostas em oportunidades.',
  bannerTag:'MENOS FRICÇÃO. MAIS CONVERSÃO.',bannerTitle:'Não é só um formulário.\nÉ o começo de uma boa conversa.',
  bannerText:'Qualifique leads com experiências interativas que as pessoas realmente querem responder.',bannerButton:'Criar meu formulário',
  helpTitle:'✦ Seu próximo lead começa aqui.',helpText:'Transforme perguntas em oportunidades.',helpUrl:'',footerText:'Feito para conectar pessoas e oportunidades.',
  contactEmail:'',website:'',instagram:'',timezone:'America/Sao_Paulo',autosaveSeconds:2,leadPageSize:300,csvDelimiter:';',
  pipelineStages:['Novo','Em atendimento','Reunião','Proposta','Venda','Perdido'],defaultStage:'Novo',defaultAssignee:'',defaultTags:[],
  formColor:'#2563eb',formBackground:'#ffffff',formTextColor:'#243551',formFont:'Manrope',formRadius:8,formSpacing:25,formProgress:true,
  formTitle:'🚀 Faça sua empresa faturar mais com um método validado',
  formIntro:'Exclusivo para empresas que faturam acima de R$30 mil por mês e desejam parar de patinar, atrair mais clientes e aumentar o faturamento com tráfego pago.',
  formBenefits:['📈 Mais ROAS no investimento','🎨 Criativos por nossa conta','✓ Resultados mais previsíveis','↗ Funil de vendas validado'],
  formStartLabel:'Quero crescer minha empresa',formIntroNote:'Leva cerca de 2 minutos · Sem compromisso',
  formSuccessTitle:'✅ Seu perfil foi aprovado para uma análise comercial',
  formSuccessText:'Com base nas suas respostas, sua empresa pode se beneficiar de uma estrutura de tráfego pago focada em geração de clientes e crescimento do faturamento.',
  formColdTitle:'Obrigado pelas informações',formColdText:'Neste momento, recomendamos estruturar o orçamento e o processo comercial antes de iniciar a gestão. Você poderá receber conteúdos para se preparar para a próxima etapa.',
  formRevenueText:'Nosso método foi desenvolvido inicialmente para empresas que já faturam acima de R$30 mil por mês. Deixe seu contato para receber conteúdos e avisos sobre futuras condições.',
  formBudgetText:'Entendemos. Para gerar resultados consistentes, é importante reservar verba para mídia e gestão. Deixe seus dados para receber orientações quando estiver preparado.',
  formWhatsAppLabel:'Falar com atendente agora',formPrivacy:'Autorizo o uso dos meus dados pela {{agencia}} para análise comercial e contato sobre os serviços solicitados. Posso solicitar a exclusão dos dados a qualquer momento.',
  privacyUrl:'',marketingText:'Permitir mensuração de marketing para ajudar a melhorar esta experiência. Opcional.',sessionHours:24,showPoweredBy:true,
  defaultWhatsApp:'',defaultMessage:'Olá, preenchi o formulário da {{agencia}} e quero falar com um atendente sobre gestão de tráfego.',
  defaultPixel:'1642763247257130',defaultWebhook:'',defaultNotifyEmail:'',defaultCaptchaSiteKey:'',metaTestEventCode:'',hot:60,warm:25,
};
export const workspaceName=(s:WorkspaceSettings)=>[s.systemName,s.systemBadge].filter(Boolean).join(' ');
export type DefaultsGroup='appearance'|'texts'|'privacy'|'integrations'|'scoring';
export function formDefaults(s:WorkspaceSettings,groups:DefaultsGroup[]=['appearance','texts','privacy','integrations','scoring']):Partial<Form>{
  const p:Partial<Form>={};
  if(groups.includes('appearance'))Object.assign(p,{brand:s.agencyName,logo:s.agencyLogo,color:s.formColor,background:s.formBackground,textColor:s.formTextColor,font:s.formFont,radius:s.formRadius,spacing:s.formSpacing,progress:s.formProgress});
  if(groups.includes('texts'))Object.assign(p,{title:s.formTitle,intro:s.formIntro,benefits:s.formBenefits,startLabel:s.formStartLabel,introNote:s.formIntroNote,successTitle:s.formSuccessTitle,successText:s.formSuccessText,coldTitle:s.formColdTitle,coldText:s.formColdText,revenueText:s.formRevenueText,budgetText:s.formBudgetText,whatsappLabel:s.formWhatsAppLabel});
  if(groups.includes('privacy'))Object.assign(p,{privacy:s.formPrivacy.replaceAll('{{agencia}}',s.agencyName),privacyUrl:s.privacyUrl,marketingText:s.marketingText,sessionHours:s.sessionHours});
  if(groups.includes('integrations'))Object.assign(p,{whatsapp:s.defaultWhatsApp,message:s.defaultMessage.replaceAll('{{agencia}}',s.agencyName),pixel:s.defaultPixel,webhook:s.defaultWebhook,notifyEmail:s.defaultNotifyEmail,captchaSiteKey:s.defaultCaptchaSiteKey});
  if(groups.includes('scoring'))Object.assign(p,{hot:s.hot,warm:s.warm});
  return p;
}
export function newFormDefaults(form:Form,s:WorkspaceSettings,isTemplate=false):Form{
  const p=formDefaults(s);
  if(isTemplate)for(const k of ['title','intro','successTitle','successText'] as const)delete p[k];
  return {...form,...p,description:form.description.replaceAll('Continental MKT',s.agencyName)};
}
