import './address-autocomplete.css';

type Place={display_name:string;lat:string;lon:string;address?:Record<string,string>};
let timer:number|undefined;

function findAddressInput(){
  const inputs=[...document.querySelectorAll<HTMLInputElement>('input.text-input')].filter(i=>i.offsetParent!==null);
  const byContext=inputs.find(input=>{
    const card=input.closest<HTMLElement>('.flow-card');
    const text=(card?.textContent||'').toLowerCase();
    return text.includes('où la job')||text.includes('adresse')||text.includes('où la tâche');
  });
  if(byContext)return byContext;
  return inputs.length===1?inputs[0]:null;
}
function setNativeValue(input:HTMLInputElement,value:string){
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
  setter?.call(input,value);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
function shortLabel(p:Place){const a=p.address||{};const first=[a.house_number,a.road].filter(Boolean).join(' ');const city=a.city||a.town||a.village||a.municipality||'';return [first||p.display_name.split(',')[0],city,a.state].filter(Boolean).join(', ')}
function mapHtml(lat:number,lon:number){const d=.008,bbox=[lon-d,lat-d,lon+d,lat+d].join('%2C');return `<div class="address-map"><iframe loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}" title="Carte OpenStreetMap"></iframe><div class="address-map-note">Carte © OpenStreetMap contributors</div></div>`}
function render(input:HTMLInputElement){let box=input.parentElement?.querySelector<HTMLElement>('.address-assist');if(!box){box=document.createElement('div');box.className='address-assist';input.insertAdjacentElement('afterend',box)}return box}
function wireLocate(input:HTMLInputElement,box:HTMLElement){const btn=box.querySelector<HTMLButtonElement>('.address-locate');if(!btn)return;btn.onclick=()=>{if(!navigator.geolocation){box.insertAdjacentHTML('beforeend','<div class="address-error">La localisation n’est pas disponible sur cet appareil.</div>');return}btn.disabled=true;btn.textContent='📍 Localisation…';navigator.geolocation.getCurrentPosition(async pos=>{try{const {latitude,longitude}=pos.coords;const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,{headers:{'Accept-Language':'fr-CA,fr;q=0.9,en;q=0.7'}});const p=await r.json() as Place;setNativeValue(input,p.display_name||`${latitude}, ${longitude}`);box.innerHTML=`<button type="button" class="address-locate">📍 Utiliser ma position</button>${mapHtml(latitude,longitude)}`;wireLocate(input,box)}catch{btn.disabled=false;btn.textContent='📍 Utiliser ma position';box.insertAdjacentHTML('beforeend','<div class="address-error">Impossible de trouver l’adresse de ta position.</div>')}},()=>{btn.disabled=false;btn.textContent='📍 Utiliser ma position';box.insertAdjacentHTML('beforeend','<div class="address-error">Autorise la localisation pour utiliser ta position.</div>')},{enableHighAccuracy:true,timeout:10000,maximumAge:30000})}}
async function searchAddress(input:HTMLInputElement,q:string){const box=render(input);box.innerHTML='<button type="button" class="address-locate">📍 Utiliser ma position</button>';wireLocate(input,box);if(q.trim().length<3)return;box.insertAdjacentHTML('beforeend','<div class="address-loading">Recherche d’adresses…</div>');try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ca&limit=5&q=${encodeURIComponent(q)}`,{headers:{'Accept-Language':'fr-CA,fr;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error();const places=await r.json() as Place[];box.querySelector('.address-loading')?.remove();const list=document.createElement('div');list.className='address-suggestions';places.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='address-suggestion';b.innerHTML=`<strong>${shortLabel(p)}</strong><small>${p.display_name}</small>`;b.onclick=()=>{setNativeValue(input,p.display_name);box.innerHTML=`<button type="button" class="address-locate">📍 Utiliser ma position</button>${mapHtml(Number(p.lat),Number(p.lon))}`;wireLocate(input,box)};list.appendChild(b)});if(places.length)box.appendChild(list);else box.insertAdjacentHTML('beforeend','<div class="address-loading">Aucune adresse trouvée.</div>')}catch{box.querySelector('.address-loading')?.remove();box.insertAdjacentHTML('beforeend','<div class="address-error">La recherche d’adresse est temporairement indisponible.</div>')}}
function mount(){const input=findAddressInput();if(!input)return;if(input.dataset.addressReady==='1')return;input.dataset.addressReady='1';input.autocomplete='street-address';input.placeholder='Commence à écrire ton adresse…';const box=render(input);box.innerHTML='<button type="button" class="address-locate">📍 Utiliser ma position</button>';wireLocate(input,box);input.addEventListener('input',()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>searchAddress(input,input.value),350)})}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount()})}
function start(){mount();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});let tries=0;const t=window.setInterval(()=>{mount();if(++tries>60)window.clearInterval(t)},500)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
