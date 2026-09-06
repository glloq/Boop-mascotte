// Reaction presets (docs/ADR_REACTIONS.md): ready-made "when → do" pairs, built
// only out of what the project already has. Expressions and Animate offer
// presets; Reactions asked for a name and a blank form instead, which is the
// one place in the journey with nothing to click.
//
// Data only: a preset names the expression, motion and hand pose it would like,
// each as an ordered list of candidates. Nothing is authored until the user
// adds one, and a preset never creates the things it references.
import { slugify } from '../expressions/expression-model.js';

/** Group order, used by the catalogue UI. The first one opens by default. */
export const REACTION_PRESET_GROUPS = Object.freeze(['When clicked', 'On hover', 'By itself', 'From your page']);

const click = Object.freeze({ type: 'click' });
const hover = Object.freeze({ type: 'hover' });
const timer = (interval) => Object.freeze({ type: 'timer', interval });
const custom = (name) => Object.freeze({ type: 'custom', name });
const reaction = (group, id, name, description, trigger, timing, expression, motion, gesture = null, after = 'return') =>
  Object.freeze({ id, name, description, group, trigger, timing, after, expression: Object.freeze(expression), motion: Object.freeze(motion), gesture: Array.isArray(gesture) ? Object.freeze(gesture) : gesture });

