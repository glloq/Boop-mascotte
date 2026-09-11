import { RIG_SCHEMA_VERSION, rigRequirements, normalizeAnimations, normalizeExpressions, normalizeKeyforms, normalizeDeformers, normalizeExpressionBlend, normalizeHands, normalizeParallax, normalizeReactions, normalizeShapeKeys, normalizeWarps, normalizeFollowers, normalizeMotionBlend, normalizeGazeSolver, normalizeRigPins, normalizeRigConstraints, normalizeRigAttachments, normalizeRigHolds } from '../../../runtime/runtime.js';

/** The hands, without the editor-only mark on one that still deforms. */
function exportedHands(state) {
  const hands = normalizeHands(state);
  if (!hands) return hands;
  return Object.fromEntries(Object.entries(hands).map(([side, hand]) => {
    const { legacyPseudo3D, ...rest } = hand;
    void legacyPseudo3D;
    return [side, rest];
  }));
}

export function createExportRig(state) {
  return structuredClone({ schemaVersion: RIG_SCHEMA_VERSION,
    // What this particular mascot cannot run without (V3-09, VNX-39). Empty
    // for almost every project: only the two triggers a runtime may not have
    // put anything in it, and a rig that uses neither asks for nothing. It is
    // named rather than versioned so a build missing one feature can say which
    // (VNX-65 splits the runtime into modules).
    requires: rigRequirements({ reactions: normalizeReactions(state) }),
    params: state.params, states: state.states,
    elements: state.elements, activeState: state.activeState, transitions: state.transitions,
    transitionSettings: state.transitionSettings, globalConstraints: state.globalConstraints,
    stateConstraints: state.stateConstraints, runtimeConfig: state.runtimeConfig, behaviors: state.behaviors,
    // Additive block (docs/ADR_EXPRESSIONS.md); runtimes that predate it ignore unknown fields.
    expressions: normalizeExpressions(state),
    // Additive blocks (docs/ADR_REACTIONS.md): clips play through playAnimation and Reactions.
    animations: normalizeAnimations({ animations: state.animationClips }), reactions: normalizeReactions(state),
    // Additive block (docs/KEYFORM_ENGINE.md): pose grids evaluated by the shared keyform engine.
    keyforms: normalizeKeyforms(state), shapeKeys: normalizeShapeKeys(state),
    // Additive block (docs/WARP_GRID.md): small optional control grids.
    warps: normalizeWarps(state),
    // Additive block (docs/HAND_RIGGING.md, docs/HAND_STYLES.md): anchors, reach,
    // inertia, and the drawings a 2D hand swaps between. `legacyPseudo3D` is
    // not among them: it marks a hand the *editor* can offer to convert, and a
    // published mascot has no such offer to make.
    hands: exportedHands(state),
    // Additive block (docs/DEFORMER_MODEL.md): parent/local/world hierarchy.
    deformers: normalizeDeformers(state),
    // Additive block (docs/DEPTH_PARALLAX.md): head-driven parallax settings.
    parallax: normalizeParallax(state.parallax),
    // Additive block (docs/SECONDARY_MOTION.md): what trails behind the head.
    followers: normalizeFollowers(state),
    // Additive block (docs/CONTINUOUS_TRANSITIONS.md): expression cross-fade span.
    expressionBlend: normalizeExpressionBlend(state.expressionBlend),
    // Additive block (docs/ADR_MOTION_LAYERING.md): motion cross-fade span.
    motionBlend: normalizeMotionBlend(state.motionBlend),
    // Additive block (docs/FACE_CONTROL_RIG.md): where a gaze sends the eyes
    // and the head. Runtimes that predate it ignore it and read `lookX` alone.
    gazeSolver: normalizeGazeSolver(state),
    // Additive block (docs/FACE_CONTROL_RIG.md): the points the artwork is held by.
    rigPins: normalizeRigPins(state),
    // Additive block (docs/FACE_CONTROL_RIG.md): what the rig holds true, and
    // what is holding on to what.
    rigConstraints: normalizeRigConstraints(state), rigAttachments: normalizeRigAttachments(state), rigHolds: normalizeRigHolds(state) });
}
