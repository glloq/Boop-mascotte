import { RIG_SCHEMA_VERSION, normalizeAnimations, normalizeExpressions, normalizeKeyforms, normalizeReactions, normalizeShapeKeys } from '../../../runtime/runtime.js';

export function createExportRig(state) {
  return structuredClone({ schemaVersion: RIG_SCHEMA_VERSION, params: state.params, states: state.states,
    elements: state.elements, activeState: state.activeState, transitions: state.transitions,
    transitionSettings: state.transitionSettings, globalConstraints: state.globalConstraints,
    stateConstraints: state.stateConstraints, runtimeConfig: state.runtimeConfig, behaviors: state.behaviors,
    // Additive block (docs/ADR_EXPRESSIONS.md); runtimes that predate it ignore unknown fields.
    expressions: normalizeExpressions(state),
    // Additive blocks (docs/ADR_REACTIONS.md): clips play through playAnimation and Reactions.
    animations: normalizeAnimations({ animations: state.animationClips }), reactions: normalizeReactions(state),
    // Additive block (docs/KEYFORM_ENGINE.md): pose grids evaluated by the shared keyform engine.
    keyforms: normalizeKeyforms(state), shapeKeys: normalizeShapeKeys(state) });
}
