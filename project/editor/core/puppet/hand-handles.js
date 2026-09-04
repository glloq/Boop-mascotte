/**
 * Hand handles (docs/DIRECT_CONTROLS.md, docs/HAND_RIGGING.md).
 *
 * A floating hand is placed with `handLX` / `handLY`, turned with
 * `handLRotation`, and it lives inside a reach ellipse. All of that was
 * numbers in a panel: eight fields for *where the hand can go*, and no way to
 * simply put it there.
 *
 * A hand handle is grabbed on the hand itself, and its range **is** the reach:
 * dragging to the edge of the ellipse is `1`, which is exactly what the
 * runtime means by it. So the gesture and the model agree without the author
 * having to know either.
 *
 * Pure: it reads the document and reports handles; the canvas draws them.
 */
import { handReachEllipse, SUGGESTED_HAND_POSES } from '../hands/hand-model.js';
import { HAND_DIGITS, artboardBox, handDigitTip } from '../sample/hand-artwork.js';
import { handDigitParameter, handFlipParameter, handGripParameter } from '../sample/hand-feature.js';
import { handPoseParameterName, normalizeHand } from '../../../runtime/runtime.js';
import { parameterAxis } from './puppet-handles.js';

const SIDE_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * One handle to place each hand, and one to turn it.
 *
 * A hand with no artwork has no handles: there is nothing on the canvas to
 * grab. Neither does a hand whose parameters the project does not carry.
 *
 * @param {object} document
 * @returns {object[]} handles in the same shape as the face's
 */
export function handPuppetHandles(document = {}) {
  const handles = [];
  for (const side of ['left', 'right']) {
    const stored = document.hands?.[side];
    if (!stored?.element || !document.elements?.[stored.element]) continue;
    const hand = normalizeHand(stored, side);
    const label = SIDE_LABEL[side];
    const x = parameterAxis(document.params, hand.parameters.x, `${label} across`);
    const y = parameterAxis(document.params, hand.parameters.y, `${label} up and down`);
    const ellipse = handReachEllipse(hand, document.elements);

    if (x || y) {
      handles.push({
        id: `hand-${side}`, label, hint: 'Drag the hand where it should reach',
        partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'centre',
        mode: 'drag', grid: false, side,
        x, y, orbit: null, invertY: false, throw: 1,
        // A span covers a parameter's whole range, min to max, while a reach is
        // a radius from rest — so the span is twice it, and dragging exactly
        // one radius puts the hand exactly on the edge of its ellipse.
        span: { x: Math.max(8, number(hand.reach.x, 40) * 2), y: Math.max(8, number(hand.reach.y, 40) * 2) },
        reach: ellipse ? { cx: ellipse.cx, cy: ellipse.cy, rx: ellipse.rx, ry: ellipse.ry, overshoot: ellipse.overshoot } : null
      });
    }

    // Everything below belongs to the hand rather than beside it: a hand with
    // seven handles of its own would bury the face it hangs next to. They are
    // the *members* of the hand's group, shown when it is opened out
    // (docs/DIRECT_CONTROLS.md).
    const group = `hand-${side}`;
    const member = (id, label, hint, axes) => ({
      id, label, hint, group,
      partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'centre',
      mode: 'drag', grid: false, side,
      x: null, y: null, orbit: null, invertY: false, throw: 0.6, span: null, reach: null, point: null, ...axes
    });

    const rotation = parameterAxis(document.params, hand.parameters.rotation, `${label} turn`);
    if (rotation) {
      handles.push(member(`hand-${side}-turn`, `Turn the ${label.toLowerCase()}`, 'Turn around the hand to rotate it',
        { at: 'right', mode: 'orbit', orbit: rotation, throw: 120 }));
    }
    // Closing every finger at once, and turning the hand over to show its back.
    const grip = parameterAxis(document.params, handGripParameter(side), `${label} grip`);
    if (grip) handles.push(member(`hand-${side}-grip`, `${label} grip`, 'Drag up to close the fingers, down to open them', { at: 'bottom', y: grip, invertY: true }));
    const flip = parameterAxis(document.params, handFlipParameter(side), `${label} turn over`);
    if (flip) handles.push(member(`hand-${side}-flip`, `${label} palm or back`, 'Drag sideways to turn the hand over', { at: 'left', x: flip }));

    // And one per finger, on the fingertip itself. The tip comes from the same
    // function that draws the outline, so it is on the finger at every pose.
    const box = artboardBox(document);
    for (const digit of HAND_DIGITS) {
      const axis = parameterAxis(document.params, handDigitParameter(side, digit.id), `${digit.id} curl`);
      if (!axis) continue;
      handles.push(member(`hand-${side}-${digit.id}`, `${label}: ${digit.id}`, `Drag up to bend the ${digit.id}`, {
        y: axis, invertY: true, throw: 0.5,
        point: handDigitTip(side, digit.id, { at: hand.anchor, box })
      }));
    }
  }
  return handles;
}

/** Whether a hand is being asked to go outside what its reach allows. */
export function handOutsideReach(values = {}, handle) {
  if (!handle?.x || !handle?.y) return false;
  const x = number(values[handle.x.control]), y = number(values[handle.y.control]);
  return Math.hypot(x, y) > 1;
}

/**
 * The poses a hand can strike, as a row of chips.
 *
 * A hand pose is a parameter the runtime raises: it deforms the neutral hand
 * through a shape key, or cross-fades to other artwork. A pose with neither is
 * a name and nothing else — so it says what it still needs rather than
 * pretending to work.
 *
 * The suggested poses the hand does not have yet come back too, as offers, so
 * one row covers both "strike this" and "add this".
 *
 * @returns {{id,name,ready,values,missing,added}[]}
 */
export function handPosePresets(document = {}, side = 'left') {
  const stored = document.hands?.[side];
  if (!stored?.element) return [];
  const hand = normalizeHand(stored, side);
  // A pose stored without its parameter still has one: the naming rule is the
  // runtime's own, and reactions raise poses through exactly the same name.
  const parameterOf = (pose) => pose.parameter || handPoseParameterName(side, pose.id);
  const rest = Object.fromEntries(hand.poses.map((pose) => [parameterOf(pose), 0]));
  const added = hand.poses.map((pose) => ({
    id: pose.id, name: pose.name || pose.id, added: true,
    ready: Boolean(pose.shapeKey || pose.variant),
    values: { ...rest, [parameterOf(pose)]: 1 },
    missing: pose.shapeKey || pose.variant ? null : 'a shape or its own artwork'
  }));
  const offers = SUGGESTED_HAND_POSES
    .filter((suggested) => !hand.poses.some((pose) => pose.id === suggested.id))
    .map((suggested) => ({ id: suggested.id, name: suggested.name, added: false, ready: false, values: {}, missing: null }));
  return added.concat(offers);
}

/** Putting every pose down, which is what "neutral" means for a hand. */
export function handPoseRest(document = {}, side = 'left') {
  const stored = document.hands?.[side];
  if (!stored?.element) return {};
  return Object.fromEntries(normalizeHand(stored, side).poses.map((pose) => [pose.parameter || handPoseParameterName(side, pose.id), 0]));
}
