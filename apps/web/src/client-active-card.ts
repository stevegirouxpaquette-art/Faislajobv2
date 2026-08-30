import { clientOrderId } from './publicIds';

type ClientMission={id:string;category_name?:string;category_id?:string;status:string;description?:string;payment_status?:string|null;provider_id?:string|null;started_at?:string|null;duration_minutes?:number|null;client_total_cents?:number|null};
type Provider={id:string;name:string};
type Category={id:string;name:string;hourly_rate_cents?:number|null};
type Billing={client_total_cents?:number|null;billable_minutes?:number|null;subtotal_cents?:number|null;client_service_fee_cents?:number|null};
type ClientAnswer={question:string;answer:string};

const labels:Record<string,string>={requested:'En attente d’un partenaire',offered:'En attente d’un partenaire',assigned:'Partenaire trouvé',en_route:'Ton partenaire est en route',arrived:'Ton partenaire est arrivé',in_progress:'Job en cours',completed:'Mission terminée'};
const details:Record<string,string>={requested:'On cherche un partenaire disponible.',offered:'Ta demande est envoyée aux partenaires disponibles.',assigned:'Un partenaire a accepté ta commande.',en_route:'Ton partenaire se dirige vers toi.',arrived:'Ton partenaire est maintenant sur place.',in_progress:'Le travail a commencé.',completed:'Le travail est terminé.'};
const icons:Record<string,string>={requested:'📣',offered:'📣',assigned:'🤝',en_route:'🚗',arrived:'📍',in_progress:'●',completed:'✓'};

let busy=false;
let current:ClientMission|null=null;
let provider:Provider|null=null;
let hourlyRate=4000;
let billing:Billing|null=null;
let detailsOpen=false;
let lastProviderId='';
let categoriesLoaded=false;
let categories:Category[]=[];

