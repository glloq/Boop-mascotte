// Reaction model (docs/ADR_REACTIONS.md, docs/HAND_GESTURES.md): When (trigger)
// → Do (an expression at a weight, an optional motion clip, optional hand
// gestures) → Timing (attack / hold / release) → After (return or stay).
// Reactions reference expressions, clips and hand poses by id and never create
// or alter them. Normalization is shared with the runtime.
import { REACTION_TIMINGS, REACTION_TRIGGERS, normalizeReaction } from '../../../runtime/runtime.js';
import { slugify } from '../expressions/expression-model.js';
import { handStyleId } from '../../../runtime/hand-vocabulary.js';

export const TIMING_PRESETS = REACTION_TIMINGS;
export const TRIGGER_TYPES = REACTION_TRIGGERS;

/**
 * Triggers that do something by themselves, with no expression and no motion.
 *
 * There is one: `gaze-follow` moves the eyes for as long as it holds, because
 * the runtime drives the gaze target from the pointer while it runs (V3-09).
 * A list rather than a comparison, so the next one is an entry rather than an
 * `||`.
 */
export const SELF_ACTING_TRIGGERS = Object.freeze(['gaze-follow']);

export const findReaction = (document, id) => (document?.reactions || []).find((item) => item.id === id) || null;

const close = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-6;
/** 'fast' | 'normal' | 'slow' when the timing matches a preset, otherwise 'custom'. */
export function timingPresetOf(timing = {}) {
  return Object.keys(TIMING_PRESETS).find((name) => ['attack', 'hold', 'release'].every((key) => close(TIMING_PRESETS[name][key], timing[key]))) || 'custom';
}

const uniqueId = (document, base) => {
  const used = new Set((document.reactions || []).map((item) => item.id));
  const root = slugify(base) === 'expression' ? 'reaction' : slugify(base);
  let id = root, n = 2;
  while (used.has(id)) id = `${root}-${n++}`;
  return id;
};

function requireTargets(document, { expressionId, clipId, gestures }) {
  if (expressionId && !(document.expressions || []).some((item) => item.id === expressionId)) throw new Error(`Expression "${expressionId}" does not exist. Create it in Expressions first.`);
  if (clipId && !(document.animationClips || []).some((item) => item.id === clipId)) throw new Error(`Motion "${clipId}" does not exist. Add it in Animate first.`);
  for (const gesture of Array.isArray(gestures) ? gestures : []) {
    if (!handGesture(document, gesture?.side, gesture?.pose)) throw new Error(`The ${gesture?.side || 'chosen'} hand has no "${gesture?.pose}" drawing. Give it one in Hands first.`);
  }
}

const fromOptions = (options, current = {}) => normalizeReaction({
  ...current,
  ...(options.name !== undefined ? { name: String(options.name).trim() } : {}),
  ...(options.enabled !== undefined ? { enabled: Boolean(options.enabled) } : {}),
  ...(options.trigger !== undefined ? { trigger: options.trigger } : {}),
  ...(options.expressionId !== undefined || options.weight !== undefined
    ? (() => { const id = options.expressionId === undefined ? current.expression?.id : options.expressionId; return { expression: id ? { id, weight: options.weight ?? current.expression?.weight ?? 1 } : null }; })() : {}),
  ...(options.clipId !== undefined ? { motion: options.clipId ? { clipId: options.clipId } : null } : {}),
  ...(options.gestures !== undefined ? { gestures: options.gestures || [] } : {}),
  ...(options.timing !== undefined ? { timing: options.timing } : {}),
  ...(options.after !== undefined ? { after: options.after } : {}),
  ...(options.priority !== undefined ? { priority: options.priority } : {}),
  ...(options.interrupt !== undefined ? { interrupt: options.interrupt } : {})
});

/** Create a reaction; `expressionId` / `clipId` must exist in the project when given. */
export function createReaction(document, options = {}) {
  const name = String(options.name ?? '').trim();
  if (!name) throw new Error('Give the reaction a name (Surprise, Wave hello…).');
  if (options.trigger && typeof options.trigger === 'object' && !TRIGGER_TYPES.includes(options.trigger.type)) throw new Error(`Unknown trigger "${options.trigger.type}".`);
  requireTargets(document, options);
  const reaction = fromOptions({ ...options, name }, { id: uniqueId(document, options.id || name) });
  (document.reactions ||= []).push(reaction);
  return reaction;
}

