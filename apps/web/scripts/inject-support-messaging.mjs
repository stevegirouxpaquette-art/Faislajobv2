import fs from 'node:fs';

const userFile=new URL('../src/UserPortal.tsx',import.meta.url);let user=fs.readFileSync(userFile,'utf8');
if(!user.includes("import ClientMessages from './ClientMessages';"))user=user.replace("import {clientOrderId,clientPublicId,dailyPin,providerMissionId,providerPublicId} from './publicIds';","import {clientOrderId,clientPublicId,dailyPin,providerMissionId,providerPublicId} from './publicIds';\nimport ClientMessages from './ClientMessages';");
if(!user.includes('faislajob-open-messages'))user=user.replace("const[tab,setTab]=useState('home');","const[tab,setTab]=useState('home');useEffect(()=>{const openMessages=()=>setTab('messages');window.addEventListener('faislajob-open-messages',openMessages);return()=>window.removeEventListener('faislajob-open-messages',openMessages)},[]);");
user=user.replace("tab==='support'?'Support & FAQ':'Ton profil'","tab==='support'?'Support & FAQ':tab==='messages'?'Messages':'Ton profil'");
if(!user.includes("{tab==='messages'&&<ClientMessages/>}"))user=user.replace("{tab==='profile'&&<ProfileCard user={user} role=\"client\"/>}","{tab==='messages'&&<ClientMessages/>}\n  {tab==='profile'&&<ProfileCard user={user} role=\"client\"/>}");
fs.writeFileSync(userFile,user);

const upgradeFile=new URL('../src/client-ui-upgrade.ts',import.meta.url);let upgrade=fs.readFileSync(upgradeFile,'utf8');
upgrade=upgrade.replace("if(a==='messages')go('Profil')","if(a==='messages')window.dispatchEvent(new Event('faislajob-open-messages'))");
if(!upgrade.includes('refreshMessageBadge')){
 upgrade=upgrade.replace("function bottom(){",`function refreshMessageBadge(){const button=document.querySelector<HTMLButtonElement>('.client-bottom-nav [data-action="messages"]');if(!button)return;let badge=button.querySelector<HTMLElement>('.client-message-badge');if(!badge){badge=document.createElement('b');badge.className='client-message-badge';button.appendChild(badge)}fetch('/api/client/support/unread',{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)return;const d=await r.json().catch(()=>({}));const n=Number(d.unread||0);badge!.textContent=n>99?'99+':String(n);badge!.hidden=n===0}).catch(()=>{})}\nfunction bottom(){`);
 upgrade=upgrade.replace("document.body.appendChild(b)}","document.body.appendChild(b);refreshMessageBadge();window.setInterval(refreshMessageBadge,5000)}");
}
fs.writeFileSync(upgradeFile,upgrade);

const adminFile=new URL('../src/AdminPortal.tsx',import.meta.url);let admin=fs.readFileSync(adminFile,'utf8');
if(!admin.includes("import AdminSupportInbox from './AdminSupportInbox';"))admin=admin.replace("import './admin.css';","import './admin.css';\nimport AdminSupportInbox from './AdminSupportInbox';");
admin=admin.replace("|'finance'>('dispatch')","|'messages'|'finance'>('dispatch')");
admin=admin.replace("tab==='promotions'?'Promotions et ristournes':'Finance'","tab==='promotions'?'Promotions et ristournes':tab==='messages'?'Messages clients':'Finance'");
admin=admin.replace("tab==='categories'?'Catégories et tarifs':'Finance'","tab==='categories'?'Catégories et tarifs':tab==='messages'?'Messages clients':'Finance'");
if(!admin.includes("onClick={()=>setTab('messages')}>💬 Messages")){
 admin=admin.replace("<button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>","<button className={tab==='messages'?'active':''} onClick={()=>setTab('messages')}>💬 Messages</button><button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>");
}
if(!admin.includes("{tab==='messages'&&<AdminSupportInbox token={token}/>}"))admin=admin.replace("{tab==='finance'&&<>","{tab==='messages'&&<AdminSupportInbox token={token}/>}\n {tab==='finance'&&<>");
fs.writeFileSync(adminFile,admin);
console.log('✓ customer messaging wired into client bottom bar and admin inbox');
