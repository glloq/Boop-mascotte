/**
 * The eyebrow's own shape (docs/FACE_CONTROL_RIG.md, CR-19).
 *
 * ```text
 *   ◇────●────◇
 * outer centre inner
 * ```
 *
 * A brow that can only **raise** and **turn** is a rigid bar hinged in the
 * middle, and half of what eyebrows do is not available to it. Worry is the
 * inner ends going up while the outer ends stay put. Anger is the inner ends
 * going down. Neither is a rotation, and neither is a translation: they are the
 * *ends of one brow disagreeing*, which is the same sentence the mouth's two
 * corners answer — and it gets the same answer, two pins on one drawn path.
 *
 * The three points the roadmap draws are two pins and the artwork between them.
 * A centre pin would hold what the raise and the tilt already move, and a pin
 * that fights a binding is a rig nobody can predict.
 *
 * Each end is a **shared movement plus a side offset**, the way every other
 * pair of sides in this rig is built (docs/SEMANTIC_RIGGING.md): `browInner`
 * lifts both inner ends, which is worry with one number, and `browInnerLeft`
 * lifts one of them, which is the eyebrow half of a smirk. Linking the brows
 * makes the end controls write the shared movement, exactly as it does for the
 * eyelids, the pupils and the mouth's corners (CR-10).
 *
 * These are **detailed** controls: a face carrying two brow controls is a face
 * an author can pose, and one carrying six is one they have to read.
 */
import { normalizeRigPins } from '../../../runtime/runtime.js';

const shared = Object.freeze({ type: 'number', min: -1, max: 1, default: 0, value: 0 });
// Wider than the movement it offsets, for the same reason the mouth's corners
// are: an offset has to be able to undo a full shared movement and go the other
// way, or "both up except this one" is a pose the rig cannot reach.
const offset = Object.freeze({ type: 'number', min: -2, max: 2, default: 0, value: 0 });

/** What each end of a brow can be told to do, on its own or as a pair. */
export const BROW_RIG_PARAMETERS = Object.freeze({
  browInner: shared,
  browInnerLeft: offset,
  browInnerRight: offset,
  browOuter: shared,
  browOuterLeft: offset,
  browOuterRight: offset
});

/**
 * How far an end travels, as a fraction of the brow's **width**.
 *
 * A brow is a stroke a few units tall and forty wide; deriving the travel from
 * its height would move the ends by nothing. The same reasoning, and the same
 * ratio, as the mouth's corners.
 */
const END_RISE = 0.22;

const round = (value) => Math.round(Number(value) * 1000) / 1000;

/**
 * The two pins one brow is held by.
 *
 * `inner` is the end nearer the middle of the face, which is the end that
 * carries the expression — so which side of the box it is on depends on which
 * brow this is.
 *
 * @param {object} options
 * @param {string} options.target the element that draws this brow
 * @param {{x,y,width,height}} options.box its box, in artwork units
 * @param {'left'|'right'} options.side which brow it is
 */
export function generateBrowPins({ target, box, side = 'left', prefix = 'brow' } = {}) {
  if (!target || !box?.width || !box?.height) return [];
  const rise = box.width * END_RISE;
  const middle = box.y + box.height / 2;
  const Side = side === 'right' ? 'Right' : 'Left';
  // The left brow's inner end is its right-hand end, and the right brow's is
  // its left-hand one: "inner" means nearer the nose, not nearer the origin.
  const inner = side === 'right' ? box.x : box.x + box.width;
  const outer = side === 'right' ? box.x + box.width : box.x;
  const end = (name, x, control) => ({
    id: `${prefix}-${side}-${name}`,
    target,
    // Directional: an end of a brow goes up and down and never sideways, and a
    // pin that only has one axis cannot be dragged off the face by accident.
    type: 'directional',
    falloff: 'smooth',
    position: { x: round(x), y: round(middle) },
    // Wide enough that the middle of the brow follows a little and the *other*
    // end does not at all. A raised end whose middle stayed exactly put reads as
    // a kink rather than an eyebrow, and one that took the far end with it is
    // the rigid bar this whole rig exists to stop being.
    radius: { x: round(box.width * 0.9), y: round(Math.max(box.height, box.width * 0.55)) },
    strength: 1,
    direction: { x: 0, y: -1 },
    // Shared plus side, summed in the pin's own expression: the same two
    // numbers a bound property would add, added in the one place that can see
    // both. Up is negative, so the amplitude is.
    motion: { y: { expression: `${control} + ${control}${Side}`, amplitude: round(-rise), offset: 0 } }
  });
  return [end('inner', inner, 'browInner'), end('outer', outer, 'browOuter')];
}

