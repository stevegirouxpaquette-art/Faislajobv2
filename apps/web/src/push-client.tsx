import { useEffect, useState } from 'react';
import './push-client.css';

type PushStatus = {
  configured?: boolean;
};

type TestResponse = {
  error?: string;
  sent?: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Ce navigateur ne supporte pas les notifications push.');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) {
    throw new Error('Les notifications push ne sont pas disponibles dans ce mode.');
  }
  return registration;
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T));
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error('Impossible d’enregistrer cet appareil.');
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PushPanel() {
  const [message, setMessage] = useState('Vérification…');
  const [tone, setTone] = useState<'default' | 'ok' | 'warn'>('default');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const showIosHint = isIos() && !isStandalone();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch('/api/push/status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const status = await readJson<PushStatus>(response);
        if (!response.ok) throw new Error('Impossible de vérifier les notifications.');
        if (!status.configured) {
          if (!cancelled) {
            setTone('warn');
            setMessage('Configuration serveur requise avant l’activation.');
          }
          return;
        }

        if (showIosHint) {
          if (!cancelled) {
            setTone('warn');
            setMessage('Ouvre FaisLaJob depuis son icône sur l’écran d’accueil pour activer les notifications.');
          }
          return;
        }

        const registration = await getRegistration();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Réassocie toujours cet appareil au compte actuellement connecté.
          await saveSubscription(subscription);
          if (!cancelled) {
            setActive(true);
            setTone('ok');
            setMessage('✓ Notifications activées sur cet appareil');
          }
        } else if (!cancelled) {
          setMessage('Notifications disponibles');
        }
      } catch (error) {
        if (!cancelled) {
          setTone('warn');
          setMessage(error instanceof Error ? error.message : 'Notifications non disponibles sur ce navigateur.');
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [showIosHint]);

  const enable = async () => {
    setBusy(true);
    setTone('default');
    setMessage('Activation…');
    try {
      if (showIosHint) {
        throw new Error('Ouvre FaisLaJob depuis son icône sur l’écran d’accueil, puis réessaie.');
      }
      if (!('Notification' in window)) {
        throw new Error('Notifications non supportées sur cet appareil.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Autorise les notifications dans les réglages de l’appareil.');
      }

      const configResponse = await fetch('/api/push/public-key', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const config = await readJson<{ publicKey?: string; error?: string }>(configResponse);
      if (!configResponse.ok) {
        throw new Error(config.error || 'Les notifications ne sont pas encore configurées sur le serveur.');
      }
      if (!config.publicKey) throw new Error('Clé push manquante sur le serveur.');

      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }
      await saveSubscription(subscription);
      setActive(true);
      setTone('ok');
      setMessage('✓ Notifications activées sur cet appareil');
    } catch (error) {
      setTone('warn');
      setMessage(error instanceof Error ? error.message : 'Activation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setTone('default');
    setMessage('Envoi du test…');
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const result = await readJson<TestResponse>(response);
      if (!response.ok) throw new Error(result.error || 'Test impossible.');
      if (!result.sent) {
        throw new Error('Aucune notification n’a été livrée. Réactive les notifications puis réessaie.');
      }
      setTone('ok');
      setMessage('✓ Notification test envoyée');
    } catch (error) {
      setTone('warn');
      setMessage(error instanceof Error ? error.message : 'Test impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="push-panel" data-push-panel="1" aria-label="Notifications">
      <div className="push-panel-head">
        <div className="push-panel-icon" aria-hidden="true">🔔</div>
        <div className="push-panel-copy">
          <strong>Notifications</strong>
          <small>Reçois les mises à jour importantes de tes missions même quand tu n’es pas dans FaisLaJob.</small>
        </div>
      </div>
      <div className="push-panel-actions">
        <button className="push-enable" type="button" disabled={busy || active} onClick={enable}>
          {active ? 'Notifications activées' : 'Activer les notifications'}
        </button>
        {active && (
          <button className="push-test" type="button" disabled={busy} onClick={sendTest}>
            Tester
          </button>
        )}
      </div>
      <div className={`push-status${tone === 'default' ? '' : ` ${tone}`}`} aria-live="polite">
        {message}
      </div>
      {showIosHint && (
        <div className="push-ios-hint">
          Sur iPhone, ajoute d’abord FaisLaJob à l’écran d’accueil avec Partager → Ajouter à l’écran d’accueil,
          puis ouvre l’app depuis cette icône pour activer les notifications.
        </div>
      )}
    </section>
  );
}
