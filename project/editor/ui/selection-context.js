import { normalizeSurface } from './task-router.js';

/**
 * What the inspector answers for, per surface.
 *
 * The question is the *panels on screen*, not the route: `rig.assign` and
 * `rig.controls` are two screens over one column of panels, and a face part is
 * a face part on both of them (UIR-01).
 */
const SURFACE_SUBJECTS = Object.freeze({
  create: 'artwork', hands: 'hands', rig: 'face-setup',
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
  if (currentTask === 'face-setup') {
    if (session.activeSemanticPartId && session.activeControl) return { kind: 'semantic-control', part: session.activeSemanticPartId, control: session.activeControl };
    if (session.activeSemanticPartId) return { kind: 'semantic-part', id: session.activeSemanticPartId };
    return { kind: 'none', task: currentTask };
  }
  if (currentTask === 'expressions') return session.activeExpressionId ? { kind: 'expression', id: session.activeExpressionId } : { kind: 'none', task: currentTask };
  if (currentTask === 'reactions') {
    // The Behavior board picks one of four things, and picking one clears the
    // other three, so the order here is only a tie-break for a session written
    // before the board existed (docs/BEHAVIOR_STUDIO.md).
    if (session.activeTransitionKeys?.length) return { kind: 'transition', id: session.activeTransitionKeys[0], keys: [...session.activeTransitionKeys] };
    if (session.activeBehaviorId) return { kind: 'automatic', id: session.activeBehaviorId };
    if (session.activeTriggerId) return { kind: 'trigger', id: session.activeTriggerId };
    if (session.activeReactionId) return { kind: 'reaction', id: session.activeReactionId };
    if (session.activeStateId) return { kind: 'state', id: session.activeStateId };
    return { kind: 'none', task: currentTask };
  }
  if (currentTask === 'animate') {
    if (session.selectedKey) return { kind: 'timeline-key', ...session.selectedKey };
    if (session.selectedTrackParameter) return { kind: 'timeline-track', parameter: session.selectedTrackParameter };
    if (session.activeStateId) return { kind: 'state', id: session.activeStateId };
    if (session.animationEditor?.activeClipId) return { kind: 'clip', id: session.animationEditor.activeClipId };
  }
  return { kind: 'none', task: currentTask };
}

/**
 * One session write for a Behavior board pick (docs/BEHAVIOR_STUDIO.md).
 *
 * Picking one thing clears the other three, so the inspector always answers
 * for one subject — and it clears the Timeline's selection too, because a
 * track chosen on another screen outranked the state an author had just
 * pressed, which is the one thing a selection-driven inspector must not do.
 *
 * Exported as a patch rather than an action because three callers write it:
 * the library column, the board and the table. Three copies of this object is
 * how a selection model starts disagreeing with itself.
 */
export const boardSelectionPatch = ({ state = null, transitions = [], behavior = null, trigger = null, reaction } = {}) => ({
  activeStateId: state || null,
  activeTransitionKeys: [...transitions],
  activeBehaviorId: behavior || null,
  activeTriggerId: trigger || null,
  selectedTrackParameter: null,
  selectedKey: null,
  ...(reaction === undefined ? {} : { activeReactionId: reaction || null })
});

export function createSelectionController(editorContext) {
  const update = patch => editorContext.update(patch);
  return {
    selectArtworkElement: id => update({ selectedId: id || null }),
    selectSemanticPart: id => update({ activeSemanticPartId: id || null, activeControl: null }),
    selectSemanticControl: (part, control) => update({ activeSemanticPartId: part || null, activeControl: control || null }),
    selectClip: id => update({ animationEditor: { ...editorContext.get().animationEditor, activeClipId: id || null } }),
    selectState: id => update({ activeStateId: id || null }),
    /** One board pick clears the others: an inspector answers for one subject. */
    selectBoard: (picked) => update(boardSelectionPatch(picked)),
    selectExpression: id => update({ activeExpressionId: id || null }),
    selectReaction: id => update({ activeReactionId: id || null }),
    selectTimelineTrack: parameter => update({ selectedTrackParameter: parameter || null, selectedKey: null }),
    selectTimelineKey: key => update({ selectedKey: key || null }),
    clearSelection: () => update({ selectedId: null, activeSemanticPartId: null, activeControl: null, selectedTrackParameter: null, selectedKey: null, activeStateId: null, activeExpressionId: null, activeReactionId: null, activeTransitionKeys: [], activeBehaviorId: null, activeTriggerId: null })
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
  if (target.kind === 'state') return { activeStateId: target.id || null, activeTransitionKeys: [], activeBehaviorId: null, activeTriggerId: null };
  if (target.kind === 'expression') return { activeExpressionId: target.id || null };
  if (target.kind === 'reaction') return { activeReactionId: target.id || null };
  return {};
}
