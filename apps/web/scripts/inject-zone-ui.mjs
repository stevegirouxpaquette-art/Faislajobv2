import fs from 'node:fs';

const adminFile = new URL('../src/AdminPortal.tsx', import.meta.url);
let admin = fs.readFileSync(adminFile,'utf8');
if(!admin.includes("import AdminZones from './AdminZones';")) admin=admin.replace("import './admin.css';","import './admin.css';\nimport AdminZones from './AdminZones';");
admin=admin.replace("useState<'dispatch'|'clients'|'providers'|'categories'|'finance'>('dispatch')","useState<'dispatch'|'clients'|'providers'|'categories'|'zones'|'finance'>('dispatch')");
admin=admin.replace("else if(tab==='categories')requests.push(api('/api/categories'));else requests.push(api('/api/admin/finance'))","else if(tab==='categories')requests.push(api('/api/categories'));else if(tab==='zones'){}else requests.push(api('/api/admin/finance'))");
admin=admin.replace("tab==='categories'?'Catégories et tarifs':'Finance'","tab==='categories'?'Catégories et tarifs':tab==='zones'?'Zones et tarifs':'Finance'");
if(!admin.includes("onClick={()=>setTab('zones')}>📍 Zones")) admin=admin.replace("<button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>","<button className={tab==='zones'?'active':''} onClick={()=>setTab('zones')}>📍 Zones</button><button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>");
if(!admin.includes("tab==='zones'&&<AdminZones")) admin=admin.replace("{tab==='finance'&&<>","{tab==='zones'&&<AdminZones token={token}/>}\n {tab==='finance'&&<>");
fs.writeFileSync(adminFile,admin);

const requestFile=new URL('../src/RequestFlow.tsx',import.meta.url);
let request=fs.readFileSync(requestFile,'utf8');
request=request.replace("body:JSON.stringify({clientId,categoryId:category.id,description})","body:JSON.stringify({clientId,categoryId:category.id,description,serviceCity:addressFields.city.trim()})");
fs.writeFileSync(requestFile,request);
console.log('✓ zone pricing UI wired');
