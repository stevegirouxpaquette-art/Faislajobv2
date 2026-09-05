import { useEffect, useMemo, useState } from 'react';
import PushPanel from './push-client';
import { dailyPin, providerMissionId, providerPublicId } from './publicIds';
import './provider-v2.css';

type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};
type Provider={id:string;name:string;email?:string;phone?:string;status:string;is_online:boolean;category_ids?:string[]};
type Offer={offer_id:string;mission_id:string;category_name:string;description:string;mission_status:string;offered_at?:string};
type Mission={id:string;provider_id:string|null;category_name?:string;category_id:string;status:string;description:string;duration_minutes?:number|null;created_at?:string;started_at?:string;completed_at?:string};
type MissionTask={id:string;position:number;title:string;details:string;required:boolean;completed:boolean;completed_at?:string|null};
type Payout={id:string;mission_id:string;category_name:string;amount_cents:number;status:string;release_at?:string|null;created_at?:string};
type BillingDetail={mission_id:string;subtotal_cents:number;client_total_cents:number;provider_commission_cents:number;provider_net_cents:number;payout_status?:string;release_at?:string|null};
type ProviderTab='home'|'jobs'|'earnings'|'messages'|'profile';

const cats=['menage','reparations','exterieur','demenagement','deneigement','animaux'];
const money=(v?:number|null)=>typeof v==='number'?`${(v/100).toFixed(2).replace('.',',')} $`:'—';
const statusLabel:Record<string,string>={requested:'En attente',offered:'Offerte',assigned:'Assignée',en_route:'En route',arrived:'Arrivé',in_progress:'En cours',completed:'Terminée',cancelled:'Annulée'};
const statusIcon:Record<string,string>={requested:'🕒',offered:'⚡',assigned:'🤝',en_route:'🚗',arrived:'📍',in_progress:'🛠️',completed:'✅',cancelled:'✖️'};
const payoutLabel:Record<string,string>={waiting_payment:'En attente du paiement',holding:'À recevoir',ready:'Prêt à payer',paid:'Payé',pending:'En attente'};
const shortDate=(value?:string|null)=>value?new Date(value).toLocaleDateString('fr-CA',{day:'numeric',month:'short'}):'—';
const isToday=(value?:string|null)=>{if(!value)return false;const d=new Date(value),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()};

