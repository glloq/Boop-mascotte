/**
 * What a hand can be: a **side**, and a **style** (docs/HAND_STYLES.md).
 *
 * ```text
 * side     which hand this is             left · right
 * style    which drawing is on screen     relaxed · open · fist · point · thumbsUp · peace
 * ```
 *
 * A style is a whole picture somebody drew, named for what it shows. It is the
 * **only** thing that decides a hand's shape. There is no angle here, no view,
 * no facing axis, no threshold and no hysteresis; nothing derives a picture
 * from a number, and nothing interpolates between two pictures. A hand shows
 * the style it is asked for, and its rotation turns that drawing exactly as it
 * turns any other artwork.
 *
 * Everything that makes a hand feel alive is a transformation of the whole
 * drawing:
 *
 * ```text
 * x + y + rotation + scale + visible + a change of style
 * ```
 *
 * A style never deforms. A wave is `open` and a rotation track, not a picture
 * of its own (docs/HAND_STYLES.md, "No wave style").
 *
 * Pure data and small pure functions: no DOM, no state, no assets.
 */
import { finite } from './numeric.js';

/* ── Sides ─────────────────────────────────────────────────────────────────── */

/** Which hand. One list, and the one place either half of the pair is named. */
export const HAND_SIDES = Object.freeze(['left', 'right']);

/** A side as the system knows it; anything unrecognised is the left hand. */
export const handSideId = (value) => (value === 'right' ? 'right' : 'left');

/** The letter a side's parameters are spelled with: `handLShow`, `handRStyle`. */
export const handSideLetter = (side) => (handSideId(side) === 'right' ? 'R' : 'L');

/* ── The registry (docs/HAND_STYLES.md, "The library") ─────────────────────── */

/**
 * Every style the system ships with, and everything it knows about one.
 *
 * ```text
 * id          label        what it is                       mirrorable
 * relaxed     Relaxed      a soft hand at rest              yes
 * open        Open         an open palm, fingers apart      yes
 * fist        Fist         a closed hand                    yes
 * point       Point        one finger out                   yes
 * thumbsUp    Thumbs up    a fist with the thumb up         yes
 * peace       Peace        two fingers in a V               yes
 * ```
 *
 * Six drawings, not a grid of poses times views: adding a seventh is adding a
 * row here and a drawing beside it, and nothing else in the system grows by
 * it. The order is the one the picker lays out, and it runs from open to
 * closed and then to the two signs, so the column reads as a hand shutting
 * rather than as a bag of gestures.
 *
 * `asset` is the file a style's drawing lives in, without a side or an
 * extension: `relaxed` is `<set>/relaxed.svg`. A **mirrorable** style is drawn
 * once and flipped for the other hand, which is what keeps the shipped set to
 * six files rather than twelve. A style whose mirror image would read wrong
 * says `mirrorable: false` and names `leftAsset` and `rightAsset` instead;
 * nothing forces that duplication on the rest (docs/HAND_STYLES.md,
 * "Mirroring").
 */
export const HAND_STYLES = Object.freeze({
  relaxed: Object.freeze({ id: 'relaxed', label: 'Relaxed', asset: 'relaxed', mirrorable: true }),
  open: Object.freeze({ id: 'open', label: 'Open', asset: 'open', mirrorable: true }),
  fist: Object.freeze({ id: 'fist', label: 'Fist', asset: 'fist', mirrorable: true }),
  point: Object.freeze({ id: 'point', label: 'Point', asset: 'point', mirrorable: true }),
  thumbsUp: Object.freeze({ id: 'thumbsUp', label: 'Thumbs up', asset: 'thumbs-up', mirrorable: true }),
  peace: Object.freeze({ id: 'peace', label: 'Peace', asset: 'peace', mirrorable: true })
});

/** The styles in the order the picker lays them out. */
export const HAND_STYLE_IDS = Object.freeze(Object.keys(HAND_STYLES));

/** The style list as records, for a caller that wants to iterate the registry. */
export const HAND_STYLE_LIST = Object.freeze(HAND_STYLE_IDS.map((id) => HAND_STYLES[id]));

/** The style a hand rests on, and the one every unknown name falls back to. */
export const DEFAULT_HAND_STYLE = 'relaxed';

/**
 * Names an older project, a preset or a hurried author may use for a style.
 *
 * The former 2D drawing ids are here (`palmOpen` → `open`), and so are the
 * pose names the deforming hand carried (`spread`, `grip`, `victory`). A wave
 * is an open hand and a rotation clip, not a picture of its own; a relaxed
 * hand is the rest drawing; a grab is the fist. Anything a turn or a
 * translation can say stays an animation, so the registry does not grow a
 * style for it.
 */
export const HAND_STYLE_ALIASES = Object.freeze({
  // the former 2D drawing ids
  sideopen: 'relaxed', palmopen: 'open', frontfist: 'fist',
  // rest
  relax: 'relaxed', rest: 'relaxed', neutral: 'relaxed', idle: 'relaxed',
  side: 'relaxed', profile: 'relaxed', sideleft: 'relaxed', sideright: 'relaxed',
  // open
  palm: 'open', flat: 'open', spread: 'open', stop: 'open', front: 'open', palmup: 'open',
  wave: 'open', hello: 'open', hi: 'open', high5: 'open', highfive: 'open',
  // closed
  grab: 'fist', grip: 'fist', hold: 'fist', punch: 'fist', clench: 'fist', closed: 'fist',
  // signs
  pointing: 'point', pointat: 'point', index: 'point', finger: 'point',
  thumbup: 'thumbsUp', thumbsup: 'thumbsUp', like: 'thumbsUp', yes: 'thumbsUp',
  victory: 'peace', v: 'peace', two: 'peace'
});

