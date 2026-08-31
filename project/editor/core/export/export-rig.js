import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';

export function createExportRig(state) {
  return structuredClone({ schemaVersion: RIG_SCHEMA_VERSION, params: state.params, states: state.states,
    elements: state.elements, activeState: state.activeState, transitions: state.transitions,
    transitionSettings: state.transitionSettings, globalConstraints: state.globalConstraints,
    stateConstraints: state.stateConstraints, runtimeConfig: state.runtimeConfig, behaviors: state.behaviors });
}
