import { normalizeSurface } from './task-router.js';

/**
 * What the inspector answers for, per surface.
 *
 * The question is the *panels on screen*, not the route: `rig.assign` and
 * `rig.controls` are two screens over one column of panels, and a face part is
 * a face part on both of them (UIR-01).
 */
const SURFACE_SUBJECTS = Object.freeze({
  create: 'artwork', character: 'character', hands: 'hands', rig: 'face-setup',
  expressions: 'expressions', animate: 'animate', reactions: 'reactions', preview: 'preview'
});

/**
 * What the panels on screen are about, from a surface, a screen or any older
 * name for either. The inspector and its empty lines are keyed by this rather
 * than by the route: four rig screens ask one question of the inspector.
 */
export const surfaceSubject = (value) => SURFACE_SUBJECTS[normalizeSurface(value)] || 'artwork';

export function resolveSelectionContext(session = {}, task = session.workspace) {
  const currentTask = surfaceSubject(task);
  if (currentTask === 'artwork') return session.selectedId ? { kind: 'artwork', id: session.selectedId } : { kind: 'none', task: currentTask };
  // The Character Builder edits the same selection Artwork does; the inspector
  // decides which adapter answers for it.
  if (currentTask === 'character') return session.selectedId ? { kind: 'artwork', id: session.selectedId } : { kind: 'none', task: currentTask };
  if (currentTask === 'face-setup') {
    if (session.activeSemanticPartId && session.activeControl) return { kind: 'semantic-control', part: session.activeSemanticPartId, control: session.activeControl };
    if (session.activeSemanticPartId) return { kind: 'semantic-part', id: session.activeSemanticPartId };
    return { kind: 'none', task: currentTask };
  }
  if (currentTask === 'expressions') return session.activeExpressionId ? { kind: 'expression', id: session.activeExpressionId } : { kind: 'none', task: currentTask };
  if (currentTask === 'reactions') return session.activeReactionId ? { kind: 'reaction', id: session.activeReactionId } : { kind: 'none', task: currentTask };
  if (currentTask === 'animate') {
    if (session.selectedKey) return { kind: 'timeline-key', ...session.selectedKey };
    if (session.selectedTrackParameter) return { kind: 'timeline-track', parameter: session.selectedTrackParameter };
    if (session.activeStateId) return { kind: 'state', id: session.activeStateId };
    if (session.animationEditor?.activeClipId) return { kind: 'clip', id: session.animationEditor.activeClipId };
  }
  return { kind: 'none', task: currentTask };
}

export function createSelectionController(editorContext) {
  const update = patch => editorContext.update(patch);
  return {
    selectArtworkElement: id => update({ selectedId: id || null }),
    selectSemanticPart: id => update({ activeSemanticPartId: id || null, activeControl: null }),
    selectSemanticControl: (part, control) => update({ activeSemanticPartId: part || null, activeControl: control || null }),
    selectClip: id => update({ animationEditor: { ...editorContext.get().animationEditor, activeClipId: id || null } }),
    selectState: id => update({ activeStateId: id || null }),
    selectExpression: id => update({ activeExpressionId: id || null }),
    selectReaction: id => update({ activeReactionId: id || null }),
    selectTimelineTrack: parameter => update({ selectedTrackParameter: parameter || null, selectedKey: null }),
    selectTimelineKey: key => update({ selectedKey: key || null }),
    clearSelection: () => update({ selectedId: null, activeSemanticPartId: null, activeControl: null, selectedTrackParameter: null, selectedKey: null, activeStateId: null, activeExpressionId: null, activeReactionId: null })
  };
}

export function selectionPatchForTarget(target) {
  if (!target) return {};
  if (target.kind === 'artwork-element') return { selectedId: target.id || null };
  if (target.kind === 'semantic-part') return { activeSemanticPartId: target.id || null, activeControl: null };
  if (target.kind === 'semantic-control') return { activeSemanticPartId: target.part || null, activeControl: target.control || null };
  if (target.kind === 'animation-clip') return { animationEditor: { activeClipId: target.id || null } };
  if (target.kind === 'timeline-track') return { selectedTrackParameter: target.parameter || null, selectedKey: null };
  if (target.kind === 'timeline-key') return { selectedKey: { parameter: target.parameter, time: target.time } };
  if (target.kind === 'state') return { activeStateId: target.id || null };
  if (target.kind === 'expression') return { activeExpressionId: target.id || null };
  if (target.kind === 'reaction') return { activeReactionId: target.id || null };
  return {};
}
