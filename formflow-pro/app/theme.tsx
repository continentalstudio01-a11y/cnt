'use client';

import {useId,useSyncExternalStore} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Moon,Sun,Monitor} from 'lucide-react';

const subscribe=()=>()=>{};
function useMounted(){return useSyncExternalStore(subscribe,()=>true,()=>false)}

export function AppTheme({children}:{children:React.ReactNode}){
  return <ThemeProvider attribute="data-ui-theme" storageKey="formflow:theme" defaultTheme="light" enableSystem enableColorScheme={false} disableTransitionOnChange>{children}</ThemeProvider>;
}

export function ThemeToggle(){
  const {resolvedTheme,setTheme}=useTheme(),mounted=useMounted();
  const dark=mounted&&resolvedTheme==='dark';
  const label=dark?'Ativar modo claro':'Ativar modo escuro';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} aria-pressed={dark} disabled={!mounted} onClick={()=>setTheme(dark?'light':'dark')}>{dark?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}</button>;
}

const options=[
  {value:'light',label:'Claro',description:'Interface clara',Icon:Sun},
  {value:'dark',label:'Escuro',description:'Menos brilho na tela',Icon:Moon},
  {value:'system',label:'Automático',description:'Segue seu dispositivo',Icon:Monitor}
] as const;

export function ThemePreference(){
  const {theme,setTheme}=useTheme(),mounted=useMounted(),name=useId();
  return <section className="panel config-card theme-preference"><h2>Tema da interface</h2><p>Sua preferência é salva automaticamente neste navegador.</p><fieldset className="theme-picker"><legend className="sr-only">Escolha o tema do painel</legend><div className="theme-options">{options.map(({value,label,description,Icon})=><label key={value} className={'theme-option'+(mounted&&theme===value?' selected':'')}><input type="radio" name={name} value={value} checked={mounted&&theme===value} disabled={!mounted} onChange={()=>setTheme(value)}/><Icon size={22} aria-hidden="true"/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset></section>;
}
