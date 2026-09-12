/**
 * A hand's states, as things an author owns (UIR-05,
 * docs/UIR_REFACTOR_BASELINE.md; docs/HAND_STYLES.md).
 *
 * ```text
 * HAND
 *   side
 *   states[]        one drawing each, edited independently
 *   activeState     the one it rests on
 *   transform       where it is, which the rig moves from
 * ```
 *
 * The model already held all of that -- `hand.styles.library` is the states and
 * `hand.styles.showing` is the active one -- and what it could not do was let an
 * author *own* them: every id had to be one the shipped set knows, every name
 * came off that set, and there was no way to copy one, rename one or take one
 * away. A hand was a view of a library rather than a library.
 *
 * These four operations close that gap, and they are all the same shape: move
 * one drawing's artwork, write one library, keep the parameter that indexes it
 * honest. Pure and immutable — they take a draft document and return whether
 * they changed it, so a command can snapshot before and roll back after.
 *
 * What they deliberately do **not** do is touch the other hand. Two hands are
 * two libraries (§16, "Hand state ≠ hand state"), and `mirrorHandState` is a
 * *copy* for that reason: there is no link afterwards.
 */
import { elementSpan } from '../face-library/face-part-artwork.js';
import { handElementId, handStyleLabel, handStyleMarkup } from './hand-style-art.js';
import { handStyleParameter, handStyleFrame } from './hand-style-install.js';
import { mapPathValues, parsePath } from '../../../runtime/path-vector.js';

const HAND_SIDES = Object.freeze(['left', 'right']);
export const OTHER_SIDE = Object.freeze({ left: 'right', right: 'left' });

/** A state id an author can be given: the shape a file name has. */
export const HAND_STATE_ID = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/**
 * `handLeftStyle-point`: the group one state's drawing lives in.
 *
 * Deliberately not `handStyleElementId`, which resolves its argument through
 * the shipped set and falls back to the default drawing for anything the set
 * does not know -- so a state an author made would have been given the *relaxed*
 * hand's id, and written a second copy of that drawing over it. A state of an
 * author's own is exactly the case this whole module exists for.
 */
export const handStateElementId = (side, id) => `${handElementId(side)}Style-${id}`;

const library = (state, side) => state?.hands?.[side]?.styles?.library || null;
const entryOf = (state, side, id) => (library(state, side) || []).find((item) => item.id === id) || null;

/** Every state of a hand, in the order its parameter indexes them. */
export const handStates = (state, side) => (library(state, side) || []).map((entry) => ({
  id: entry.id,
  name: entry.label || handStyleLabel(entry.id) || entry.id,
  element: entry.element,
  active: entry.id === state?.hands?.[side]?.styles?.showing
}));

/** A state id nothing on this hand is using yet, from a name an author gave. */
export function freeHandStateId(state, side, wanted) {
  const taken = new Set((library(state, side) || []).map((entry) => entry.id));
  // What an author typed, made into an id: letters, digits and dashes, starting
  // with a letter and never ending on a dash.
  const base = String(wanted || 'state').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^[^a-zA-Z]+/, '').replace(/-+$/, '') || 'state';
  if (!taken.has(base)) return base;
  for (let n = 2; n < 999; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return null;
}

/* ── The parameter that indexes the library ───────────────────────────────── */

/**
 * Rewrite the style parameter from the library, and keep every stored value in
 * range.
 *
 * A hand's parameter is an *index* into its library, so adding or taking away a
 * state moves what every number means. A state that is stored out of range is
 * exactly what the validator is there to report, so it is clamped here rather
 * than left to be reported for ever.
 */
