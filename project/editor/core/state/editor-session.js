export function createEditorSession(candidate = {}) {
  const animationEditor = candidate.animationEditor || {};
  const selectedKey = candidate.selectedKey;
  return {
    selectedId: typeof candidate.selectedId === 'string' ? candidate.selectedId : null,
    svgWarnings: Array.isArray(candidate.svgWarnings) ? candidate.svgWarnings : [],
    workspace: candidate.workspace || 'create', activeSemanticPartId: candidate.activeSemanticPartId || null,
    activeControl: candidate.activeControl || null, selectedTrackParameter: candidate.selectedTrackParameter || null,
    selectedKey: selectedKey && typeof selectedKey.parameter === 'string' && Number.isFinite(Number(selectedKey.time))
      ? { parameter: selectedKey.parameter, time: Number(selectedKey.time) } : null,
    activeStateId: typeof candidate.activeStateId === 'string' ? candidate.activeStateId : null,
    activeExpressionId: typeof candidate.activeExpressionId === 'string' ? candidate.activeExpressionId : null,
    activeReactionId: typeof candidate.activeReactionId === 'string' ? candidate.activeReactionId : null,
    authorMode: candidate.authorMode || 'states',
    animationEditor: { activeClipId: animationEditor.activeClipId || null, playhead: Math.max(0, Number(animationEditor.playhead) || 0), panel: animationEditor.panel || 'preview', autoKey: Boolean(animationEditor.autoKey) },
    focusPreview: Boolean(candidate.focusPreview)
  };
}
export const normalizeEditorSession = createEditorSession;
