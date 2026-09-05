/**
 * The mouth control rig (docs/FACE_CONTROL_RIG.md, CR-27 … CR-31).
 *
 * ```text
 *       ╭────────────────────╮
 *       │ ◇──────●──────◇    │   corners, centre
 *       ╰────────◆───────────╯
 *                │
 *               JAW
 * ```
 *
 * `smile` is one number, and a face that can only smile symmetrically has one
 * expression where it should have a dozen. A smirk, a grimace, a lip pulled by
 * a word — every one of them is *the two corners disagreeing*, and none of them
 * is reachable by turning a single slider further.
 *
 * The eyes solved this with side offsets on their bindings, because an eye is
 * two pieces of artwork. A mouth is **one closed path**, so its two corners
 * cannot be two bindings: they are two **pins** on the same shape
 * (`runtime/rig-pins.js`), each holding its own end of the lip line and letting
 * the artwork between them follow.
 *
 * ```text
 * smile 0.3   both corners up a little      (the shape key: symmetric)
 * smileRight  the right one further still   (the pin: asymmetric)
 * ```
 *
 * The two compose because they are offsets on the same numeric vector, which is
 * the same reason a warped mouth can still carry shape keys.
 *
 * **Mouth lock** (CR-31) is the other half of a talking mouth. A jaw that drops
 * takes the lower lip with it, which is right for a yawn and wrong for tension,
 * for anticipation, and for every cartoon line delivered through closed teeth.
 * `mouthLock` is how much the lips refuse to follow: it lives inside the pin's
 * own expression, so nothing else in the pipeline has to know about it.
 */
import { normalizeRigPins } from '../../../runtime/runtime.js';

/** The offsets that let the two corners disagree, and the lock that holds the lips. */
export const MOUTH_RIG_PARAMETERS = Object.freeze({
  smileLeft: Object.freeze({ type: 'number', min: -2, max: 2, default: 0, value: 0 }),
  smileRight: Object.freeze({ type: 'number', min: -2, max: 2, default: 0, value: 0 }),
  mouthWidthLeft: Object.freeze({ type: 'number', min: -2, max: 2, default: 0, value: 0 }),
  mouthWidthRight: Object.freeze({ type: 'number', min: -2, max: 2, default: 0, value: 0 }),
  mouthLock: Object.freeze({ type: 'number', min: 0, max: 1, default: 0, value: 0 })
});

/**
 * How far a corner travels at a full offset, as a fraction of the mouth's
 * **width**.
 *
 * Not its height: a closed mouth is a thin lens a few units tall, and a rig
 * derived from that would move its corners by nothing at all. A mouth's
 * expressive travel scales with how wide it is, which is also what makes the
 * numbers right on a 40px face and on a 2000px one.
 */
const CORNER_RISE = 0.1;
const CORNER_SPREAD = 0.08;
/** How far the jaw takes the lower lip with it, before the lock has its say. */
const JAW_DROP = 0.5;

const round = (value) => Math.round(Number(value) * 1000) / 1000;

/**
 * The pins a mouth is held by, from the box the artwork occupies.
 *
 * Three, and not one per control point: a corner, the other corner, and the
 * lower lip the jaw pulls on. Everything else on the mouth is between them and
 * follows, which is what a pin is for.
 *
 * @param {object} options
 * @param {string} options.target the element that draws the lips
 * @param {{x,y,width,height}} options.box its box, in artwork units
 * @returns {object[]} pin records, ready for `document.rigPins`
 */
