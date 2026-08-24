import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

type ClientMission = {
  id: string;
  status: string;
  category_name?: string;
};

const statusText: Record<string, [string, string, string]> = {
  requested: ['🔎', 'Recherche en cours', 'On cherche un partenaire disponible.'],
  offered: ['📣', 'Demande envoyée', 'Ta mission est proposée aux partenaires disponibles.'],
  assigned: ['🤝', 'Partenaire trouvé', 'Un partenaire a accepté ta mission.'],
  en_route: ['🚗', 'Partenaire en route', 'Ton partenaire se dirige vers toi.'],
  arrived: ['📍', 'Partenaire arrivé', 'Ton partenaire est arrivé sur place.'],
  in_progress: ['🛠️', 'Job en cours', 'Le travail est présentement en cours.'],
  completed: ['✅', 'Mission terminée', 'La facture est disponible dans Mes missions.'],
};

function ClientMissionTracker() {
  const [mission, setMission] = useState<ClientMission | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/client/missions', { credentials: 'same-origin' });
        if (!response.ok) {
          if (!cancelled) setMission(null);
          return;
        }
        const data = await response.json();
        const missions = (data.missions || []) as ClientMission[];
        const latest = missions.find((item) => item.status !== 'completed') || missions[0] || null;
        if (!cancelled) setMission(latest);
      } catch {
        if (!cancelled) setMission(null);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!mission) return null;
  const [icon, title, detail] = statusText[mission.status] || ['ℹ️', mission.status, 'Le statut de ta mission vient d’être mis à jour.'];

  return (
    <aside className="client-live-tracker">
      <div>
        <div className="client-live-eyebrow">Mission #{mission.id}{mission.category_name ? ` • ${mission.category_name}` : ''}</div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="client-live-icon">{icon}</div>
    </aside>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ClientMissionTracker />
  </React.StrictMode>,
);
