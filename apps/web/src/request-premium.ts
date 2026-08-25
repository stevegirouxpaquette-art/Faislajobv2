function applyRequestPremium(){
  document.querySelectorAll<HTMLElement>('.flow-card').forEach(card=>{
    const eyebrow=card.querySelector<HTMLElement>('.eyebrow');
    const text=(eyebrow?.textContent||'').trim().toLowerCase();
    if(text.includes('demande de service')) card.classList.add('request-premium');
  });
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;applyRequestPremium();});
}

function start(){
  applyRequestPremium();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
}

document.readyState==='loading'
  ? document.addEventListener('DOMContentLoaded',start,{once:true})
  : start();
