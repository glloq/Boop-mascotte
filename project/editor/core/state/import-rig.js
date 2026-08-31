export function applyImportedRig(state, imported) {
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Invalid rig');
  state.params = { ...state.params, ...(imported.params || {}) };
  state.states = { ...state.states, ...(imported.states || {}) };
  state.transitions = { ...state.transitions, ...(imported.transitions || {}) };
  if (imported.activeState && state.states[imported.activeState]) state.activeState = imported.activeState;
  Object.entries(imported.elements || {}).forEach(([id, value]) => {
    if (state.elements[id] && value && typeof value === 'object') {
      state.elements[id] = {
        ...state.elements[id], ...value,
        constraints: { ...state.elements[id].constraints, ...(value.constraints || {}) },
        bindings: { ...state.elements[id].bindings, ...(value.bindings || {}) },
        bindingCurves: { ...state.elements[id].bindingCurves, ...(value.bindingCurves || {}) },
        morph: { ...state.elements[id].morph, ...(value.morph || {}) }
      };
    }
  });
  if (imported.globalConstraints) state.globalConstraints = { ...state.globalConstraints, ...imported.globalConstraints };
  if (imported.stateConstraints) state.stateConstraints = { ...state.stateConstraints, ...imported.stateConstraints };
  if (imported.runtimeConfig) state.runtimeConfig = { ...state.runtimeConfig, ...imported.runtimeConfig };
}
