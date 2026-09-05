import { normalizeRigHandles } from '../puppet/handle-record.js';
import { normalizeRigLinks } from '../puppet/control-links.js';
import { normalizeArrangement } from '../animation/arrangement.js';
import { RIG_SCHEMA_VERSION, normalizeDeformers, normalizeExpressionBlend, normalizeHands, normalizeParallax, normalizeFollowers, normalizeWarps, normalizeKeyforms, normalizeShapeKeys, normalizeMotionBlend, normalizeGazeSolver, normalizeRigPins } from '../../../runtime/runtime.js';

export const PROJECT_DOMAINS = Object.freeze({
  artwork: ['svgMarkup', 'elements'],
  layers: ['layers', 'layerMetadata'],
  // `gazeSolver` sits here because turning it on writes parameters: one
  // domain, one notification (docs/FACE_CONTROL_RIG.md).
  rig: ['params', 'globalConstraints', 'stateConstraints', 'runtimeConfig', 'gazeSolver'],
  stateMachine: ['states', 'transitions', 'transitionSettings', 'activeState', 'behaviors'],
  semanticRig: ['semanticParts'],
  // On-canvas controls an author owns (docs/DIRECT_CONTROLS.md): sparse
  // overrides on the generated set, so improving the defaults still reaches
  // every project that already exists.
  rigHandles: ['rigHandles', 'rigLinks'],
  animation: ['animationClips', 'motionBlend'],
  // Several clips placed in time (docs/VNEXT_ROADMAP.md, VNX-29). Editor-side
  // authoring state: it adds no runtime concept and never reaches `rig.json`.
  arrangement: ['arrangement'],
  // Everything that deforms artwork rather than moving it whole: pose grids,
  // shape keys, warp grids and the pins the control rig holds it by.
  keyforms: ['keyforms', 'shapeKeys', 'warps', 'rigPins'],
  hands: ['hands'],
  // How artwork answers the head, beyond its own bindings: the deformer
  // hierarchy, the depth parallax, and what trails behind (3D-10).
  hierarchy: ['deformers', 'parallax', 'followers'],
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
    // The structural points artwork is deformed around (docs/FACE_CONTROL_RIG.md).
    rigPins: normalizeRigPins(candidate),
    // Two floating hands (docs/HAND_RIGGING.md); null when the mascot has none.
    hands: normalizeHands(candidate),
    // Light transform hierarchy (docs/DEFORMER_MODEL.md).
    deformers: normalizeDeformers(candidate),
    // What an author changed about the handles on the mascot.
    rigHandles: normalizeRigHandles(candidate),
    // Which two-sided controls are being moved together (docs/FACE_CONTROL_RIG.md).
    rigLinks: normalizeRigLinks(candidate),
    // How a gaze target is divided between the eyes and the head. Disabled in
    // every project that predates the solver.
    gazeSolver: normalizeGazeSolver(candidate),
    // Where each clip sits when several play together.
    arrangement: normalizeArrangement(candidate),
    // Pseudo depth (docs/DEPTH_PARALLAX.md).
    parallax: normalizeParallax(candidate.parallax),
    // What trails behind the head (docs/SECONDARY_MOTION.md).
    followers: normalizeFollowers(candidate),
    // How long an expression change takes (docs/CONTINUOUS_TRANSITIONS.md).
    expressionBlend: normalizeExpressionBlend(candidate.expressionBlend),
    // How long one motion takes to become another (docs/ADR_MOTION_LAYERING.md).
    motionBlend: normalizeMotionBlend(candidate.motionBlend)
  };
}

export const normalizeProjectDocument = createProjectDocument;
