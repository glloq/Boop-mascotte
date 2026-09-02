export function createEditorSession(candidate = {}) {
  const animationEditor = candidate.animationEditor || {};
  return {
    selectedId: typeof candidate.selectedId === 'string' ? candidate.selectedId : null,
    svgWarnings: Array.isArray(candidate.svgWarnings) ? candidate.svgWarnings : [],
    workspace: candidate.workspace || 'create', activeSemanticPartId: candidate.activeSemanticPartId || null,
    activeControl: candidate.activeControl || null, selectedTrackParameter: candidate.selectedTrackParameter || null,
    selectedKey: candidate.selectedKey || null, activeStateId: candidate.activeStateId || null,
    authorMode: candidate.authorMode || 'states',
    animationEditor: { activeClipId: animationEditor.activeClipId || null, playhead: Math.max(0, Number(animationEditor.playhead) || 0), panel: animationEditor.panel || 'preview', autoKey: Boolean(animationEditor.autoKey) },
    focusPreview: Boolean(candidate.focusPreview)
  };
}
export const normalizeEditorSession = createEditorSession;
