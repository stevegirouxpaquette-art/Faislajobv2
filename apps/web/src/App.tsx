import { useEffect, useMemo, useState } from 'react';

type Category = { id: string; icon: string; name: string; subcategories: string[] };
type Answers = { details: string; timing: string; address: string };
type ClientInfo = { name: string; email: string; phone: string };
type Offer = { offer_id: string; mission_id: string; category_name: string; description: string; mission_status: string };
type Mission = { id: string; provider_id: string | null; category_name?: string; category_id: string; status: string; description: string; duration_minutes?: number | null };
type Provider = { id: string; name: string; is_online: boolean; status: string };
type User = { id: string; email: string; role: 'client' | 'provider'; client_id: string | null; provider_id: string | null; name: string; phone?: string | null };
type AuthForm = { name: string; email: string; phone: string; password: string; role: 'client' | 'provider' };
type ClientMission = { id: string; category_name: string; status: string; description: string; duration_minutes?: number | null; client_total_cents?: number | null; billable_minutes?: number | null; billing_status?: string | null; payment_status?: string | null; created_at: string };
type Billing = { mission_id: string; hourly_rate_cents: number; actual_minutes: number; billable_minutes: number; subtotal_cents: number; client_service_fee_cents: number; client_total_cents: number; provider_commission_cents: number; provider_net_cents: number; payment_status?: string; payment_method?: string; payout_status?: string; release_at?: string | null };
type Payout = { id: string; mission_id: string; category_name: string; amount_cents: number; status: string; release_at?: string | null };

const categories: Category[] = [
  { id: 'menage', icon: '🧹', name: 'Ménage', subcategories: ['Ménage régulier', 'Grand ménage', 'Après déménagement'] },
  { id: 'reparations', icon: '🔧', name: 'Petites réparations', subcategories: ['Assemblage', 'Installation', 'Réparation légère'] },
  { id: 'exterieur', icon: '🌿', name: 'Terrain & extérieur', subcategories: ['Tonte de gazon', 'Ramassage de feuilles', 'Entretien extérieur'] },
  { id: 'demenagement', icon: '📦', name: 'Déménagement', subcategories: ['Aide à transporter', 'Chargement / déchargement', 'Petits meubles'] },
  { id: 'deneigement', icon: '❄️', name: 'Déneigement', subcategories: ['Entrée', 'Escaliers', 'Auto à déneiger'] },
  { id: 'animaux', icon: '🐕', name: 'Animaux', subcategories: ['Promenade', 'Visite à domicile', 'Aide ponctuelle'] },
];
const timingOptions = ['Le plus tôt possible', 'Aujourd’hui', 'Cette semaine', 'Je choisis une date'];
const apiBase = '';
const money = (cents?: number | null) => typeof cents === 'number' ? `${(cents / 100).toFixed(2).replace('.', ',')} $` : '—';

