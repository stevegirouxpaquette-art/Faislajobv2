const categories = [
  { icon: '🧹', name: 'Ménage' },
  { icon: '🔧', name: 'Petites réparations' },
  { icon: '🌿', name: 'Terrain & extérieur' },
  { icon: '📦', name: 'Déménagement' },
  { icon: '❄️', name: 'Déneigement' },
  { icon: '🐕', name: 'Animaux' },
];

export default function App() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand">FaisLaJob</div>
        <button className="ghost-button">Connexion</button>
      </header>

      <section className="hero">
        <div className="eyebrow">Services locaux, simplement</div>
        <h1>Qu’est-ce qu’on peut faire pour toi?</h1>
        <p>
          Choisis le service dont tu as besoin. On te pose seulement les bonnes
          questions, puis on trouve un partenaire disponible près de chez toi.
        </p>
        <button className="primary-button">J’ai besoin d’un service</button>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Services populaires</h2>
          <span>Québec</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button className="category-card" key={category.name}>
              <span className="category-icon">{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="partner-card">
        <div>
          <div className="eyebrow">Tu veux faire des jobs?</div>
          <h2>Travaille quand tu veux.</h2>
          <p>Vois les demandes près de toi et accepte celles qui t’intéressent.</p>
        </div>
        <button className="secondary-button">Devenir partenaire</button>
      </section>
    </main>
  );
}