export function syncHandStateParameter(state, side) {
  const entries = library(state, side);
  const name = handStyleParameter(side);
  if (!entries?.length) return false;
  const names = entries.map((entry) => entry.id);
  const showing = state.hands[side].styles.showing;
  const max = Math.max(0, names.length - 1);
  const fallback = Math.max(0, names.indexOf(showing));
  const before = state.params?.[name];
  state.params = { ...(state.params || {}), [name]: { ...(before || { type: 'number' }), min: 0, max, default: fallback, value: Math.min(Number(before?.value) || 0, max), options: names } };
  for (const stored of Object.values(state.states || {})) {
    if (!(name in stored)) stored[name] = fallback;
    else stored[name] = Math.min(Math.max(0, Number(stored[name]) || 0), max);
  }
  return true;
}

/* ── Rename ──────────────────────────────────────────────────────────────── */

/**
 * What this hand calls one of its states.
 *
 * Per hand, not per set: the shipped drawing is still called Point, and this
 * hand's copy of it can be called whatever the mascot needs. An empty name puts
 * the set's own back rather than leaving a state with no name at all.
 */
export function renameHandState(state, side, id, name) {
  const entries = library(state, side);
  if (!entries || !entryOf(state, side, id)) return false;
  const label = String(name || '').trim() || handStyleLabel(id) || id;
  if (entryOf(state, side, id).label === label) return false;
  state.hands = { ...state.hands, [side]: { ...state.hands[side], styles: { ...state.hands[side].styles, library: entries.map((entry) => (entry.id === id ? { ...entry, label } : entry)) } } };
  return true;
}

/* ── Delete ──────────────────────────────────────────────────────────────── */

/**
 * Take a state off a hand: its entry, its artwork, and its element records.
 *
 * The last one never goes. A hand with an empty library is a hand the runtime
 * has nothing to draw, and "delete the only drawing" is a way to break a mascot
 * that no author means to ask for -- removing the *hand* is what they mean, and
 * that is its own command.
 */
export function deleteHandState(state, side, id) {
  const entries = library(state, side);
  const entry = entryOf(state, side, id);
  if (!entry || !entries || entries.length < 2) return false;
  const kept = entries.filter((item) => item.id !== id);
  const span = elementSpan(state.svgMarkup || '', entry.element);
  if (span) state.svgMarkup = state.svgMarkup.slice(0, span.start) + state.svgMarkup.slice(span.end);
  state.elements = { ...(state.elements || {}) };
  for (const key of Object.keys(state.elements)) if (key === entry.element || key.startsWith(`${entry.element}-`)) delete state.elements[key];
  state.layers = (state.layers || []).filter((layer) => layer !== entry.element && !String(layer).startsWith(`${entry.element}-`));
  const showing = state.hands[side].styles.showing === id ? kept[0].id : state.hands[side].styles.showing;
  state.hands = { ...state.hands, [side]: { ...state.hands[side], styles: { ...state.hands[side].styles, library: kept, showing } } };
  syncHandStateParameter(state, side);
  return true;
}

/* ── Copying one drawing onto another state ──────────────────────────────── */

/** Every id inside one state rewritten for another: the group, and every layer under it. */
const rewriteIds = (markup, from, to) => markup.split(`id="${from}`).join(`id="${to}`);

/**
 * One state's artwork, moved to another pivot and optionally mirrored.
 *
 * The drawings of a set are absolute `M`/`L`/`C`/`Z` — one pivot, everything
 * inside a radius — so an even value in a path is an x and an odd one a y, and
 * mirroring is arithmetic rather than a transform wrapped round the group. A
 * path this does not hold for is left alone rather than mangled: a drawing an
 * author brought in with `H`, `V` or an arc copies across unmirrored, which is
 * honest, where flipping its numbers by index would be nonsense.
 */
export function moveHandDrawing(markup, { from, to, flip = false }) {
  const mirrorable = (d) => !/[hHvVaA]/.test(d);
  return markup.replace(/(\sd=")([^"]*)(")/g, (whole, head, d, tail) => {
    if (!parsePath(d).commands.length) return whole;
    if (flip && !mirrorable(d)) return whole;
    const next = mapPathValues(d, (value, index) => (index % 2 === 0
      ? (flip ? from.x + to.x - value : value + (to.x - from.x))
      : value + (to.y - from.y)));
    return `${head}${next}${tail}`;
  });
}