export default function App() {
  const [portal, setPortal] = useState<'client' | 'provider'>('client');
  const [clientView, setClientView] = useState<'request' | 'missions'>('request');
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [answers, setAnswers] = useState<Answers>({ details: '', timing: '', address: '' });
  const [client, setClient] = useState<ClientInfo>({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [missionId, setMissionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState<AuthForm>({ name: '', email: '', phone: '', password: '', role: 'client' });
  const [clientMissions, setClientMissions] = useState<ClientMission[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const title = useMemo(() => {
    if (missionId) return 'Ta demande est envoyée';
    if (step === 0) return 'Qu’est-ce qu’on peut faire pour toi?';
    if (step === 1) return category ? `Quel type de ${category.name.toLowerCase()}?` : 'Choisis un service';
    if (step === 2) return 'Parle-nous un peu de la job';
    if (step === 3) return 'Quand as-tu besoin de quelqu’un?';
    if (step === 4) return 'Où la job doit-elle être faite?';
    if (step === 5) return 'Comment peut-on te joindre?';
    return 'Vérifie ta demande';
  }, [step, category, missionId]);

  const resetFlow = () => {
    setStep(0); setCategory(null); setSubcategory(''); setAnswers({ details: '', timing: '', address: '' });
    setMissionId(null); setError(''); setBilling(null); setClientView('request');
    if (user?.role === 'client') setClient({ name: user.name, email: user.email, phone: user.phone || '' });
    else setClient({ name: '', email: '', phone: '' });
  };

  const loadSession = async () => {
    const response = await fetch(`${apiBase}/api/auth/me`, { credentials: 'same-origin' });
    if (!response.ok) { setUser(null); return null; }
    const nextUser = (await response.json()).user as User;
    setUser(nextUser);
    if (nextUser.role === 'client') setClient({ name: nextUser.name, email: nextUser.email, phone: nextUser.phone || '' });
    return nextUser;
  };
  useEffect(() => { loadSession(); }, []);

  const openAuth = (mode: 'login' | 'register', role?: 'client' | 'provider') => {
    setAuthMode(mode); setAuthOpen(true); setError(''); if (role) setAuthForm((current) => ({ ...current, role }));
  };
  const submitAuth = async () => {
    setAuthLoading(true); setError('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm;
      const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Connexion impossible.');
      const nextUser = data.user as User;
      setUser(nextUser); setAuthOpen(false); setAuthForm({ name: '', email: '', phone: '', password: '', role: 'client' });
      if (nextUser.role === 'provider') setPortal('provider');
      else { setPortal('client'); setClient({ name: nextUser.name, email: nextUser.email, phone: nextUser.phone || '' }); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de connexion.'); }
    finally { setAuthLoading(false); }
  };
  const logout = async () => {
    await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'same-origin' });
    setUser(null); setProvider(null); setOffers([]); setActiveMission(null); setPortal('client'); setClientView('request'); setClientMissions([]); setPayouts([]);
    localStorage.clear(); resetFlow();
  };

  const providerId = user?.role === 'provider' ? user.provider_id : null;
  const loadPartner = async () => {
    if (!providerId) return;
    setPartnerLoading(true); setError('');
    try {
      const [providerResponse, offersResponse, payoutsResponse] = await Promise.all([
        fetch(`${apiBase}/api/providers/${providerId}`, { credentials: 'same-origin' }),
        fetch(`${apiBase}/api/providers/${providerId}/offers`, { credentials: 'same-origin' }),
        fetch(`${apiBase}/api/provider/payouts`, { credentials: 'same-origin' }),
      ]);
      if (!providerResponse.ok || !offersResponse.ok) throw new Error('Impossible de charger le portail partenaire.');
      setProvider((await providerResponse.json()).provider); setOffers((await offersResponse.json()).offers);
      if (payoutsResponse.ok) setPayouts((await payoutsResponse.json()).payouts);
      const storedMissionId = localStorage.getItem(`faislajob_active_mission_${providerId}`);
      if (storedMissionId) {
        const missionResponse = await fetch(`${apiBase}/api/missions/${storedMissionId}`, { credentials: 'same-origin' });
        if (missionResponse.ok) {
          const mission = (await missionResponse.json()).mission as Mission;
          setActiveMission(mission.status === 'completed' ? null : mission);
          if (mission.status === 'completed') localStorage.removeItem(`faislajob_active_mission_${providerId}`);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur partenaire.'); }
    finally { setPartnerLoading(false); }
  };
  useEffect(() => { if (portal === 'provider' && providerId) loadPartner(); }, [portal, providerId]);

  const loadClientMissions = async () => {
    if (user?.role !== 'client') return;
    setError('');
    const response = await fetch(`${apiBase}/api/client/missions`, { credentials: 'same-origin' });
    if (!response.ok) { setError('Impossible de charger tes missions.'); return; }
    setClientMissions((await response.json()).missions);
  };
  useEffect(() => { if (clientView === 'missions' && user?.role === 'client') loadClientMissions(); }, [clientView, user?.id]);

  const viewBilling = async (id: string) => {
    setError(''); setBilling(null);
    const response = await fetch(`${apiBase}/api/missions/${id}/billing`, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || 'Facturation non disponible.'); return; }
    setBilling(data.billing);
  };
  const payMock = async (id: string) => {
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`${apiBase}/api/missions/${id}/pay/mock`, { method: 'POST', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Paiement impossible.');
      setBilling(data.billing); await loadClientMissions();
    } catch (e) { setError(e instanceof Error ? e.message : 'Paiement impossible.'); }
    finally { setSubmitting(false); }
  };

  const toggleOnline = async () => {
    if (!provider || !providerId) return;
    setPartnerLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/providers/${providerId}/availability`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ online: !provider.is_online, categoryIds: categories.map((c) => c.id) }) });
      if (!response.ok) throw new Error('Impossible de changer la disponibilité.'); await loadPartner();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); setPartnerLoading(false); }
  };
  const acceptOffer = async (offerId: string) => {
    if (!providerId) return; setPartnerLoading(true); setError('');
    try {
      const response = await fetch(`${apiBase}/api/offers/${offerId}/accept`, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Cette mission n’est plus disponible.');
      const mission = (await response.json()).mission as Mission; setActiveMission(mission); localStorage.setItem(`faislajob_active_mission_${providerId}`, mission.id); await loadPartner();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); setPartnerLoading(false); }
  };
  const declineOffer = async (offerId: string) => { await fetch(`${apiBase}/api/offers/${offerId}/decline`, { method: 'POST', credentials: 'same-origin' }); await loadPartner(); };
  const missionAction = async (action: 'en-route' | 'arrive' | 'start' | 'complete') => {
    if (!activeMission || !providerId) return; setPartnerLoading(true); setError('');
    try {
      const response = await fetch(`${apiBase}/api/missions/${activeMission.id}/${action}`, { method: 'POST', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Cette action n’est pas permise.');
      const mission = data.mission as Mission; setActiveMission(mission);
      if (mission.status === 'completed') { localStorage.removeItem(`faislajob_active_mission_${providerId}`); setBilling(data.billing || null); await loadPartner(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); }
    finally { setPartnerLoading(false); }
  };

  const submitMission = async () => {
    if (!category) return; setSubmitting(true); setError('');
    try {
      let clientId: number | undefined;
      if (user?.role === 'client' && user.client_id) clientId = Number(user.client_id);
      else {
        const clientResponse = await fetch(`${apiBase}/api/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(client) });
        if (!clientResponse.ok) throw new Error('Création du client impossible.'); clientId = Number((await clientResponse.json()).client.id);
      }
      const description = [subcategory, answers.details, `Moment: ${answers.timing}`, `Adresse: ${answers.address}`].join('\n');
      const missionResponse = await fetch(`${apiBase}/api/missions`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, categoryId: category.id, description }) });
      if (!missionResponse.ok) throw new Error('Création de la mission impossible.'); setMissionId(String((await missionResponse.json()).mission.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    finally { setSubmitting(false); }
  };

  const nextFromDetails = () => { if (answers.details.trim().length >= 5) setStep(3); };
  const nextFromAddress = () => { if (answers.address.trim().length < 5) return; setStep(user?.role === 'client' ? 6 : 5); };
  const nextFromClient = () => { if (client.name.trim().length >= 2 && (client.email.trim() || client.phone.trim())) setStep(6); };

  const authCard = <section className="flow-card auth-card"><div className="flow-topline"><div className="eyebrow">Compte FaisLaJob</div><button className="ghost-button" onClick={() => setAuthOpen(false)}>Fermer</button></div><h1 className="flow-title">{authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>{authMode === 'register' && <><div className="role-choice"><button className={authForm.role === 'client' ? 'switch-active' : ''} onClick={() => setAuthForm({ ...authForm, role: 'client' })}>Je suis client</button><button className={authForm.role === 'provider' ? 'switch-active' : ''} onClick={() => setAuthForm({ ...authForm, role: 'provider' })}>Je suis partenaire</button></div><input className="text-input" placeholder="Nom complet" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /><input className="text-input" placeholder="Téléphone" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></>}<input className="text-input" type="email" placeholder="Courriel" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /><input className="text-input" type="password" placeholder="Mot de passe (8 caractères minimum)" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />{error && <p className="error-box">⚠️ {error}</p>}<button className="primary-button full-button" disabled={authLoading} onClick={submitAuth}>{authLoading ? 'Un instant…' : authMode === 'login' ? 'Me connecter' : 'Créer mon compte'}</button><button className="link-button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}>{authMode === 'login' ? 'Pas encore de compte? Créer un compte' : 'J’ai déjà un compte'}</button></section>;

  const billingCard = billing && <div className="active-mission-card"><div className="eyebrow">Facturation mission #{billing.mission_id}</div><h2>{money(billing.client_total_cents)}</h2><div className="summary-card"><div><span>Temps réel</span><strong>{billing.actual_minutes} min</strong></div><div><span>Temps facturé</span><strong>{billing.billable_minutes} min</strong></div><div><span>Job</span><strong>{money(billing.subtotal_cents)}</strong></div><div><span>Frais de service</span><strong>{money(billing.client_service_fee_cents)}</strong></div><div><span>Partenaire net</span><strong>{money(billing.provider_net_cents)}</strong></div><div><span>Paiement</span><strong>{billing.payment_status || 'pending'}</strong></div></div>{billing.payment_status !== 'paid' && user?.role === 'client' && <button className="primary-button full-button" disabled={submitting} onClick={() => payMock(billing.mission_id)}>💳 Payer en mode test</button>}{billing.payment_status === 'paid' && <p className="success-box">Paiement test réussi ✅</p>}<button className="link-button" onClick={() => setBilling(null)}>Fermer</button></div>;

  return <main className="page-shell">
    <header className="topbar"><button className="brand brand-button" onClick={() => { setPortal('client'); resetFlow(); }}>FaisLaJob</button><div className="header-actions"><div className="portal-switch"><button className={portal === 'client' ? 'switch-active' : ''} onClick={() => setPortal('client')}>Client</button><button className={portal === 'provider' ? 'switch-active' : ''} onClick={() => setPortal('provider')}>Partenaire</button></div>{user?.role === 'client' && portal === 'client' && <button className="ghost-button" onClick={() => { setClientView('missions'); setBilling(null); }}>Mes missions</button>}{user ? <><span className="user-chip">{user.name}</span><button className="ghost-button" onClick={logout}>Déconnexion</button></> : <button className="ghost-button" onClick={() => openAuth('login')}>Connexion</button>}</div></header>

    {authOpen ? authCard : portal === 'provider' ? (
      user?.role !== 'provider' ? <section className="flow-card"><div className="eyebrow">Portail partenaire</div><h1 className="flow-title">Connecte-toi comme partenaire</h1><p className="flow-copy">Tes offres, missions et versements sont liés à ton compte.</p><button className="primary-button full-button" onClick={() => openAuth('login', 'provider')}>Connexion partenaire</button><button className="link-button" onClick={() => openAuth('register', 'provider')}>Créer mon compte partenaire</button></section> :
      <section className="flow-card"><div className="flow-topline"><div className="eyebrow">Portail partenaire</div><button className="ghost-button" onClick={loadPartner}>Actualiser</button></div><h1 className="flow-title">{provider?.name || user.name}</h1>{error && <p className="error-box">⚠️ {error}</p>}<div className="partner-status-card"><div><span>Disponibilité</span><strong>{provider?.is_online ? '🟢 En ligne' : '⚪ Hors ligne'}</strong></div><button className="primary-button" disabled={partnerLoading} onClick={toggleOnline}>{provider?.is_online ? 'Me mettre hors ligne' : 'Me mettre en ligne'}</button></div>
      {billingCard}
      {activeMission ? <div className="active-mission-card"><div className="eyebrow">Mission active #{activeMission.id}</div><h2>{activeMission.category_name || activeMission.category_id}</h2><p>{activeMission.description}</p><div className="mission-status">Statut : <strong>{activeMission.status}</strong></div>{activeMission.status === 'assigned' && <button className="primary-button full-button" onClick={() => missionAction('en-route')}>🚗 Je suis en route</button>}{activeMission.status === 'en_route' && <button className="primary-button full-button" onClick={() => missionAction('arrive')}>📍 Je suis arrivé</button>}{activeMission.status === 'arrived' && <button className="primary-button full-button" onClick={() => missionAction('start')}>▶️ Commencer la job</button>}{activeMission.status === 'in_progress' && <button className="primary-button full-button" onClick={() => missionAction('complete')}>✅ Terminer la job</button>}</div> : <div className="offers-section"><h2>Jobs disponibles</h2>{partnerLoading && <p className="flow-copy">Chargement…</p>}{!partnerLoading && offers.length === 0 && <p className="empty-state">Aucune offre pour le moment. Mets-toi en ligne pour recevoir les nouvelles jobs.</p>}{offers.map((offer) => <div className="offer-card" key={offer.offer_id}><div><div className="eyebrow">Mission #{offer.mission_id}</div><h3>{offer.category_name}</h3><p>{offer.description}</p></div><div className="offer-actions"><button className="primary-button" onClick={() => acceptOffer(offer.offer_id)}>Accepter</button><button className="ghost-button" onClick={() => declineOffer(offer.offer_id)}>Refuser</button></div></div>)}</div>}
      <div className="offers-section"><h2>Mes versements</h2>{payouts.length === 0 ? <p className="empty-state">Aucun versement pour le moment.</p> : payouts.map((p) => <div className="offer-card" key={p.id}><div><div className="eyebrow">Mission #{p.mission_id}</div><h3>{p.category_name}</h3><p>Statut : {p.status}{p.release_at ? ` • libération prévue ${new Date(p.release_at).toLocaleDateString('fr-CA')}` : ''}</p></div><strong>{money(p.amount_cents)}</strong></div>)}</div></section>
    ) : clientView === 'missions' && user?.role === 'client' ? <section className="flow-card"><div className="flow-topline"><div className="eyebrow">Mon compte client</div><button className="ghost-button" onClick={() => { setClientView('request'); setBilling(null); }}>Nouvelle demande</button></div><h1 className="flow-title">Mes missions</h1>{error && <p className="error-box">⚠️ {error}</p>}{billingCard}{clientMissions.length === 0 ? <p className="empty-state">Aucune mission pour le moment.</p> : clientMissions.map((m) => <div className="offer-card" key={m.id}><div><div className="eyebrow">Mission #{m.id}</div><h3>{m.category_name}</h3><p>Statut : {m.status}{m.duration_minutes ? ` • ${m.duration_minutes} min` : ''}</p>{m.client_total_cents ? <p>Total : <strong>{money(m.client_total_cents)}</strong> • paiement : {m.payment_status || 'pending'}</p> : null}</div><div className="offer-actions">{m.status === 'completed' && <button className="ghost-button" onClick={() => viewBilling(m.id)}>Facture</button>}{m.status === 'completed' && m.payment_status !== 'paid' && <button className="primary-button" onClick={() => payMock(m.id)}>Payer (test)</button>}</div></div>)}</section> : <>
      <section className="flow-card"><div className="flow-topline"><div className="eyebrow">Demande de service</div>{!missionId && <span className="step-pill">Étape {Math.min(step + 1, 7)} / 7</span>}</div>{!missionId && <div className="progress-track"><div className="progress-value" style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>}<h1 className="flow-title">{title}</h1>{user?.role === 'client' && step === 0 && <p className="account-note">Connecté comme <strong>{user.name}</strong> — ta demande sera liée automatiquement à ton compte.</p>}{missionId ? <><p className="success-box">Mission #{missionId} créée avec succès. Elle est maintenant envoyée aux partenaires disponibles.</p><button className="primary-button full-button" onClick={resetFlow}>Faire une autre demande</button>{user?.role === 'client' && <button className="link-button" onClick={() => setClientView('missions')}>Voir mes missions</button>}</> : <>
      {step === 0 && <><p className="flow-copy">Choisis une catégorie. Ensuite, on te pose seulement les questions utiles.</p><div className="category-grid">{categories.map((item) => <button className="category-card" key={item.id} onClick={() => { setCategory(item); setStep(1); }}><span className="category-icon">{item.icon}</span><span>{item.name}</span></button>)}</div></>}
      {step === 1 && category && <div className="option-list">{category.subcategories.map((item) => <button className="option-row" key={item} onClick={() => { setSubcategory(item); setStep(2); }}><span>{item}</span><span>→</span></button>)}</div>}
      {step === 2 && <><textarea className="text-area" rows={6} value={answers.details} placeholder="Décris la job en quelques mots..." onChange={(e) => setAnswers({ ...answers, details: e.target.value })} /><button className="primary-button full-button" onClick={nextFromDetails}>Continuer</button></>}
      {step === 3 && <div className="option-list">{timingOptions.map((item) => <button className="option-row" key={item} onClick={() => { setAnswers({ ...answers, timing: item }); setStep(4); }}><span>{item}</span><span>→</span></button>)}</div>}
      {step === 4 && <><input className="text-input" value={answers.address} placeholder="Adresse de la job" onChange={(e) => setAnswers({ ...answers, address: e.target.value })} /><button className="primary-button full-button" onClick={nextFromAddress}>Continuer</button></>}
      {step === 5 && <><p className="flow-copy">Tu peux continuer sans compte, ou te connecter pour conserver ton historique.</p><input className="text-input" value={client.name} placeholder="Nom complet" onChange={(e) => setClient({ ...client, name: e.target.value })} /><input className="text-input" value={client.email} placeholder="Courriel" onChange={(e) => setClient({ ...client, email: e.target.value })} /><input className="text-input" value={client.phone} placeholder="Téléphone" onChange={(e) => setClient({ ...client, phone: e.target.value })} /><button className="primary-button full-button" onClick={nextFromClient}>Voir le résumé</button><button className="link-button" onClick={() => openAuth('register', 'client')}>Créer un compte client</button></>}
      {step === 6 && category && <><div className="summary-card"><div><span>Client</span><strong>{user?.role === 'client' ? user.name : client.name}</strong></div><div><span>Service</span><strong>{category.name}</strong></div><div><span>Type</span><strong>{subcategory}</strong></div><div><span>Quand</span><strong>{answers.timing}</strong></div><div><span>Adresse</span><strong>{answers.address}</strong></div><div className="summary-details"><span>Détails</span><strong>{answers.details}</strong></div></div>{error && <p className="error-box">⚠️ {error}</p>}<button className="primary-button full-button" disabled={submitting} onClick={submitMission}>{submitting ? 'Envoi…' : 'Trouver un partenaire'}</button></>}
      {step > 0 && step < 6 && <button className="link-button" onClick={() => setStep(Math.max(0, step - 1))}>← Retour</button>}</>}</section><section className="partner-card compact-partner-card"><div><div className="eyebrow">Tu veux faire des jobs?</div><h2>Travaille quand tu veux.</h2></div><button className="secondary-button" onClick={() => { setPortal('provider'); if (!user) openAuth('register', 'provider'); }}>Devenir partenaire</button></section></>}
  </main>;
}
