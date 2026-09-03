// Reaction model (docs/ADR_REACTIONS.md, docs/HAND_GESTURES.md): When (trigger)
// → Do (an expression at a weight, an optional motion clip, optional hand
// gestures) → Timing (attack / hold / release) → After (return or stay).
// Reactions reference expressions, clips and hand poses by id and never create
// or alter them. Normalization is shared with the runtime.
import { REACTION_TIMINGS, REACTION_TRIGGERS, normalizeReaction } from '../../../runtime/runtime.js';
import { slugify } from '../expressions/expression-model.js';

export const TIMING_PRESETS = REACTION_TIMINGS;
export const TRIGGER_TYPES = REACTION_TRIGGERS;

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
    const poses = document.hands?.[gesture?.side]?.poses || [];
    if (!poses.some((pose) => pose.id === gesture?.pose)) throw new Error(`The ${gesture?.side || 'chosen'} hand has no "${gesture?.pose}" pose. Add it in Hands first.`);
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

/** Non-blocking problems: targets that no longer exist, or a reaction that does nothing. */
export function reactionIssues(document) {
  const expressions = new Set((document?.expressions || []).map((item) => item.id)), clips = new Set((document?.animationClips || []).map((item) => item.id));
  const posesFor = (side) => new Set((document?.hands?.[side]?.poses || []).map((pose) => pose.id));
  const poses = { left: posesFor('left'), right: posesFor('right') };
  return (document?.reactions || []).map((reaction) => ({
    id: reaction.id, name: reaction.name,
    missingExpression: reaction.expression && !expressions.has(reaction.expression.id) ? reaction.expression.id : null,
    missingClip: reaction.motion && !clips.has(reaction.motion.clipId) ? reaction.motion.clipId : null,
    // A gesture naming a pose the hand no longer has (docs/HAND_GESTURES.md).
    missingGesture: (reaction.gestures || []).find((gesture) => !poses[gesture.side]?.has(gesture.pose)) || null,
    empty: !reaction.expression && !reaction.motion && !(reaction.gestures || []).length
  })).filter((item) => item.missingExpression || item.missingClip || item.missingGesture || item.empty);
}

/** Human summary of a trigger for lists and chips. */
export function triggerLabel(trigger = {}) {
  if (trigger.type === 'hover') return 'When hovered';
  if (trigger.type === 'timer') return `Every ${trigger.interval} s`;
  if (trigger.type === 'custom') return `On "${trigger.name}"`;
  return 'When clicked';
}
