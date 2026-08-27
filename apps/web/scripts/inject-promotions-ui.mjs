import fs from 'node:fs';

function replaceRequired(source,from,to,label){if(source.includes(to))return source;if(!source.includes(from))throw new Error(`Could not patch ${label}`);return source.replace(from,to)}

const mainFile=new URL('../src/main.tsx',import.meta.url);let main=fs.readFileSync(mainFile,'utf8');
if(!main.includes("import PromotionsPage from './PromotionsPage';"))main=main.replace("import AuthScreen from './AuthScreen';","import AuthScreen from './AuthScreen';\nimport PromotionsPage from './PromotionsPage';");
main=replaceRequired(main," const isRequest=path==='/request'||path.startsWith('/request/');"," const isRequest=path==='/request'||path.startsWith('/request/');\n const isPromotions=path==='/promotions'||path.startsWith('/promotions/');",'promotions route flag');
main=replaceRequired(main," if(isRequest){if(user?.role==='provider')return <RoleGuardMessage user={user}/>;return <RequestFlow/>}"," if(isRequest){if(user?.role==='provider')return <RoleGuardMessage user={user}/>;return <RequestFlow/>}\n if(isPromotions){if(!user)return <AuthScreen onAuthenticated={(next)=>{setUser(next);window.location.href='/promotions'}}/>;if(user.role==='provider')return <RoleGuardMessage user={user}/>;return <PromotionsPage/>}",'promotions route');
fs.writeFileSync(mainFile,main);

const upgradeFile=new URL('../src/client-ui-upgrade.ts',import.meta.url);let upgrade=fs.readFileSync(upgradeFile,'utf8');
if(!upgrade.includes("if(a==='promos')location.href='/promotions'"))upgrade=upgrade.replace("if(a==='request')location.href='/request';","if(a==='request')location.href='/request';if(a==='promos')location.href='/promotions';");
fs.writeFileSync(upgradeFile,upgrade);

const adminFile=new URL('../src/AdminPortal.tsx',import.meta.url);let admin=fs.readFileSync(adminFile,'utf8');
if(!admin.includes("import PromotionsAdmin from './PromotionsAdmin';"))admin=admin.replace("import './admin.css';","import './admin.css';\nimport PromotionsAdmin from './PromotionsAdmin';");

// Add promotions to the admin tab union regardless of whether Zones has already been injected.
if(!/useState<[^>]*'promotions'[^>]*>\('dispatch'\)/.test(admin)){
  admin=admin.replace(/useState<([^>]*)>\('dispatch'\)/,(full,tabs)=>`useState<${String(tabs).replace("|'finance'","|'promotions'|'finance'")}>('dispatch')`);
}
if(!admin.includes("tab==='promotions')requests.push")){
  if(admin.includes("else if(tab==='zones'){}else requests.push(api('/api/admin/finance'))"))
    admin=admin.replace("else if(tab==='zones'){}else requests.push(api('/api/admin/finance'))","else if(tab==='zones')requests.push(Promise.resolve({}));else if(tab==='promotions')requests.push(Promise.resolve({}));else requests.push(api('/api/admin/finance'))");
  else
    admin=admin.replace("else if(tab==='categories')requests.push(api('/api/categories'));else requests.push(api('/api/admin/finance'));","else if(tab==='categories')requests.push(api('/api/categories'));else if(tab==='promotions')requests.push(Promise.resolve({}));else requests.push(api('/api/admin/finance'));");
}
if(!admin.includes("else if(tab==='promotions'){}")){
  admin=admin.replace("else if(tab==='categories')setCategories(data[1].categories);else{setPayments(data[1].payments);setPayouts(data[1].payouts)}","else if(tab==='categories')setCategories(data[1].categories);else if(tab==='zones'){}else if(tab==='promotions'){}else{setPayments(data[1].payments);setPayouts(data[1].payouts)}");
}
if(!admin.includes("tab==='promotions'?'Promotions et ristournes'")){
  admin=admin.replace("tab==='zones'?'Zones et tarifs':'Finance'","tab==='zones'?'Zones et tarifs':tab==='promotions'?'Promotions et ristournes':'Finance'");
  admin=admin.replace("tab==='categories'?'Catégories et tarifs':'Finance'","tab==='categories'?'Catégories et tarifs':tab==='promotions'?'Promotions et ristournes':'Finance'");
}
if(!admin.includes("onClick={()=>setTab('promotions')}>🎁 Promotions")){
  admin=admin.replace("<button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>","<button className={tab==='promotions'?'active':''} onClick={()=>setTab('promotions')}>🎁 Promotions</button><button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}>💳 Finance</button>");
}
if(!admin.includes("{tab==='promotions'&&<PromotionsAdmin token={token}/>}"))admin=admin.replace("{tab==='finance'&&<>","{tab==='promotions'&&<PromotionsAdmin token={token}/>}\n {tab==='finance'&&<>");
fs.writeFileSync(adminFile,admin);
console.log('✓ promotions page, promo square and clear admin form wired');
