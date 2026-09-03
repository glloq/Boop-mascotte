// Reaction presets (docs/ADR_REACTIONS.md): ready-made "when → do" pairs, built
// only out of what the project already has. Expressions and Animate offer
// presets; Reactions asked for a name and a blank form instead, which is the
// one place in the journey with nothing to click.
//
// Data only: a preset names the expression, motion and hand pose it would like,
// each as an ordered list of candidates. Nothing is authored until the user
// adds one, and a preset never creates the things it references.
import { slugify } from '../expressions/expression-model.js';

export const REACTION_PRESETS = Object.freeze([
  Object.freeze({
    id: 'surprise', name: 'Surprise', description: 'Clicked → a surprised face and a quick pop, then back.',
    trigger: Object.freeze({ type: 'click' }), timing: 'fast', after: 'return',
    expression: Object.freeze(['surprised', 'excited']), motion: Object.freeze(['head-pop', 'bounce', 'nod']), gesture: null
  }),
  Object.freeze({
    id: 'greet', name: 'Greet', description: 'Clicked → a happy face, a nod and a wave.',
    trigger: Object.freeze({ type: 'click' }), timing: 'normal', after: 'return',
    expression: Object.freeze(['happy', 'excited']), motion: Object.freeze(['nod', 'bounce']), gesture: 'wave'
  }),
  Object.freeze({
    id: 'notice', name: 'Notice you', description: 'Hovered → looks up and smiles.',
    trigger: Object.freeze({ type: 'hover' }), timing: 'normal', after: 'return',
    expression: Object.freeze(['happy', 'excited']), motion: Object.freeze(['eye-dart', 'look-around']), gesture: null
  }),
  Object.freeze({
    id: 'shy', name: 'Shy', description: 'Clicked → looks away, then comes back.',
    trigger: Object.freeze({ type: 'click' }), timing: 'slow', after: 'return',
    expression: Object.freeze(['sad', 'confused', 'sleepy']), motion: Object.freeze(['shake', 'tilt']), gesture: null
  }),
  Object.freeze({
    id: 'glance', name: 'Glance around', description: 'Every few seconds → a quick look around.',
    trigger: Object.freeze({ type: 'timer', interval: 8 }), timing: 'normal', after: 'return',
    expression: Object.freeze([]), motion: Object.freeze(['look-around', 'eye-dart']), gesture: null
  })
]);

export const reactionPresetById = (id) => REACTION_PRESETS.find((preset) => preset.id === id) || null;

/** A candidate matches an item by its id or by its name, so "Happy" finds `happy`. */
const match = (items, candidates) => {
  for (const candidate of candidates) {
    const found = items.find((item) => item.id === candidate || slugify(item.name || '') === candidate);
    if (found) return found;
  }
  return null;
};

/**
 * Resolve a preset against the project: what it would use, what it is missing,
 * and where to go and make that.
 *
 * @returns {{id,name,description,trigger,timing,after,expressionId,expressionName,
 *            clipId,clipName,gestures,missing,usable}}
 */
export function instantiateReactionPreset(document = {}, preset) {
  const source = typeof preset === 'string' ? reactionPresetById(preset) : preset;
  if (!source) throw new Error(`Unknown reaction preset "${preset}".`);
  const expression = source.expression.length ? match(document.expressions || [], source.expression) : null;
  const clip = source.motion.length ? match(document.animationClips || [], source.motion) : null;
  const gestures = [];
  if (source.gesture) {
    for (const side of ['left', 'right']) {
      const pose = (document.hands?.[side]?.poses || []).find((item) => item.id === source.gesture);
      if (pose) { gestures.push({ side, pose: pose.id }); break; }
    }
  }

  // A reaction has to do something: an expression or a motion is enough.
  const missing = [];
  if (source.expression.length && !expression) missing.push({ kind: 'expression', label: `a ${source.expression[0]} expression`, route: { task: 'expressions' } });
  if (source.motion.length && !clip) missing.push({ kind: 'motion', label: `a ${source.motion[0].replace(/-/g, ' ')} motion`, route: { task: 'animate' } });
  if (source.gesture && !gestures.length) missing.push({ kind: 'gesture', label: `a ${source.gesture} hand pose`, route: { task: 'face-setup', focus: 'hand-setup' } });

  return {
    id: source.id, name: source.name, description: source.description,
    trigger: source.trigger, timing: source.timing, after: source.after,
    expressionId: expression?.id || null, expressionName: expression?.name || null,
    clipId: clip?.id || null, clipName: clip?.name || null,
    gestures, missing, usable: Boolean(expression || clip)
  };
}

/** Availability of every preset for the current project (for the catalogue UI). */
export function reactionPresetAvailability(document) {
  return REACTION_PRESETS.map((preset) => instantiateReactionPreset(document, preset));
}

/** What a resolved preset would build, in the words the reaction list uses. */
export function reactionPresetSummary(resolved) {
  const parts = [resolved.expressionName, resolved.clipName, resolved.gestures.length ? `${resolved.gestures[0].side} hand` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nothing yet';
}
