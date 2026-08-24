const YELLOW='#f7b500';
const STORAGE_PREFIX='faislajob_completion_';

type Mission={id:string;status:string;category_name?:string;description?:string;duration_minutes?:number|null;client_total_cents?:number|null;payment_status?:string|null};
type Billing={actual_minutes?:number;subtotal_cents?:number;client_service_fee_cents?:number;client_total_cents?:number;payment_status?:string};

function money(v?:number|null){return typeof v==='number'?`${(v/100).toFixed(2).replace('.',',')} $`:'—'}
function esc(v:any){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m] as string))}

let currentMissionId:string|null=null;
let checking=false;

function hideNewRequest(hide:boolean){
  document.querySelectorAll<HTMLElement>('button,a').forEach(el=>{
    const t=(el.textContent||'').toLowerCase();
    if(t.includes('nouvelle demande')||t.includes('trouver quelqu')){
      if(hide){if(!el.dataset.completionDisplay)el.dataset.completionDisplay=el.style.display||'__empty__';el.style.display='none'}
      else if(el.dataset.completionDisplay){el.style.display=el.dataset.completionDisplay==='__empty__'?'':el.dataset.completionDisplay;delete el.dataset.completionDisplay}
    }
  });
}

function styleButton(selected:boolean){return `border:1px solid ${selected?YELLOW:'#465166'};background:${selected?YELLOW:'#111827'};color:${selected?'#0b1020':'#e7edf7'};border-radius:14px;padding:14px 16px;font-weight:800;font-size:16px;cursor:pointer;`}

