import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPortal from './AdminPortal';
import './styles.css';

const BRAND_LOGO='https://335a351f-416d-4e29-89d5-2204a8876ab2.sandbox.floot.app/_cdn/static/40f11d09-fbf4-43b4-8bbf-9da5343620ff-IMG_2043.png';

type ClientMission = { id: string; status: string; category_name?: string };
const statusText: Record<string, [string, string, string]> = {
  requested: ['🔎', 'Recherche d’un partenaire', 'On cherche un partenaire disponible pour ta job.'],
  offered: ['📣', 'Recherche d’un partenaire', 'Ta demande est envoyée aux partenaires disponibles.'],
  assigned: ['🤝', 'Partenaire trouvé', 'Un partenaire a accepté ta mission.'],
  en_route: ['🚗', 'Ton partenaire est en route', 'Il se dirige maintenant vers l’adresse de la job.'],
  arrived: ['📍', 'Ton partenaire est arrivé', 'Il est maintenant sur place.'],
  in_progress: ['🛠️', 'La job est en cours', 'Le temps de travail est maintenant comptabilisé.'],
  completed: ['✅', 'La job est terminée', 'La facture est prête dans Mes missions.'],
};
function getMissionIdShownOnScreen(){const box=document.querySelector<HTMLElement>('.flow-card .success-box');return box?.textContent?.match(/Mission\s+#(\d+)/i)?.[1]||null;}
function updateVisibleClientScreen(mission:ClientMission){const status=statusText[mission.status]||['ℹ️','Mise à jour',`Statut : ${mission.status}`],visibleId=getMissionIdShownOnScreen();if(visibleId&&String(visibleId)!==String(mission.id))return;const title=document.querySelector<HTMLElement>('.flow-card .flow-title'),box=document.querySelector<HTMLElement>('.flow-card .success-box');if(title&&box){title.textContent=`${status[0]} ${status[1]}`;box.textContent=`Mission #${mission.id} • ${status[2]}`;}}
function ClientMissionTracker(){const[mission,setMission]=useState<ClientMission|null>(null);useEffect(()=>{let cancelled=false;const refresh=async()=>{try{const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});if(!r.ok){if(!cancelled)setMission(null);return}const missions=((await r.json()).missions||[]) as ClientMission[],visibleId=getMissionIdShownOnScreen(),current=visibleId?missions.find(x=>String(x.id)===String(visibleId))||null:missions.find(x=>x.status!=='completed')||missions[0]||null;if(!cancelled){setMission(current);if(current)updateVisibleClientScreen(current)}}catch{if(!cancelled)setMission(null)}};refresh();const timer=window.setInterval(refresh,1000);const observer=new MutationObserver(()=>{if(mission)updateVisibleClientScreen(mission)});observer.observe(document.body,{childList:true,subtree:true,characterData:true});return()=>{cancelled=true;window.clearInterval(timer);observer.disconnect()}},[mission?.id,mission?.status]);useEffect(()=>{if(mission)updateVisibleClientScreen(mission)},[mission]);if(!mission||!getMissionIdShownOnScreen())return null;const[icon,title,detail]=statusText[mission.status]||['ℹ️',mission.status,'Le statut vient d’être mis à jour.'];return <aside className="client-live-tracker"><div><div className="client-live-eyebrow">Mission #{mission.id}{mission.category_name?` • ${mission.category_name}`:''}</div><strong>{icon} {title}</strong><span>{detail}</span></div></aside>}

function LogoInjector(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLElement>('.brand-button').forEach(el=>{
        if(el.dataset.logoApplied==='1')return;
        el.dataset.logoApplied='1';
        el.textContent='';
        const img=document.createElement('img');
        img.src=BRAND_LOGO; img.alt='FaisLaJob.ca';
        img.style.height='52px'; img.style.width='auto'; img.style.maxWidth='190px'; img.style.objectFit='contain'; img.style.display='block';
        el.appendChild(img);
      });
      document.querySelectorAll<HTMLElement>('.admin-logo').forEach(el=>{
        if(el.dataset.logoApplied==='1')return;
        el.dataset.logoApplied='1';
        const hasAdmin=/admin/i.test(el.textContent||'');
        el.textContent='';
        el.style.display='flex'; el.style.alignItems='center'; el.style.gap='9px';
        const img=document.createElement('img');
        img.src=BRAND_LOGO; img.alt='FaisLaJob.ca';
        img.style.height='46px'; img.style.width='auto'; img.style.maxWidth='175px'; img.style.objectFit='contain'; img.style.display='block';
        el.appendChild(img);
        if(hasAdmin){const badge=document.createElement('span');badge.textContent='Admin';badge.style.fontSize='.72rem';badge.style.fontWeight='900';badge.style.padding='4px 7px';badge.style.borderRadius='999px';badge.style.background='#1577E6';badge.style.color='white';el.appendChild(badge);}
      });
    };
    apply();
    const observer=new MutationObserver(apply); observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}

const isAdmin=window.location.pathname==='/admin'||window.location.pathname.startsWith('/admin/');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LogoInjector/>{isAdmin?<AdminPortal/>:<><App/><ClientMissionTracker/></>}</React.StrictMode>);
