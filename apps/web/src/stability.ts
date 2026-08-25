// Stability guard for the mobile client flow.
// The request screen must stay simple: the main React form already shows
// the newly-created mission, so the extra live tracker is redundant there.
class NoopMutationObserver {
  constructor(_callback: MutationCallback) {}
  observe(_target: Node, _options?: MutationObserverInit) {}
  disconnect() {}
  takeRecords(): MutationRecord[] { return []; }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: NoopMutationObserver,
  });

  if (window.location.pathname.startsWith('/request')) {
    // Hide the duplicate card at the bottom of the request screen.
    const style = document.createElement('style');
    style.textContent = '.client-live-tracker{display:none!important}';
    document.head.appendChild(style);

    // Prevent the duplicate tracker from polling /api/missions/:id while
    // the client is still on the request screen. The portal will resume
    // normal mission tracking after navigation.
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'GET' && /\/api\/missions\/[^/?]+(?:\?|$)/.test(url) && !/\/billing(?:\?|$)/.test(url)) {
        return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
  }
}

export {};
