import fs from 'node:fs';

const adminFile=new URL('../src/AdminPortal.tsx',import.meta.url);
let admin=fs.readFileSync(adminFile,'utf8');
if(!admin.includes("import AdminSubscriptions from './AdminSubscriptions';"))admin=admin.replace("import './admin.css';","import './admin.css';\nimport AdminSubscriptions from './AdminSubscriptions';");
admin=admin.replace("|'promotions'|'messages'|'finance'>('dispatch')","|'promotions'|'messages'|'subscriptions'|'finance'>('dispatch')");
admin=admin.replace("|'messages'|'finance'>('dispatch')","|'messages'|'subscriptions'|'finance'>('dispatch')");
if(!admin.includes("tab==='subscriptions'?'Abonnements et récurrence'")){
 admin=admin.replace("tab==='messages'?'Messages clients':'Finance'","tab==='messages'?'Messages clients':tab==='subscriptions'?'Abonnements et récurrence':'Finance'");
 admin=admin.replace("tab==='promotions'?'Promotions et ristournes':'Finance'","tab==='promotions'?'Promotions et ristournes':tab==='subscriptions'?'Abonnements et récurrence':'Finance'");
 admin=admin.replace("tab==='categories'?'Catégories et tarifs':'Finance'","tab==='categories'?'Catégories et tarifs':tab==='subscriptions'?'Abonnements et récurrence':'Finance'");
}
if(!admin.includes("onClick={()=>setTab('subscriptions')}>🔁 Abonnements")){
 const msg="<button className={tab==='messages'?'active':''} onClick={()=>setTab('messages')}>💬 Messages</button>";
 const fin="<button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>";
 if(admin.includes(msg))admin=admin.replace(msg,`<button className={tab==='subscriptions'?'active':''} onClick={()=>setTab('subscriptions')}>🔁 Abonnements</button>${msg}`);
 else if(admin.includes(fin))admin=admin.replace(fin,`<button className={tab==='subscriptions'?'active':''} onClick={()=>setTab('subscriptions')}>🔁 Abonnements</button>${fin}`);
 else throw new Error('Could not find admin nav anchor for subscriptions');
}
if(!admin.includes("{tab==='subscriptions'&&<AdminSubscriptions token={token}/>}")){
 const anchor="{tab==='finance'&&<>";
 if(!admin.includes(anchor))throw new Error('Could not find finance view anchor for subscriptions');
 admin=admin.replace(anchor,"{tab==='subscriptions'&&<AdminSubscriptions token={token}/>}\n "+anchor);
}
fs.writeFileSync(adminFile,admin);

const requestFile=new URL('../src/RequestFlow.tsx',import.meta.url);
let request=fs.readFileSync(requestFile,'utf8');
if(!request.includes("import CategorySubscriptions from './CategorySubscriptions';"))request=request.replace("import './request-native.css';","import './request-native.css';\nimport CategorySubscriptions from './CategorySubscriptions';");
if(!request.includes('<CategorySubscriptions categoryId={category.id}/>')){
 const anchor='<div className="request-option-list">';
 const i=request.indexOf(anchor);
 if(i<0)throw new Error('Could not find category options anchor for subscriptions');
 request=request.slice(0,i)+'<CategorySubscriptions categoryId={category.id}/>'+request.slice(i);
}
fs.writeFileSync(requestFile,request);
console.log('✓ recurring subscriptions wired into admin and client categories');
