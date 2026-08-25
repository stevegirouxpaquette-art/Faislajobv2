let busy=false;

function esc(v:any){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;')}

function style(){
  if(document.getElementById('client-upgrade-style'))return;
  const s=document.createElement('style');
  s.id='client-upgrade-style';
  s.textContent=`.cl-pref{margin-top:18px}.cl-pref label{display:block;color:#aebdd0;font-weight:700;margin:12px 0 6px}.cl-pref input,.cl-pref textarea,.cl-pref select{box-sizing:border-box;width:100%;padding:13px;border-radius:12px;border:1px solid #35465f;background:#091321;color:#fff;font-size:16px}`;
  document.head.appendChild(s);
}

function profile(){
  const panel=document.querySelector<HTMLElement>('.profile-panel');
  if(!panel||document.getElementById('client-profile-upgrade'))return;
  const saved=JSON.parse(localStorage.getItem('faislajob_client_preferences')||'{}');
  const x=document.createElement('div');
  x.id='client-profile-upgrade';
  x.className='cl-pref';
  x.innerHTML=`<h3>Mes préférences</h3><label>Adresse principale</label><input id="cp-address" value="${esc(saved.address||'')}" placeholder="Adresse pour les prochaines demandes"><label>Mode de paiement préféré</label><select id="cp-pay"><option>Virement Interac</option></select><label>Instructions habituelles</label><textarea id="cp-notes" rows="3" placeholder="Ex. sonner à la porte, stationnement...">${esc(saved.notes||'')}</textarea><button class="portal-primary" id="cp-save" style="margin-top:14px">Enregistrer mes préférences</button><div id="cp-msg" style="color:#8ed0ff;margin-top:9px"></div>`;
  panel.appendChild(x);
  x.querySelector('#cp-save')?.addEventListener('click',()=>{
    localStorage.setItem('faislajob_client_preferences',JSON.stringify({address:(x.querySelector<HTMLInputElement>('#cp-address')?.value||''),payment:'Virement Interac',notes:(x.querySelector<HTMLTextAreaElement>('#cp-notes')?.value||'')}));
    const msg=x.querySelector<HTMLElement>('#cp-msg');
    if(msg)msg.textContent='✓ Préférences enregistrées.';
  });
}

async function run(){
  if(busy)return;
  busy=true;
  try{
    style();
    const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!me.ok)return;
    const u=(await me.json()).user;
    if(u?.role!=='client')return;
    profile();
  }catch{}finally{busy=false}
}

setTimeout(run,700);
setInterval(run,4000);
new MutationObserver(()=>profile()).observe(document.documentElement,{subtree:true,childList:true});
