// Adds an explicit logout action inside the profile panel on both client and provider portals.
const installProfileLogout=()=>{
  const apply=()=>{
    const profile=document.querySelector<HTMLElement>('.profile-panel');
    if(!profile||profile.querySelector('[data-profile-logout="1"]'))return;
    const button=document.createElement('button');
    button.type='button';
    button.dataset.profileLogout='1';
    button.className='portal-secondary full';
    button.textContent='↪ Se déconnecter';
    button.style.marginTop='18px';
    button.style.width='100%';
    button.style.borderColor='#7a3340';
    button.style.color='#ffb7c1';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      button.textContent='Déconnexion…';
      try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}finally{
        localStorage.clear();
        window.location.href='/';
      }
    });
    profile.appendChild(button);
  };
  apply();
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installProfileLogout,{once:true});else installProfileLogout();
export {};
