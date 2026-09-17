/**
 * A piece that is several drawings, one of which is showing.
 *
 * The mechanism a mascot made of images needs most, and the one the editor
 * already had — for hands only. `runtime/hand-sprite.js` says it plainly:
 * *"A style is a sprite, and a change of style is a sprite swap."* No skew, no
 * squash, no morphing, no geometric interpolation between two pictures,
 * because there is no honest interpolation between two photographs.
 *
 * That is exactly what a closed eyelid and a mouth appearance need, and it is
 * the one thing a single picture cannot do:
 *
 * ```text
 * a mouth stretched by a number        a mouth with states
 *   one shape, scaled and translated     five drawings, one showing
 *   an A and an O are the same shape     an O is drawn as an O
 *   teeth fade in                        the open drawing has teeth
 * ```
 *
 * This generalises it to any piece, raster or vector, because a state is a
 * node id and nothing here cares what the node is made of.
 *
 * **Which state shows is a rule, not a number.** The obvious design — index
 * the drawings with a parameter from 0 to n, as hands do — makes the author
 * count, and makes `eyeOpen` mean something different on every mascot. So a
 * state carries the same conditions a reaction carries
 * (`runtime/reaction-conditions.js`): *when `eyeOpen` is at most 0.2*. One
 * vocabulary, already normalized, already readable in a sentence.
 *
 * **First match wins, in the order the author put them.** A state with no rule
 * always matches — `conditionsHold([])` is true, deliberately — so an
 * unconditional state belongs last, where it reads as "and otherwise, this
 * one".
 */

import { conditionsHold, describeCondition, normalizeConditions } from './reaction-conditions.js';
import { cssEscape } from './mesh-warp.js';

/**
 * The marker a rig asks for when any of its pieces has states.
 *
 * Not additive, for the reason nothing in this codebase is: a runtime that
 * does not know about states does not show the first drawing, it shows **all
 * of them, stacked** — five mouths on top of one another. Declining the rig by
 * name is better than that (VNX-39).
 */
export const PART_STATES_REQUIREMENT = 'part:states';

/**
 * How many states the editor offers to name on one piece.
 *
 * A budget for the UI, not a limit in the model: a file may carry more and is
 * read as it is. Past a handful this stops being "a mouth has appearances" and
 * becomes frame-by-frame animation, which is not what this editor does.
 */
export const PART_STATE_SLOTS = 5;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * One state, or null.
 *
 * Null rather than repaired, like every other normalizer here: a state whose
 * element cannot be read names no drawing, and a set that kept it would have a
 * rule that hides everything and shows nothing.
 */
export function normalizePartState(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const element = text(candidate.element);
  if (!element) return null;
  const id = text(candidate.id) || element;
  return Object.freeze({
    id, element,
    name: text(candidate.name) || id,
    when: normalizeConditions(candidate.when)
  });
}

/**
 * One piece's states: which piece, which drawings, and which one otherwise.
 *
 * A set of fewer than two states is dropped. One drawing that is always
 * showing is not a set, it is a piece — and keeping it would put a rig into
 * `requires` for a feature it does not use.
 */
export function normalizePartStateSet(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const target = text(candidate.target);
  if (!target) return null;
  const states = [];
  const seen = new Set();
  for (const entry of Array.isArray(candidate.states) ? candidate.states : []) {
    const state = normalizePartState(entry);
    // Two states on one drawing is a set that cannot say which is showing.
    if (!state || seen.has(state.id) || seen.has(state.element)) continue;
    seen.add(state.id); seen.add(state.element);
    states.push(state);
  }
  if (states.length < 2) return null;
  const fallback = states.some((state) => state.id === text(candidate.fallback))
    ? text(candidate.fallback)
    : states[states.length - 1].id;
  return Object.freeze({
    id: text(candidate.id) || `states-${target}`,
    target, fallback,
    states: Object.freeze(states)
  });
}

/** Every readable set a rig carries. Empty for every mascot that has none. */
export function normalizePartStates(source = {}) {
  const list = Array.isArray(source?.partStates) ? source.partStates : [];
  const out = [];
  const targets = new Set();
  for (const candidate of list) {
    const set = normalizePartStateSet(candidate);
    // One set per piece: two would each hide what the other shows, every
    // frame, in whichever order they happened to be written.
    if (!set || targets.has(set.target)) continue;
    targets.add(set.target);
    out.push(set);
  }
  return Object.freeze(out);
}

/**
 * The state showing right now: the first whose rule holds, or the fallback.
 *
 * @param {object} set
 * @param {{params?: object, state?: string|null}} situation
 */
export function stateFor(set, situation = {}) {
  if (!set?.states?.length) return null;
  for (const state of set.states) if (conditionsHold(state.when, situation)) return state;
  return set.states.find((state) => state.id === set.fallback) || set.states[set.states.length - 1];
}

/** Every element a set can show, for whoever has to hide the others. */
export const stateElements = (set) => (set?.states || []).map((state) => state.element);

/**
 * Show one drawing per set and hide the rest, on a live document.
 *
 * Called on the frames where something changed and on no others: the whole
 * point of a swap is that it costs nothing to keep showing what is already
 * showing, so the chosen id is compared against what was last written.
 *
 * `showing` is the caller's memory — the engine keeps one map for the life of
 * the mascot — because a swap remade every frame would have none, which is the
 * same reason `createHandStyleSwaps` exists.
 *
 * @returns {number} how many sets actually changed
 */
export function applyPartStatesToDom(root, sets = [], situation = {}, showing = new Map()) {
  if (!root?.querySelector || !Array.isArray(sets)) return 0;
  let swapped = 0;
  for (const set of sets) {
    const chosen = stateFor(set, situation);
    if (!chosen || showing.get(set.id) === chosen.id) continue;
    let wrote = false;
    for (const state of set.states) {
      const node = root.querySelector(`#${cssEscape(state.element)}`);
      if (!node) continue;
      // `display` rather than `opacity`: a hidden drawing must not be
      // clickable, must not be measured, and must not be painted at all.
      node.style.display = state.id === chosen.id ? '' : 'none';
      wrote = true;
    }
    if (!wrote) continue;
    showing.set(set.id, chosen.id);
    swapped += 1;
  }
  return swapped;
}

/**
 * The first paint, before anything has been posed.
 *
 * Without it every drawing in every set is visible at once until the first
 * frame runs — and in a static viewer, which never runs one, for ever. So the
 * fallback is written as soon as the artwork is there, and the export carries
 * it in the markup.
 */
export const primePartStates = (root, sets = []) => applyPartStatesToDom(root, sets, {}, new Map());

/** Said the way an author wrote it: "Ouverte — when mouthOpen is at least 0.5". */
export function describePartState(state) {
  if (!state) return '';
  const rule = (state.when || []).map(describeCondition).join(' and ');
  return rule ? `${state.name} — when ${rule}` : `${state.name} — otherwise`;
}
