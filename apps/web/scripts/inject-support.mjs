import fs from 'node:fs';
const portal='src/UserPortal.tsx';
let s=fs.readFileSync(portal,'utf8');
if(!s.includes("import SupportFaq from './SupportFaq';"))s=s.replace("import {clientOrderId,clientPublicId,dailyPin,providerMissionId,providerPublicId} from './publicIds';","import {clientOrderId,clientPublicId,dailyPin,providerMissionId,providerPublicId} from './publicIds';\nimport SupportFaq from './SupportFaq';");
// Support reste volontairement absent du menu latéral/haut : il est ouvert par le bouton mobile en bas à droite.
s=s.replace("[['home','⌂','Accueil'],['missions','📋','Mes commandes'],['payments','💳','Paiements'],['support','❓','Support'],['profile','👤','Profil']]","[['home','⌂','Accueil'],['missions','📋','Mes commandes'],['payments','💳','Paiements'],['profile','👤','Profil']]");
s=s.replace("tab==='payments'?'Paiements & factures':'Ton profil'","tab==='payments'?'Paiements & factures':tab==='support'?'Support & FAQ':'Ton profil'");
if(!s.includes("faislajob-open-support"))s=s.replace("const[tab,setTab]=useState('home');const[missions,setMissions]", "const[tab,setTab]=useState('home');useEffect(()=>{const openSupport=()=>setTab('support');window.addEventListener('faislajob-open-support',openSupport);return()=>window.removeEventListener('faislajob-open-support',openSupport)},[]);const[missions,setMissions]");
if(!s.includes("{tab==='support'&&<SupportFaq/>}"))s=s.replace("{tab==='profile'&&<ProfileCard user={user} role=\"client\"/>}","{tab==='support'&&<SupportFaq/>}\n  {tab==='profile'&&<ProfileCard user={user} role=\"client\"/>}");
fs.writeFileSync(portal,s);
const upgrade='src/client-ui-upgrade.ts';
let u=fs.readFileSync(upgrade,'utf8');
u=u.replace("if(a==='support'||a==='messages')go('Profil')","if(a==='support')window.dispatchEvent(new Event('faislajob-open-support'));if(a==='messages')go('Profil')");
u=u.replace("if(a==='support')go('Support');if(a==='messages')go('Profil')","if(a==='support')window.dispatchEvent(new Event('faislajob-open-support'));if(a==='messages')go('Profil')");
u=u.replace("if(a==='support')go('Profil')","if(a==='support')window.dispatchEvent(new Event('faislajob-open-support'))");
u=u.replace("if(a==='support')go('Support')","if(a==='support')window.dispatchEvent(new Event('faislajob-open-support'))");
fs.writeFileSync(upgrade,u);
console.log('✓ support FAQ wired only to bottom-right Support button');
