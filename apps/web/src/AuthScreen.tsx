import { useState } from 'react';

type User={id:string;email:string;role:'client'|'provider';client_id:string|null;provider_id:string|null;name:string;phone?:string|null};

type Props={onAuthenticated:(user:User)=>void};

export default function AuthScreen({onAuthenticated}:Props){
  const[mode,setMode]=useState<'login'|'register'>('login');
  const[role,setRole]=useState<'client'|'provider'>('client');
  const[name,setName]=useState('');
  const[email,setEmail]=useState('');
  const[phone,setPhone]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  const submit=async()=>{
    setLoading(true);setError('');
    try{
      const endpoint=mode==='login'?'/api/auth/login':'/api/auth/register';
      const body=mode==='login'?{email,password}:{name,email,phone,password,role};
      const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Connexion impossible.');
      onAuthenticated(data.user as User);
    }catch(e){setError(e instanceof Error?e.message:'Une erreur est survenue.')}finally{setLoading(false)}
  };

  return <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#06111f,#071728)',color:'#f8fbff',padding:'34px 20px',display:'flex',justifyContent:'center'}}>
    <section style={{width:'100%',maxWidth:460}}>
      <div style={{fontSize:38,fontWeight:900,color:'#39a9ff',marginBottom:28}}>FaisLaJob</div>
      <div style={{background:'linear-gradient(180deg,#0b1b2e,#0a1727)',border:'1px solid #284765',borderRadius:28,padding:24,boxShadow:'0 24px 70px rgba(0,0,0,.3)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,background:'#101d30',padding:6,borderRadius:16,marginBottom:22}}>
          <button onClick={()=>setRole('client')} style={{border:0,borderRadius:12,padding:'12px 10px',fontWeight:900,fontSize:16,background:role==='client'?'#f4f7fb':'transparent',color:role==='client'?'#07111f':'#95a8bf'}}>Client</button>
          <button onClick={()=>setRole('provider')} style={{border:0,borderRadius:12,padding:'12px 10px',fontWeight:900,fontSize:16,background:role==='provider'?'#f4f7fb':'transparent',color:role==='provider'?'#07111f':'#95a8bf'}}>Partenaire</button>
        </div>
        <div style={{color:'#69bfff',fontWeight:900,letterSpacing:'.14em',fontSize:12,textTransform:'uppercase'}}>{mode==='login'?'Connexion':'Créer un compte'}</div>
        <h1 style={{fontSize:34,lineHeight:1.05,margin:'10px 0 8px'}}>{mode==='login'?'Content de te revoir':'Bienvenue chez FaisLaJob'}</h1>
        <p style={{color:'#9aabc0',lineHeight:1.55,margin:'0 0 22px'}}>{role==='client'?'Demande un service en quelques étapes simples.':'Accède directement aux jobs disponibles et à tes missions.'}</p>
        {mode==='register'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom complet" style={inputStyle}/>} 
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Courriel" inputMode="email" autoCapitalize="none" style={inputStyle}/>
        {mode==='register'&&<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Téléphone" inputMode="tel" style={inputStyle}/>} 
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" type="password" style={inputStyle}/>
        {error&&<div style={{background:'#3b1820',border:'1px solid #753241',color:'#ffc3cc',padding:'11px 13px',borderRadius:12,marginBottom:14,fontWeight:700}}>⚠️ {error}</div>}
        <button onClick={submit} disabled={loading||!email.trim()||password.length<8||(mode==='register'&&name.trim().length<2)} style={{width:'100%',border:0,borderRadius:15,padding:'15px 16px',fontSize:17,fontWeight:900,background:'linear-gradient(90deg,#18a8ff,#1877ff)',color:'white',opacity:loading?.65:1}}>{loading?'Patiente…':mode==='login'?'Se connecter':'Créer mon compte'}</button>
        <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}} style={{width:'100%',marginTop:12,border:'1px solid #2d4c69',borderRadius:15,padding:'13px 16px',fontSize:15,fontWeight:800,background:'#0d1b2b',color:'#c8d7e8'}}>{mode==='login'?'Pas encore de compte? Créer un compte':'J’ai déjà un compte'}</button>
      </div>
    </section>
  </main>;
}

const inputStyle={width:'100%',boxSizing:'border-box' as const,marginBottom:12,border:'1px solid #2a4967',borderRadius:14,padding:'14px 15px',fontSize:16,background:'#091827',color:'#f7fbff',outline:'none'};
