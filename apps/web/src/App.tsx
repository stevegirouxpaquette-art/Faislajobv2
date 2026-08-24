import { useMemo, useState } from 'react';

type Category = {
  id: string;
  icon: string;
  name: string;
  subcategories: string[];
};

type Answers = {
  details: string;
  timing: string;
  address: string;
};

type ClientInfo = {
  name: string;
  email: string;
  phone: string;
};

const categories: Category[] = [
  { id: 'menage', icon: '🧹', name: 'Ménage', subcategories: ['Ménage régulier', 'Grand ménage', 'Après déménagement'] },
  { id: 'reparations', icon: '🔧', name: 'Petites réparations', subcategories: ['Assemblage', 'Installation', 'Réparation légère'] },
  { id: 'exterieur', icon: '🌿', name: 'Terrain & extérieur', subcategories: ['Tonte de gazon', 'Ramassage de feuilles', 'Entretien extérieur'] },
  { id: 'demenagement', icon: '📦', name: 'Déménagement', subcategories: ['Aide à transporter', 'Chargement / déchargement', 'Petits meubles'] },
  { id: 'deneigement', icon: '❄️', name: 'Déneigement', subcategories: ['Entrée', 'Escaliers', 'Auto à déneiger'] },
  { id: 'animaux', icon: '🐕', name: 'Animaux', subcategories: ['Promenade', 'Visite à domicile', 'Aide ponctuelle'] },
];

const timingOptions = ['Le plus tôt possible', 'Aujourd’hui', 'Cette semaine', 'Je choisis une date'];
const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

