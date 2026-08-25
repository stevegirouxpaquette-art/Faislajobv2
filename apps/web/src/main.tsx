import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPortal from './AdminPortal';
import UserPortal from './UserPortal';
import './styles.css';
import './portal.css';
import './client-ui-upgrade';
import './client-experience.css';
import './request-premium.css';
import './request-premium';
import './request-experience';
import './address-autocomplete';

const BRAND_LOGO='https://335a351f-416d-4e29-89d5-2204a8876ab2.sandbox.floot.app/_cdn/static/40f11d09-fbf4-43b4-8bbf-9da5343620ff-IMG_2043.png';
type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};

function LogoInjector(){useEffect(()=>{const apply=()=>{document.querySelectorAll<HTMLElement>('.brand-button').forEach(el=>{if(el.dataset.logoApplied==='1')return;el.dataset.logoApplied='1';el.textContent='';const img=document.createElement('img');img.src=BRAND_LOGO;img.alt='FaisLaJob.ca';img.style.height='52px';img.style.width='auto';img.style.maxWidth='190px';img.style.objectFit='contain';img.style.display='block';el.appendChild(img)});document.querySelectorAll<HTMLElement>('.admin-logo').forEach(el=>{if(el.dataset.logoApplied==='1')return;el.dataset.logoApplied='1';const hasAdmin=/admin/i.test(el.textContent||'');el.textContent='';el.style.display='flex';el.style.alignItems='center';el.style.gap='9px';const img=document.createElement('img');img.src=BRAND_LOGO;img.alt='FaisLaJob.ca';img.style.height='46px';img.style.width='auto';img.style.maxWidth='175px';img.style.objectFit='contain';img.style.display='block';el.appendChild(img);if(hasAdmin){const badge=document.createElement('span');badge.textContent='Admin';badge.style.fontSize='.72rem';badge.style.fontWeight='900';badge.style.padding='4px 7px';badge.style.borderRadius='999px';badge.style.background='#1577E6';badge.style.color='white';el.appendChild(badge)}})};apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);return null}

function RoleGuardMessage({user}:{user:User}){return <main className="page-shell"><section className="flow-card" style={{marginTop:30}}><div className="eyebrow">Compte {user.role==='provider'?'partenaire':'client'}</div><h1 className="flow-title">Cette page n’est pas disponible pour ce compte</h1><p className="flow-copy">Tu es connecté comme {user.role==='provider'?'partenaire':'client'}. FaisLaJob garde maintenant les deux portails séparés pour éviter de mélanger les sessions.</p><button className="primary-button full-button" onClick={()=>{window.location.href='/'}}>Retour à mon portail</button></section></main>}

function RootRouter(){
 const[user,setUser]=useState<User|null|undefined>(undefined),path=window.location.pathname;
 const loadUser=async()=>{try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){setUser(null);return}setUser((await r.json()).user)}catch{setUser(null)}};
 useEffect(()=>{loadUser()},[]);
 useEffect(()=>{if(user!==null)return;let stopped=false;const check=async()=>{if(stopped)return;try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(r.ok){const next=(await r.json()).user as User;if(!stopped)setUser(next)}}catch{}};const timer=window.setInterval(check,800);return()=>{stopped=true;window.clearInterval(timer)}},[user]);
 const logout=async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});localStorage.clear();setUser(null);window.location.href='/'};
 if(user===undefined)return <main className="page-shell"><section className="flow-card" style={{marginTop:30}}><p className="flow-copy">Chargement de FaisLaJob…</p></section></main>;
 const isRequest=path==='/request'||path.startsWith('/request/');
 if(isRequest){if(user?.role==='provider')return <RoleGuardMessage user={user}/>;return <App/>}
 if(user)return <UserPortal user={user} onLogout={logout}/>;
 return <App/>
}

const isAdmin=window.location.pathname==='/admin'||window.location.pathname.startsWith('/admin/');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LogoInjector/>{isAdmin?<AdminPortal/>:<RootRouter/>}</React.StrictMode>);
