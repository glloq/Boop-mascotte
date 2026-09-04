import { normalizeRigHandles } from '../puppet/handle-record.js';
import { RIG_SCHEMA_VERSION, normalizeDeformers, normalizeExpressionBlend, normalizeHands, normalizeParallax, normalizeWarps, normalizeKeyforms, normalizeShapeKeys, normalizeMotionBlend } from '../../../runtime/runtime.js';

export const PROJECT_DOMAINS = Object.freeze({
  artwork: ['svgMarkup', 'elements'],
  layers: ['layers', 'layerMetadata'],
  rig: ['params', 'globalConstraints', 'stateConstraints', 'runtimeConfig'],
  stateMachine: ['states', 'transitions', 'transitionSettings', 'activeState', 'behaviors'],
  semanticRig: ['semanticParts'],
  // On-canvas controls an author owns (docs/DIRECT_CONTROLS.md): sparse
  // overrides on the generated set, so improving the defaults still reaches
  // every project that already exists.
  rigHandles: ['rigHandles'],
  animation: ['animationClips', 'motionBlend'],
  keyforms: ['keyforms', 'shapeKeys', 'warps'],
  hands: ['hands'],
  hierarchy: ['deformers', 'parallax'],
  expressions: ['expressions', 'expressionBlend'],
  reactions: ['reactions']
});

export const PROJECT_DOCUMENT_FIELDS = Object.freeze(['schemaVersion', ...new Set(Object.values(PROJECT_DOMAINS).flat())]);

const constraintScale = { translate: 1, rotate: 1, scale: 1 };

export function createProjectDocument(candidate = {}) {
  const states = candidate.states && typeof candidate.states === 'object' ? candidate.states : {};
  const activeState = states[candidate.activeState] ? candidate.activeState : Object.keys(states)[0] || null;
  const globalConstraints = { ...constraintScale, ...(candidate.globalConstraints || {}) };
  return {
    schemaVersion: RIG_SCHEMA_VERSION,
    svgMarkup: typeof candidate.svgMarkup === 'string' ? candidate.svgMarkup : '',
    elements: candidate.elements && typeof candidate.elements === 'object' ? candidate.elements : {},
    layers: Array.isArray(candidate.layers) ? candidate.layers : [],
    layerMetadata: candidate.layerMetadata && typeof candidate.layerMetadata === 'object' ? candidate.layerMetadata : {},
    params: candidate.params && typeof candidate.params === 'object' ? candidate.params : {},
    states, transitions: candidate.transitions && typeof candidate.transitions === 'object' ? candidate.transitions : {},
    transitionSettings: candidate.transitionSettings && typeof candidate.transitionSettings === 'object' ? candidate.transitionSettings : {},
    activeState, globalConstraints,
    stateConstraints: candidate.stateConstraints && typeof candidate.stateConstraints === 'object' ? candidate.stateConstraints : {},
    runtimeConfig: { blink: false, idleMotion: 0, ...(candidate.runtimeConfig || {}) },
    behaviors: Array.isArray(candidate.behaviors) ? candidate.behaviors : [],
    semanticParts: candidate.semanticParts && typeof candidate.semanticParts === 'object' ? candidate.semanticParts : {},
    animationClips: Array.isArray(candidate.animationClips) ? candidate.animationClips : [],
    expressions: Array.isArray(candidate.expressions) ? candidate.expressions : [],
    reactions: Array.isArray(candidate.reactions) ? candidate.reactions : [],
    // v4 pose grids (docs/KEYFORM_ENGINE.md); [] for every older project.
    keyforms: normalizeKeyforms(candidate),
    shapeKeys: normalizeShapeKeys(candidate),
    // Optional small warp grids (docs/WARP_GRID.md).
    warps: normalizeWarps(candidate),
    // Two floating hands (docs/HAND_RIGGING.md); null when the mascot has none.
    hands: normalizeHands(candidate),
    // Light transform hierarchy (docs/DEFORMER_MODEL.md).
    deformers: normalizeDeformers(candidate),
    // What an author changed about the handles on the mascot.
    rigHandles: normalizeRigHandles(candidate),
    // Pseudo depth (docs/DEPTH_PARALLAX.md).
    parallax: normalizeParallax(candidate.parallax),
    // How long an expression change takes (docs/CONTINUOUS_TRANSITIONS.md).
    expressionBlend: normalizeExpressionBlend(candidate.expressionBlend),
    // How long one motion takes to become another (docs/ADR_MOTION_LAYERING.md).
    motionBlend: normalizeMotionBlend(candidate.motionBlend)
  };
}

export const normalizeProjectDocument = createProjectDocument;
