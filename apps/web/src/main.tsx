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
  requested: ['🔎', 'Recherche d’un partenaire', 'On cherche un partenaire disponible pour ta job.'],
  offered: ['📣', 'Recherche d’un partenaire', 'Ta demande est envoyée aux partenaires disponibles.'],
  assigned: ['🤝', 'Partenaire trouvé', 'Un partenaire a accepté ta mission.'],
  en_route: ['🚗', 'Ton partenaire est en route', 'Il se dirige maintenant vers l’adresse de la job.'],
  arrived: ['📍', 'Ton partenaire est arrivé', 'Il est maintenant sur place.'],
  in_progress: ['🛠️', 'La job est en cours', 'Le temps de travail est maintenant comptabilisé.'],
  completed: ['✅', 'La job est terminée', 'La facture est prête dans Mes missions.'],
};

function updateVisibleClientScreen(mission: ClientMission) {
  const status = statusText[mission.status] || ['ℹ️', 'Mise à jour de la mission', `Statut : ${mission.status}`];
  const titles = Array.from(document.querySelectorAll<HTMLElement>('.flow-title'));
  const title = titles.find((node) =>
    node.textContent?.includes('Ta demande est envoyée') ||
    node.dataset.liveMission === 'true'
  );

  if (title) {
    title.dataset.liveMission = 'true';
    title.textContent = `${status[0]} ${status[1]}`;
    const card = title.closest('.flow-card');
    const successBox = card?.querySelector<HTMLElement>('.success-box');
    if (successBox) {
      successBox.textContent = `Mission #${mission.id} • ${status[2]}`;
    }
  }
}

function ClientMissionTracker() {
  const [mission, setMission] = useState<ClientMission | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch('/api/client/missions', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) setMission(null);
          return;
        }

        const data = await response.json();
        const missions = (data.missions || []) as ClientMission[];
        const latest = missions.find((item) => item.status !== 'completed') || missions[0] || null;

        if (!cancelled) {
          setMission(latest);
          if (latest) updateVisibleClientScreen(latest);
        }
      } catch {
        if (!cancelled) setMission(null);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 1500);
    const observer = new MutationObserver(() => {
      if (mission) updateVisibleClientScreen(mission);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [mission?.id, mission?.status]);

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