export function generateMouthPins({ target, box, prefix = 'mouth' } = {}) {
  if (!target || !box?.width || !box?.height) return [];
  const rise = box.width * CORNER_RISE, spread = box.width * CORNER_SPREAD, drop = box.width * JAW_DROP;
  const middle = box.y + box.height / 2;
  const corner = (side, x, outward) => ({
    id: `${prefix}-corner-${side}`,
    target,
    // Soft rather than sliding: a corner moves in two directions at once — up
    // to smile and outwards to widen — and a slide would collapse both onto
    // one axis. What keeps it on the lip line is the artwork between the two
    // corners following it, which is what the reach is for.
    type: 'soft',
    falloff: 'smooth',
    position: { x: round(x), y: round(middle) },
    // Wide but shallow: a circular reach that covers a corner also covers the
    // upper lip, and a mouth is ten times wider than it is tall.
    radius: { x: round(box.width * 0.42), y: round(box.height * 2) },
    strength: 1,
    direction: { x: outward, y: 0 },
    motion: {
      // Up is negative, and a corner rises as its own offset rises.
      y: { expression: `smile${side === 'left' ? 'Left' : 'Right'}`, amplitude: round(-rise), offset: 0 },
      x: { expression: `mouthWidth${side === 'left' ? 'Left' : 'Right'}`, amplitude: round(spread * outward), offset: 0 }
    }
  });
  return [
    corner('left', box.x, -1),
    corner('right', box.x + box.width, 1),
    {
      id: `${prefix}-lower-lip`,
      target,
      type: 'soft',
      falloff: 'smooth',
      position: { x: round(box.x + box.width / 2), y: round(box.y + box.height) },
      // Shallow enough that the upper lip is outside it: a jaw drops the lower
      // lip, and a jaw that took the whole mouth with it would be a hinge.
      radius: { x: round(box.width * 0.6), y: round(box.height * 0.6) },
      strength: 1,
      direction: { x: 0, y: 1 },
      motion: {
        // The lock lives in the expression: `mouthLock` at 1 and the lips stay
        // together however far the jaw drops (CR-31).
        y: { expression: 'jawOpen - jawOpen * mouthLock', amplitude: round(drop), offset: 0 }
      }
    }
  ];
}

/** Whether a project already carries the mouth rig, so a panel can say so. */
export const hasMouthRig = (document = {}, prefix = 'mouth') =>
  (document.rigPins || []).some((pin) => String(pin?.id).startsWith(`${prefix}-corner-`));

/** Take it away again, leaving every pin an author placed by hand. */
export const withoutMouthRig = (document = {}, prefix = 'mouth') =>
  (document.rigPins || []).filter((pin) => !String(pin?.id).startsWith(`${prefix}-corner-`) && !String(pin?.id).startsWith(`${prefix}-lower-lip`));

/**
 * Give a mouth two corners of its own, and a lip the jaw can pull on.
 *
 * The parameters rest at 0 and the lock rests at 0, so a mouth that has just
 * been given the rig behaves exactly as it did: symmetric, and following the
 * jaw as it always has.
 */
export function enableMouthRig(rig, { target, box, prefix = 'mouth' } = {}) {
  const pins = generateMouthPins({ target, box, prefix });
  if (!pins.length) throw new Error('The mouth needs a piece of artwork and a size before it can be pinned.');
  rig.params ||= {};
  for (const [name, parameter] of Object.entries(MOUTH_RIG_PARAMETERS)) {
    if (!rig.params[name]) rig.params[name] = structuredClone(parameter);
    for (const pose of Object.values(rig.states || {})) if (!(name in pose)) pose[name] = parameter.default;
  }
  rig.rigPins = normalizeRigPins({ rigPins: [...withoutMouthRig(rig, prefix), ...pins] });
  return rig.rigPins;
}

/**
 * What the mouth is doing, in the words an animator uses.
 *
 * A rig that can be asymmetric needs a readout that says so: `smile 0.5` on
 * its own no longer describes the mouth, and an author reading one number
 * would not know the other corner had been moved.
 */
export function mouthReadout(values = {}) {
  const number = (name) => (Number.isFinite(Number(values[name])) ? Number(values[name]) : 0);
  const left = round(number('smile') + number('smileLeft'));
  const right = round(number('smile') + number('smileRight'));
  const lock = number('mouthLock');
  if (Math.abs(left - right) < 0.01) {
    const shared = round(left);
    return `${shared > 0 ? 'smiling' : shared < 0 ? 'frowning' : 'neutral'}${lock ? ` · lips ${Math.round(lock * 100)}% locked` : ''}`;
  }
  return `${left > right ? 'left' : 'right'} corner higher · ${left} / ${right}${lock ? ` · lips ${Math.round(lock * 100)}% locked` : ''}`;
}
