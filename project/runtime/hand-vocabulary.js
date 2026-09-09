/**
 * What a hand can be: a **side**, and a **drawing** (docs/HANDS_2D.md).
 *
 * ```text
 * side      which hand this is                left · right
 * drawing   which picture of it is on screen  sideOpen · palmOpen · frontFist · …
 * anim      how far that picture's own animation has played   0 … 1
 * ```
 *
 * A drawing is a whole picture somebody drew, named for what it shows. There
 * is no angle here and nothing chooses a picture from one: a hand shows the
 * drawing it is asked for, and its rotation turns that drawing exactly as it
 * turns any other artwork. The editor used to derive the picture from a
 * continuous facing axis, morphing between three tables; that machinery is
 * gone, along with the hands nobody had drawn that lived between its stops.
 *
 * A drawing may carry **one animation of its own** — its own little rig, over
 * the parts of that picture and nothing else: an open side hand closing into a
 * fist, a palm closing, a fist raising its thumb. It is optional. A drawing
 * with none simply ignores the animation parameter.
 *
 * Pure data and small pure functions: no DOM, no state, no assets.
 */
import { clamp, finite } from './numeric.js';

/* ── Sides ─────────────────────────────────────────────────────────────────── */

/** Which hand. One list, and the one place either half of the pair is named. */
export const HAND_SIDES = Object.freeze(['left', 'right']);

/** A side as the system knows it; anything unrecognised is the left hand. */
export const handSideId = (value) => (value === 'right' ? 'right' : 'left');

/** The letter a side's parameters are spelled with: `handLShow`, `handRShow`. */
export const handSideLetter = (side) => (handSideId(side) === 'right' ? 'R' : 'L');

/* ── The built-in drawings ─────────────────────────────────────────────────── */

/**
 * The pictures the editor can draw, and the animation each one carries.
 *
 * ```text
 * sideOpen    an open hand seen edge-on      closes into a fist
 * palmOpen    an open hand, palm to us       closes
 * frontFist   a fist, facing us              raises its thumb
 * point       one finger out                 bends the finger
 * peace       two fingers up                 closes
 * ```
 *
 * A list of pictures, not a grid of poses times views. Each is drawn once and
 * stands on its own, so adding a sixth is adding one drawing — nothing else in
 * the system grows by it. A set that ships its own pictures names them itself;
 * this catalogue is only what the built-in generator draws.
 *
 * The order is the one the picker beside the face lays out, and it runs from
 * open to closed and then to the two signs, so the column reads as a hand
 * shutting rather than as a bag of gestures.
 */
export const HAND_DRAWINGS = Object.freeze([
  Object.freeze({ id: 'sideOpen', name: 'Side, open', anim: 'Close the fist' }),
  Object.freeze({ id: 'palmOpen', name: 'Palm, open', anim: 'Close the hand' }),
  Object.freeze({ id: 'frontFist', name: 'Front fist', anim: 'Thumb up' }),
  Object.freeze({ id: 'point', name: 'Pointing', anim: 'Bend the finger' }),
  Object.freeze({ id: 'peace', name: 'Peace', anim: 'Close the hand' })
]);

/** The drawing a hand rests on, and the one everything falls back to. */
export const DEFAULT_HAND_DRAWING = 'palmOpen';

/**
 * Names a preset, an older project or a hurried author may use for a drawing.
 *
 * A wave is an open palm and a rotation clip, not a picture of its own; a
 * relaxed hand is the side view; a grab is the fist. Anything a turn or a
 * translation can say stays an animation, so the catalogue does not grow a
 * picture for it.
 */
export const HAND_DRAWING_ALIASES = Object.freeze({
  open: 'palmOpen', palm: 'palmOpen', flat: 'palmOpen', spread: 'palmOpen', stop: 'palmOpen',
  wave: 'palmOpen', hello: 'palmOpen', hi: 'palmOpen', front: 'palmOpen',
  relaxed: 'sideOpen', relax: 'sideOpen', rest: 'sideOpen', neutral: 'sideOpen', idle: 'sideOpen',
  side: 'sideOpen', profile: 'sideOpen', sideRight: 'sideOpen', sideLeft: 'sideOpen',
  fist: 'frontFist', grab: 'frontFist', grip: 'frontFist', hold: 'frontFist', punch: 'frontFist',
  thumbsup: 'frontFist', thumbsUp: 'frontFist', thumbup: 'frontFist',
  pointing: 'point', pointat: 'point', index: 'point', finger: 'point',
  victory: 'peace', v: 'peace', two: 'peace'
});

const DRAWING_BY_ID = new Map(HAND_DRAWINGS.map((drawing) => [drawing.id, drawing]));

/**
 * A drawing id as the catalogue knows it, following aliases; `null` when it
 * knows none.
 *
 * `among` is a hand's own list of drawings, when there is one: a set that
 * brings its own pictures answers for its own names first, so a custom
 * `wave.svg` is that drawing rather than an alias of the palm.
 */
export function handDrawingId(value, among = null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  // With a list to answer from, that list is the whole world: a name it does
  // not hold resolves to nothing, so a caller falls back to a picture the set
  // actually drew rather than to a catalogue entry it never did.
  const own = Array.isArray(among) ? among.map((drawing) => (typeof drawing === 'string' ? drawing : drawing?.id)) : null;
  const holds = (id) => (own ? own.includes(id) : DRAWING_BY_ID.has(id));
  if (holds(raw)) return raw;
  const alias = HAND_DRAWING_ALIASES[raw] || HAND_DRAWING_ALIASES[raw.toLowerCase()];
  return alias && holds(alias) ? alias : null;
}

/** The catalogue's record for a drawing, when it has one. */
export const handDrawing = (value) => DRAWING_BY_ID.get(handDrawingId(value)) || null;

/** A set's own record for a name, when the set holds one. */
const ownDrawing = (value, among) =>
  (Array.isArray(among) ? among : []).find((drawing) => drawing?.id === handDrawingId(value, among)) || null;

/**
 * What to call a drawing on screen: its own name, the catalogue's, or its id.
 *
 * A set's own name wins, and the catalogue answers for anything the set has
 * not drawn -- which is how a picker offers a picture by name before it exists.
 */
export function handDrawingName(value, among = null) {
  return ownDrawing(value, among)?.name || handDrawing(value)?.name || (typeof value === 'string' ? value : '');
}

/** The animation a drawing carries, or `null` when it carries none. */
export function handDrawingAnim(value, among = null) {
  return ownDrawing(value, among)?.anim || handDrawing(value)?.anim || null;
}

/* ── States ────────────────────────────────────────────────────────────────── */

/**
 * A hand's state as everything downstream expects it: which hand, which
 * drawing, how far its animation has played, where it is and how big.
 *
 * `drawings` is the hand's own list, when the caller has one, so an unknown
 * name lands on the drawing the set actually rests on rather than on a
 * catalogue entry the set never drew.
 */
export function normalizeHandState(source = {}, side = 'left', drawings = null) {
  const list = Array.isArray(drawings) ? drawings : null;
  const first = list?.[0]?.id || DEFAULT_HAND_DRAWING;
  return {
    side: handSideId(source?.side ?? side),
    drawing: handDrawingId(source?.drawing, list) || first,
    anim: clamp(finite(source?.anim, 0), 0, 1),
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    rotation: finite(source?.rotation, 0),
    scale: finite(source?.scale, 1),
    flipX: source?.flipX === true,
    visible: source?.visible !== false
  };
}
