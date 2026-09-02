export function createPreviewSession(candidate = {}) {
  return { running:false, playing:false, activeClipId:null, clipTime:0, previewElapsed:0, transitionElapsed:0,
    liveParams:{}, effectiveParams:{}, transition:null, previewState:null, testBehavior:null, lastError:null, ...candidate };
}
