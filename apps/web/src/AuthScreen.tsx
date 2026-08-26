import { useState } from 'react';
import './public-home.css';

type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};
type Props={onAuthenticated:(user:User)=>void};

const services=[
  ['🧹','Ménage'],['🛠️','Petites réparations'],['🌿','Extérieur & terrain'],['🚚','Déménagement'],['🐾','Animaux et plus']
] as const;

export default function AuthScreen({onAuthenticated}:Props){
  const[showForm,setShowForm]=useState(false);
  const[mode,setMode]=useState<'login'|'register'>('login');
  const[role,setRole]=useState<'client'|'provider'>('client');
  const[name,setName]=useState('');const[email,setEmail]=useState('');const[phone,setPhone]=useState('');const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);const[error,setError]=useState('');

  const openForm=(next:'login'|'register')=>{setMode(next);setShowForm(true);setError('');window.scrollTo({top:0,behavior:'smooth'})};
  const submit=async()=>{setLoading(true);setError('');try{const endpoint=mode==='login'?'/api/auth/login':'/api/auth/register';const body=mode==='login'?{email,password}:{name,email,phone,password,role};const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Connexion impossible.');onAuthenticated(data.user as User)}catch(e){setError(e instanceof Error?e.message:'Une erreur est survenue.')}finally{setLoading(false)}};

  if(showForm)return <main className="public-home"><section className="auth-panel"><button className="auth-back" onClick={()=>setShowForm(false)}>← Retour</button><div className="auth-logo">FaisLa<span>Job</span></div><div className="role-switch"><button className={role==='client'?'active':''} onClick={()=>setRole('client')}>Client</button><button className={role==='provider'?'active':''} onClick={()=>setRole('provider')}>Partenaire</button></div><div className="auth-kicker">{mode==='login'?'Connexion':'Créer un compte'}</div><h1>{mode==='login'?'Content de te revoir':'Bienvenue chez FaisLaJob'}</h1><p>{role==='client'?'Demande un service en quelques étapes simples.':'Accède directement aux jobs disponibles et à tes missions.'}</p>{mode==='register'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom complet"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Courriel" inputMode="email" autoCapitalize="none"/>{mode==='register'&&<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Téléphone" inputMode="tel"/>}<input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" type="password"/>{error&&<div className="auth-error">⚠️ {error}</div>}<button className="home-primary" onClick={submit} disabled={loading||!email.trim()||password.length<8||(mode==='register'&&name.trim().length<2)}>{loading?'Patiente…':mode==='login'?'Se connecter':'Créer mon compte'}</button><button className="home-secondary" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Pas encore de compte? Créer un compte':'J’ai déjà un compte'}</button></section></main>;

  return <main className="app-home">
    <section className="app-hero">
      <div className="hero-head">
        <div className="brand-icon">🔧</div>
        <div className="brand">FaisLa<span>Job</span></div>
        <button className="sector"><span>📍</span><span><small>Votre secteur</small><b>Trois-Rivières + 25 km</b></span><i>⌄</i></button>
      </div>
      <div className="hero-copy"><small>LE COUP DE MAIN QU’IL TE FAUT,</small><h1>QUAND TU EN AS BESOIN.</h1></div>
      <div className="hero-grid">
        <div className="benefits">
          <div><i>⚡</i><span><b>Rapide & simple</b><small>Demande en quelques étapes</small></span></div>
          <div><i>✓</i><span><b>Fiable & sécuritaire</b><small>Prestataires vérifiés</small></span></div>
          <div><i>📍</i><span><b>Service local</b><small>Dans ton secteur</small></span></div>
        </div>
        <div className="mascot-wrap"><img src="/faislajob-hero.webp" alt="Mascotte FaisLaJob"/><div className="rest-note">On s’occupe<br/>du reste !</div></div>
      </div>
    </section>

    <button className="request-cta" onClick={()=>window.location.href='/request'}><div className="phone-tile">📱</div><div><small>NOUVELLE DEMANDE</small><strong>Dis-nous ce dont<br/>tu as <em>besoin</em></strong><span>On s’occupe du reste.</span></div><i>→</i></button>

    <section className="services"><small>DES CENTAINES DE SERVICES</small><h2>On a la personne pour le faire.</h2><div className="service-row">{services.map(([icon,label])=><button key={label} onClick={()=>window.location.href='/request'}><i>{icon}</i><span>{label}</span></button>)}</div></section>

    <div className="trust-row"><span>🛡️ Prestataires vérifiés</span><span>👥 Assurés</span><span>☆ Évalués par des clients comme toi</span></div>
    <div className="auth-actions"><button className="login-main" onClick={()=>openForm('login')}>👤 <b>Se connecter</b><i>›</i></button><button className="register-main" onClick={()=>openForm('register')}>👤＋ <b>Créer un compte</b><i>›</i></button></div>
    <div className="rating-row"><span>👩🏻 👨🏻 👩🏻 <small>Plus de 1000+ clients satisfaits</small></span><strong>★★★★★ <b>4,9/5</b></strong></div>
  </main>;
}
