import { useEffect, useState } from 'react';

type Rate={category_id:string;category_name:string;default_hourly_rate_cents:number|null;hourly_rate_cents:number|null};
type Zone={id:string;name:string;city_match:string;is_active:boolean;rates:Rate[]};

const money=(cents:number|null|undefined)=>typeof cents==='number'?`${(cents/100).toFixed(2).replace('.',',')} $`:'—';

export default function AdminZones({token}:{token:string}){
 const[zones,setZones]=useState<Zone[]>([]),[name,setName]=useState(''),[city,setCity]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const headers={'x-admin-token':token,'Content-Type':'application/json'};
 const api=async(path:string,options:RequestInit={})=>{const r=await fetch(path,{...options,headers:{...headers,...(options.headers as Record<string,string>||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Erreur ${r.status}`);return d};
 const load=async()=>{try{const d=await api('/api/admin/zones');setZones(d.zones||[]);setError('')}catch(e){setError(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);
 const create=async()=>{if(!name.trim()||!city.trim())return;setSaving(true);try{await api('/api/admin/zones',{method:'POST',body:JSON.stringify({name:name.trim(),cityMatch:city.trim()})});setName('');setCity('');await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setSaving(false)}};
 const updateRate=async(zoneId:string,categoryId:string,value:string)=>{const dollars=Number(value.replace(',','.'));if(!Number.isFinite(dollars)||dollars<=0)return;await api(`/api/admin/zones/${zoneId}/rates/${categoryId}`,{method:'POST',body:JSON.stringify({hourlyRateCents:Math.round(dollars*60*100)})});await load()};
 const useDefault=async(zoneId:string,categoryId:string)=>{await api(`/api/admin/zones/${zoneId}/rates/${categoryId}/default`,{method:'POST',body:'{}'});await load()};
 const toggle=async(z:Zone)=>{await api(`/api/admin/zones/${z.id}`,{method:'POST',body:JSON.stringify({name:z.name,cityMatch:z.city_match,isActive:!z.is_active})});await load()};
 const remove=async(z:Zone)=>{if(!confirm(`Supprimer la zone ${z.name}?`))return;await api(`/api/admin/zones/${z.id}/delete`,{method:'POST',body:'{}'});await load()};
 return <>
  <div className="admin-card"><div className="admin-card-top"><div><span className="mission-number">Tarification géographique</span><h3>Zones et tarifs par catégorie</h3></div></div><p className="admin-muted">La ville saisie par le client associe automatiquement la mission à une zone. Un tarif de zone remplace le tarif général de la catégorie. Sans tarif personnalisé, le tarif général s'applique.</p><div className="admin-tools"><input placeholder="Nom de la zone (ex. Montréal)" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Ville à reconnaître (ex. Montréal)" value={city} onChange={e=>setCity(e.target.value)}/><button disabled={saving||!name.trim()||!city.trim()} onClick={create}>+ Ajouter la zone</button></div>{error&&<div className="admin-error">⚠️ {error}</div>}</div>
  {zones.map(z=><div className="admin-card" key={z.id}><div className="admin-card-top"><div><span className="mission-number">Zone #{z.id}</span><h3>{z.name}</h3><small className="admin-muted">Ville reconnue : {z.city_match}</small></div><span className={`online-dot ${z.is_active?'on':''}`}>{z.is_active?'● Active':'○ Inactive'}</span></div><div className="admin-table-wrap"><table><thead><tr><th>Catégorie</th><th>Tarif général</th><th>Tarif zone / min</th><th>Équiv. / h</th><th></th></tr></thead><tbody>{z.rates.map(r=>{const active=r.hourly_rate_cents??r.default_hourly_rate_cents;return <tr key={r.category_id}><td><strong>{r.category_name}</strong></td><td>{money(r.default_hourly_rate_cents)}</td><td><input style={{maxWidth:110}} inputMode="decimal" defaultValue={active?((active/100)/60).toFixed(2):''} onBlur={e=>updateRate(z.id,r.category_id,e.target.value)}/></td><td><strong>{money(active)}</strong>{r.hourly_rate_cents!=null&&<small>tarif zone</small>}</td><td>{r.hourly_rate_cents!=null&&<button onClick={()=>useDefault(z.id,r.category_id)}>Tarif général</button>}</td></tr>})}</tbody></table></div><div className="admin-actions"><button onClick={()=>toggle(z)}>{z.is_active?'Désactiver':'Activer'}</button><button className="danger" onClick={()=>remove(z)}>Supprimer la zone</button></div></div>)}
  {zones.length===0&&<div className="admin-empty">Aucune zone configurée. Ajoute Trois-Rivières, Montréal, Québec, etc.</div>}
 </>;
}
