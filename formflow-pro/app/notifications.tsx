'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,CheckCheck,Volume2,VolumeX,X} from 'lucide-react';
type Item={id:string;formName:string;created:string;status:string;qualified:boolean;read:boolean};
type Feed={items:Item[];unreadCount:number;latest:{id:string;created:string}|null;channel:string};
type Props={timezone:string;onNew:()=>void;onLeads:()=>void};
const newer=(a:{id:string;created:string},b:{id:string;created:string})=>a.created>b.created||(a.created===b.created&&a.id>b.id);
export default function Notifications({timezone,onNew,onLeads}:Props){
  const [feed,F]=useState<Feed|null>(null),[open,O]=useState(false),[error,E]=useState(''),[sound,S]=useState(false),[desktop,D]=useState(false);
  const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),seen=useRef<Feed['latest']>(null),initialized=useRef(false),soundRef=useRef(false),audio=useRef<AudioContext|null>(null),callbacks=useRef({onNew,onLeads});
  useEffect(()=>{callbacks.current={onNew,onLeads}},[onNew,onLeads]);
  useEffect(()=>{try{const s=localStorage.getItem('formflow:lead-sound')==='true';S(s);soundRef.current=s;D('Notification' in window&&Notification.permission==='granted')}catch{}},[]);
  useEffect(()=>{const unlock=()=>{if(!soundRef.current)return;try{const Audio=window.AudioContext||(window as any).webkitAudioContext;if(!audio.current&&Audio)audio.current=new Audio();if(audio.current?.state!=='running')void audio.current?.resume()}catch{}};window.addEventListener('pointerdown',unlock,{passive:true});window.addEventListener('keydown',unlock);return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock)}},[]);
  useEffect(()=>{
    let alive=true,polling=false,timer:ReturnType<typeof setTimeout>,controller:AbortController|null=null;
    async function poll(){
      if(!alive||polling)return;polling=true;
      const active=new AbortController();controller=active;const deadline=setTimeout(()=>active.abort(),10000);
      try{
        const r=await fetch('/api/notifications',{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error();
        const data=await r.json() as Feed;if(!alive)return;F(data);E('');
        if(initialized.current&&data.latest&&(!seen.current||newer(data.latest,seen.current))){
          const storageKey='formflow:last-lead-alert:'+data.channel;let alerted='';
          try{alerted=localStorage.getItem(storageKey)||'';localStorage.setItem(storageKey,data.latest.created+'|'+data.latest.id)}catch{}
          if(alerted!==data.latest.created+'|'+data.latest.id){
            const title='Novo formulário concluído';
            if(soundRef.current&&audio.current){try{const ctx=audio.current;void ctx.resume();const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=720;gain.gain.setValueAtTime(.08,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);oscillator.start();oscillator.stop(ctx.currentTime+.23)}catch{}}
            if('Notification' in window&&Notification.permission==='granted'){try{const notification=new Notification(title,{body:'Um novo lead concluiu o formulário. Abra o painel para consultar.',tag:'formflow-new-lead'});notification.onclick=()=>{window.focus();callbacks.current.onLeads();notification.close()}}catch{}}
            callbacks.current.onNew();
          }
        }
        initialized.current=true;if(data.latest&&(!seen.current||newer(data.latest,seen.current)))seen.current=data.latest;
      }catch(e){if(alive)E('Não foi possível atualizar os avisos. Vou tentar novamente.')}
      finally{clearTimeout(deadline);polling=false;if(alive)timer=setTimeout(poll,document.hidden?60000:15000)}
    }
    void poll();const refresh=()=>{clearTimeout(timer);void poll()};window.addEventListener('focus',refresh);
    return()=>{alive=false;clearTimeout(timer);controller?.abort();window.removeEventListener('focus',refresh);if(audio.current){void audio.current.close().catch(()=>{});audio.current=null}};
  },[]);
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))O(false)},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){O(false);button.current?.focus()}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)}},[open]);
  async function markRead(){if(!feed?.latest)return;try{const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:feed.latest.id})});if(!r.ok)throw Error();const cursor=feed.latest;F(current=>current?{...current,items:current.items.map(i=>newer(i,cursor)?i:{...i,read:true}),unreadCount:current.items.filter(i=>!i.read&&newer(i,cursor)).length}:current);E('')}catch{E('Não foi possível marcar como lidas.')}}
  function toggleSound(){const enabled=!sound;if(enabled){try{const Audio=window.AudioContext||(window as any).webkitAudioContext;if(!audio.current&&Audio)audio.current=new Audio();void audio.current?.resume()}catch{}}S(enabled);soundRef.current=enabled;try{localStorage.setItem('formflow:lead-sound',String(enabled))}catch{}}
  async function enableDesktop(){if(!('Notification' in window)){E('Seu navegador não oferece avisos na área de trabalho.');return}try{const permission=await Notification.requestPermission();D(permission==='granted');if(permission!=='granted')E('Os avisos do navegador não foram autorizados. O sino continua ativo.')}catch{E('Use o sino para acompanhar os novos leads.')}}
  return <div className="lead-notifications" ref={root}><button ref={button} type="button" className="notification-bell" aria-label={'Notificações'+(feed?.unreadCount?': '+feed.unreadCount+' não lidas':'')} aria-expanded={open} aria-controls="lead-notifications-panel" onClick={()=>O(!open)}><Bell size={18}/>{!!feed?.unreadCount&&<span className="notification-count">{feed.unreadCount>99?'99+':feed.unreadCount}</span>}</button>{open&&<section className="notification-panel" id="lead-notifications-panel" aria-label="Notificações de novos leads"><div className="notification-heading"><h2>Novos leads</h2><button type="button" aria-label="Fechar notificações" onClick={()=>{O(false);button.current?.focus()}}><X size={16}/></button></div><p className="notification-subtitle">Respostas enviadas até a conclusão. Atualização automática com o painel aberto.</p><div className="notification-controls"><button type="button" aria-pressed={sound} onClick={toggleSound}>{sound?<Volume2 size={15}/>:<VolumeX size={15}/>}Som {sound?'ativado':'desativado'}</button><button type="button" onClick={enableDesktop} disabled={desktop}>{desktop?'Avisos autorizados':'Ativar avisos do navegador'}</button></div>{error&&<p role="alert" className="error">{error}</p>}<div className="notification-items">{!feed?<p>Carregando avisos…</p>:!feed.items.length?<p>Nenhum formulário concluído ainda.</p>:feed.items.map(item=><article key={item.id} className={item.read?'':'unread'}><span className="notification-indicator" aria-label={item.read?'Lida':'Não lida'}/><div><strong>Formulário concluído</strong><p>{item.formName}</p><small>{item.status} · {new Date(item.created).toLocaleString('pt-BR',{timeZone:timezone})}</small></div></article>)}</div><div className="notification-footer"><button type="button" disabled={!feed?.unreadCount} onClick={markRead}><CheckCheck size={15}/>Marcar como lidas</button><button type="button" className="primary" onClick={()=>{O(false);callbacks.current.onLeads()}}>Ver leads</button></div></section>}</div>;
}
