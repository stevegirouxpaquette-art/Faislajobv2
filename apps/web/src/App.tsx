import { useEffect, useMemo, useState } from 'react';

type Category = { id: string; icon: string; name: string; subcategories: string[] };
type Answers = { details: string; timing: string; address: string };
type ClientInfo = { name: string; email: string; phone: string };
type Offer = { offer_id: string; mission_id: string; category_name: string; description: string; mission_status: string };
type Mission = { id: string; provider_id: string | null; category_name?: string; category_id: string; status: string; description: string; duration_minutes?: number | null };
type Provider = { id: string; name: string; is_online: boolean; status: string };

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
const testProviderId = 1;

export default function App() {
  const [portal, setPortal] = useState<'client' | 'provider'>('client');
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
    setStep(0); setCategory(null); setSubcategory('');
    setAnswers({ details: '', timing: '', address: '' });
    setClient({ name: '', email: '', phone: '' });
    setMissionId(null); setError('');
  };

  const loadPartner = async () => {
    setPartnerLoading(true); setError('');
    try {
      const [providerResponse, offersResponse] = await Promise.all([
        fetch(`${apiBase}/api/providers/${testProviderId}`),
        fetch(`${apiBase}/api/providers/${testProviderId}/offers`),
      ]);
      if (!providerResponse.ok || !offersResponse.ok) throw new Error('Impossible de charger le portail partenaire.');
      setProvider((await providerResponse.json()).provider);
      setOffers((await offersResponse.json()).offers);

      const storedMissionId = localStorage.getItem('faislajob_active_mission');
      if (storedMissionId) {
        const missionResponse = await fetch(`${apiBase}/api/missions/${storedMissionId}`);
        if (missionResponse.ok) {
          const mission = (await missionResponse.json()).mission as Mission;
          setActiveMission(mission.status === 'completed' ? null : mission);
          if (mission.status === 'completed') localStorage.removeItem('faislajob_active_mission');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur partenaire.');
    } finally { setPartnerLoading(false); }
  };

  useEffect(() => { if (portal === 'provider') loadPartner(); }, [portal]);

  const toggleOnline = async () => {
    if (!provider) return;
    setPartnerLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/providers/${testProviderId}/availability`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: !provider.is_online, categoryIds: categories.map((c) => c.id) }),
      });
      if (!response.ok) throw new Error('Impossible de changer la disponibilité.');
      await loadPartner();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); setPartnerLoading(false); }
  };

  const acceptOffer = async (offerId: string) => {
    setPartnerLoading(true); setError('');
    try {
      const response = await fetch(`${apiBase}/api/offers/${offerId}/accept`, { method: 'POST' });
      if (!response.ok) throw new Error('Cette mission n’est plus disponible.');
      const mission = (await response.json()).mission as Mission;
      setActiveMission(mission); localStorage.setItem('faislajob_active_mission', mission.id);
      await loadPartner();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); setPartnerLoading(false); }
  };

  const declineOffer = async (offerId: string) => {
    await fetch(`${apiBase}/api/offers/${offerId}/decline`, { method: 'POST' });
    await loadPartner();
  };

  const missionAction = async (action: 'en-route' | 'arrive' | 'start' | 'complete') => {
    if (!activeMission) return;
    setPartnerLoading(true); setError('');
    try {
      const response = await fetch(`${apiBase}/api/missions/${activeMission.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: testProviderId }),
      });
      if (!response.ok) throw new Error('Cette action n’est pas permise pour le statut actuel.');
      const mission = (await response.json()).mission as Mission;
      setActiveMission(mission);
      if (mission.status === 'completed') localStorage.removeItem('faislajob_active_mission');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); }
    finally { setPartnerLoading(false); }
  };

  const submitMission = async () => {
    if (!category) return;
    setSubmitting(true); setError('');
    try {
      const clientResponse = await fetch(`${apiBase}/api/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(client) });
      if (!clientResponse.ok) throw new Error('Création du client impossible.');
      const clientData = await clientResponse.json();
      const description = [subcategory, answers.details, `Moment: ${answers.timing}`, `Adresse: ${answers.address}`].join('\n');
      const missionResponse = await fetch(`${apiBase}/api/missions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: Number(clientData.client.id), categoryId: category.id, description }) });
      if (!missionResponse.ok) throw new Error('Création de la mission impossible.');
      setMissionId(String((await missionResponse.json()).mission.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    finally { setSubmitting(false); }
  };

  const nextFromDetails = () => answers.details.trim().length >= 5 && setStep(3);
  const nextFromAddress = () => answers.address.trim().length >= 5 && setStep(5);
  const nextFromClient = () => client.name.trim().length >= 2 && (client.email.trim() || client.phone.trim()) && setStep(6);

  return (
    <main className="page-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={() => { setPortal('client'); resetFlow(); }}>FaisLaJob</button>
        <div className="portal-switch">
          <button className={portal === 'client' ? 'switch-active' : ''} onClick={() => setPortal('client')}>Client</button>
          <button className={portal === 'provider' ? 'switch-active' : ''} onClick={() => setPortal('provider')}>Partenaire</button>
        </div>
      </header>

      {portal === 'provider' ? (
        <section className="flow-card">
          <div className="flow-topline"><div className="eyebrow">Portail partenaire — test #1</div><button className="ghost-button" onClick={loadPartner}>Actualiser</button></div>
          <h1 className="flow-title">{provider?.name || 'Partenaire'}</h1>
          {error && <p className="error-box">⚠️ {error}</p>}
          <div className="partner-status-card">
            <div><span>Disponibilité</span><strong>{provider?.is_online ? '🟢 En ligne' : '⚪ Hors ligne'}</strong></div>
            <button className="primary-button" disabled={partnerLoading} onClick={toggleOnline}>{provider?.is_online ? 'Me mettre hors ligne' : 'Me mettre en ligne'}</button>
          </div>

          {activeMission ? (
            <div className="active-mission-card">
              <div className="eyebrow">Mission active #{activeMission.id}</div>
              <h2>{activeMission.category_name || activeMission.category_id}</h2>
              <p>{activeMission.description}</p>
              <div className="mission-status">Statut : <strong>{activeMission.status}</strong></div>
              {activeMission.status === 'assigned' && <button className="primary-button full-button" onClick={() => missionAction('en-route')}>🚗 Je suis en route</button>}
              {activeMission.status === 'en_route' && <button className="primary-button full-button" onClick={() => missionAction('arrive')}>📍 Je suis arrivé</button>}
              {activeMission.status === 'arrived' && <button className="primary-button full-button" onClick={() => missionAction('start')}>▶️ Commencer la job</button>}
              {activeMission.status === 'in_progress' && <button className="primary-button full-button" onClick={() => missionAction('complete')}>✅ Terminer la job</button>}
              {activeMission.status === 'completed' && <p className="success-box">Mission terminée — {activeMission.duration_minutes ?? 0} min</p>}
            </div>
          ) : (
            <div className="offers-section">
              <h2>Jobs disponibles</h2>
              {partnerLoading && <p className="flow-copy">Chargement…</p>}
              {!partnerLoading && offers.length === 0 && <p className="empty-state">Aucune offre pour le moment. Mets-toi en ligne pour recevoir les nouvelles jobs.</p>}
              {offers.map((offer) => (
                <div className="offer-card" key={offer.offer_id}>
                  <div><div className="eyebrow">Mission #{offer.mission_id}</div><h3>{offer.category_name}</h3><p>{offer.description}</p></div>
                  <div className="offer-actions"><button className="primary-button" onClick={() => acceptOffer(offer.offer_id)}>Accepter</button><button className="ghost-button" onClick={() => declineOffer(offer.offer_id)}>Refuser</button></div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="flow-card">
            <div className="flow-topline"><div className="eyebrow">Demande de service</div>{!missionId && <span className="step-pill">Étape {Math.min(step + 1, 7)} / 7</span>}</div>
            {!missionId && <div className="progress-track"><div className="progress-value" style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>}
            <h1 className="flow-title">{title}</h1>
            {missionId ? <><p className="success-box">Mission #{missionId} créée avec succès. Elle est maintenant envoyée aux partenaires disponibles.</p><button className="primary-button full-button" onClick={resetFlow}>Faire une autre demande</button></> : <>
              {step === 0 && <><p className="flow-copy">Choisis une catégorie. Ensuite, on te pose seulement les questions utiles.</p><div className="category-grid">{categories.map((item) => <button className="category-card" key={item.id} onClick={() => { setCategory(item); setStep(1); }}><span className="category-icon">{item.icon}</span><span>{item.name}</span></button>)}</div></>}
              {step === 1 && category && <div className="option-list">{category.subcategories.map((item) => <button className="option-row" key={item} onClick={() => { setSubcategory(item); setStep(2); }}><span>{item}</span><span>→</span></button>)}</div>}
              {step === 2 && <><textarea className="text-area" rows={6} value={answers.details} placeholder="Décris la job en quelques mots..." onChange={(e) => setAnswers({ ...answers, details: e.target.value })} /><button className="primary-button full-button" onClick={nextFromDetails}>Continuer</button></>}
              {step === 3 && <div className="option-list">{timingOptions.map((item) => <button className="option-row" key={item} onClick={() => { setAnswers({ ...answers, timing: item }); setStep(4); }}><span>{item}</span><span>→</span></button>)}</div>}
              {step === 4 && <><input className="text-input" value={answers.address} placeholder="Adresse de la job" onChange={(e) => setAnswers({ ...answers, address: e.target.value })} /><button className="primary-button full-button" onClick={nextFromAddress}>Continuer</button></>}
              {step === 5 && <><input className="text-input" value={client.name} placeholder="Nom complet" onChange={(e) => setClient({ ...client, name: e.target.value })} /><input className="text-input" value={client.email} placeholder="Courriel" onChange={(e) => setClient({ ...client, email: e.target.value })} /><input className="text-input" value={client.phone} placeholder="Téléphone" onChange={(e) => setClient({ ...client, phone: e.target.value })} /><button className="primary-button full-button" onClick={nextFromClient}>Voir le résumé</button></>}
              {step === 6 && category && <><div className="summary-card"><div><span>Client</span><strong>{client.name}</strong></div><div><span>Service</span><strong>{category.name}</strong></div><div><span>Type</span><strong>{subcategory}</strong></div><div><span>Quand</span><strong>{answers.timing}</strong></div><div><span>Adresse</span><strong>{answers.address}</strong></div><div className="summary-details"><span>Détails</span><strong>{answers.details}</strong></div></div>{error && <p className="error-box">⚠️ {error}</p>}<button className="primary-button full-button" disabled={submitting} onClick={submitMission}>{submitting ? 'Envoi…' : 'Trouver un partenaire'}</button></>}
              {step > 0 && step < 6 && <button className="link-button" onClick={() => setStep(Math.max(0, step - 1))}>← Retour</button>}
            </>}
          </section>
          <section className="partner-card compact-partner-card"><div><div className="eyebrow">Tu veux faire des jobs?</div><h2>Travaille quand tu veux.</h2></div><button className="secondary-button" onClick={() => setPortal('provider')}>Ouvrir le portail partenaire</button></section>
        </>
      )}
    </main>
  );
}
