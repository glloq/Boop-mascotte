export function createPreviewSession(candidate = {}) {
  return { running:false, playing:false, activeClipId:null, clipTime:0, previewElapsed:0, transitionElapsed:0,
    liveParams:{}, effectiveParams:{}, transition:null,
    // The running transition by name, for the diagram that draws it (V4-103).
    // `transition` itself carries the two poses, which say nothing about which
    // arrow is lighting up.
    transitionEdge:null, previewState:null, testBehavior:null, lastError:null, heldStill:false, behaviorOverrides:{}, expressionWeights:{}, activeReaction:null, eventLog:[], ...candidate };
}
