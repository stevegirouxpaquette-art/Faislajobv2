import { clientOrderId } from './publicIds';

type ClientMission={
  id:string;
  category_name?:string;
  category_id?:string;
  status:string;
  description?:string;
  payment_status?:string|null;
  provider_id?:string|null;
  started_at?:string|null;
  duration_minutes?:number|null;
  client_total_cents?:number|null;
};
type Provider={id:string;name:string};
type Category={id:string;name:string;hourly_rate_cents?:number|null};
type Billing={client_total_cents?:number|null;billable_minutes?:number|null;subtotal_cents?:number|null;client_service_fee_cents?:number|null};

const labels:Record<string,string>={
  requested:'En attente d’un partenaire',
  offered:'En attente d’un partenaire',
  assigned:'Partenaire trouvé',
  en_route:'Ton partenaire est en route',
  arrived:'Ton partenaire est arrivé',
  in_progress:'La job est en cours',
  completed:'Mission terminée'
};
const details:Record<string,string>={
  requested:'On cherche un partenaire disponible pour ta commande.',
  offered:'Ta demande est envoyée aux partenaires disponibles.',
  assigned:'Un partenaire a accepté ta commande.',
  en_route:'Ton partenaire se dirige vers l’adresse de la job.',
  arrived:'Ton partenaire est maintenant sur place.',
  in_progress:'Le travail est commencé. Le chronomètre et le prix estimé se mettent à jour automatiquement.',
  completed:'Le travail est terminé.'
};
const icons:Record<string,string>={requested:'📣',offered:'📣',assigned:'🤝',en_route:'🚗',arrived:'📍',in_progress:'🛠️',completed:'✅'};
const ranks:Record<string,number>={requested:0,offered:0,assigned:1,en_route:2,arrived:3,in_progress:4,completed:5};
const steps=['Demande','Partenaire','En route','Arrivé','Travail','Terminé'];

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

function goTo(tabText:string){
  const btn=[...document.querySelectorAll<HTMLButtonElement>('.user-portal-nav button')].find(b=>(b.textContent||'').includes(tabText));
  btn?.click();
  window.scrollTo({top:0,behavior:'smooth'});
}

function palette(m:ClientMission){
  const payment=m.status==='completed'&&m.payment_status!=='paid';
  if(payment)return {bg:'linear-gradient(135deg,#3c2e05,#241b03)',border:'#f7b500',accent:'#ffd75a',soft:'#f4df9a',badge:'Paiement requis',icon:'💳'};
  if(m.status==='in_progress')return {bg:'linear-gradient(135deg,#063f2e,#082f25)',border:'#1fc77a',accent:'#65e7a4',soft:'#bcebd2',badge:'Mission en cours',icon:'🛠️'};
  return {bg:'linear-gradient(135deg,#12315a,#0d203b)',border:'#2693ff',accent:'#9dcfff',soft:'#d5dfeb',badge:'Commande active',icon:icons[m.status]||'📋'};
}

