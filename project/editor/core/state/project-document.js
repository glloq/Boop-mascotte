import { normalizeRigHandles } from '../puppet/handle-record.js';
import { normalizeRigLinks } from '../puppet/control-links.js';
import { normalizeArrangement } from '../animation/arrangement.js';
import { RIG_SCHEMA_VERSION, normalizeDeformers, normalizeExpressionBlend, normalizeHands, normalizeParallax, normalizeFollowers, normalizeWarps, normalizeKeyforms, normalizeShapeKeys, normalizeMotionBlend, normalizeGazeSolver, normalizeRigPins, normalizeRigConstraints, normalizeRigAttachments, normalizeRigHolds } from '../../../runtime/runtime.js';

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
  // The relationships the rig holds, and what is holding on to what.
  constraints: ['rigConstraints', 'rigAttachments', 'rigHolds'],
  hands: ['hands'],
  // How artwork answers the head, beyond its own bindings: the deformer
  // hierarchy, the depth parallax, and what trails behind (3D-10).
  hierarchy: ['deformers', 'parallax', 'followers'],
  expressions: ['expressions', 'expressionBlend'],
  reactions: ['reactions']
});

export const PROJECT_DOCUMENT_FIELDS = Object.freeze(['schemaVersion', ...new Set(Object.values(PROJECT_DOMAINS).flat())]);

const constraintScale = { translate: 1, rotate: 1, scale: 1 };

/**
 * Mark the hands that still carry the pseudo-3D turn.
 *
 * The tell is the facing axis: a hand with no drawings whose rig has a
 * `handLFacing` parameter is a hand that turned by morphing six paths. Nothing
 * reads the mark but the editor, which uses it to offer the conversion and to
 * say what it will do (docs/HAND_STYLES.md, "Migration").
 */
function markLegacyPseudo3DHands(hands, source = {}) {
  if (!hands) return hands;
  const out = {};
  for (const [side, hand] of Object.entries(hands)) {
    const facing = `hand${side === 'right' ? 'R' : 'L'}Facing`;
    out[side] = !hand.styles && source?.params?.[facing] ? { ...hand, legacyPseudo3D: true } : hand;
  }
  return out;
}

/**
 * The retired hand parameters, dropped from the values a file stores for them.
 *
 * `handLAnim` played a drawing's own little rig — a fist closing, a thumb
 * going up — and nothing has one any more (docs/HAND_STYLES.md, "Deprecated
 * fields"). A file written before that still carries a value per state, and a
 * stored value with no parameter behind it is exactly what the validator is
 * there to report, so it is dropped on the way in rather than left to be
 * reported for ever. A file that still declares the parameter keeps both: the
 * value is honest about the rig it is in, and nothing reads it.
 */
const RETIRED_HAND_PARAMETERS = Object.freeze(['handLAnim', 'handRAnim']);
function dropRetiredHandValues(states = {}, params = {}) {
  const retired = RETIRED_HAND_PARAMETERS.filter((name) => !params?.[name]);
  if (!retired.length) return states;
  let touched = false;
  const out = {};
  for (const [id, stored] of Object.entries(states)) {
    if (!retired.some((name) => name in (stored || {}))) { out[id] = stored; continue; }
    const next = { ...stored };
    for (const name of retired) delete next[name];
    out[id] = next;
    touched = true;
  }
  return touched ? out : states;
}

export function createProjectDocument(candidate = {}) {
  const states = dropRetiredHandValues(
    candidate.states && typeof candidate.states === 'object' ? candidate.states : {},
    candidate.params
  );
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
    // What has to stay true whatever moved: follow, distance, orientation,
    // axis, limit and slide.
    rigConstraints: normalizeRigConstraints(candidate),
    // Named points on the artwork, and what is currently holding on to them.
    rigAttachments: normalizeRigAttachments(candidate),
    rigHolds: normalizeRigHolds(candidate),
    // Two floating hands (docs/HAND_RIGGING.md); null when the mascot has none.
    // A hand that still deforms is marked rather than converted: a file
    // written before the 2D refit opens exactly as it did, and the conversion
    // is an action its author takes (docs/HANDS_2D.md, PHASE 41).
    hands: markLegacyPseudo3DHands(normalizeHands(candidate), candidate),
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
