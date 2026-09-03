import { normalizeRig } from '../rig/normalize-rig.js';

export function applyImportedRig(state, imported) {
  const rig = normalizeRig(imported);
  state.schemaVersion = rig.schemaVersion;
  if (imported.params) state.params = rig.params;
  if (imported.states) state.states = rig.states;
  if (imported.transitions) state.transitions = structuredClone(rig.transitions || {});
  state.transitionSettings = structuredClone(rig.transitionSettings || {});
  if (imported.behaviors || imported.runtimeConfig) state.behaviors = structuredClone(rig.behaviors || []);
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
  if (imported.keyforms) state.keyforms = structuredClone(rig.keyforms || []);
  if (imported.shapeKeys) state.shapeKeys = structuredClone(rig.shapeKeys || []);
  if (imported.hands) state.hands = rig.hands ? structuredClone(rig.hands) : null;
  state.globalConstraints = structuredClone(rig.globalConstraints);
  state.stateConstraints = structuredClone(imported.stateConstraints || rig.stateConstraints || {});
  state.runtimeConfig = structuredClone(rig.runtimeConfig || {});
}