function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string))}
function money(v?:number|null){return typeof v==='number'?`${(v/100).toFixed(2).replace('.',',')} $`:'—'}
function removeCard(){document.getElementById('client-active-top-card')?.remove()}
function fmtClock(totalSeconds:number){const s=Math.max(0,Math.floor(totalSeconds));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function goTo(tabText:string){const btn=[...document.querySelectorAll<HTMLButtonElement>('.user-portal-nav button')].find(b=>(b.textContent||'').includes(tabText));btn?.click();window.scrollTo({top:0,behavior:'smooth'})}
function escapeRegExp(v:string){return v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function extractBlock(text:string,label:string,nextLabels:string[]){const next=nextLabels.length?`(?=(?:${nextLabels.map(escapeRegExp).join('|')})\\s*:|$)`:'$';const match=text.match(new RegExp(`${escapeRegExp(label)}\\s*:?\\s*([\\s\\S]*?)${next}`,'i'));return String(match?.[1]||'').trim()}
function parseMissionDescription(description?:string){const text=String(description||'').replace(/\r/g,'').trim();const labels=['Informations prestataire','Temps estimé IA','Réponses client','Moment','Adresse','Code postal saisi','Coordonnées'];const summaryMarker=/Résumé IA\s*:/i;const intro=(text.split(summaryMarker)[0]||'').trim();return{intro,summary:extractBlock(text,'Résumé IA',labels),providerInfo:extractBlock(text,'Informations prestataire',labels.slice(1)),aiEstimate:extractBlock(text,'Temps estimé IA',labels.slice(2)),clientAnswers:extractBlock(text,'Réponses client',labels.slice(3)),timing:extractBlock(text,'Moment',labels.slice(4)),address:extractBlock(text,'Adresse',labels.slice(5)),postalCode:extractBlock(text,'Code postal saisi',['Coordonnées']),coordinates:extractBlock(text,'Coordonnées',[])}}
function parseClientAnswers(text:string):ClientAnswer[]{return String(text||'').split('\n').map(v=>v.trim()).filter(Boolean).map(line=>{const idx=line.indexOf(':');if(idx<0)return{question:'',answer:line};return{question:line.slice(0,idx).trim(),answer:line.slice(idx+1).trim()}})}
function sectionCard(title:string,content:string,accent='#8fc8ff'){if(!content)return'';return `<div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px"><div style="color:${accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px">${esc(title)}</div><div style="color:#eef6ff;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere">${esc(content)}</div></div>`}

function estimatedMinutes(m:ClientMission){
  const stored=Number(m.duration_minutes||0);
  if(Number.isFinite(stored)&&stored>0)return Math.max(15,Math.ceil(stored));
  const description=String(m.description||'');
  const ai=description.match(/Temps\s+estim[ée]\s+IA\s*:\s*(\d+(?:[.,]\d+)?)\s*(?:minutes?|min\b)/i);
  if(ai){const value=Number(ai[1].replace(',','.'));if(Number.isFinite(value)&&value>0)return Math.max(15,Math.ceil(value))}
  const duration=description.match(/dur[ée]e\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(heures?|hrs?|h|minutes?|min)\b/i);
  if(duration){const value=Number(duration[1].replace(',','.'));if(Number.isFinite(value)&&value>0){const unit=duration[2].toLowerCase();return Math.max(15,Math.ceil(unit.startsWith('h')?value*60:value))}}
  return 15;
}

function palette(m:ClientMission){
  const payment=m.status==='completed'&&m.payment_status!=='paid';
  if(payment)return {bg:'radial-gradient(circle at 25% 20%,rgba(247,181,0,.14),transparent 36%),linear-gradient(135deg,#2d2305,#171305)',border:'#f7b500',accent:'#ffd75a',soft:'#f4df9a',badge:'PAIEMENT REQUIS'};
  if(m.status==='in_progress')return {bg:'radial-gradient(circle at 25% 20%,rgba(31,199,122,.16),transparent 36%),linear-gradient(135deg,#052f23,#063b2b)',border:'#1fc77a',accent:'#25e38b',soft:'#c3ead7',badge:'MISSION ACTIVE'};
  return {bg:'radial-gradient(circle at 25% 20%,rgba(38,147,255,.16),transparent 36%),linear-gradient(135deg,#102e51,#0b1d35)',border:'#2693ff',accent:'#45a7ff',soft:'#d5e5f4',badge:'COMMANDE ACTIVE'};
}

function liveNumbers(m:ClientMission){
  const started=m.started_at?new Date(m.started_at).getTime():0;
  const elapsed=started?Math.max(0,Math.floor((Date.now()-started)/1000)):0;
  const elapsedMinutes=Math.max(1,Math.ceil(elapsed/60));
  const expectedMinutes=estimatedMinutes(m);
  const billableMinutes=m.status==='in_progress'?Math.max(15,elapsedMinutes):expectedMinutes;
  const subtotal=Math.ceil(hourlyRate*billableMinutes/60);
  const fee=Math.ceil(subtotal*.11);
  return {elapsed,billableMinutes,subtotal,fee,total:subtotal+fee};
}

function render(m:ClientMission){
  const shell=document.querySelector<HTMLElement>('.user-portal-shell');
  const root=document.getElementById('root');
  if(!shell||!root){removeCard();return}
  current=m;
  let card=document.getElementById('client-active-top-card') as HTMLElement|null;
  if(!card){card=document.createElement('section');card.id='client-active-top-card';root.insertBefore(card,shell)}

  const p=palette(m),payment=m.status==='completed'&&m.payment_status!=='paid',live=liveNumbers(m);
  const title=payment?'Paiement à compléter':(labels[m.status]||m.status);
  const description=payment?'La mission est terminée. Ta facture est prête.':(details[m.status]||'Mise à jour de ta commande.');
  const billed=payment?(billing?.subtotal_cents??live.subtotal):live.subtotal;
  const shownTotal=payment?(billing?.client_total_cents??m.client_total_cents??live.total):live.total;
  const minutes=payment?(billing?.billable_minutes??live.billableMinutes):live.billableMinutes;
  const rateHour=hourlyRate/100;
  const missionInfo=parseMissionDescription(m.description);
  const answers=parseClientAnswers(missionInfo.clientAnswers);
  const providerBlock=provider?`<div style="display:flex;align-items:center;gap:14px;min-width:0"><div style="width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;font-size:25px;font-weight:950;flex:0 0 auto">${esc(provider.name?.[0]?.toUpperCase()||'P')}</div><div style="min-width:0"><strong style="display:block;font-size:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(provider.name)}</strong><span style="display:block;color:${p.soft};margin-top:3px">Partenaire</span></div></div>`:`<div><strong style="display:block;font-size:18px">${esc(m.category_name||'Service FaisLaJob')}</strong><span style="display:block;color:${p.soft};margin-top:3px">En attente du partenaire</span></div>`;

  const answersHtml=answers.length?`<div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Réponses du client</div><div style="display:grid;gap:11px">${answers.map((item,index)=>`<div style="${index<answers.length-1?'padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.09)':''}">${item.question?`<div style="color:${p.soft};font-size:13px;line-height:1.35;margin-bottom:4px">${esc(item.question)}</div>`:''}<div style="color:#fff;font-weight:800;line-height:1.45;overflow-wrap:anywhere">${esc(item.answer)}</div></div>`).join('')}</div></div>`:'';
  const planningBits=[missionInfo.timing?`<div><span style="display:block;color:${p.soft};font-size:12px;margin-bottom:3px">Moment</span><strong style="display:block;color:#fff;line-height:1.4">${esc(missionInfo.timing)}</strong></div>`:'',missionInfo.address?`<div><span style="display:block;color:${p.soft};font-size:12px;margin-bottom:3px">Adresse</span><strong style="display:block;color:#fff;line-height:1.45">${esc(missionInfo.address)}</strong>${missionInfo.postalCode?`<small style="display:block;color:${p.soft};margin-top:4px">Code postal : ${esc(missionInfo.postalCode)}</small>`:''}</div>`:''].filter(Boolean).join('<div style="height:1px;background:rgba(255,255,255,.09)"></div>');
  const planningHtml=planningBits?`<div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px;display:grid;gap:11px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase">Planification</div>${planningBits}${missionInfo.coordinates?`<details style="margin-top:1px"><summary style="color:${p.soft};font-size:12px;cursor:pointer">Coordonnées GPS</summary><div style="color:${p.soft};font-size:12px;margin-top:6px;overflow-wrap:anywhere">${esc(missionInfo.coordinates)}</div></details>`:''}</div>`:'';
  const fallbackDescription=!missionInfo.summary&&!missionInfo.providerInfo&&!answers.length&&!planningBits&&m.description?sectionCard('Détails de la demande',m.description,p.accent):'';

  const detailHtml=detailsOpen?`<div style="margin-top:14px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px;color:#eef6ff"><div style="display:grid;gap:12px"><div style="display:grid;grid-template-columns:1fr ${provider?'1fr':'auto'};gap:10px"><div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Service</div><strong style="display:block;font-size:17px">${esc(m.category_name||'Service FaisLaJob')}</strong>${missionInfo.intro?`<span style="display:block;color:${p.soft};margin-top:4px">${esc(missionInfo.intro)}</span>`:''}</div>${provider?`<div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Partenaire</div><strong style="display:block;font-size:17px">${esc(provider.name)}</strong></div>`:''}</div>${missionInfo.summary?sectionCard('Résumé de la job',missionInfo.summary,p.accent):''}${missionInfo.providerInfo?sectionCard('À savoir pour le prestataire',missionInfo.providerInfo.replace(/^[-–—]\s*/,''),p.accent):''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="background:rgba(69,167,255,.10);border:1px solid rgba(69,167,255,.28);border-radius:15px;padding:14px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">Temps estimé</div><strong style="display:block;font-size:23px;color:#fff">${estimatedMinutes(m)} min</strong></div><div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);border-radius:15px;padding:14px"><div style="color:${p.accent};font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">Tarif</div><strong style="display:block;font-size:23px;color:#fff">${rateHour.toFixed(2).replace('.',',')} $/h</strong></div></div>${answersHtml}${planningHtml}${fallbackDescription}<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 2px 2px;border-top:1px solid rgba(255,255,255,.12)"><span style="color:${p.soft}">${m.status==='in_progress'?'Temps facturé':'Durée estimée'}</span><strong id="client-live-minutes" style="font-size:18px">${minutes} min</strong></div><button id="client-open-orders" style="width:100%;margin-top:2px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.14);color:#fff;border-radius:13px;padding:12px;font-weight:900">Ouvrir Mes commandes</button></div></div>`:'';

  card.innerHTML=`<div style="background:#07101f;padding:14px 18px 0;color:#fff"><div style="width:min(1100px,100%);margin:0 auto;background:${p.bg};border:1.5px solid ${p.border};border-radius:24px;padding:20px;box-shadow:0 18px 45px rgba(0,0,0,.34)">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><span style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.08);color:${p.accent};font-weight:950;letter-spacing:.06em">${p.badge} <b style="width:7px;height:7px;border-radius:50%;background:${p.accent};display:inline-block"></b></span><span style="color:${p.soft};font-size:16px">Commande #${clientOrderId(m.id)}</span></div>
    <div style="margin-top:18px"><strong style="display:block;font-size:clamp(30px,7vw,44px);line-height:1.08;color:#fff"><span style="color:${p.accent}">${icons[m.status]||'●'}</span> ${esc(title)}</strong><span style="display:block;color:${p.soft};margin-top:9px;font-size:18px">${esc(description)}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center;margin-top:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.13)"><div>${providerBlock}</div><div style="text-align:right"><small style="display:block;color:${p.accent};font-weight:950;text-transform:uppercase;letter-spacing:.04em">${m.status==='in_progress'?'Temps écoulé':'Durée'}</small><strong id="client-live-clock" style="display:block;font-size:clamp(29px,8vw,44px);margin-top:3px;color:${m.status==='in_progress'?p.accent:'#fff'}">${m.status==='in_progress'?fmtClock(live.elapsed):`${estimatedMinutes(m)} min`}</strong><span style="color:${p.soft}">${m.status==='in_progress'?'Facturation en cours':payment?'Mission terminée':'Estimation'}</span></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px"><div><small style="display:block;color:${p.accent};font-weight:950;text-transform:uppercase">Facturation</small><strong id="client-live-billed" style="display:block;font-size:clamp(28px,8vw,42px);margin-top:4px">${money(billed)}</strong><span style="color:${p.soft}">${rateHour.toFixed(2).replace('.',',')} $ / h</span></div><div style="text-align:right"><small style="display:block;color:${p.accent};font-weight:950;text-transform:uppercase">${payment?'Total à payer':'Estimé total'}</small><strong id="client-live-total" style="display:block;font-size:clamp(28px,8vw,42px);margin-top:4px">${money(shownTotal)}</strong><span style="color:${p.soft}">Basé sur ${rateHour.toFixed(2).replace('.',',')} $ / h</span></div></div>
    <button id="client-active-top-action" style="width:100%;margin-top:20px;border:1px solid rgba(255,255,255,.17);background:rgba(4,15,24,.35);color:#fff;border-radius:15px;padding:16px;font-size:17px;font-weight:950;text-align:left;display:flex;justify-content:space-between;align-items:center"><span>☷ ${payment?'Voir le paiement':detailsOpen?'Masquer les détails':'Voir les détails de la mission'}</span><span style="font-size:28px;line-height:1">›</span></button>${detailHtml}
  </div></div>`;

  card.querySelector('#client-active-top-action')?.addEventListener('click',()=>{if(payment){goTo('Paiements');return}detailsOpen=!detailsOpen;if(current)render(current)});
  card.querySelector('#client-open-orders')?.addEventListener('click',()=>goTo('Mes commandes'));
}

function updateLiveValues(){if(!current||current.status!=='in_progress')return;const live=liveNumbers(current);const clock=document.getElementById('client-live-clock');if(clock)clock.textContent=fmtClock(live.elapsed);const billed=document.getElementById('client-live-billed');if(billed)billed.textContent=money(live.subtotal);const total=document.getElementById('client-live-total');if(total)total.textContent=money(live.total);const mins=document.getElementById('client-live-minutes');if(mins)mins.textContent=`${live.billableMinutes} min`}

async function loadCategories(m:ClientMission){if(!categoriesLoaded){try{const r=await fetch('/api/categories',{credentials:'same-origin',cache:'no-store'});if(r.ok){const d=await r.json();categories=(d.categories||[]) as Category[];categoriesLoaded=true}}catch{}}const cat=categories.find(c=>String(c.id)===String(m.category_id))||categories.find(c=>c.name===m.category_name);if(cat?.hourly_rate_cents!=null)hourlyRate=Number(cat.hourly_rate_cents)}
async function enrich(m:ClientMission){let full=m;try{const mr=await fetch(`/api/missions/${m.id}`,{credentials:'same-origin',cache:'no-store'});if(mr.ok){const d=await mr.json();full=(d.mission||d) as ClientMission}}catch{}await loadCategories(full);const pid=String(full.provider_id||'');if(pid&&pid!==lastProviderId){try{const pr=await fetch(`/api/providers/${pid}`,{credentials:'same-origin',cache:'no-store'});if(pr.ok){const d=await pr.json();provider=(d.provider||d) as Provider;lastProviderId=pid}}catch{}}else if(!pid){provider=null;lastProviderId=''}if(full.status==='completed'&&full.payment_status!=='paid'){try{const br=await fetch(`/api/missions/${full.id}/billing`,{credentials:'same-origin',cache:'no-store'});if(br.ok){const d=await br.json();billing=(d.billing||d) as Billing}}catch{}}else billing=null;return full}

async function refresh(){if(busy)return;busy=true;try{if(location.pathname.startsWith('/request')||location.pathname.startsWith('/admin')){removeCard();current=null;return}const shell=document.querySelector<HTMLElement>('.user-portal-shell');if(!shell){removeCard();return}const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok){removeCard();return}const user=(await me.json()).user;if(user?.role!=='client'){removeCard();return}const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();const missions=(d.missions||[]) as ClientMission[];const pendingPayment=missions.find(m=>m.status==='completed'&&m.payment_status!=='paid');const active=missions.find(m=>!['completed','cancelled'].includes(m.status));const base=pendingPayment||active;if(base){const full=await enrich(base);render(full)}else{removeCard();current=null;provider=null;billing=null}}catch{}finally{busy=false}}

setTimeout(refresh,700);setTimeout(refresh,1800);setInterval(refresh,8000);setInterval(updateLiveValues,1000);
export {};
