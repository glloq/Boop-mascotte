const clone = value => structuredClone(value);

/** A detached, plain-data projection of the two V2 state owners used by tests. */
export function createE2EStateSnapshot(document, session) {
  const project = clone(document);
  return {
    ...project,
    selectedId: session.selectedId,
    svgWarnings: clone(session.svgWarnings),
    workspace: session.workspace,
    activeSemanticPartId: session.activeSemanticPartId,
    activeControl: session.activeControl,
    selectedTrackParameter: session.selectedTrackParameter,
    selectedKey: clone(session.selectedKey),
    activeStateId: session.activeStateId,
    authorMode: session.authorMode,
    animationEditor: clone(session.animationEditor),
    focusPreview: session.focusPreview
  };
}
