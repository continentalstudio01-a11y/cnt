import {httpsUrl} from './validation';
import type {Form} from '../app/model';
export function integrationStatus(form:Form,secrets:Record<string,string>,testCode=''){
  const phone=String(form.whatsapp||'').replace(/\D/g,''),hasPhone=/^[1-9]\d{9,14}$/.test(phone);
  const pixel=/^\d{5,25}$/.test(form.pixel||''),webhook=!!form.webhook&&httpsUrl(form.webhook);
  const email=!!form.notifyEmail&&!!secrets.RESEND_API_KEY&&!!secrets.NOTIFY_FROM;
  return [
    {provider:'WhatsApp',configured:hasPhone,detail:hasPhone?'Link pronto para abrir o atendimento.':'Informe o número com código do país e DDD.',url:hasPhone?'https://wa.me/'+phone+'?text='+encodeURIComponent(form.message||'Olá, preenchi o formulário e quero falar com um atendente.'):undefined},
    {provider:'Webhook',configured:webhook,detail:webhook?'Endpoint HTTPS configurado. CRM e Google Sheets recebem por este webhook.':'Informe um endpoint HTTPS do CRM ou da automação do Google Sheets.',testable:webhook},
    {provider:'E-mail',configured:email,detail:email?'Destinatário, chave e remetente cadastrados.':!form.notifyEmail?'Informe o e-mail que receberá os avisos.':'Cadastre a chave do Resend e o remetente em Configurações → Integrações.',testable:email},
    {provider:'Meta Pixel',configured:pixel,detail:pixel?'ID cadastrado. Eventos são enviados após o consentimento de marketing.':'Informe o ID numérico do Pixel.'},
    {provider:'Meta CAPI',configured:pixel&&!!secrets.META_CAPI_TOKEN,detail:!pixel?'Informe o ID do Pixel.':!secrets.META_CAPI_TOKEN?'Cadastre o token da Meta em Configurações → Integrações.':testCode?'Token e código de teste cadastrados.':'Token cadastrado. Configure o código de Testar eventos da Meta para enviar um teste.',testable:pixel&&!!secrets.META_CAPI_TOKEN&&!!testCode},
    {provider:'API REST',configured:form.published&&!['paused','archived'].includes(form.lifecycle||''),detail:form.published?'Captura com validação de respostas, consentimento e limite de requisições.':'Publique o formulário para habilitar a captura pública.'},
    {provider:'CAPTCHA',configured:!form.captchaSiteKey||!!secrets.TURNSTILE_SECRET,disabled:!form.captchaSiteKey,detail:!form.captchaSiteKey?'Proteção adicional desativada.':secrets.TURNSTILE_SECRET?'Chaves pública e secreta cadastradas.':'Cadastre a chave secreta do Turnstile.'}
  ];
}
