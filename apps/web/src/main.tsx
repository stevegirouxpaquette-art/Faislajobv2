import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPortal from './AdminPortal';
import UserPortal from './UserPortal';
import './styles.css';
import './portal.css';

const BRAND_LOGO='https://335a351f-416d-4e29-89d5-2204a8876ab2.sandbox.floot.app/_cdn/static/40f11d09-fbf4-43b4-8bbf-9da5343620ff-IMG_2043.png';

type ClientMission = { id: string; status: string; category_name?: string; provider_id?: string|null; description?:string; created_at?:string };
type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};
const statusText: Record<string, [string, string, string]> = {
  requested: ['🔎', 'En attente d’un partenaire', 'On cherche un partenaire disponible pour ta job.'],
  offered: ['📣', 'En attente d’un partenaire', 'Ta demande est envoyée aux partenaires disponibles.'],
  assigned: ['🤝', 'Partenaire trouvé', 'Un partenaire a accepté ta mission.'],
  en_route: ['🚗', 'Votre partenaire est en route', 'Il se dirige maintenant vers l’adresse de la job.'],
  arrived: ['📍', 'Votre partenaire est arrivé', 'Il est maintenant sur place.'],
  in_progress: ['🛠️', 'La job est en cours', 'Le temps de travail est maintenant comptabilisé.'],
  completed: ['✅', 'La job est terminée', 'La facture est prête dans Mes missions.'],
};
function getMissionIdShownOnScreen(){const box=document.querySelector<HTMLElement>('.flow-card .success-box');return box?.textContent?.match(/Mission\s+#(\d+)/i)?.[1]||null;}
function normalizedMissionStatus(mission:ClientMission){return mission.provider_id&&['requested','offered'].includes(mission.status)?'assigned':mission.status;}
function updateVisibleClientScreen(mission:ClientMission){const effectiveStatus=normalizedMissionStatus(mission),status=statusText[effectiveStatus]||['ℹ️','Mise à jour',`Statut : ${effectiveStatus}`],visibleId=getMissionIdShownOnScreen();if(visibleId&&String(visibleId)!==String(mission.id))return;const title=document.querySelector<HTMLElement>('.flow-card .flow-title'),box=document.querySelector<HTMLElement>('.flow-card .success-box');if(title&&box){title.textContent=`${status[0]} ${status[1]}`;box.textContent=`Mission #${mission.id} • ${status[2]}`;}}
function ClientMissionTracker(){const[mission,setMission]=useState<ClientMission|null>(null);useEffect(()=>{let cancelled=false;const refresh=async()=>{const visibleId=getMissionIdShownOnScreen();if(!visibleId){if(!cancelled)setMission(null);return}try{const r=await fetch(`/api/missions/${visibleId}`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const data=await r.json();const current=(data.mission||data) as ClientMission;if(!cancelled){setMission(current);updateVisibleClientScreen(current)}}catch{}};refresh();const timer=window.setInterval(refresh,1000);return()=>{cancelled=true;window.clearInterval(timer)}},[]);useEffect(()=>{if(!mission)return;const apply=()=>updateVisibleClientScreen(mission);apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true,characterData:true});return()=>observer.disconnect()},[mission?.id,mission?.status,mission?.provider_id]);if(!mission||!getMissionIdShownOnScreen())return null;const effectiveStatus=normalizedMissionStatus(mission),[icon,title,detail]=statusText[effectiveStatus]||['ℹ️',effectiveStatus,'Le statut vient d’être mis à jour.'];return <aside className="client-live-tracker"><div><div className="client-live-eyebrow">Mission #{mission.id}{mission.category_name?` • ${mission.category_name}`:''}</div><strong>{icon} {title}</strong><span>{detail}</span></div></aside>}

function ClientActiveMissionBanner(){
  const[mission,setMission]=useState<ClientMission|null>(null);const[open,setOpen]=useState(false);
  useEffect(()=>{let stopped=false;const refresh=async()=>{try{const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();const active=(d.missions||[]).find((m:ClientMission)=>!['completed','cancelled'].includes(m.status))||null;if(!stopped)setMission(active)}catch{}};refresh();const t=window.setInterval(refresh,3000);return()=>{stopped=true;window.clearInterval(t)}},[]);
  if(!mission)return null;const effective=normalizedMissionStatus(mission);const [icon,title,detail]=statusText[effective]||['📋',effective,'Mise à jour de ta mission.'];
  return <div style={{position:'relative',zIndex:20,background:'#07101f',padding:'14px 18px 0'}}><button onClick={()=>setOpen(v=>!v)} style={{width:'100%',maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',gap:14,textAlign:'left',background:'linear-gradient(135deg,#12315a,#0d203b)',border:'2px solid #2693ff',borderRadius:22,padding:'18px 20px',color:'#fff',boxShadow:'0 10px 32px rgba(0,0,0,.3)'}}><span style={{fontSize:34}}>{icon}</span><span style={{flex:1}}><small style={{display:'block',color:'#8fbce9',fontWeight:800,textTransform:'uppercase',letterSpacing:1}}>Mission active #{mission.id}</small><strong style={{display:'block',fontSize:'clamp(20px,5vw,30px)',marginTop:3}}>{title}</strong><span style={{display:'block',color:'#c6d5e7',marginTop:4}}>{detail}</span></span><span style={{fontSize:22}}>{open?'⌃':'›'}</span></button>{open&&<div style={{maxWidth:1100,margin:'8px auto 0',background:'#0d192a',border:'1px solid #29415f',borderRadius:18,padding:'18px 20px',color:'#eaf2ff'}}><strong>{mission.category_name||'Mission'} • #{mission.id}</strong>{mission.description&&<p style={{whiteSpace:'pre-line',lineHeight:1.55,color:'#b8c8dc',marginBottom:0}}>{mission.description}</p>}</div>}</div>;
}

function LogoInjector(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLElement>('.brand-button').forEach(el=>{if(el.dataset.logoApplied==='1')return;el.dataset.logoApplied='1';el.textContent='';const img=document.createElement('img');img.src=BRAND_LOGO;img.alt='FaisLaJob.ca';img.style.height='52px';img.style.width='auto';img.style.maxWidth='190px';img.style.objectFit='contain';img.style.display='block';el.appendChild(img);});
      document.querySelectorAll<HTMLElement>('.admin-logo').forEach(el=>{if(el.dataset.logoApplied==='1')return;el.dataset.logoApplied='1';const hasAdmin=/admin/i.test(el.textContent||'');el.textContent='';el.style.display='flex';el.style.alignItems='center';el.style.gap='9px';const img=document.createElement('img');img.src=BRAND_LOGO;img.alt='FaisLaJob.ca';img.style.height='46px';img.style.width='auto';img.style.maxWidth='175px';img.style.objectFit='contain';img.style.display='block';el.appendChild(img);if(hasAdmin){const badge=document.createElement('span');badge.textContent='Admin';badge.style.fontSize='.72rem';badge.style.fontWeight='900';badge.style.padding='4px 7px';badge.style.borderRadius='999px';badge.style.background='#1577E6';badge.style.color='white';el.appendChild(badge);}});
    };apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);return null;
}

function RoleGuardMessage({user}:{user:User}){return <main className="page-shell"><section className="flow-card" style={{marginTop:30}}><div className="eyebrow">Compte {user.role==='provider'?'partenaire':'client'}</div><h1 className="flow-title">Cette page n’est pas disponible pour ce compte</h1><p className="flow-copy">Tu es connecté comme {user.role==='provider'?'partenaire':'client'}. FaisLaJob garde maintenant les deux portails séparés pour éviter de mélanger les sessions.</p><button className="primary-button full-button" onClick={()=>{window.location.href='/'}}>Retour à mon portail</button></section></main>}

function RootRouter(){
  const [user,setUser]=useState<User|null|undefined>(undefined);const path=window.location.pathname;
  const loadUser=async()=>{try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){setUser(null);return}setUser((await r.json()).user)}catch{setUser(null)}};useEffect(()=>{loadUser()},[]);
  useEffect(()=>{if(user!==null)return;let stopped=false;const check=async()=>{if(stopped)return;try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(r.ok){const next=(await r.json()).user as User;if(!stopped)setUser(next)}}catch{}};const timer=window.setInterval(check,800);return()=>{stopped=true;window.clearInterval(timer)}},[user]);
  const logout=async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});localStorage.clear();setUser(null);window.location.href='/'};
  if(user===undefined)return <main className="page-shell"><section className="flow-card" style={{marginTop:30}}><p className="flow-copy">Chargement de FaisLaJob…</p></section></main>;
  const isRequest=path==='/request'||path.startsWith('/request/');if(isRequest){if(user?.role==='provider')return <RoleGuardMessage user={user}/>;return <><App/><ClientMissionTracker/></>}
  if(user)return <>{user.role==='client'&&<ClientActiveMissionBanner/>}<UserPortal user={user} onLogout={logout}/></>;
  return <><App/><ClientMissionTracker/></>;
}

const isAdmin=window.location.pathname==='/admin'||window.location.pathname.startsWith('/admin/');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LogoInjector/>{isAdmin?<AdminPortal/>:<RootRouter/>}</React.StrictMode>);