/** A record for a copied layer: the source's, pivoted where the copy is drawn. */
const copyRecord = (record, at) => (record
  ? { ...structuredClone(record), baseTransform: { ...(record.baseTransform || {}), x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: at.x, pivotY: at.y }, baseOpacity: 1 }
  : null);

/**
 * Put a copy of one state's drawing on a hand, as a state of its own.
 *
 * The same operation whether the copy stays on this hand (Duplicate) or goes to
 * the other one (Mirror copy): read the drawing where it is, draw it where the
 * target hand is, and give the target its own entry. Nothing links them
 * afterwards -- which is the point.
 *
 * @param {object} state    a draft document, mutated
 * @param {{side, id}} source
 * @param {{side, id, name}} target
 * @param {(side: string) => object|null} [measure]  a hand's frame, when the canvas knows better
 */
export function copyHandState(state, source, target, { measure } = {}) {
  if (!HAND_SIDES.includes(target.side) || !HAND_STATE_ID.test(target.id || '')) return false;
  const entry = entryOf(state, source.side, source.id);
  const entries = library(state, target.side);
  if (!entry || !entries || entryOf(state, target.side, target.id)) return false;
  const fromFrame = handStyleFrame(state, source.side, measure);
  const toFrame = handStyleFrame(state, target.side, measure);
  if (!fromFrame || !toFrame) return false;

  const element = handStateElementId(target.side, target.id);
  const span = elementSpan(state.svgMarkup || '', entry.element);
  const drawn = span ? state.svgMarkup.slice(span.start, span.end) : handStyleMarkup(source.side, source.id, { at: fromFrame.at, scale: fromFrame.scale });
  if (!drawn) return false;
  const markup = moveHandDrawing(rewriteIds(drawn, entry.element, element), {
    from: fromFrame.at, to: toFrame.at, flip: source.side !== target.side
  }).replace(/\sopacity="0"/, '');

  // Inside the target hand's own group, so the hand's reach, turn and size
  // carry the copy exactly as they carry every other state.
  const hostId = state.hands[target.side].element;
  const host = elementSpan(state.svgMarkup || '', hostId);
  if (!host) return false;
  const close = state.svgMarkup.lastIndexOf('</g>', host.end);
  state.svgMarkup = state.svgMarkup.slice(0, close) + markup + state.svgMarkup.slice(close);

  state.elements = { ...(state.elements || {}) };
  const sourceRecord = state.elements[entry.element];
  state.elements[element] = copyRecord(sourceRecord, toFrame.at) || copyRecord({ meta: { nodeType: 'g' } }, toFrame.at);
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) {
    if (match[2] === element) continue;
    const origin = state.elements[match[2].replace(element, entry.element)];
    state.elements[match[2]] = copyRecord(origin, toFrame.at) || copyRecord({ meta: { nodeType: match[1] } }, toFrame.at);
  }

  const label = String(target.name || '').trim() || `${entry.label || handStyleLabel(entry.id) || entry.id} copy`;
  state.hands = { ...state.hands, [target.side]: { ...state.hands[target.side], styles: { ...state.hands[target.side].styles, library: [...entries, { id: target.id, label, element, mirrored: source.side !== target.side }] } } };
  syncHandStateParameter(state, target.side);
  return true;
}

/** Duplicate: a copy of a state, on the same hand. */
export const duplicateHandState = (state, side, id, options = {}) => copyHandState(state, { side, id }, {
  side, id: freeHandStateId(state, side, options.id || `${id}-copy`), name: options.name
}, options);

/** Mirror copy: the same drawing on the other hand, its own from then on. */
export const mirrorHandState = (state, side, id, options = {}) => {
  const other = OTHER_SIDE[side];
  return copyHandState(state, { side, id }, {
    side: other, id: freeHandStateId(state, other, options.id || id), name: options.name
  }, options);
};