export const REACTION_PRESETS = Object.freeze([
  // Clicked: the first thing anyone tries on a mascot.
  // A hand pose is a list of candidates too, and a drawn pair's own poses come
  // first (docs/HAND_RIGGING.md); a pair that rests behind the head comes out
  // for the gesture and goes back after it.
  reaction('When clicked', 'surprise', 'Surprise', 'Clicked \u2192 a surprised face, hands up, and a quick pop, then back.', click, 'fast', ['surprised', 'excited'], ['head-pop', 'gasp', 'bounce', 'nod'], ['spread', 'stop', 'open']),
  reaction('When clicked', 'greet', 'Greet', 'Clicked \u2192 a happy face and a wave.', click, 'normal', ['happy', 'excited'], ['hand-wave', 'nod', 'bounce'], ['wave', 'open']),
  reaction('When clicked', 'laugh', 'Laugh', 'Clicked \u2192 laughing, with the head bobbing.', click, 'normal', ['laughing', 'excited', 'happy'], ['laugh', 'bounce', 'nod'], ['spread', 'open']),
  reaction('When clicked', 'shy', 'Shy', 'Clicked \u2192 looks away, then comes back.', click, 'slow', ['shy', 'sad', 'confused', 'sleepy'], ['shake', 'tilt', 'wobble']),
  reaction('When clicked', 'grumble', 'Grumble', 'Clicked \u2192 unimpressed, a fist, with a slow head shake.', click, 'normal', ['annoyed', 'angry', 'sulking'], ['shake', 'wobble'], ['fist']),
  reaction('When clicked', 'cheer', 'Cheer', 'Clicked \u2192 excited, hands up, thumbs up.', click, 'fast', ['excited', 'proud', 'happy'], ['hands-up', 'bounce', 'head-pop', 'laugh'], ['thumbsUp', 'wave', 'open']),

  // Hover: the mascot notices the pointer before it is even pressed.
  reaction('On hover', 'notice', 'Notice you', 'Hovered \u2192 looks up and smiles.', hover, 'normal', ['happy', 'excited', 'curious'], ['eye-dart', 'look-around', 'look-up']),
  reaction('On hover', 'curious-look', 'Curious', 'Hovered \u2192 tilts its head and studies you.', hover, 'normal', ['curious', 'confused', 'thinking'], ['tilt', 'peek', 'look-around']),
  reaction('On hover', 'brow-hello', 'Brow hello', 'Hovered \u2192 a quick brow flash, like a silent hello.', hover, 'fast', ['happy', 'calm', 'cheeky'], ['brow-flash', 'smile-flash', 'nod']),

  // By itself: life that happens with no input at all.
  reaction('By itself', 'glance', 'Glance around', 'Every few seconds \u2192 a quick look around.', timer(8), 'normal', [], ['look-around', 'eye-dart']),
  reaction('By itself', 'sleepy-yawn', 'Yawn', 'Now and then \u2192 a sleepy yawn.', timer(20), 'slow', ['sleepy', 'bored', 'relieved'], ['yawn', 'sigh']),
  reaction('By itself', 'bored-sigh', 'Get bored', 'Now and then \u2192 a bored sigh.', timer(15), 'slow', ['bored', 'sulking', 'sad'], ['sigh', 'wobble', 'shake']),
  reaction('By itself', 'stretch', 'Stretch', 'Now and then \u2192 a slow head roll, then settle.', timer(25), 'slow', ['relieved', 'calm', 'happy'], ['head-roll', 'wobble', 'tilt']),

  // From your page: reactions your own code fires, so the mascot can answer.
  reaction('From your page', 'say-yes', 'Say yes', "mascot.trigger('custom', { name: 'yes' }) \u2192 a happy nod.", custom('yes'), 'fast', ['happy', 'excited', 'calm'], ['nod', 'bounce'], ['thumbsUp']),
  reaction('From your page', 'say-no', 'Say no', "mascot.trigger('custom', { name: 'no' }) \u2192 a firm head shake, hand up.", custom('no'), 'fast', ['sad', 'annoyed', 'angry'], ['shake', 'wobble'], ['stop', 'open']),
  reaction('From your page', 'celebrate', 'Celebrate', "On 'success' \u2192 excited, hands up, thumbs up.", custom('success'), 'normal', ['excited', 'proud', 'happy'], ['hands-up', 'bounce', 'head-pop', 'laugh'], ['thumbsUp', 'wave', 'peace']),
  reaction('From your page', 'oops', 'Oops', "On 'error' \u2192 worried, hands up, with a small shiver.", custom('error'), 'fast', ['worried', 'scared', 'confused'], ['shiver', 'shake', 'gasp'], ['stop', 'spread', 'open']),
  reaction('From your page', 'ponder', 'Ponder', "On 'thinking' \u2192 looks away and thinks, a hand to the chin, and stays that way.", custom('thinking'), 'slow', ['thinking', 'confused', 'curious'], ['look-up', 'tilt', 'look-around'], ['pinch', 'point'], 'stay')
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
  // A gesture is a list of candidates too: Thumbs Up if the hand has it, a
  // Wave otherwise. The first candidate any hand can make wins.
  const wanted = source.gesture ? (Array.isArray(source.gesture) ? source.gesture : [source.gesture]) : [];
  const gestures = [];
  outer: for (const candidate of wanted) {
    for (const side of ['left', 'right']) {
      const pose = (document.hands?.[side]?.poses || []).find((item) => item.id === candidate);
      if (pose) { gestures.push({ side, pose: pose.id }); break outer; }
    }
  }

  // A reaction has to do something: an expression or a motion is enough.
  const missing = [];
  if (source.expression.length && !expression) missing.push({ kind: 'expression', label: `a ${source.expression[0]} expression`, route: { task: 'expressions' } });
  if (source.motion.length && !clip) missing.push({ kind: 'motion', label: `a ${source.motion[0].replace(/-/g, ' ')} motion`, route: { task: 'animate' } });
  // A gesture is an extra: a project with no hands is not told to draw some
  // for a reaction's sake, and one with hands is told which pose would help.
  const hasHands = ['left', 'right'].some((side) => document.hands?.[side]?.element);
  if (wanted.length && !gestures.length && hasHands) missing.push({ kind: 'gesture', label: `a ${wanted[0]} hand pose`, route: { task: 'face-setup', focus: 'hand-setup' } });

  return {
    id: source.id, name: source.name, description: source.description, group: source.group || REACTION_PRESET_GROUPS[0],
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

/** The same availability, bucketed in catalogue order; empty groups are dropped. */
export function reactionPresetAvailabilityGroups(document) {
  const resolved = reactionPresetAvailability(document);
  return REACTION_PRESET_GROUPS.map((group) => ({ group, presets: resolved.filter((item) => item.group === group) })).filter((entry) => entry.presets.length);
}