/** The ids a library holds, from a library of records or of plain ids. */
const libraryIds = (among) => (Array.isArray(among)
  ? among.map((entry) => (typeof entry === 'string' ? entry : entry?.id)).filter(Boolean)
  : null);

/**
 * A style id as the registry knows it, following aliases; `null` when it knows
 * none.
 *
 * `among` is a hand's own library, when there is one: a hand that has been
 * drawn with four of the six styles answers for those four, so a name it does
 * not hold resolves to nothing and the caller falls back to a style the hand
 * actually has rather than to a registry entry it never drew.
 */
export function handStyleId(value, among = null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const own = libraryIds(among);
  const holds = (id) => (own ? own.includes(id) : Object.hasOwn(HAND_STYLES, id));
  if (holds(raw)) return raw;
  const alias = HAND_STYLE_ALIASES[raw] || HAND_STYLE_ALIASES[raw.toLowerCase()];
  return alias && holds(alias) ? alias : null;
}

/** The registry's record for a style, when it has one. */
export const handStyle = (value) => HAND_STYLES[handStyleId(value)] || null;

/** A hand's own record for a name, when its library holds one. */
const ownStyle = (value, among) =>
  (Array.isArray(among) ? among : []).find((entry) => entry?.id === handStyleId(value, among)) || null;

/**
 * What to call a style on screen: the hand's own label, the registry's, or the
 * id itself.
 *
 * A hand's own label wins, and the registry answers for anything the hand has
 * not drawn -- which is how a picker offers a style by name before it exists.
 */
export function handStyleLabel(value, among = null) {
  const own = ownStyle(value, among);
  return own?.label || own?.name || handStyle(value)?.label || (typeof value === 'string' ? value : '');
}

/* ── The resolver (docs/HAND_STYLES.md, "Resolving a style") ───────────────── */

/**
 * Said once per unknown name rather than once per frame: a style that is not
 * there is an authoring mistake worth reading, and a render loop that repeats
 * it a thousand times a second is not.
 */
const warned = new Set();
const warnUnknown = (value) => {
  const key = String(value);
  if (warned.has(key)) return;
  warned.add(key);
  globalThis.console?.warn?.(`[boop] unknown hand style ${JSON.stringify(key)} — falling back to "${DEFAULT_HAND_STYLE}".`);
};

/** Forget what has been warned about, so a test can watch the warning again. */
export const resetHandStyleWarnings = () => warned.clear();

/**
 * Everything a renderer needs to put a style on screen: which drawing, and
 * whether it is flipped.
 *
 * ```js
 * resolveHandStyle('open', 'right')   // { id: 'open', asset: 'open', flipX: true }
 * resolveHandStyle('nonsense')        // { id: 'relaxed', asset: 'relaxed', flipX: false, fallback: true }
 * ```
 *
 * No angle, no view, no interpolation: a style is a name and a side, and this
 * is the whole of the logic between them and a file. An unknown name never
 * stops the render — it falls back to the rest style and says so once
 * (docs/HAND_STYLES.md, "Fallback").
 *
 * @param {?string} style the style asked for
 * @param {'left'|'right'} side which hand it is for
 * @param {?Array} among the hand's own library, when the caller has one
 * @returns {{id: string, asset: string, flipX: boolean, mirrorable: boolean, fallback: boolean}}
 */
export function resolveHandStyle(style, side = 'left', among = null) {
  const hand = handSideId(side);
  const asked = handStyleId(style, among);
  const fallback = !asked;
  if (fallback && style) warnUnknown(style);
  const id = asked || handStyleId(DEFAULT_HAND_STYLE, among) || DEFAULT_HAND_STYLE;
  const record = HAND_STYLES[id] || HAND_STYLES[DEFAULT_HAND_STYLE];
  const mirrorable = record.mirrorable !== false;
  return {
    id,
    // One drawing flipped for the other hand, or a drawing of its own per side.
    asset: mirrorable ? record.asset : (hand === 'right' ? (record.rightAsset || record.asset) : (record.leftAsset || record.asset)),
    flipX: mirrorable && hand === 'right',
    mirrorable,
    fallback
  };
}

/* ── States ────────────────────────────────────────────────────────────────── */

/**
 * A hand's state as everything downstream expects it: which hand, which style,
 * where it is, how big, which way round and whether it is on screen.
 *
 * These seven fields are the whole model (docs/HAND_STYLES.md, "The model").
 * There is nothing here that deforms a drawing, because nothing does.
 *
 * `library` is the hand's own styles, when the caller has them, so an unknown
 * name lands on a style the hand actually holds rather than on a registry
 * entry it never drew.
 */
export function normalizeHandState(source = {}, side = 'left', library = null) {
  const list = Array.isArray(library) ? library : null;
  const first = libraryIds(list)?.[0] || DEFAULT_HAND_STYLE;
  return {
    side: handSideId(source?.side ?? side),
    // `drawing` and `pose` are what older files called it.
    style: handStyleId(source?.style ?? source?.drawing ?? source?.pose, list) || first,
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    rotation: finite(source?.rotation, 0),
    scale: finite(source?.scale, 1),
    flipX: source?.flipX === true,
    visible: source?.visible !== false
  };
}

/**
 * The turn a cartoon hand reads well at (docs/HAND_STYLES.md, "Rotation").
 *
 * A recommendation for whoever is animating, not a limit the engine imposes:
 * a drawing turned much past this stops reading as a hand turning and starts
 * reading as a picture rotating, because it is one.
 */
export const HAND_ROTATION_ADVICE = Object.freeze({ min: -35, max: 35 });

/** Whether a turn is inside the range a static drawing carries comfortably. */
export const handRotationIsComfortable = (degrees) =>
  Math.abs(finite(degrees, 0)) <= HAND_ROTATION_ADVICE.max;
