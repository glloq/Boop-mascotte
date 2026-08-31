import { normalizeRig } from '../rig/normalize-rig.js';

export function applyImportedRig(state, imported) {
  const rig = normalizeRig(imported);
  state.schemaVersion = rig.schemaVersion;
  state.params = rig.params;
  state.states = rig.states;
  state.transitions = { ...state.transitions, ...(rig.transitions || {}) };
  if (rig.activeState && state.states[rig.activeState]) state.activeState = rig.activeState;
  Object.entries(rig.elements || {}).forEach(([id, value]) => {
    if (state.elements[id] && value && typeof value === 'object') {
      state.elements[id] = {
        ...state.elements[id], ...value,
        constraints: { ...state.elements[id].constraints, ...(value.constraints || {}) },
        bindings: { ...state.elements[id].bindings, ...(value.bindings || {}) },
        morph: { ...state.elements[id].morph, ...(value.morph || {}) }
      };
    }
  });
  if (rig.globalConstraints) state.globalConstraints = rig.globalConstraints;
  if (Object.keys(rig.stateConstraints || {}).length) state.stateConstraints = rig.stateConstraints;
  else if (imported.stateConstraints) state.stateConstraints = { ...state.stateConstraints, ...imported.stateConstraints };
  if (rig.runtimeConfig) state.runtimeConfig = { ...state.runtimeConfig, ...rig.runtimeConfig };
}
