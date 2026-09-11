// What runs, and when (V3-09 → V3-10).
//
// Choosing what a mascot does used to be two questions asked in two places: a
// reaction was authored in Reactions and an automatic behaviour was switched on
// in Automatic, and the only thing the two panels shared was a comment saying
// they were the same idea. Worse, the reaction catalogue already *bucketed by
// when* — "When clicked", "On hover", "By itself" — but only for adding: once a
// reaction existed there was no way to move it to another bucket, and a motion
// clip could not be selected to run at all.
//
// This module is the single answer to "when does this run?". Both panels read
// it, the preset catalogue groups by it, and a reaction changes bucket by
// having its trigger rewritten through `triggerForRunsWhen` — which is an
// ordinary `reactions` command and one history step, not a new kind of edit.
//
// Data and derivation only: nothing here mutates a document or knows about the
// DOM, and there is no branch on an id anywhere in it.
import { UNPROMPTED_REACTION_TRIGGERS } from '../../../runtime/runtime.js';
import { deriveAutomaticStatus } from '../behaviors/automatic-presets.js';

/**
 * The whens, in the order an author meets them: the two things they will try
 * first, then the two the mascot does without being asked, then the one their
 * own code drives.
 *
 * `triggers` is the list of runtime trigger types that land in the bucket, and
 * it is what makes the bucket derivable rather than hand-kept. "By itself"
 * holds two: `idle` is the honest one — nothing has happened for a while — and
 * `timer` is the clock that used to stand in for it, kept because a rig may
 * still want a metronome and because an older project is full of them.
 */
export const RUNS_WHEN = Object.freeze([
  Object.freeze({ id: 'click', label: 'When clicked', hint: 'Someone clicks or taps the mascot.', triggers: Object.freeze(['click']) }),
  Object.freeze({ id: 'hover', label: 'On hover', hint: 'The pointer is over the mascot, and it holds until the pointer leaves.', triggers: Object.freeze(['hover']) }),
  Object.freeze({ id: 'gaze', label: 'Following the pointer', hint: 'The eyes follow the pointer around the page, and this runs while they do.', triggers: Object.freeze(['gaze-follow']) }),
  Object.freeze({ id: 'idle', label: 'By itself', hint: 'Nobody is doing anything: the mascot acts on its own.', triggers: Object.freeze(['idle', 'timer']) }),
  Object.freeze({ id: 'page', label: 'From your page', hint: "Your own code fires it with mascot.trigger('custom', { name })." , triggers: Object.freeze(['custom']) })
]);

export const runsWhenById = (id) => RUNS_WHEN.find((entry) => entry.id === id) || null;

/** The bucket one trigger belongs to, or `null` for a trigger nothing can run. */
export function runsWhenOf(trigger = {}) {
  const type = typeof trigger === 'string' ? trigger : trigger?.type;
  return RUNS_WHEN.find((entry) => entry.triggers.includes(type))?.id || null;
}

/** The bucket's own label, for a trigger. `null` when the runtime cannot run it. */
export const runsWhenLabel = (id) => runsWhenById(id)?.label || null;

/**
 * The trigger a reaction takes when it is moved into a bucket.
 *
 * What the reaction already carries is kept wherever the new bucket can hold
 * it: an event name survives a trip through another bucket and back, and a
 * `timer` moved to "By itself" stays a timer rather than becoming an idle
 * reaction with a different meaning and a different number. A reaction that
 * arrives in "By itself" from anywhere else becomes `idle`, because that is
 * what "by itself" means now that the vocabulary can say it.
 */
export function triggerForRunsWhen(id, current = {}) {
  switch (id) {
    case 'click': return { type: 'click' };
    case 'hover': return { type: 'hover' };
    case 'gaze': return { type: 'gaze-follow' };
    case 'idle': return current.type === 'timer'
      ? { type: 'timer', interval: current.interval ?? 5 }
      : { type: 'idle', after: current.after ?? 8 };
    case 'page': return { type: 'custom', name: current.name || 'custom' };
    default: throw new Error(`Unknown "runs when" group "${id}".`);
  }
}

/** Whether this trigger needs nothing from anyone — the mascot's own life. */
export const isUnprompted = (trigger = {}) => UNPROMPTED_REACTION_TRIGGERS.includes(typeof trigger === 'string' ? trigger : trigger?.type);

/**
 * Motion clips nothing runs.
 *
 * A clip is authored in Animate and then has nowhere to go: the only way to
 * make one play in an exported mascot is to wrap it in a reaction, and an
 * arrangement — the other place a clip can be placed — is editor-only and is
 * never exported. So a clip no reaction plays is a clip the published mascot
 * will never show, however finished it is, and this is the list of them.
 */
export function motionsNotRunning(document = {}) {
  const played = new Set((document.reactions || []).map((item) => item.motion?.clipId).filter(Boolean));
  return (document.animationClips || []).filter((clip) => !played.has(clip.id)).map((clip) => ({ id: clip.id, name: clip.name || clip.id }));
}

/**
 * Everything that runs, bucketed by when, for one project.
 *
 * Two kinds of entry share the buckets and stay distinguishable, because they
 * are written to two different domains and only one of them can be moved:
 *
 * - `kind: 'reaction'` — a `reactions` entry, which changes bucket by having
 *   its trigger rewritten;
 * - `kind: 'automatic'` — a `stateMachine` behaviour behind an Automatic
 *   preset. It is always "by itself" and there is nowhere else for it to go,
 *   so it is listed and never moved.
 *
 * They are not one array in the document and this does not pretend otherwise:
 * merging them would be a schema change, and V3-09 already spends the one this
 * programme has. One surface, one vocabulary, one order — two writers.
 */
export function deriveRunsWhen(document = {}) {
  const automatic = deriveAutomaticStatus(document);
  const groups = RUNS_WHEN.map((entry) => ({
    id: entry.id, label: entry.label, hint: entry.hint,
    reactions: (document.reactions || []).filter((item) => runsWhenOf(item.trigger) === entry.id)
      .map((item) => ({ kind: 'reaction', id: item.id, name: item.name, enabled: item.enabled !== false, when: entry.id, trigger: item.trigger })),
    automatic: entry.id === 'idle'
      ? automatic.presets.filter((item) => item.status === 'on' || item.status === 'disabled')
        .map((item) => ({ kind: 'automatic', id: item.id, name: item.title, enabled: item.status === 'on' }))
      : []
  }));
  // A trigger this runtime cannot run belongs to no bucket, and saying so is
  // the point of V3-09: it is reported rather than filed under "when clicked".
  const unsupported = (document.reactions || []).filter((item) => !runsWhenOf(item.trigger))
    .map((item) => ({ kind: 'reaction', id: item.id, name: item.name, needs: item.trigger?.of || item.trigger?.type || 'an unknown trigger' }));
  return {
    groups: groups.map((group) => ({ ...group, count: group.reactions.length + group.automatic.length })),
    unsupported,
    motions: motionsNotRunning(document),
    running: groups.reduce((total, group) => total + group.reactions.filter((item) => item.enabled).length + group.automatic.filter((item) => item.enabled).length, 0)
  };
}
