export type DeliveryResult={ok:boolean;error:string;retryable:boolean;retryAfter:number};
export async function deliveryResponse(provider:string,response:Response,expectedEvents=1):Promise<DeliveryResult>{
  let body:any=null;try{body=await response.clone().json()}catch{}
  let ok=response.ok,error='',retryable=response.status===408||response.status===409||response.status===425||response.status===429||response.status>=500;
  if(provider==='Meta CAPI'){
    ok=ok&&!body?.error&&Number(body?.events_received)>=expectedEvents;
    if(!ok){const code=Number(body?.error?.code)||0;retryable=retryable||body?.error?.is_transient===true;error='HTTP '+response.status+' · '+(code===190?'Token da Meta inválido ou expirado.':code===100?'Verifique o Pixel, as permissões e os dados do evento.':code?'Meta recusou o evento (código '+code+').':'A Meta não confirmou o recebimento dos eventos.')}
  }else if(provider==='E-mail'){
    ok=ok&&typeof body?.id==='string'&&body.id.length>0;
    if(!ok)error='HTTP '+response.status+' · '+([401,403].includes(response.status)?'Verifique a chave do Resend e o domínio do remetente.':response.status===422?'Verifique o remetente e o destinatário.':'O provedor não confirmou o envio do e-mail.');
  }else if(!ok)error='HTTP '+response.status+' · '+(response.status>=300&&response.status<400?'Use a URL final do endpoint, sem redirecionamento.':'O endpoint não confirmou a entrega.');
  const header=response.headers.get('retry-after');let retryAfter=0;
  if(header){const seconds=Number(header);retryAfter=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now();if(!Number.isFinite(retryAfter))retryAfter=0;retryAfter=Math.min(3600000,Math.max(0,retryAfter))}
  return {ok,error,retryable,retryAfter};
}
