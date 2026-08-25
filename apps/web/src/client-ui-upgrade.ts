import './client-premium.css';
import c0 from './mascot-chunk-0';
import c1 from './mascot-chunk-1';
import c2 from './mascot-chunk-2';
import c3 from './mascot-chunk-3';
import c4 from './mascot-chunk-4';
import c5 from './mascot-chunk-5';
import c6 from './mascot-chunk-6';
import c7 from './mascot-chunk-7';

const mascot=`data:image/webp;base64,${c0}${c1}${c2}${c3}${c4}${c5}${c6}${c7}`;

function clickNav(label:string){
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('.user-portal-nav nav button')];
  buttons.find(b=>(b.textContent||'').includes(label))?.click();
}

function mountClientHome(){
  const role=document.querySelector('.portal-role')?.textContent||'';
  if(!role.includes('Portail client')) return;
  const main=document.querySelector<HTMLElement>('.user-portal-main');
  const title=main?.querySelector<HTMLElement>('.portal-top h1');
  if(!main||!title) return;
  const isHome=title.textContent?.trim()==='Ton tableau de bord';
  main.classList.toggle('client-home-premium',!!isHome);
  document.querySelector('.client-bottom-nav')?.remove();
  if(!isHome){ document.querySelector('.client-premium-hero')?.remove(); return; }

  const stats=main.querySelector('.portal-stats');
  if(!stats) return;
  [...stats.querySelectorAll<HTMLElement>('.portal-stat')].forEach((card,i)=>{
    card.classList.add(`client-stat-${i}`);
  });

  if(!main.querySelector('.client-premium-hero')){
    const kicker=main.querySelector('.portal-top .portal-kicker')?.textContent||'Bonjour 👋';
    const hero=document.createElement('section');
    hero.className='client-premium-hero';
    hero.innerHTML=`
      <div class="client-hero-copy">
        <span class="client-hero-kicker">${kicker}</span>
        <h1>Prêt à déléguer<br/>une tâche ?</h1>
        <p>FaisLaJob s’occupe de trouver le bon partenaire pour toi.</p>
        <button class="client-hero-cta" data-action="request">＋ Nouvelle demande <span>›</span></button>
      </div>
      <div class="client-hero-visual">
        <div class="client-glow client-glow-a"></div>
        <div class="client-glow client-glow-b"></div>
        <img src="${mascot}" alt="Mascotte FaisLaJob" />
        <span class="client-floating client-check">✓</span>
        <span class="client-floating client-user">◉</span>
      </div>
      <div class="client-quick-grid">
        <button data-action="missions"><span>📋</span><strong>Mes commandes</strong><small>Voir l’historique</small></button>
        <button data-action="support"><span>💬</span><strong>Besoin d’aide ?</strong><small>Parle-nous</small></button>
        <button data-action="request"><span>🕒</span><strong>Demande rapide</strong><small>En 2 minutes</small></button>
        <button data-action="payments"><span>🛡️</span><strong>Paiement sécurisé</strong><small>100% protégé</small></button>
      </div>`;
    stats.parentElement?.insertBefore(hero,stats);
    hero.addEventListener('click',(e)=>{
      const btn=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if(!btn)return;
      const action=btn.dataset.action;
      if(action==='request') window.location.href='/request';
      if(action==='missions') clickNav('Mes commandes');
      if(action==='payments') clickNav('Paiements');
      if(action==='support') clickNav('Profil');
    });
  }

  const bottom=document.createElement('nav');
  bottom.className='client-bottom-nav';
  bottom.innerHTML=`<button data-action="home"><span>⌂</span><small>Accueil</small></button><button data-action="missions"><span>☷</span><small>Commandes</small></button><button class="client-bottom-plus" data-action="request"><span>＋</span></button><button data-action="payments"><span>▣</span><small>Paiements</small></button><button data-action="support"><span>◌</span><small>Profil</small></button>`;
  bottom.addEventListener('click',(e)=>{
    const btn=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if(!btn)return;
    const action=btn.dataset.action;
    if(action==='request') window.location.href='/request';
    if(action==='home') clickNav('Accueil');
    if(action==='missions') clickNav('Mes commandes');
    if(action==='payments') clickNav('Paiements');
    if(action==='support') clickNav('Profil');
  });
  document.body.appendChild(bottom);
}

const observer=new MutationObserver(()=>requestAnimationFrame(mountClientHome));
function start(){mountClientHome();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
