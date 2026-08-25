export {};

// Sur la page de création, quitter immédiatement l'écran de formulaire
// dès que l'API confirme la création d'une mission. Aucun polling ni
// MutationObserver: on évite de laisser iOS travailler sur l'ancien écran.
if (window.location.pathname.startsWith('/request')) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'POST' && /\/api\/missions(?:\?|$)/.test(url) && response.ok) {
        window.setTimeout(() => window.location.replace('/'), 0);
      }
    } catch {}
    return response;
  }) as typeof window.fetch;
}