/** Whether a project already carries the brow rig, so a panel can say so. */
export const hasBrowRig = (document = {}, prefix = 'brow') =>
  (document.rigPins || []).some((pin) => String(pin?.id).startsWith(`${prefix}-left-`) || String(pin?.id).startsWith(`${prefix}-right-`));

/** Take it away again, leaving every pin an author placed by hand. */
export const withoutBrowRig = (document = {}, prefix = 'brow') =>
  (document.rigPins || []).filter((pin) => !String(pin?.id).startsWith(`${prefix}-left-`) && !String(pin?.id).startsWith(`${prefix}-right-`));

/**
 * Give both brows ends of their own.
 *
 * Every offset rests at 0, so a brow that has just been given the rig behaves
 * exactly as it did: it raises and it turns, and nothing else has changed.
 */
export function enableBrowRig(rig, { left, right, prefix = 'brow' } = {}) {
  const pins = [
    ...generateBrowPins({ ...left, side: 'left', prefix }),
    ...generateBrowPins({ ...right, side: 'right', prefix })
  ];
  if (!pins.length) throw new Error('Each eyebrow needs a piece of artwork and a size before it can be pinned.');
  rig.params ||= {};
  for (const [name, parameter] of Object.entries(BROW_RIG_PARAMETERS)) {
    if (!rig.params[name]) rig.params[name] = structuredClone(parameter);
    for (const pose of Object.values(rig.states || {})) if (!(name in pose)) pose[name] = parameter.default;
  }
  rig.rigPins = normalizeRigPins({ rigPins: [...withoutBrowRig(rig, prefix), ...pins] });
  return rig.rigPins;
}

/**
 * What the brows are doing, in the words an animator uses.
 *
 * Two numbers per brow no longer describe a face: `browRaise 0.5` says nothing
 * about whether the inner ends went with it, and worry and anger are told apart
 * by exactly that.
 */
export function browReadout(values = {}) {
  const number = (name) => (Number.isFinite(Number(values[name])) ? Number(values[name]) : 0);
  const end = (which, side) => round(number(`brow${which}`) + number(`brow${which}${side}`));
  const inner = [end('Inner', 'Left'), end('Inner', 'Right')];
  const outer = [end('Outer', 'Left'), end('Outer', 'Right')];
  const raise = round(number('browRaise'));
  const words = [];
  if (Math.abs(inner[0] - inner[1]) > 0.01 || Math.abs(outer[0] - outer[1]) > 0.01) {
    words.push(`brows apart · inner ${inner[0]} / ${inner[1]}`);
  } else if (inner[0] > 0.01 && outer[0] < inner[0] - 0.01) words.push('worried');
  else if (inner[0] < -0.01 && outer[0] > inner[0] + 0.01) words.push('angry');
  else if (Math.abs(inner[0]) > 0.01 || Math.abs(outer[0]) > 0.01) words.push(`ends ${inner[0]} / ${outer[0]}`);
  if (raise) words.push(`${raise > 0 ? 'raised' : 'lowered'} ${Math.abs(raise)}`);
  return words.length ? words.join(' · ') : 'at rest';
}