export default function ProviderPortalV2({user,onLogout}:{user:User;onLogout:()=>void}){
 const[tab,setTab]=useState<ProviderTab>('home');
 const[provider,setProvider]=useState<Provider|null>(null);
 const[offers,setOffers]=useState<Offer[]>([]);
 const[mission,setMission]=useState<Mission|null>(null);
 const[payouts,setPayouts]=useState<Payout[]>([]);
 const[billingByMission,setBillingByMission]=useState<Record<string,BillingDetail>>({});
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');
 const id=user.provider_id;

 const load=async(background=false)=>{
  if(!id)return;
  if(!background){setLoading(true);setError('')}
  try{
   const[pr,or,pa]=await Promise.all([
    fetch(`/api/providers/${id}`,{credentials:'same-origin',cache:'no-store'}),
    fetch(`/api/providers/${id}/offers`,{credentials:'same-origin',cache:'no-store'}),
    fetch('/api/provider/payouts',{credentials:'same-origin',cache:'no-store'})
   ]);
   if(pr.ok)setProvider((await pr.json()).provider);
   if(or.ok)setOffers((await or.json()).offers||[]);
   if(pa.ok)setPayouts((await pa.json()).payouts||[]);
   const stored=localStorage.getItem(`faislajob_active_mission_${id}`);
   if(stored){
    const mr=await fetch(`/api/missions/${stored}`,{credentials:'same-origin',cache:'no-store'});
    if(mr.ok){
     const m=(await mr.json()).mission as Mission;
     if(['completed','cancelled'].includes(m.status)){setMission(null);localStorage.removeItem(`faislajob_active_mission_${id}`)}else setMission(m);
    }
   }
  }catch(e){if(!background)setError(e instanceof Error?e.message:'Erreur partenaire')}
  finally{if(!background)setLoading(false)}
 };

 useEffect(()=>{void load();const t=window.setInterval(()=>void load(true),4000);return()=>window.clearInterval(t)},[id]);

 const payoutKey=payouts.map(p=>p.mission_id).join(',');
 useEffect(()=>{
  if(!payoutKey)return;
  let cancelled=false;
  const hydrate=async()=>{
   const missing=payouts.filter(p=>!billingByMission[p.mission_id]);
   if(!missing.length)return;
   const rows=await Promise.all(missing.map(async p=>{
    try{const r=await fetch(`/api/missions/${p.mission_id}/billing`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)return null;const d=await r.json();return d.billing as BillingDetail}catch{return null}
   }));
   if(cancelled)return;
   setBillingByMission(prev=>{const next={...prev};rows.filter(Boolean).forEach(b=>{next[String((b as BillingDetail).mission_id)]=b as BillingDetail});return next});
  };
  void hydrate();
  return()=>{cancelled=true};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[payoutKey]);

 const toggle=async()=>{
  if(!id||!provider)return;
  setError('');
  try{
   const r=await fetch(`/api/providers/${id}/availability`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({online:!provider.is_online,categoryIds:provider.category_ids?.length?provider.category_ids:cats})});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Impossible de modifier ta disponibilité.')}
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'Action impossible')}
 };

 const accept=async(offerId:string)=>{
  setError('');
  const r=await fetch(`/api/offers/${offerId}/accept`,{method:'POST',credentials:'same-origin'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){setError(d.error||'Mission non disponible.');return}
  setMission(d.mission);localStorage.setItem(`faislajob_active_mission_${id}`,d.mission.id);setTab('home');await load(true);
 };
 const decline=async(offerId:string)=>{await fetch(`/api/offers/${offerId}/decline`,{method:'POST',credentials:'same-origin'});await load(true)};
 const act=async(action:'en-route'|'arrive'|'start'|'complete')=>{
  if(!mission)return;
  setError('');
  const r=await fetch(`/api/missions/${mission.id}/${action}`,{method:'POST',credentials:'same-origin'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){setError(d.error||'Action impossible.');return}
  if(d.mission.status==='completed'){localStorage.removeItem(`faislajob_active_mission_${id}`);setMission(null);setTab('earnings')}else setMission(d.mission);
  await load(true);
 };

 const total=useMemo(()=>payouts.reduce((s,p)=>s+Number(p.amount_cents||0),0),[payouts]);
 const paid=useMemo(()=>payouts.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount_cents||0),0),[payouts]);
 const pending=total-paid;
 const todayPayouts=useMemo(()=>payouts.filter(p=>isToday(p.created_at)),[payouts]);
 const todayTotal=useMemo(()=>todayPayouts.reduce((s,p)=>s+Number(p.amount_cents||0),0),[todayPayouts]);
 const nextRelease=useMemo(()=>payouts.filter(p=>p.status!=='paid'&&p.release_at).map(p=>p.release_at as string).sort((a,b)=>new Date(a).getTime()-new Date(b).getTime())[0]||null,[payouts]);
 const firstName=user.name?.split(' ')[0]||'Partenaire';
 const title=tab==='home'?(mission?'Mission en cours':'Tableau de bord'):tab==='jobs'?'Jobs disponibles':tab==='earnings'?'Tes revenus':tab==='messages'?'Messages & support':'Ton profil';

 const navItems:[ProviderTab,string,string][]= [['home','⌂','Accueil'],['jobs','⚡','Jobs'],['earnings','💰','Revenus'],['messages','✉','Messages'],['profile','👤','Profil']];
 const goNotifications=()=>{setTab('profile');window.setTimeout(()=>document.querySelector('[data-push-panel="1"]')?.scrollIntoView({behavior:'smooth',block:'center'}),80)};

 return <main className="provider-v2-shell">
  <aside className="provider-v2-sidebar">
   <button className="brand brand-button provider-v2-brand" onClick={()=>setTab('home')}>FaisLaJob</button>
   <span className="provider-v2-role">Portail partenaire</span>
   <nav>{navItems.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><span>{icon}</span><b>{label}</b>{key==='jobs'&&offers.length>0&&<i>{offers.length}</i>}</button>)}</nav>
   <div className="provider-v2-side-status"><span className={provider?.is_online?'dot online':'dot'}/><div><strong>{provider?.is_online?'En ligne':'Hors ligne'}</strong><small>{provider?.is_online?'Disponible pour les jobs':'Non visible aux clients'}</small></div></div>
  </aside>

  <section className="provider-v2-main">
   <div className="provider-v2-mobile-bar"><button className="brand brand-button provider-v2-mobile-brand" onClick={()=>setTab('home')}>FaisLaJob</button><div><button className="provider-v2-icon-btn" aria-label="Notifications" onClick={goNotifications}>🔔</button><button className="provider-v2-icon-btn" aria-label="Messages" onClick={()=>setTab('messages')}>✉️</button></div></div>
   <header className="provider-v2-header">
    <div><span className="provider-v2-kicker">Portail partenaire</span><h1>{title}</h1>{tab==='home'&&<p>Bonjour {firstName} 👋</p>}</div>
    <div className="provider-v2-header-actions"><button className="provider-v2-icon-btn desktop-only" aria-label="Notifications" onClick={goNotifications}>🔔</button><button className="provider-v2-icon-btn desktop-only" aria-label="Messages" onClick={()=>setTab('messages')}>✉️</button><button className={`provider-v2-online ${provider?.is_online?'online':''}`} onClick={toggle}><span/>{provider?.is_online?'En ligne':'Hors ligne'}</button></div>
   </header>

   {error&&<div className="provider-v2-alert">⚠️ {error}</div>}

   {tab==='home'&&<>
    <section className={`provider-v2-availability ${provider?.is_online?'online':''}`}>
     <div className="provider-v2-availability-icon">{provider?.is_online?'●':'○'}</div>
     <div><span className="provider-v2-kicker">Disponibilité</span><h2>{provider?.is_online?'Tu es en ligne':'Tu es hors ligne'}</h2><p>{provider?.is_online?'Recherche de missions activée. Les nouvelles offres apparaîtront automatiquement.':'Mets-toi en ligne pour recevoir les jobs correspondant à tes catégories.'}</p></div>
     <div className="provider-v2-availability-end"><strong>{offers.length}</strong><small>job{offers.length!==1?'s':''} disponible{offers.length!==1?'s':''}</small>{offers.length>0&&<button onClick={()=>setTab('jobs')}>Voir les jobs →</button>}</div>
    </section>

    {mission?<ActiveMissionV2 mission={mission} act={act}/>:offers[0]?<section className="provider-v2-offer-preview"><div className="provider-v2-offer-icon">⚡</div><div><span className="provider-v2-kicker">Nouvelle offre • Mission #{providerMissionId(offers[0].mission_id)}</span><h2>{offers[0].category_name}</h2><p>{offers[0].description}</p></div><button onClick={()=>setTab('jobs')}>Voir l’offre</button></section>:<section className="provider-v2-searching"><div>📡</div><div><h2>{provider?.is_online?'On cherche des jobs pour toi':'Active ta disponibilité'}</h2><p>{provider?.is_online?'Tu peux laisser FaisLaJob ouvert ou revenir plus tard. Les notifications peuvent t’avertir lorsqu’une offre arrive.':'Tu ne recevras aucune nouvelle offre tant que ton statut est hors ligne.'}</p></div>{!provider?.is_online&&<button onClick={toggle}>Me mettre en ligne</button>}</section>}

    <section className="provider-v2-today"><div><span>Aujourd’hui</span><strong>{todayPayouts.length}</strong><small>mission{todayPayouts.length!==1?'s':''} terminée{todayPayouts.length!==1?'s':''}</small></div><div><span>Gagné</span><strong>{money(todayTotal)}</strong><small>revenus générés</small></div><div><span>Offres</span><strong>{offers.length}</strong><small>disponibles maintenant</small></div></section>

    <section className="provider-v2-receivable"><div><span className="provider-v2-kicker">À recevoir</span><strong>{money(pending)}</strong><small>{nextRelease?`Prochain versement prévu le ${shortDate(nextRelease)}`:'Aucun versement planifié'}</small></div><button onClick={()=>setTab('earnings')}>Voir mes revenus →</button></section>
   </>}

   {tab==='jobs'&&<section className="provider-v2-panel"><div className="provider-v2-panel-head"><div><span className="provider-v2-kicker">Radar</span><h2>{offers.length} job{offers.length!==1?'s':''} disponible{offers.length!==1?'s':''}</h2></div><button onClick={()=>void load(false)}>↻ Actualiser</button></div>{loading&&offers.length===0?<div className="provider-v2-empty">Chargement…</div>:offers.length===0?<div className="provider-v2-empty"><div>📭</div><h3>Aucune offre pour le moment</h3><p>{provider?.is_online?'Tu es bien en ligne. Les nouvelles offres apparaîtront ici automatiquement.':'Mets-toi en ligne pour recevoir des offres.'}</p>{!provider?.is_online&&<button onClick={toggle}>Me mettre en ligne</button>}</div>:<div className="provider-v2-job-list">{offers.map(o=><article className="provider-v2-job" key={o.offer_id}><div><span className="provider-v2-kicker">Mission #{providerMissionId(o.mission_id)}</span><h3>{o.category_name}</h3><p>{o.description}</p></div><div className="provider-v2-job-actions"><button className="accept" onClick={()=>accept(o.offer_id)}>Accepter</button><button onClick={()=>decline(o.offer_id)}>Refuser</button></div></article>)}</div>}</section>}

   {tab==='earnings'&&<>
    <section className="provider-v2-earnings-summary"><div className="provider-v2-total-card"><span>Total généré</span><strong>{money(total)}</strong><small>{payouts.length} mission{payouts.length!==1?'s':''}</small></div><div className="provider-v2-money-card"><span>Payé</span><strong>{money(paid)}</strong><small>Versements complétés</small></div><div className="provider-v2-money-card highlight"><span>À recevoir</span><strong>{money(pending)}</strong><small>{nextRelease?`Prochain : ${shortDate(nextRelease)}`:'Aucun versement prévu'}</small></div></section>
    <section className="provider-v2-panel"><div className="provider-v2-panel-head"><div><span className="provider-v2-kicker">Historique</span><h2>Mes versements</h2></div></div>{payouts.length===0?<div className="provider-v2-empty">Aucun versement pour le moment.</div>:<div className="provider-v2-payout-list">{payouts.map(p=>{const b=billingByMission[p.mission_id];return <article className="provider-v2-payout" key={p.id}><div className="provider-v2-payout-head"><div><strong>Mission #{providerMissionId(p.mission_id)} • {p.category_name}</strong><span>{p.release_at?`Versement prévu le ${shortDate(p.release_at)}`:'Versement enregistré'}</span></div><span className={`provider-v2-payout-status status-${p.status}`}>{payoutLabel[p.status]||p.status}</span></div><div className="provider-v2-payout-breakdown"><div><span>Montant du service</span><strong>{b?money(b.subtotal_cents):'—'}</strong></div><div><span>Commission FaisLaJob</span><strong>{b?`− ${money(b.provider_commission_cents)}`:'—'}</strong></div><div className="net"><span>Tu reçois</span><strong>{money(b?.provider_net_cents??p.amount_cents)}</strong></div></div></article>})}</div>}</section>
   </>}

   {tab==='messages'&&<section className="provider-v2-panel provider-v2-support"><div className="provider-v2-support-icon">✉️</div><span className="provider-v2-kicker">Support partenaire</span><h2>Besoin d’aide?</h2><p>La boîte de clavardage partenaire n’est pas encore branchée dans cette version. Pour le moment, tu peux joindre l’équipe FaisLaJob par courriel. Ton identifiant partenaire est <strong>{providerPublicId(user.provider_id)}</strong>.</p><a href={`mailto:support@faislajob.ca?subject=${encodeURIComponent(`Support partenaire ${providerPublicId(user.provider_id)}`)}`}>Écrire au support</a><div className="provider-v2-support-note">Pour une mission, indique aussi son numéro public afin d’accélérer le traitement.</div></section>}

   {tab==='profile'&&<ProviderProfile user={user} provider={provider} onLogout={onLogout}/>}
  </section>

  <nav className="provider-v2-bottom-nav">{navItems.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><span>{icon}{key==='jobs'&&offers.length>0&&<i>{offers.length}</i>}</span><b>{label}</b></button>)}</nav>
 </main>;
}

function ActiveMissionV2({mission,act}:{mission:Mission;act:(a:'en-route'|'arrive'|'start'|'complete')=>void}){
 const[tasks,setTasks]=useState<MissionTask[]>([]),[taskError,setTaskError]=useState('');
 const loadTasks=async()=>{try{const r=await fetch(`/api/missions/${mission.id}/tasks`,{credentials:'same-origin',cache:'no-store'});if(r.ok)setTasks((await r.json()).tasks||[])}catch{}};
 useEffect(()=>{void loadTasks()},[mission.id,mission.status]);
 const toggleTask=async(task:MissionTask)=>{if(mission.status!=='in_progress')return;setTaskError('');const r=await fetch(`/api/missions/${mission.id}/tasks/${task.id}/toggle`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:!task.completed})});const d=await r.json().catch(()=>({}));if(!r.ok){setTaskError(d.error||'Impossible de mettre la tâche à jour.');return}setTasks(items=>items.map(t=>t.id===task.id?d.task:t))};
 const remaining=tasks.filter(t=>t.required&&!t.completed).length;
 const next:{action:'en-route'|'arrive'|'start'|'complete';label:string}|null=mission.status==='assigned'?{action:'en-route',label:'🚗 Je suis en route'}:mission.status==='en_route'?{action:'arrive',label:'📍 Je suis arrivé'}:mission.status==='arrived'?{action:'start',label:'▶️ Commencer la job'}:mission.status==='in_progress'?{action:'complete',label:'✅ Terminer la job'}:null;
 const completeBlocked=next?.action==='complete'&&remaining>0;
 return <section className="provider-v2-active-mission"><div className="provider-v2-active-icon">{statusIcon[mission.status]||'🧭'}</div><div className="provider-v2-active-main"><span className="provider-v2-kicker">Mission #{providerMissionId(mission.id)} • {mission.category_name||mission.category_id}</span><h2>{statusLabel[mission.status]||mission.status}</h2><p>{mission.description}</p><div className="provider-v2-progress"><i className={['assigned','en_route','arrived','in_progress'].includes(mission.status)?'done':''}/><i className={['en_route','arrived','in_progress'].includes(mission.status)?'done':''}/><i className={['arrived','in_progress'].includes(mission.status)?'done':''}/><i className={mission.status==='in_progress'?'done':''}/></div>{tasks.length>0&&<div className="provider-v2-tasks"><div className="provider-v2-task-head"><strong>Liste de tâches</strong><span>{tasks.filter(t=>t.completed).length}/{tasks.length}</span></div>{tasks.map(task=><button key={task.id} className={task.completed?'done':''} disabled={mission.status!=='in_progress'} onClick={()=>toggleTask(task)}><span>{task.completed?'✓':'□'}</span><div><strong>{task.title}</strong>{task.details&&<small>{task.details}</small>}</div></button>)}{mission.status!=='in_progress'&&<small>Les cases deviennent actives quand la job est commencée.</small>}{taskError&&<small className="error">{taskError}</small>}</div>}</div>{next&&<div className="provider-v2-next"><button disabled={completeBlocked} onClick={()=>act(next.action)}>{next.label}</button>{completeBlocked&&<small>Il reste {remaining} tâche{remaining!==1?'s':''} obligatoire{remaining!==1?'s':''}.</small>}</div>}</section>;
}

function ProviderProfile({user,provider,onLogout}:{user:User;provider:Provider|null;onLogout:()=>void}){
 const publicId=providerPublicId(user.provider_id),pin=dailyPin(user);
 return <div className="provider-v2-profile-stack"><section className="provider-v2-profile"><div className="provider-v2-profile-hero"><div>{user.name?.[0]?.toUpperCase()||'F'}</div><span className="provider-v2-kicker">Compte partenaire</span><h2>{user.name}</h2><p>Compte FaisLaJob {provider?.status==='active'||!provider?.status?'actif':provider.status}</p></div><div className="provider-v2-id-grid"><div><span>Identifiant partenaire</span><strong>{publicId}</strong></div><div><span>NIP du jour</span><strong>{pin}</strong><small>Change chaque jour</small></div></div><div className="provider-v2-profile-lines"><div><span>Courriel</span><strong>{user.email}</strong></div><div><span>Téléphone</span><strong>{user.phone||'Non renseigné'}</strong></div><div><span>Disponibilité</span><strong>{provider?.is_online?'🟢 En ligne':'⚪ Hors ligne'}</strong></div><div><span>Catégories</span><strong>{provider?.category_ids?.length||cats.length}</strong></div></div></section><PushPanel/><button className="provider-v2-logout" onClick={onLogout}>Déconnexion</button></div>;
}
