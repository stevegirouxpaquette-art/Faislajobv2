// Stability guard for the mobile client flow.
// FaisLaJob does not require DOM MutationObserver hooks for core React rendering.
// Disable legacy DOM observers that were causing repeated self-triggered work on iOS.
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
}

export {};