export default function App() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [answers, setAnswers] = useState<Answers>({ details: '', timing: '', address: '' });
  const [client, setClient] = useState<ClientInfo>({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [missionId, setMissionId] = useState<string | null>(null);

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
    setStep(0);
    setCategory(null);
    setSubcategory('');
    setAnswers({ details: '', timing: '', address: '' });
    setClient({ name: '', email: '', phone: '' });
    setMissionId(null);
    setError('');
  };

  const chooseCategory = (selected: Category) => {
    setCategory(selected);
    setSubcategory('');
    setStep(1);
  };

  const chooseSubcategory = (selected: string) => {
    setSubcategory(selected);
    setStep(2);
  };

  const nextFromDetails = () => {
    if (answers.details.trim().length < 5) return;
    setStep(3);
  };

  const chooseTiming = (timing: string) => {
    setAnswers((current) => ({ ...current, timing }));
    setStep(4);
  };

  const nextFromAddress = () => {
    if (answers.address.trim().length < 5) return;
    setStep(5);
  };

  const nextFromClient = () => {
    if (client.name.trim().length < 2) return;
    if (!client.email.trim() && !client.phone.trim()) return;
    setStep(6);
  };

  const submitMission = async () => {
    if (!category) return;
    setSubmitting(true);
    setError('');

    try {
      const clientResponse = await fetch(`${apiBase}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client),
      });

      if (!clientResponse.ok) throw new Error('Impossible de créer le client.');
      const clientData = await clientResponse.json();

      const description = [
        subcategory,
        answers.details,
        `Moment: ${answers.timing}`,
        `Adresse: ${answers.address}`,
      ].join('\n');

      const missionResponse = await fetch(`${apiBase}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientData.client.id),
          categoryId: category.id,
          description,
        }),
      });

      if (!missionResponse.ok) throw new Error('Impossible de créer la mission.');
      const missionData = await missionResponse.json();
      setMissionId(String(missionData.mission.id));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={resetFlow}>FaisLaJob</button>
        <button className="ghost-button">Connexion</button>
      </header>

      <section className="flow-card">
        <div className="flow-topline">
          <div className="eyebrow">Demande de service</div>
          {!missionId && <span className="step-pill">Étape {Math.min(step + 1, 7)} / 7</span>}
        </div>
        {!missionId && <div className="progress-track"><div className="progress-value" style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>}

        <h1 className="flow-title">{title}</h1>

        {missionId ? (
          <>
            <p className="flow-copy">Mission #{missionId} créée avec succès. Un partenaire pourra maintenant être recherché pour ta demande.</p>
            <button className="primary-button full-button" onClick={resetFlow}>Faire une autre demande</button>
          </>
        ) : (
          <>
            {step === 0 && (
              <>
                <p className="flow-copy">Choisis une catégorie. Ensuite, on te pose seulement les questions utiles pour cette job.</p>
                <div className="category-grid">
                  {categories.map((item) => (
                    <button className="category-card" key={item.id} onClick={() => chooseCategory(item)}>
                      <span className="category-icon">{item.icon}</span>
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && category && (
              <div className="option-list">
                {category.subcategories.map((item) => (
                  <button className="option-row" key={item} onClick={() => chooseSubcategory(item)}>
                    <span>{item}</span><span>→</span>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <>
                <p className="flow-copy">Explique comme si tu nous appelais. Exemple : « J’ai une commode IKEA à assembler et je suis au 2e étage. »</p>
                <textarea className="text-area" rows={6} value={answers.details} placeholder="Décris la job en quelques mots..." onChange={(event) => setAnswers((current) => ({ ...current, details: event.target.value }))} />
                <button className="primary-button full-button" onClick={nextFromDetails}>Continuer</button>
              </>
            )}

            {step === 3 && (
              <div className="option-list">
                {timingOptions.map((item) => (
                  <button className="option-row" key={item} onClick={() => chooseTiming(item)}><span>{item}</span><span>→</span></button>
                ))}
              </div>
            )}

            {step === 4 && (
              <>
                <p className="flow-copy">Entre l’adresse où le partenaire devra se rendre.</p>
                <input className="text-input" value={answers.address} placeholder="Ex. 123 rue des Forges, Trois-Rivières" onChange={(event) => setAnswers((current) => ({ ...current, address: event.target.value }))} />
                <button className="primary-button full-button" onClick={nextFromAddress}>Continuer</button>
              </>
            )}

            {step === 5 && (
              <>
                <p className="flow-copy">Ces informations servent à enregistrer ta demande et à te contacter.</p>
                <input className="text-input" value={client.name} placeholder="Nom complet" onChange={(event) => setClient((current) => ({ ...current, name: event.target.value }))} />
                <input className="text-input" value={client.email} placeholder="Courriel" onChange={(event) => setClient((current) => ({ ...current, email: event.target.value }))} />
                <input className="text-input" value={client.phone} placeholder="Téléphone" onChange={(event) => setClient((current) => ({ ...current, phone: event.target.value }))} />
                <button className="primary-button full-button" onClick={nextFromClient}>Voir le résumé</button>
              </>
            )}

            {step === 6 && category && (
              <>
                <div className="summary-card">
                  <div><span>Client</span><strong>{client.name}</strong></div>
                  <div><span>Service</span><strong>{category.name}</strong></div>
                  <div><span>Type</span><strong>{subcategory}</strong></div>
                  <div><span>Quand</span><strong>{answers.timing}</strong></div>
                  <div><span>Adresse</span><strong>{answers.address}</strong></div>
                  <div className="summary-details"><span>Détails</span><strong>{answers.details}</strong></div>
                </div>
                {error && <p className="flow-copy">⚠️ {error}</p>}
                <button className="primary-button full-button" disabled={submitting} onClick={submitMission}>{submitting ? 'Envoi en cours...' : 'Trouver un partenaire'}</button>
                <button className="link-button" onClick={() => setStep(0)}>Modifier ma demande</button>
              </>
            )}

            {step > 0 && step < 6 && (
              <button className="link-button" onClick={() => setStep((current) => Math.max(0, current - 1))}>← Retour</button>
            )}
          </>
        )}
      </section>

      <section className="partner-card compact-partner-card">
        <div>
          <div className="eyebrow">Tu veux faire des jobs?</div>
          <h2>Travaille quand tu veux.</h2>
        </div>
        <button className="secondary-button">Devenir partenaire</button>
      </section>
    </main>
  );
}
