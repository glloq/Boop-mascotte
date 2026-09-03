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
import { handReachEllipse } from '../hands/hand-model.js';
import { normalizeHand } from '../../../runtime/runtime.js';
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

    const rotation = parameterAxis(document.params, hand.parameters.rotation, `${label} turn`);
    if (rotation) {
      handles.push({
        id: `hand-${side}-turn`, label: `Turn the ${label.toLowerCase()}`, hint: 'Turn around the hand to rotate it',
        partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'bottom',
        mode: 'orbit', grid: false, side,
        x: null, y: null, orbit: rotation, invertY: false, throw: 120, span: null, reach: null
      });
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
