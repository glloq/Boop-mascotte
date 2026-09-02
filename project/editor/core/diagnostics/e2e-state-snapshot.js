const clone = value => structuredClone(value);

/** A detached, structured-clone-safe ProjectDocument projection. */
export function createE2EDocumentSnapshot(document) {
  return clone(document);
}

/** A detached, structured-clone-safe EditorSession projection. */
export function createE2ESessionSnapshot(session) {
  return {
    selectedId: session.selectedId,
    svgWarnings: clone(session.svgWarnings),
    workspace: session.workspace,
    activeSemanticPartId: session.activeSemanticPartId,
    activeControl: session.activeControl,
    selectedTrackParameter: session.selectedTrackParameter,
    selectedKey: clone(session.selectedKey),
    activeStateId: session.activeStateId,
    activeExpressionId: session.activeExpressionId,
    activeReactionId: session.activeReactionId,
    authorMode: session.authorMode,
    animationEditor: clone(session.animationEditor),
    focusPreview: session.focusPreview
  };
}

/** A detached, plain-data compatibility projection of both V2 state owners. */
export function createE2EStateSnapshot(document, session) {
  return {
    ...createE2EDocumentSnapshot(document),
    ...createE2ESessionSnapshot(session)
  };
}

/** Detached validation/readiness projection for product-journey assertions. */
export function createE2EReadinessSnapshot(readiness, issues) {
  return clone({ readiness, issues });
}