export function updateReaction(document, id, patch = {}) {
  const index = (document.reactions || []).findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Reaction "${id}" does not exist.`);
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Give the reaction a name (Surprise, Wave hello…).');
  if (patch.trigger && typeof patch.trigger === 'object' && !TRIGGER_TYPES.includes(patch.trigger.type)) throw new Error(`Unknown trigger "${patch.trigger.type}".`);
  if (patch.timing !== undefined && typeof patch.timing === 'string' && !TIMING_PRESETS[patch.timing]) throw new Error(`Unknown timing "${patch.timing}".`);
  requireTargets(document, patch);
  const next = fromOptions(patch, document.reactions[index]);
  document.reactions[index] = next;
  return next;
}

export const renameReaction = (document, id, name) => updateReaction(document, id, { name });

export function duplicateReaction(document, id) {
  const source = findReaction(document, id);
  if (!source) throw new Error(`Reaction "${id}" does not exist.`);
  const copy = normalizeReaction({ ...structuredClone(source), id: uniqueId(document, `${source.id}-copy`), name: `${source.name} Copy` });
  document.reactions.push(copy);
  return copy;
}

export function removeReaction(document, id) {
  const index = (document.reactions || []).findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Reaction "${id}" does not exist.`);
  return document.reactions.splice(index, 1)[0];
}

/**
 * The gesture a hand can actually make, for a name a preset or a reaction asks
 * for; `null` when it cannot make one (docs/HAND_GESTURES.md).
 *
 * A hand with a library answers with the **style** the name resolves to, so a
 * gesture asking for a `wave` finds the open hand and one asking for a `grab`
 * finds the fist (docs/HAND_STYLES.md). A hand from before the refit answers
 * with the pose it carries, if it carries one.
 */
export function handGesture(document = {}, side = 'left', wanted = '') {
  const hand = document?.hands?.[side];
  if (!hand || !wanted) return null;
  const library = hand.styles?.library;
  if (library?.length) return handStyleId(wanted, library);
  return (hand.poses || []).some((pose) => pose.id === wanted) ? wanted : null;
}

/** Non-blocking problems: targets that no longer exist, or a reaction that does nothing. */
export function reactionIssues(document) {
  const expressions = new Set((document?.expressions || []).map((item) => item.id)), clips = new Set((document?.animationClips || []).map((item) => item.id));

  return (document?.reactions || []).map((reaction) => ({
    id: reaction.id, name: reaction.name,
    missingExpression: reaction.expression && !expressions.has(reaction.expression.id) ? reaction.expression.id : null,
    missingClip: reaction.motion && !clips.has(reaction.motion.clipId) ? reaction.motion.clipId : null,
    // A gesture naming a pose the hand no longer has (docs/HAND_GESTURES.md).
    missingGesture: (reaction.gestures || []).find((gesture) => !handGesture(document, gesture.side, gesture.pose)) || null,
    // Following the pointer *is* the doing (V3-09): the runtime drives
    // `gazeX`/`gazeY` for as long as such a reaction holds, so one with no
    // expression and no motion still moves the mascot and must not be reported
    // as empty. Every other trigger needs something to show.
    empty: !SELF_ACTING_TRIGGERS.includes(reaction.trigger?.type) && !reaction.expression && !reaction.motion && !(reaction.gestures || []).length,
    // A trigger the runtime cannot run: the project was written by a newer
    // editor, and saying so beats quietly treating it as a click.
    unsupportedTrigger: reaction.trigger?.type === 'unsupported' ? reaction.trigger.of : null
  })).filter((item) => item.missingExpression || item.missingClip || item.missingGesture || item.empty || item.unsupportedTrigger);
}

/**
 * Human summary of a trigger for lists and chips.
 *
 * The two held triggers open with *while* rather than *when*, because that is
 * the difference V3-09 put in the runtime: a hover now lasts as long as the
 * pointer is there instead of playing once on the way in.
 */
export function triggerLabel(trigger = {}) {
  if (trigger.type === 'hover') return 'While hovered';
  if (trigger.type === 'gaze-follow') return 'While following you';
  if (trigger.type === 'idle') return `After ${trigger.after} s alone`;
  if (trigger.type === 'timer') return `Every ${trigger.interval} s`;
  if (trigger.type === 'custom') return `On "${trigger.name}"`;
  if (trigger.type === 'unsupported') return `Needs a newer runtime ("${trigger.of}")`;
  return 'When clicked';
}
