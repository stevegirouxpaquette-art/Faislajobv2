import { clientOrderId } from './publicIds';

type ClientMission={id:string;category_name?:string;status:string;description?:string};

const labels:Record<string,string>={
  requested:'En attente d’un partenaire',
  offered:'En attente d’un partenaire',
  assigned:'Partenaire trouvé',
  en_route:'Partenaire en route',
  arrived:'Partenaire arrivé',
  in_progress:'Travail en cours'
};
const icons:Record<string,string>={requested:'📣',offered:'📣',assigned:'🤝',en_route:'🚗',arrived:'📍',in_progress:'🛠️'};
const ranks:Record<string,number>={requested:0,offered:0,assigned:1,en_route:2,arrived:3,in_progress:4};
const steps=['Demande','Partenaire','En route','Arrivé','Travail','Terminé'];
let busy=false;

function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string))}

function removeCard(){document.getElementById('client-active-compact')?.remove()}

function details(){
  const btn=[...document.querySelectorAll<HTMLButtonElement>('.user-portal-nav button')].find(b=>(b.textContent||'').includes('Mes commandes'));
  btn?.click();
}

function render(m:ClientMission){
  const stats=document.querySelector<HTMLElement>('.portal-stats');
  if(!stats){removeCard();return}
  let card=document.getElementById('client-active-compact') as HTMLElement|null;
  if(!card){card=document.createElement('section');card.id='client-active-compact';stats.insertAdjacentElement('afterend',card)}
  const rank=ranks[m.status]??0;
  card.innerHTML=`<div style="background:linear-gradient(135deg,#102844,#0d1d33);border:1px solid #2d5e91;border-radius:20px;padding:18px;margin:0 0 20px;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.18)">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div><div style="color:#8ec5ff;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em">Commande active</div><strong style="display:block;font-size:22px;margin-top:5px">${icons[m.status]||'📋'} ${esc(labels[m.status]||m.status)}</strong></div>
      <div style="font-weight:850;color:#cfe5ff;white-space:nowrap">#${clientOrderId(m.id)}</div>
    </div>
    <div style="margin-top:8px;color:#9fb3ca;font-weight:800">${esc(m.category_name||'Service FaisLaJob')}</div>
    <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin-top:16px">${steps.map((s,i)=>`<div style="text-align:center;color:${i<=rank?'#b9dcff':'#64748b'};font-size:9px;font-weight:800"><i style="display:block;height:5px;border-radius:8px;background:${i<=rank?'#35a7ff':'#26364d'};margin-bottom:6px"></i>${s}</div>`).join('')}</div>
    <button id="client-active-details" style="width:100%;margin-top:16px;border:0;background:#2693ff;color:#fff;border-radius:13px;padding:12px 14px;font-size:16px;font-weight:900;cursor:pointer">Voir les détails</button>
  </div>`;
  card.querySelector('#client-active-details')?.addEventListener('click',details);
}

async function refresh(){
  if(busy)return;busy=true;
  try{
    const stats=document.querySelector<HTMLElement>('.portal-stats');
    if(!stats){removeCard();return}
    const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!me.ok){removeCard();return}
    const user=(await me.json()).user;
    if(user?.role!=='client'){removeCard();return}
    const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();
    const active=(d.missions||[]).find((m:ClientMission)=>!['completed','cancelled'].includes(m.status));
    if(active)render(active);else removeCard();
  }catch{}finally{busy=false}
}

setTimeout(refresh,900);
setInterval(refresh,10000);

export {};
