export function applyImportedRig(state, imported) {
  state.params = { ...state.params, ...(imported.params || {}) };
  state.states = { ...state.states, ...(imported.states || {}) };
  state.transitions = { ...state.transitions, ...(imported.transitions || {}) };
  state.activeState = imported.activeState || state.activeState;
  Object.entries(imported.elements || {}).forEach(([id, value]) => {
    if (state.elements[id]) state.elements[id] = { ...state.elements[id], ...value };
  });
  if (imported.runtimeConfig) state.runtimeConfig = { ...state.runtimeConfig, ...imported.runtimeConfig };
}
