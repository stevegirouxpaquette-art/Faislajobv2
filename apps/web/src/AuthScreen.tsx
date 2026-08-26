import { useEffect, useState } from 'react';
import './public-home.css';

type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};
type Props={onAuthenticated:(user:User)=>void};

export default function AuthScreen({onAuthenticated}:Props){
  const[showForm,setShowForm]=useState(false);
  const[mode,setMode]=useState<'login'|'register'>('login');
  const[role,setRole]=useState<'client'|'provider'>('client');
  const[name,setName]=useState('');const[email,setEmail]=useState('');const[phone,setPhone]=useState('');const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);const[error,setError]=useState('');
  const[homeArtwork,setHomeArtwork]=useState('');

  useEffect(()=>{
    let cancelled=false;
    fetch('/faislajob-home-exact-v2.webp.b64',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('artwork');return r.text()})
      .then(t=>{if(!cancelled)setHomeArtwork(`data:image/webp;base64,${t.trim()}`)})
      .catch(()=>{if(!cancelled)setHomeArtwork('')});
    return()=>{cancelled=true};
  },[]);

  const openForm=(next:'login'|'register')=>{setMode(next);setShowForm(true);setError('');window.scrollTo({top:0,behavior:'smooth'})};
  const submit=async()=>{setLoading(true);setError('');try{const endpoint=mode==='login'?'/api/auth/login':'/api/auth/register';const body=mode==='login'?{email,password}:{name,email,phone,password,role};const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Connexion impossible.');onAuthenticated(data.user as User)}catch(e){setError(e instanceof Error?e.message:'Une erreur est survenue.')}finally{setLoading(false)}};

  if(showForm)return <main className="public-home"><section className="auth-panel"><button className="auth-back" onClick={()=>setShowForm(false)}>← Retour</button><div className="auth-logo">FaisLa<span>Job</span></div><div className="role-switch"><button className={role==='client'?'active':''} onClick={()=>setRole('client')}>Client</button><button className={role==='provider'?'active':''} onClick={()=>setRole('provider')}>Partenaire</button></div><div className="auth-kicker">{mode==='login'?'Connexion':'Créer un compte'}</div><h1>{mode==='login'?'Content de te revoir':'Bienvenue chez FaisLaJob'}</h1><p>{role==='client'?'Demande un service en quelques étapes simples.':'Accède directement aux jobs disponibles et à tes missions.'}</p>{mode==='register'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom complet"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Courriel" inputMode="email" autoCapitalize="none"/>{mode==='register'&&<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Téléphone" inputMode="tel"/>}<input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" type="password"/>{error&&<div className="auth-error">⚠️ {error}</div>}<button className="home-primary" onClick={submit} disabled={loading||!email.trim()||password.length<8||(mode==='register'&&name.trim().length<2)}>{loading?'Patiente…':mode==='login'?'Se connecter':'Créer mon compte'}</button><button className="home-secondary" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Pas encore de compte? Créer un compte':'J’ai déjà un compte'}</button></section></main>;

  return <main className="exact-home-shell">
    <div className="exact-home-card">
      {homeArtwork?<img src={homeArtwork} alt="Accueil FaisLaJob" className="exact-home-image"/>:<div className="exact-home-loading">FaisLaJob</div>}
      <button className="exact-hotspot exact-request" aria-label="Nouvelle demande" onClick={()=>window.location.href='/request'} />
      <button className="exact-hotspot exact-login" aria-label="Se connecter" onClick={()=>openForm('login')} />
      <button className="exact-hotspot exact-register" aria-label="Créer un compte" onClick={()=>openForm('register')} />
    </div>
  </main>;
}
