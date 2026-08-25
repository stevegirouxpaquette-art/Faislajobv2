import './push-client.css';

type PushState={configured?:boolean;subscribed?:boolean;publicKey?:string};

function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}

async function getRegistration(){
  if(!('serviceWorker'in navigator))throw new Error('Ce navigateur ne supporte pas les notifications push.');
  await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  return navigator.serviceWorker.ready;
}

async function getState():Promise<PushState>{
  try{const r=await fetch('/api/push/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return{};return await r.json()}catch{return{}}
}

async function enablePush(status:HTMLElement,button:HTMLButtonElement,testButton:HTMLButtonElement){
  button.disabled=true;status.className='push-status';status.textContent='Activation…';
  try{
    if(!('Notification'in window))throw new Error('Notifications non supportées sur cet appareil.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Autorise les notifications dans les réglages du navigateur.');
    const config=await fetch('/api/push/public-key',{credentials:'same-origin',cache:'no-store'});
    if(!config.ok){const d=await config.json().catch(()=>({}));throw new Error(d.error||'Les notifications ne sont pas encore configurées sur le serveur.');}
    const {publicKey}=await config.json();
    if(!publicKey)throw new Error('Clé push manquante sur le serveur.');
    const reg=await getRegistration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)});
    const save=await fetch('/api/push/subscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});
    if(!save.ok)throw new Error('Impossible d’enregistrer cet appareil.');
    status.className='push-status ok';status.textContent='✓ Notifications activées sur cet appareil';
    button.textContent='Notifications activées';testButton.hidden=false;
  }catch(e){status.className='push-status warn';status.textContent=e instanceof Error?e.message:'Activation impossible.';button.disabled=false;}
}

async function testPush(status:HTMLElement,button:HTMLButtonElement){
  button.disabled=true;status.textContent='Envoi du test…';
  try{const r=await fetch('/api/push/test',{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Test impossible.');status.className='push-status ok';status.textContent='✓ Notification test envoyée';}
  catch(e){status.className='push-status warn';status.textContent=e instanceof Error?e.message:'Test impossible.'}finally{button.disabled=false}
}

function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true}

function mountPushPanel(){
  const profile=document.querySelector<HTMLElement>('.profile-panel');
  if(!profile||profile.querySelector('[data-push-panel="1"]'))return;
  const panel=document.createElement('section');panel.className='push-panel';panel.dataset.pushPanel='1';
  panel.innerHTML=`<div class="push-panel-head"><div class="push-panel-icon">🔔</div><div class="push-panel-copy"><strong>Notifications</strong><small>Reçois les mises à jour importantes de tes missions même quand tu n’es pas dans FaisLaJob.</small></div></div><div class="push-panel-actions"><button class="push-enable" type="button">Activer les notifications</button><button class="push-test" type="button" hidden>Tester</button></div><div class="push-status">Vérification…</div>${isIos()&&!isStandalone()?'<div class="push-ios-hint">Sur iPhone, ajoute d’abord FaisLaJob à l’écran d’accueil avec Partager → Ajouter à l’écran d’accueil, puis ouvre l’app depuis cette icône pour activer les notifications.</div>':''}`;
  const logout=profile.querySelector('[data-profile-logout="1"]');if(logout)profile.insertBefore(panel,logout);else profile.appendChild(panel);
  const enable=panel.querySelector<HTMLButtonElement>('.push-enable')!,test=panel.querySelector<HTMLButtonElement>('.push-test')!,status=panel.querySelector<HTMLElement>('.push-status')!;
  enable.onclick=()=>enablePush(status,enable,test);test.onclick=()=>testPush(status,test);
  getState().then(async state=>{
    if(!state.configured){status.className='push-status warn';status.textContent='Configuration serveur requise avant l’activation.';return}
    try{const reg=await getRegistration();const sub=await reg.pushManager.getSubscription();if(sub){status.className='push-status ok';status.textContent='✓ Notifications activées sur cet appareil';enable.textContent='Notifications activées';enable.disabled=true;test.hidden=false}else{status.textContent='Notifications disponibles';}}
    catch{status.className='push-status warn';status.textContent='Notifications non disponibles sur ce navigateur.'}
  });
}

function start(){mountPushPanel();new MutationObserver(mountPushPanel).observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
export {};
