import { clientOrderId } from './publicIds';

type ClientMission={
  id:string;
  category_name?:string;
  status:string;
  description?:string;
  payment_status?:string|null;
};

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
  in_progress:'Le travail est commencé. Tu peux suivre la mission ici.',
  completed:'Le travail est terminé.'
};
const icons:Record<string,string>={requested:'📣',offered:'📣',assigned:'🤝',en_route:'🚗',arrived:'📍',in_progress:'🛠️',completed:'✅'};
const ranks:Record<string,number>={requested:0,offered:0,assigned:1,en_route:2,arrived:3,in_progress:4,completed:5};
const steps=['Demande','Partenaire','En route','Arrivé','Travail','Terminé'];
let busy=false;

function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string))}
function removeCard(){document.getElementById('client-active-top-card')?.remove()}

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

function render(m:ClientMission){
  const shell=document.querySelector<HTMLElement>('.user-portal-shell');
  const root=document.getElementById('root');
  if(!shell||!root){removeCard();return}

  let card=document.getElementById('client-active-top-card') as HTMLElement|null;
  if(!card){
    card=document.createElement('section');
    card.id='client-active-top-card';
    root.insertBefore(card,shell);
  }

  const p=palette(m);
  const payment=m.status==='completed'&&m.payment_status!=='paid';
  const rank=ranks[m.status]??0;
  const title=payment?'Paiement à compléter':(labels[m.status]||m.status);
  const description=payment?'La mission est terminée. Ta facture est prête pour le paiement.':(details[m.status]||'Mise à jour de ta commande.');
  const action=payment?'Voir le paiement':'Voir les détails de la commande';

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
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:20px">${steps.map((s,i)=>`<div style="text-align:center;font-size:10px;font-weight:800;color:${i<=rank?p.accent:'#6f8298'}"><i style="display:block;height:6px;border-radius:8px;background:${i<=rank?p.border:'#243247'};margin-bottom:7px"></i>${s}</div>`).join('')}</div>
        <button id="client-active-top-action" style="width:100%;margin-top:20px;border:1px solid rgba(255,255,255,.18);background:${payment?'#f7b500':m.status==='in_progress'?'#1fc77a':'#2693ff'};color:${payment?'#171100':'#fff'};border-radius:16px;padding:15px 12px;font-weight:950;font-size:17px;cursor:pointer">${action} ›</button>
      </div>
    </div>`;

  card.querySelector('#client-active-top-action')?.addEventListener('click',()=>goTo(payment?'Paiements':'Mes commandes'));
}

async function refresh(){
  if(busy)return;
  busy=true;
  try{
    if(location.pathname.startsWith('/request')||location.pathname.startsWith('/admin')){removeCard();return}
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
    const mission=pendingPayment||active;
    if(mission)render(mission);else removeCard();
  }catch{}finally{busy=false}
}

setTimeout(refresh,700);
setTimeout(refresh,1800);
setInterval(refresh,8000);

export {};
