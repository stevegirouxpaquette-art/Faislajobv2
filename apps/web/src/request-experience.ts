const categoryDescriptions:Record<string,string>={
'Ménage':'Maison, condo, nettoyage, etc.',
'Petites réparations':'Plomberie, électricité, assemblage, etc.',
'Terrain & extérieur':'Tonte, jardinage, entretien, etc.',
'Déménagement':'Résidentiel, commercial, transport, etc.',
'Déneigement':'Entrée, trottoir, stationnement, etc.',
'Animaux':'Promenade, garde, toilettage, etc.'
};
const optionMeta:Record<string,{icon:string,desc:string}>={
'Ménage régulier':{icon:'🧹',desc:'Entretien courant de la maison ou du condo'},
'Grand ménage':{icon:'✨',desc:'Nettoyage complet et en profondeur'},
'Après déménagement':{icon:'📦',desc:'Nettoyage après un départ ou une arrivée'},
'Assemblage':{icon:'🪛',desc:'Meubles, étagères et petits assemblages'},
'Installation':{icon:'🔧',desc:'Petites installations à la maison'},
'Réparation légère':{icon:'🛠️',desc:'Petits travaux et réparations courantes'},
'Tonte de gazon':{icon:'🌱',desc:'Tonte et finition de la pelouse'},
'Ramassage de feuilles':{icon:'🍂',desc:'Ramassage et mise en sacs'},
'Entretien extérieur':{icon:'🌿',desc:'Petits travaux autour de la propriété'},
'Aide à transporter':{icon:'🏠',desc:'Maison, condo ou appartement'},
'Chargement / déchargement':{icon:'📦',desc:'Quelques meubles ou boîtes seulement'},
'Petits meubles':{icon:'🚚',desc:'Transport de meubles et petits articles'},
'Entrée':{icon:'❄️',desc:'Déneigement de l’entrée'},
'Escaliers':{icon:'🧊',desc:'Marches, galerie et accès'},
'Auto à déneiger':{icon:'🚗',desc:'Déneigement autour du véhicule'},
'Promenade':{icon:'🐕',desc:'Promenade de ton animal'},
'Visite à domicile':{icon:'🏡',desc:'Visite, nourriture et présence'},
'Aide ponctuelle':{icon:'🐾',desc:'Besoin particulier pour ton animal'}
};
function enhanceCategory(card:HTMLElement){
 const label=card.querySelector('span:last-child')?.textContent?.trim()||'';
 if(!label||card.querySelector('.request-card-copy'))return;
 const copy=document.createElement('div');copy.className='request-card-copy';copy.innerHTML=`<strong>${label}</strong><small>${categoryDescriptions[label]||'Service sur demande'}</small>`;
 const old=card.querySelector('span:last-child');old?.replaceWith(copy);
}
function enhanceOptions(card:HTMLElement){
 card.querySelectorAll<HTMLElement>('.option-row').forEach(row=>{
   if(row.querySelector('.request-option-copy'))return;
   const first=row.querySelector('span:first-child');const label=first?.textContent?.trim()||'';if(!label)return;
   const meta=optionMeta[label]||{icon:'✓',desc:'Choisis cette option pour continuer'};
   const wrap=document.createElement('span');wrap.className='request-option-content';wrap.innerHTML=`<span class="request-option-icon">${meta.icon}</span><span class="request-option-copy"><strong>${label}</strong><small>${meta.desc}</small></span>`;
   first?.replaceWith(wrap);
   const arrow=row.querySelector('span:last-child');if(arrow){arrow.textContent='○';arrow.className='request-option-radio'}
 });
 if(card.querySelector('.option-list')&&!card.querySelector('.request-tip')){
   const tip=document.createElement('div');tip.className='request-tip';tip.innerHTML='<strong>💡 Bon à savoir</strong><br>Tu pourras donner plus de détails à l’étape suivante pour recevoir un prix juste.';
   card.querySelector('.option-list')?.insertAdjacentElement('afterend',tip);
 }
}
function addBack(card:HTMLElement){
 const pill=card.querySelector('.step-pill');if(!pill)return;const m=(pill.textContent||'').match(/Étape\s+(\d+)/i);const step=Number(m?.[1]||1);if(step<=1||card.querySelector('.request-back'))return;
 const btn=document.createElement('button');btn.type='button';btn.className='request-back';btn.textContent='← Retour';
 btn.onclick=()=>history.back();
 card.insertAdjacentElement('afterbegin',btn);
}
function mount(){
 document.querySelectorAll<HTMLElement>('.flow-card').forEach(card=>{
  const eyebrow=(card.querySelector('.eyebrow')?.textContent||'').toLowerCase();if(!eyebrow.includes('demande de service'))return;
  card.classList.add('request-premium');enhanceOptions(card);addBack(card);card.querySelectorAll<HTMLElement>('.category-card').forEach(enhanceCategory);
 });
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()})}
function start(){mount();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
