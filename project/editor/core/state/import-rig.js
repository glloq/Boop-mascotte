import { normalizeRig } from '../rig/normalize-rig.js';

export function applyImportedRig(state, imported) {
  const rig = normalizeRig(imported);
  state.schemaVersion = rig.schemaVersion;
  state.params = rig.params;
  state.states = rig.states;
  state.transitions = structuredClone(rig.transitions || {});
  state.transitionSettings = structuredClone(rig.transitionSettings || {});
  state.behaviors = structuredClone(rig.behaviors || []);
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
  state.globalConstraints = structuredClone(rig.globalConstraints);
  state.stateConstraints = structuredClone(imported.stateConstraints || rig.stateConstraints || {});
  state.runtimeConfig = structuredClone(rig.runtimeConfig || {});
}
