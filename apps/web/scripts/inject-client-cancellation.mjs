import fs from 'node:fs';

const file = new URL('../src/UserPortal.tsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  "type ClientMission={id:string;category_name:string;status:string;description:string;duration_minutes?:number|null;client_total_cents?:number|null;billable_minutes?:number|null;billing_status?:string|null;payment_status?:string|null;created_at:string;completed_at?:string|null};",
  "type ClientMission={id:string;category_name:string;status:string;description:string;provider_id?:string|null;hourly_rate_cents?:number|null;duration_minutes?:number|null;client_total_cents?:number|null;billable_minutes?:number|null;billing_status?:string|null;payment_status?:string|null;created_at:string;completed_at?:string|null};"
);

if (!source.includes('const cancelMission=async')) {
  source = source.replace(
    " const pay=async(id:string)=>{const r=await fetch(`/api/missions/${id}/pay/mock`,{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok){setError(d.error||'Paiement impossible.');return}setBilling(d.billing);await load(true)};",
    " const pay=async(id:string)=>{const r=await fetch(`/api/missions/${id}/pay/mock`,{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok){setError(d.error||'Paiement impossible.');return}setBilling(d.billing);await load(true)};\n const cancelMission=async(m:ClientMission)=>{if(['completed','cancelled'].includes(m.status))return;const assigned=Boolean(m.provider_id);const fee=assigned?Math.ceil(Number(m.hourly_rate_cents||4000)*15/60):0;const message=assigned?`Un prestataire est déjà attribué. Des frais d’annulation de ${money(fee)} (15 minutes) seront facturés. Confirmer l’annulation?`:'Aucun prestataire n’est attribué. L’annulation est gratuite. Confirmer l’annulation?';if(!window.confirm(message))return;setError('');const r=await fetch(`/api/client/missions/${m.id}/cancel`,{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok){setError(d.error||'Annulation impossible.');return}await load(false)};"
  );
}

source = source.replace(
  "<Recent missions={missions.slice(0,4)} onBilling={viewBilling} onOpen={()=>setTab('missions')}/>",
  "<Recent missions={missions.slice(0,4)} onBilling={viewBilling} onCancel={cancelMission} onOpen={()=>setTab('missions')}/>"
);
source = source.replace(
  "missions.map(m=><MissionRow key={m.id} mission={m} onBilling={viewBilling} onPay={pay}/>)",
  "missions.map(m=><MissionRow key={m.id} mission={m} onBilling={viewBilling} onPay={pay} onCancel={cancelMission}/>)"
);
source = source.replace(
  "completed.map(m=><MissionRow key={m.id} mission={m} onBilling={viewBilling} onPay={pay} compact/>)",
  "completed.map(m=><MissionRow key={m.id} mission={m} onBilling={viewBilling} onPay={pay} compact/>)"
);
source = source.replace(
  "function Recent({missions,onBilling,onOpen}:{missions:ClientMission[];onBilling:(id:string)=>void;onOpen:()=>void}){return <section",
  "function Recent({missions,onBilling,onCancel,onOpen}:{missions:ClientMission[];onBilling:(id:string)=>void;onCancel:(m:ClientMission)=>void;onOpen:()=>void}){return <section"
);
source = source.replace(
  "missions.map(m=><MissionRow key={m.id} mission={m} onBilling={onBilling} onOpen={onOpen}/>)",
  "missions.map(m=><MissionRow key={m.id} mission={m} onBilling={onBilling} onCancel={onCancel} onOpen={onOpen}/>)"
);
source = source.replace(
  "function MissionRow({mission,onBilling,onPay,compact,onOpen}:{mission:ClientMission;onBilling:(id:string)=>void;onPay?:(id:string)=>void;compact?:boolean;onOpen?:()=>void})",
  "function MissionRow({mission,onBilling,onPay,onCancel,compact,onOpen}:{mission:ClientMission;onBilling:(id:string)=>void;onPay?:(id:string)=>void;onCancel?:(m:ClientMission)=>void;compact?:boolean;onOpen?:()=>void})"
);
source = source.replace(
  "{mission.status==='completed'&&mission.payment_status!=='paid'&&onPay&&<button className=\"portal-link\" onClick={e=>{e.stopPropagation();onPay(mission.id)}}>Payer</button>}",
  "{mission.status==='completed'&&mission.payment_status!=='paid'&&onPay&&<button className=\"portal-link\" onClick={e=>{e.stopPropagation();onPay(mission.id)}}>Payer</button>}{!['completed','cancelled'].includes(mission.status)&&onCancel&&<button className=\"portal-link portal-cancel-link\" onClick={e=>{e.stopPropagation();onCancel(mission)}}>Annuler</button>}"
);

fs.writeFileSync(file, source);

const cssFile = new URL('../src/portal.css', import.meta.url);
let css = fs.readFileSync(cssFile, 'utf8');
if (!css.includes('.portal-cancel-link')) css += `\n.portal-cancel-link{color:#ff7f7f!important;border-color:rgba(255,90,90,.35)!important}.portal-cancel-link:hover{background:rgba(255,90,90,.08)!important}\n`;
fs.writeFileSync(cssFile, css);
console.log('✓ client cancellation button wired');