function liveNumbers(m:ClientMission){
  const started=m.started_at?new Date(m.started_at).getTime():0;
  const elapsed=started?Math.max(0,Math.floor((Date.now()-started)/1000)):0;
  const elapsedMinutes=Math.max(1,Math.ceil(elapsed/60));
  const expectedMinutes=Math.max(15,Number(m.duration_minutes||15));
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

  const p=palette(m);
  const payment=m.status==='completed'&&m.payment_status!=='paid';
  const rank=ranks[m.status]??0;
  const title=payment?'Paiement à compléter':(labels[m.status]||m.status);
  const description=payment?'La mission est terminée. Ta facture est prête pour le paiement.':(details[m.status]||'Mise à jour de ta commande.');
  const live=liveNumbers(m);
  const shownTotal=payment?(billing?.client_total_cents??m.client_total_cents??live.total):live.total;
  const detailHtml=detailsOpen?`
    <div id="client-active-detail-panel" style="margin-top:14px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px;color:#eef6ff">
      <div style="display:grid;gap:10px">
        ${provider?`<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:${p.soft}">Prestataire</span><strong>${esc(provider.name)}</strong></div>`:''}
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:${p.soft}">Service</span><strong style="text-align:right">${esc(m.category_name||'Service FaisLaJob')}</strong></div>
        ${m.description?`<div style="padding-top:10px;border-top:1px solid rgba(255,255,255,.12);color:${p.soft};line-height:1.5">${esc(m.description)}</div>`:''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12)">
          <div><small style="display:block;color:${p.soft};font-weight:850;text-transform:uppercase">${payment?'Temps facturé':'Temps estimé/facturé'}</small><strong id="client-live-minutes" style="font-size:21px">${payment&&billing?.billable_minutes!=null?billing.billable_minutes:live.billableMinutes} min</strong></div>
          <div style="text-align:right"><small style="display:block;color:${p.soft};font-weight:850;text-transform:uppercase">${payment?'Total':'Prix estimé'}</small><strong id="client-live-detail-total" style="font-size:21px;color:${p.accent}">${money(shownTotal)}</strong></div>
        </div>
        <button id="client-open-orders" style="width:100%;margin-top:4px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.14);color:#fff;border-radius:13px;padding:12px;font-weight:900">Ouvrir Mes commandes</button>
      </div>
    </div>`:'';

  card.innerHTML=`
    <div style="background:#07101f;padding:14px 18px 0;color:#fff">
      <div style="width:min(1100px,100%);margin:0 auto;background:${p.bg};border:2px solid ${p.border};border-radius:24px;padding:20px;box-shadow:0 12px 34px rgba(0,0,0,.35)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <span style="display:inline-flex;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.08);color:${p.accent};font-weight:950;text-transform:uppercase;letter-spacing:.08em">${p.badge}</span>
          <span style="color:${p.soft};font-size:16px">Commande #${clientOrderId(m.id)}</span>
        </div>
        <div style="margin-top:20px">
          <strong style="display:block;font-size:clamp(30px,7vw,46px);line-height:1.08">${p.icon} ${esc(title)}</strong>
          <span style="display:block;color:${p.soft};margin-top:10px;font-size:18px;line-height:1.45">${esc(description)}</span>
          ${m.category_name?`<div style="margin-top:12px;color:${p.accent};font-weight:900;text-transform:uppercase;letter-spacing:.05em">${esc(m.category_name)}</div>`:''}
          ${provider?`<div style="margin-top:8px;color:${p.soft}">👤 Prestataire : <strong style="color:#fff">${esc(provider.name)}</strong></div>`:''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:20px">${steps.map((s,i)=>`<div style="text-align:center;font-size:10px;font-weight:800;color:${i<=rank?p.accent:'#6f8298'}"><i style="display:block;height:6px;border-radius:8px;background:${i<=rank?p.border:'#243247'};margin-bottom:7px"></i>${s}</div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14)">
          <div><small style="display:block;color:${p.soft};font-weight:900;text-transform:uppercase">${m.status==='in_progress'?'Chronomètre':'Durée'}</small><strong id="client-live-clock" style="display:block;font-size:clamp(24px,7vw,36px);margin-top:4px;color:${m.status==='in_progress'?p.accent:'#fff'}">${m.status==='in_progress'?fmtClock(live.elapsed):`${Math.max(15,Number(m.duration_minutes||15))} min`}</strong></div>
          <div style="text-align:right"><small style="display:block;color:${p.soft};font-weight:900;text-transform:uppercase">${payment?'Total à payer':'Prix estimé'}</small><strong id="client-live-total" style="display:block;font-size:clamp(24px,7vw,36px);margin-top:4px;color:${p.accent}">${money(shownTotal)}</strong></div>
        </div>
        <button id="client-active-top-action" style="width:100%;margin-top:18px;border:1px solid rgba(255,255,255,.18);background:${payment?'#f7b500':m.status==='in_progress'?'#1fc77a':'#2693ff'};color:${payment?'#171100':'#fff'};border-radius:16px;padding:15px 12px;font-weight:950;font-size:17px;cursor:pointer">${payment?'Voir le paiement':detailsOpen?'Masquer les détails':'Voir les détails de la commande'} ›</button>
        ${detailHtml}
      </div>
    </div>`;

  card.querySelector('#client-active-top-action')?.addEventListener('click',()=>{
    if(payment){goTo('Paiements');return}
    detailsOpen=!detailsOpen;
    if(current)render(current);
  });
  card.querySelector('#client-open-orders')?.addEventListener('click',()=>goTo('Mes commandes'));
}

function updateLiveValues(){
  if(!current||current.status!=='in_progress')return;
  const live=liveNumbers(current);
  const clock=document.getElementById('client-live-clock');if(clock)clock.textContent=fmtClock(live.elapsed);
  const total=document.getElementById('client-live-total');if(total)total.textContent=money(live.total);
  const detailTotal=document.getElementById('client-live-detail-total');if(detailTotal)detailTotal.textContent=money(live.total);
  const mins=document.getElementById('client-live-minutes');if(mins)mins.textContent=`${live.billableMinutes} min`;
}

async function loadCategories(m:ClientMission){
  if(!categoriesLoaded){
    try{const r=await fetch('/api/categories',{credentials:'same-origin',cache:'no-store'});if(r.ok){const d=await r.json();categories=(d.categories||[]) as Category[];categoriesLoaded=true}}catch{}
  }
  const cat=categories.find(c=>String(c.id)===String(m.category_id))||categories.find(c=>c.name===m.category_name);
  if(cat?.hourly_rate_cents!=null)hourlyRate=Number(cat.hourly_rate_cents);
}

async function enrich(m:ClientMission){
  let full=m;
  try{const mr=await fetch(`/api/missions/${m.id}`,{credentials:'same-origin',cache:'no-store'});if(mr.ok){const d=await mr.json();full=(d.mission||d) as ClientMission}}catch{}
  await loadCategories(full);

  const pid=String(full.provider_id||'');
  if(pid&&pid!==lastProviderId){
    try{const pr=await fetch(`/api/providers/${pid}`,{credentials:'same-origin',cache:'no-store'});if(pr.ok){const d=await pr.json();provider=(d.provider||d) as Provider;lastProviderId=pid}}catch{}
  }else if(!pid){provider=null;lastProviderId=''}

  if(full.status==='completed'&&full.payment_status!=='paid'){
    try{const br=await fetch(`/api/missions/${full.id}/billing`,{credentials:'same-origin',cache:'no-store'});if(br.ok){const d=await br.json();billing=(d.billing||d) as Billing}}catch{}
  }else billing=null;
  return full;
}

async function refresh(){
  if(busy)return;
  busy=true;
  try{
    if(location.pathname.startsWith('/request')||location.pathname.startsWith('/admin')){removeCard();current=null;return}
    const shell=document.querySelector<HTMLElement>('.user-portal-shell');
    if(!shell){removeCard();return}
    const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!me.ok){removeCard();return}
    const user=(await me.json()).user;
    if(user?.role!=='client'){removeCard();return}
    const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();
    const missions=(d.missions||[]) as ClientMission[];
    const pendingPayment=missions.find(m=>m.status==='completed'&&m.payment_status!=='paid');
    const active=missions.find(m=>!['completed','cancelled'].includes(m.status));
    const base=pendingPayment||active;
    if(base){const full=await enrich(base);render(full)}else{removeCard();current=null;provider=null;billing=null}
  }catch{}finally{busy=false}
}

setTimeout(refresh,700);
setTimeout(refresh,1800);
setInterval(refresh,8000);
setInterval(updateLiveValues,1000);

export {};
