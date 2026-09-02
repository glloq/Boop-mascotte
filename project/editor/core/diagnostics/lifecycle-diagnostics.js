const enabled = typeof location !== 'undefined' && /^(1|true)$/.test(new URLSearchParams(location.search).get('debug') || new URLSearchParams(location.search).get('e2e') || '');

const fresh = () => ({
  preview: { activeRaf: 0, rafRequests: 0, rafCancellations: 0, starts: 0, stops: 0, frames: 0, computes: 0, applies: 0, playing: false, computeMs: 0, applyMs: 0, lastError: null },
  store: { mutations: 0, notifications: 0, documentMutations: 0, sessionMutations: 0, documentNotifications: 0, sessionNotifications: 0, wholeDocumentMutationClones: 0, historyDocumentClones: 0, legacySetState: 0 },
  autosave: { schedules: 0, writes: 0 }, validation: { runs: 0 },
  timeline: { renders: 0, renderMs: 0, renderRequests: 0, renderCoalesced: 0, reentrantRenderPrevented: 0, pendingRenders: 0 },
  rig: { renders: 0 },
  canvas: { reconciles: 0, interactionAttachments: 0, interactiveElements: 0, domWrites: 0 }
});
let counters = fresh();

// Calls are intentionally cheap no-ops outside explicit debug/e2e sessions.
export const lifecycleDiagnostics = {
  enabled,
  increment(path, amount = 1) { if (!enabled) return; const [group, key] = path.split('.'); counters[group][key] += amount; },
  set(path, value) { if (!enabled) return; const [group, key] = path.split('.'); counters[group][key] = value; },
  snapshot() { return structuredClone(counters); },
  reset() { counters = fresh(); }
};