async function renderCompletion(m:Mission){
  const main=document.querySelector<HTMLElement>('.user-portal-main');
  if(!main)return;
  let billing:Billing={};
  try{const r=await fetch(`/api/missions/${m.id}/billing`,{credentials:'same-origin',cache:'no-store'});if(r.ok){const d=await r.json();billing=d.billing||d}}catch{}
  const key=STORAGE_PREFIX+m.id;
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  const satisfaction=saved.satisfaction||'';
  const rating=Number(saved.rating||0);
  let box=document.getElementById('faislajob-completion-flow');
  if(!box){box=document.createElement('section');box.id='faislajob-completion-flow';main.prepend(box)}
  box.innerHTML=`
    <div style="border:2px solid ${YELLOW};border-radius:24px;background:linear-gradient(180deg,#16140b,#0b1019);padding:22px;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.28);margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="display:inline-flex;align-items:center;gap:8px;background:#33280a;color:${YELLOW};border:1px solid #6a5310;border-radius:999px;padding:7px 12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase">✓ Terminée</div>
          <h2 style="font-size:clamp(30px,7vw,48px);margin:14px 0 4px">Mission terminée</h2>
          <div style="font-size:21px;font-weight:900;color:${YELLOW}">En attente de paiement</div>
        </div>
        <div style="font-size:18px;color:#d6dbe6">Mission #${esc(m.id)}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:22px;border-top:1px solid #394253;padding-top:18px">
        <div><div style="color:${YELLOW};font-weight:800;text-transform:uppercase;font-size:12px">Temps total</div><strong style="font-size:28px">${esc(billing.actual_minutes??m.duration_minutes??0)} min</strong></div>
        <div><div style="color:${YELLOW};font-weight:800;text-transform:uppercase;font-size:12px">Facturation</div><strong style="font-size:28px">${money(billing.subtotal_cents)}</strong></div>
        <div><div style="color:${YELLOW};font-weight:800;text-transform:uppercase;font-size:12px">Total à payer</div><strong style="font-size:28px">${money(billing.client_total_cents??m.client_total_cents)}</strong></div>
      </div>
      <button id="completion-details" style="width:100%;margin-top:18px;border:1px solid #6a5310;background:#121721;color:${YELLOW};border-radius:14px;padding:14px;font-size:16px;font-weight:850;cursor:pointer">Voir les détails de la mission</button>
    </div>
    <div style="border:1px solid #334155;border-radius:24px;background:#0d1624;padding:22px;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.22)">
      <h2 style="margin:0 0 6px;font-size:28px">Avant de fermer la mission</h2>
      <p style="margin:0 0 22px;color:#b7c3d5">Complète les étapes suivantes. Le jaune apparaît seulement maintenant, une fois le travail terminé.</p>
      <div style="font-weight:900;margin-bottom:10px"><span style="display:inline-grid;place-items:center;width:28px;height:28px;background:${YELLOW};color:#111;border-radius:7px;margin-right:8px">1</span>Le client est-il satisfait du travail?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px">
        <button data-satisfaction="yes" style="${styleButton(satisfaction==='yes')}">🙂 Oui, satisfait</button>
        <button data-satisfaction="no" style="${styleButton(satisfaction==='no')}">☹️ Non, insatisfait</button>
      </div>
      <div style="font-weight:900;margin-bottom:10px"><span style="display:inline-grid;place-items:center;width:28px;height:28px;background:${YELLOW};color:#111;border-radius:7px;margin-right:8px">2</span>Mode de paiement pour aujourd'hui</div>
      <div style="border:2px solid ${YELLOW};border-radius:15px;padding:15px 16px;margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;gap:12px"><div><strong>Virement Interac</strong><div style="color:#aeb9c9;margin-top:3px">Le client paiera par virement Interac</div></div><div style="width:28px;height:28px;border-radius:50%;background:${YELLOW};display:grid;place-items:center;color:#111;font-weight:900">✓</div></div>
      <div style="font-weight:900;margin-bottom:10px"><span style="display:inline-grid;place-items:center;width:28px;height:28px;background:${YELLOW};color:#111;border-radius:7px;margin-right:8px">3</span>Évaluer le partenaire</div>
      <div id="completion-stars" style="display:flex;gap:8px;margin:6px 0 8px;justify-content:center;font-size:42px;cursor:pointer">${[1,2,3,4,5].map(n=>`<span data-rating="${n}" style="color:${n<=rating?YELLOW:'#4b5563'}">★</span>`).join('')}</div>
      <div style="text-align:center;color:${YELLOW};font-weight:800;margin-bottom:20px">${rating?`${rating} / 5`:'Choisis une note'}</div>
      <button id="completion-close" style="width:100%;border:0;background:${YELLOW};color:#111827;border-radius:16px;padding:17px;font-size:19px;font-weight:950;cursor:pointer">✓ Fermer la mission</button>
      <div id="completion-error" style="display:none;margin-top:12px;color:#ffb4b4;font-weight:700"></div>
    </div>`;
  box.querySelector('#completion-details')?.addEventListener('click',()=>{window.location.hash='';const missionBtn=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Mes missions')) as HTMLButtonElement|undefined;missionBtn?.click()});
  box.querySelectorAll<HTMLElement>('[data-satisfaction]').forEach(btn=>btn.addEventListener('click',()=>{const next=btn.dataset.satisfaction;localStorage.setItem(key,JSON.stringify({...saved,satisfaction:next,rating:Number(localStorage.getItem(key)&&JSON.parse(localStorage.getItem(key)!).rating||rating)}));renderCompletion(m)}));
  box.querySelectorAll<HTMLElement>('[data-rating]').forEach(star=>star.addEventListener('click',()=>{const next=Number(star.dataset.rating);const prev=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...prev,rating:next}));renderCompletion(m)}));
  box.querySelector('#completion-close')?.addEventListener('click',async()=>{
    const state=JSON.parse(localStorage.getItem(key)||'{}');const err=box?.querySelector<HTMLElement>('#completion-error');
    if(!state.satisfaction){if(err){err.style.display='block';err.textContent='Indique d’abord si le client est satisfait.'}return}
    if(!state.rating){if(err){err.style.display='block';err.textContent='Choisis une évaluation de 1 à 5 étoiles.'}return}
    const btn=box?.querySelector<HTMLButtonElement>('#completion-close');if(btn){btn.disabled=true;btn.textContent='Fermeture en cours…'}
    try{const r=await fetch(`/api/missions/${m.id}/pay/mock`,{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Impossible de fermer la mission.');localStorage.removeItem(key);currentMissionId=null;box?.remove();hideNewRequest(false);setTimeout(()=>location.reload(),250)}catch(e:any){if(err){err.style.display='block';err.textContent=e?.message||'Erreur';}if(btn){btn.disabled=false;btn.textContent='✓ Fermer la mission'}}
  });
  hideNewRequest(true);
}

async function check(){
  if(checking)return;checking=true;
  try{
    const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok){document.getElementById('faislajob-completion-flow')?.remove();hideNewRequest(false);return}
    const user=(await me.json()).user;if(user?.role!=='client'){document.getElementById('faislajob-completion-flow')?.remove();hideNewRequest(false);return}
    const r=await fetch('/api/client/missions',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();
    const pending=(d.missions||[]).find((m:Mission)=>m.status==='completed'&&m.payment_status!=='paid');
    if(!pending){document.getElementById('faislajob-completion-flow')?.remove();currentMissionId=null;hideNewRequest(false);return}
    if(currentMissionId!==String(pending.id)||!document.getElementById('faislajob-completion-flow')){currentMissionId=String(pending.id);await renderCompletion(pending)}else hideNewRequest(true);
  }catch{}finally{checking=false}
}

setTimeout(check,900);
setInterval(check,3500);
new MutationObserver(()=>{if(currentMissionId)hideNewRequest(true)}).observe(document.documentElement,{subtree:true,childList:true});
