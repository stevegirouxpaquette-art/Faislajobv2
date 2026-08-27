import fs from 'node:fs';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not patch ${label}`);
  return source.replace(from, to);
}

const requestFile = new URL('../src/RequestFlow.tsx', import.meta.url);
let request = fs.readFileSync(requestFile, 'utf8');
request = replaceRequired(
  request,
  "{p.hourly!==null&&<small><b>{money(p.minute)}/min · {money(p.hourly)}/h</b><br/>Minimum 15 min : {money(p.minimum)}</small>}",
  "{p.hourly!==null&&<small><b>Tarif minute : {money(p.minute)}/min</b><br/><b>Tarif heure : {money(p.hourly)}/h</b><br/>Minimum 15 min : {money(p.minimum)}</small>}",
  'category card pricing'
);
request = replaceRequired(
  request,
  "{selectedPricing&&selectedPricing.hourly!==null&&<div className=\"request-tip\">💵 <span><strong>{money(selectedPricing.minute)}/minute · {money(selectedPricing.hourly)}/heure</strong><br/>Minimum facturable de 15 minutes : <strong>{money(selectedPricing.minimum)}</strong></span></div>}",
  "{selectedPricing&&selectedPricing.hourly!==null&&<div className=\"request-tip\">💵 <span><strong>Tarif minute : {money(selectedPricing.minute)}/minute</strong><br/><strong>Tarif heure : {money(selectedPricing.hourly)}/heure</strong><br/>Minimum facturable de 15 minutes : <strong>{money(selectedPricing.minimum)}</strong></span></div>}",
  'selected category pricing'
);
request = replaceRequired(
  request,
  "{selectedPricing&&selectedPricing.hourly!==null&&<><div><span>Tarif</span><strong>{money(selectedPricing.minute)}/min · {money(selectedPricing.hourly)}/h</strong></div><div><span>Minimum</span><strong>15 min · {money(selectedPricing.minimum)}</strong></div></>}",
  "{selectedPricing&&selectedPricing.hourly!==null&&<><div><span>Tarif minute</span><strong>{money(selectedPricing.minute)}/min</strong></div><div><span>Tarif heure</span><strong>{money(selectedPricing.hourly)}/h</strong></div><div><span>Minimum</span><strong>15 min · {money(selectedPricing.minimum)}</strong></div></>}",
  'summary pricing'
);
fs.writeFileSync(requestFile, request);

const adminFile = new URL('../src/AdminPortal.tsx', import.meta.url);
let admin = fs.readFileSync(adminFile, 'utf8');
admin = replaceRequired(
  admin,
  " const openAssign=(m:Mission)=>{setSelectedMission(m);setSelectedProvider(m.provider_id||'')};",
  ` const categorySlug=(name:string)=>name.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);\n const parseRate=(value:string)=>Math.round(Number(value.replace(',','.'))*100);\n const addCategory=async()=>{const name=window.prompt('Nom de la nouvelle catégorie');if(!name?.trim())return;const rate=window.prompt('Tarif horaire en dollars','40');if(!rate)return;const cents=parseRate(rate);if(!Number.isFinite(cents)||cents<=0){setError('Tarif horaire invalide');return}await action('/api/admin/categories',{id:categorySlug(name),name:name.trim(),hourlyRateCents:cents})};\n const editCategory=async(c:Category)=>{const name=window.prompt('Nom de la catégorie',c.name);if(!name?.trim())return;const rate=window.prompt('Tarif horaire en dollars',String(((c.hourly_rate_cents||0)/100).toFixed(2)).replace('.',','));if(!rate)return;const cents=parseRate(rate);if(!Number.isFinite(cents)||cents<=0){setError('Tarif horaire invalide');return}await action(\`/api/admin/categories/\${encodeURIComponent(c.id)}\`,{name:name.trim(),hourlyRateCents:cents})};\n const deleteCategory=async(c:Category)=>{if(!window.confirm(\`Supprimer la catégorie « \${c.name} »?\`))return;await action(\`/api/admin/categories/\${encodeURIComponent(c.id)}/delete\`)};\n const openAssign=(m:Mission)=>{setSelectedMission(m);setSelectedProvider(m.provider_id||'')};`,
  'category admin actions'
);
admin = replaceRequired(
  admin,
  "{tab==='categories'&&<><div className=\"admin-card\"><div className=\"admin-card-top\"><div><span className=\"mission-number\">Tarification client</span><h3>Minimum facturable : 15 minutes</h3></div></div><p className=\"admin-muted\">Le tarif à la minute et le montant minimum sont calculés automatiquement à partir du tarif horaire de chaque catégorie.</p></div><div className=\"admin-table-wrap\"><table><thead><tr><th>Catégorie</th><th>Tarif / minute</th><th>Tarif / heure</th><th>Minimum 15 min</th></tr></thead><tbody>{categories.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id}</small></td><td><strong>{money(minuteRate(c.hourly_rate_cents))}</strong></td><td><strong>{money(c.hourly_rate_cents)}</strong></td><td><strong>{money(minimum15(c.hourly_rate_cents))}</strong></td></tr>)}</tbody></table></div></>}",
  "{tab==='categories'&&<><div className=\"admin-card\"><div className=\"admin-card-top\"><div><span className=\"mission-number\">Tarification client</span><h3>Minimum facturable : 15 minutes</h3></div><div className=\"admin-actions\"><button onClick={addCategory}>＋ Ajouter une catégorie</button></div></div><p className=\"admin-muted\">Modifie le tarif horaire ici. Le tarif à la minute et le minimum 15 minutes sont recalculés automatiquement et affichés au client.</p></div><div className=\"admin-table-wrap\"><table><thead><tr><th>Catégorie</th><th>Tarif / minute</th><th>Tarif / heure</th><th>Minimum 15 min</th><th>Actions</th></tr></thead><tbody>{categories.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id}</small></td><td><strong>{money(minuteRate(c.hourly_rate_cents))}</strong></td><td><strong>{money(c.hourly_rate_cents)}</strong></td><td><strong>{money(minimum15(c.hourly_rate_cents))}</strong></td><td><div className=\"admin-actions\"><button onClick={()=>editCategory(c)}>Modifier</button><button className=\"danger\" onClick={()=>deleteCategory(c)}>Supprimer</button></div></td></tr>)}</tbody></table></div></>}",
  'category admin table'
);
fs.writeFileSync(adminFile, admin);
console.log('✓ category pricing layout and editable admin UI wired');
