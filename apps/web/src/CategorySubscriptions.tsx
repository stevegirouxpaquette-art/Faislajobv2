import {useEffect,useState} from 'react';
import './subscriptions.css';

type Plan={id:string;name:string;description?:string|null;trigger_type:'snow_accumulation'|'weekly'|'interval'|'manual';trigger_config:any;pricing_type:'per_minute'|'per_visit'|'monthly'|'seasonal';price_cents:number;same_team:boolean;max_interventions?:number|null};
const money=(c:number)=>`${(Number(c||0)/100).toFixed(2).replace('.',',')} $`;
const minuteMoney=(hourly:number)=>money(hourly/60);
const minimum15=(hourly:number)=>money(Math.ceil(hourly*15/60));

export default function CategorySubscriptions({categoryId}:{categoryId:string}){
 const[plans,setPlans]=useState<Plan[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);fetch(`/api/service-plans?category_id=${encodeURIComponent(categoryId)}`,{cache:'no-store'}).then(async r=>{if(!r.ok)return{plans:[]};return r.json()}).then(d=>{if(alive)setPlans(d.plans||[])}).catch(()=>{if(alive)setPlans([])}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[categoryId]);
 if(loading||plans.length===0)return null;
 const trigger=(p:Plan)=>p.trigger_type==='snow_accumulation'?`Interventions à ${(p.trigger_config?.thresholds_cm||[]).join(', ')} cm`:p.trigger_type==='weekly'?`${p.trigger_config?.visits_per_week||1}× par semaine`:p.trigger_type==='interval'?`Tous les ${p.trigger_config?.interval_days||7} jours`:'Déclenchement sur demande';
 const price=(p:Plan)=>p.pricing_type==='per_minute'?`${minuteMoney(p.price_cents)}/min · ${money(p.price_cents)}/h · minimum 15 min ${minimum15(p.price_cents)}`:`${money(p.price_cents)} ${p.pricing_type==='per_visit'?'par intervention':p.pricing_type==='monthly'?'par mois':'par saison'}`;
 return <section className="client-subs-block"><div className="client-subs-heading"><div><span>⭐ Services récurrents</span><h2>Abonnements disponibles</h2><p>Planifie une fois et FaisLaJob s’occupe des interventions récurrentes.</p></div></div><div className="client-subs-list">{plans.map(p=><article className="client-sub-card" key={p.id}><div className="client-sub-icon">🔁</div><div className="client-sub-copy"><strong>{p.name}</strong>{p.description&&<p>{p.description}</p>}<div className="client-sub-tags"><span>{trigger(p)}</span><span>{price(p)}</span>{p.same_team&&<span>Même équipe privilégiée</span>}</div></div><button type="button" onClick={()=>alert('La sélection complète de cet abonnement arrive à la prochaine étape : adresse, jours préférés et confirmation du plan.')}>Voir le plan</button></article>)}</div></section>;
}
