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
import { handPoseDrive, handReachEllipse, SUGGESTED_HAND_POSES } from '../hands/hand-model.js';
import { HAND_DIGITS, artboardBox, handDigitTip, handPartId, handWristPoint } from '../sample/hand-artwork.js';
import { handDigitParameter, handFacingParameter, handFlipParameter, handGripParameter } from '../sample/hand-feature.js';
import { HAND_SIDES, handPoseParameterName, inverseElementTransform, normalizeHand } from '../../../runtime/runtime.js';
import { parameterAxis } from './puppet-handles.js';

const SIDE_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Where the hand's outline actually sits, in the artwork's own coordinates.
 *
 * The anchor is stored in the *parent's* coordinates, so on a body that
 * carries a transform of its own the two are not the same point.
 * `handReachEllipse` is the one place that mapping lives, and the drawn anchor
 * is its centre less the rest offset — the hand hangs from the anchor and
 * rests a little away from it. Identical to the stored anchor whenever the
 * body has no transform, which is every project that has never been imported.
 */
export function handDrawnAnchor(hand, elements = {}) {
  const ellipse = handReachEllipse(hand, elements);
  return ellipse
    ? { x: ellipse.cx - hand.restOffset.x, y: ellipse.cy - hand.restOffset.y }
    : { x: number(hand?.anchor?.x), y: number(hand?.anchor?.y) };
}

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
  for (const side of HAND_SIDES) {
    const stored = document.hands?.[side];
    if (!stored?.element || !document.elements?.[stored.element]) continue;
    const hand = normalizeHand(stored, side);
    const label = SIDE_LABEL[side];
    const x = parameterAxis(document.params, hand.parameters.x, `${label} across`);
    const y = parameterAxis(document.params, hand.parameters.y, `${label} up and down`);
    const ellipse = handReachEllipse(hand, document.elements);
    const box = artboardBox(document);
    const drawn = handDrawnAnchor(hand, document.elements);
    // A generated hand is held by its cuff: the anchor sits at the middle of
    // the palm, and a handle on top of it would take every drag meant for the
    // other. Any other artwork is grabbed at its centre, as before.
    const wrist = document.elements?.[handPartId(side, 'cuff')] ? handWristPoint(side, { at: drawn, box }) : null;

    if (x || y) {
      handles.push({
        id: `hand-${side}`, label, hint: 'Drag the hand where it should reach',
        partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'centre', point: wrist,
        // A hand is *reaching for a place*, which is a target rather than two
        // movements that happen to share a widget (docs/FACE_CONTROL_RIG.md).
        controller: 'target', visualParent: 'hand-rig',
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
      id, label, hint, group, visualParent: 'hand-rig',
      partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'centre',
      mode: 'drag', grid: false, side,
      x: null, y: null, orbit: null, invertY: false, throw: 0.6, span: null, reach: null, point: null, ...axes
    });

    const rotation = parameterAxis(document.params, hand.parameters.rotation, `${label} turn`);
    if (rotation) {
      handles.push(member(`hand-${side}-turn`, `Turn the ${label.toLowerCase()}`, 'Turn around the hand to rotate it',
        { at: 'right', mode: 'orbit', orbit: rotation, throw: 120, controller: 'arc' }));
    }
    // Closing every finger at once, and turning the hand over to show its back.
    const grip = parameterAxis(document.params, handGripParameter(side), `${label} grip`);
    if (grip) handles.push(member(`hand-${side}-grip`, `${label} grip`, 'Drag up to close the fingers, down to open them', { at: 'bottom', y: grip, invertY: true }));
    const flip = parameterAxis(document.params, handFlipParameter(side), `${label} turn over`);
    if (flip) handles.push(member(`hand-${side}-flip`, `${label} palm or back`, 'Drag sideways to turn the hand over', { at: 'left', x: flip }));
    // Palm, side or far side: the facing axis a hand made of parts turns through.
    const facing = parameterAxis(document.params, handFacingParameter(side), `${label} facing`);
    if (facing) handles.push(member(`hand-${side}-facing`, `${label} palm or side`, 'Drag sideways to turn the hand towards its side', { at: 'left', x: facing }));

    // And one per finger, on the fingertip itself. The tip comes from the same
    // function that draws the outline, placed where the outline was placed, so
    // it is on the finger at every pose.
    for (const digit of HAND_DIGITS) {
      const axis = parameterAxis(document.params, handDigitParameter(side, digit.id), `${digit.id} curl`);
      if (!axis) continue;
      handles.push(member(`hand-${side}-${digit.id}`, `${label}: ${digit.id}`, `Drag up to bend the ${digit.id}`, {
        y: axis, invertY: true, throw: 0.5,
        point: handDigitTip(side, digit.id, { at: drawn, box })
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
  const added = hand.poses.map((pose) => {
    // Its own key or artwork, or anything the parameter drives on the parts.
    const drive = handPoseDrive(document, pose, side);
    return {
      id: pose.id, name: pose.name || pose.id, added: true,
      ready: Boolean(drive),
      values: { ...rest, [parameterOf(pose)]: 1 },
      missing: drive ? null : 'a shape or its own artwork'
    };
  });
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

/* ── Hand mode (VNX-19, docs/VNEXT_ROADMAP.md) ─────────────────────────────
 *
 * ```text
 *      ┌───────────┐
 *      │   HAND    │
 *      └───────────┘
 *           ●            rest  = anchor + restOffset
 *      ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒◆       ◆ the grip, on the reach ellipse itself
 *           │
 *         anchor
 * ```
 *
 * The handles above drive *parameters*: they pose a hand that is already
 * rigged, live and non-destructively. The anchor and the reach are not that.
 * They are **document** fields — where the hand hangs from, and how far it may
 * go — so what is below produces values for a command, never a live parameter,
 * and one whole drag is one undo step.
 *
 * Everything here is pure and DOM-free: the canvas owns the pointer, this owns
 * what the gesture means and when it is allowed to write.
 */

/**
 * A reach of zero is a hand that cannot move, and a negative one is an ellipse
 * turned inside out. Hand Setup's own fields already say `min="1"`; a drag has
 * to agree with them or the panel and the canvas disagree about the same hand.
 */
export const HAND_REACH_MINIMUM = 1;

/** The two things hand mode lets an author grab. */
export const HAND_RIG_PARTS = Object.freeze(['anchor', 'reach']);

/** Setting a hand up is a Rig job, so hand mode is drawn there and nowhere else. */
export const HAND_RIG_WORKSPACE = 'rig';

/**
 * Which hand, if any, hand mode is drawing.
 *
 * A reach ellipse round every mascot in every task is clutter on every canvas
 * an author ever looks at, so the overlay is limited twice over: to the task
 * where a hand is set up, and to one hand within it. There are two ways to name
 * that hand — Hand Setup saying which side it has open, and the hand whose own
 * artwork is selected — and neither replaces the other; the panel is simply the
 * louder of the two. A side whose artwork is gone names nothing either way.
 *
 * @param {{workspace: string, requested: ?string, selectedId: ?string, document: object}} view
 * @returns {'left'|'right'|null}
 */
export function handRigSide({ workspace = null, requested = null, selectedId = null, document = {} } = {}) {
  if (workspace !== HAND_RIG_WORKSPACE) return null;
  const hands = document?.hands || {};
  const drawn = (side) => Boolean(hands[side]?.element && document?.elements?.[hands[side].element]);
  if (requested && drawn(requested)) return requested;
  return HAND_SIDES.find((side) => drawn(side) && handOwnsElement(document, side, selectedId)) || null;
}

/**
 * Whether `id` is this hand's artwork, or a part inside it.
 *
 * A hand made of parts is a group, and a click on the canvas selects the
 * finger under the pointer rather than the group. Selecting any part of a hand
 * is selecting the hand: the layer tree says which group a part sits in.
 */
export function handOwnsElement(document = {}, side = 'left', id = null) {
  const element = document?.hands?.[side]?.element;
  if (!element || !id) return false;
  if (element === id) return true;
  const inside = (layers, within) => (Array.isArray(layers) ? layers : []).some((layer) =>
    (within && layer?.id === id) || inside(layer?.children, within || layer?.id === element));
  return inside(document?.layers, false);
}

// The reach handle sits on the ellipse itself, at 45°, so what is dragged is
// the edge rather than a box drawn around it. cos 45° = sin 45°, which makes
// the inverse — a point back into a reach — exact rather than approximate.
const GRIP = Math.SQRT1_2;
const round = (value) => Math.round(number(value) * 100) / 100;

/**
 * The picture hand mode draws, in the artwork's own coordinates.
 *
 * @param {{anchor: {x,y}, restOffset: {x,y}, reach: {x,y}, overshoot: number}} source
 * @returns {{anchor: {x,y}, rest: {x,y}, reach: {rx,ry,overshoot}, grip: {x,y}}}
 */
export function handRigGeometry({ anchor, restOffset, reach, overshoot = 0 } = {}) {
  const at = { x: number(anchor?.x), y: number(anchor?.y) };
  const rest = { x: at.x + number(restOffset?.x), y: at.y + number(restOffset?.y) };
  const rx = Math.max(HAND_REACH_MINIMUM, Math.abs(number(reach?.x, HAND_REACH_MINIMUM)));
  const ry = Math.max(HAND_REACH_MINIMUM, Math.abs(number(reach?.y, HAND_REACH_MINIMUM)));
  return { anchor: at, rest, reach: { rx, ry, overshoot: Math.max(0, number(overshoot)) },
    grip: { x: rest.x + rx * GRIP, y: rest.y + ry * GRIP } };
}

/**
 * The same picture, read from the document.
 *
 * The anchor is stored in the parent's own coordinates, so the drawn one is
 * the model's mapped ellipse centre less the rest offset — `handReachEllipse`
 * is the one place that mapping lives, and hand mode must not grow a second.
 *
 * Null when the side has no hand, or its artwork is gone: an ellipse around
 * artwork that does not exist explains nothing.
 */
export function handRigOverlay(document = {}, side = 'left') {
  const stored = document?.hands?.[side];
  if (!stored?.element || !document?.elements?.[stored.element]) return null;
  const hand = normalizeHand(stored, side);
  const ellipse = handReachEllipse(hand, document.elements);
  if (!ellipse) return null;
  return {
    side, element: hand.element, parent: hand.parent,
    ...handRigGeometry({
      anchor: handDrawnAnchor(hand, document.elements),
      restOffset: hand.restOffset, reach: hand.reach, overshoot: hand.softness
    })
  };
}

/**
 * A point on the canvas → the anchor, in the coordinates the document keeps it
 * in. The parent's base transform is what `handReachEllipse` maps *through*, so
 * dragging has to map back through the same one or a rotated or scaled body
 * would put the anchor somewhere the ellipse is not.
 */
export function handAnchorFromPoint(document = {}, side = 'left', point = {}) {
  const stored = document?.hands?.[side];
  if (!stored) return null;
  const hand = normalizeHand(stored, side);
  const base = hand.parent ? document?.elements?.[hand.parent]?.baseTransform : null;
  const at = { x: number(point?.x), y: number(point?.y) };
  const local = base ? inverseElementTransform(base, at) : at;
  return { x: round(local.x), y: round(local.y) };
}

/** The grip dragged to a point → the reach it stands for. Never zero, never negative. */
export function handReachFromPoint(rest = {}, point = {}) {
  return {
    x: Math.max(HAND_REACH_MINIMUM, round(Math.abs(number(point?.x) - number(rest?.x)) / GRIP)),
    y: Math.max(HAND_REACH_MINIMUM, round(Math.abs(number(point?.y) - number(rest?.y)) / GRIP))
  };
}

/**
 * One drag of the anchor or of the reach, as a value rather than as pointer
 * plumbing.
 *
 * Nothing is written while the pointer moves: `to()` only says where the
 * overlay should be drawn, and `commit()` is the single command. So a drag is
 * one undo step however many frames it took, and a drag that is given up
 * leaves the document exactly as it found it.
 *
 * @param {{document: () => object, commands: {setAnchor: Function, setReach: Function}}} deps
 */
export function createHandRigGesture({ document: read = () => ({}), commands = {} } = {}) {
  let drag = null;

  /** The hand as it stands, plus the picture it currently draws. */
  const start = (side) => {
    const overlay = handRigOverlay(read(), side);
    if (!overlay) return null;
    return { overlay, hand: normalizeHand(read().hands[side], side) };
  };
  /** The same picture with one thing about it changed, for the live preview. */
  const shaped = (base, { anchor = base.overlay.anchor, reach = base.hand.reach }) => ({
    side: base.overlay.side, element: base.overlay.element, parent: base.overlay.parent,
    ...handRigGeometry({ anchor, restOffset: base.hand.restOffset, reach, overshoot: base.hand.softness })
  });
  const write = (side, kind, value) => (kind === 'anchor'
    ? Boolean(commands.setAnchor?.(side, value))
    : Boolean(commands.setReach?.(side, value)));

  return {
    /** What is being dragged, if anything. */
    active: () => (drag ? { side: drag.side, kind: drag.kind, moved: drag.moved } : null),
    /** What to draw right now: the live preview, or nothing when no drag is on. */
    preview: () => (drag ? drag.overlay : null),
    /** Take hold of one part of one hand. Returns the picture it starts from. */
    begin(side, kind) {
      const base = HAND_RIG_PARTS.includes(kind) ? start(side) : null;
      if (!base) return null;
      drag = { side, kind, base, moved: false, value: null, overlay: base.overlay };
      return drag.overlay;
    },
    /** Where the overlay goes for this pointer position. The document is untouched. */
    to(point) {
      if (!drag || !point) return null;
      if (drag.kind === 'anchor') {
        drag.value = handAnchorFromPoint(read(), drag.side, point);
        drag.overlay = shaped(drag.base, { anchor: point });
      } else {
        drag.value = handReachFromPoint(drag.base.overlay.rest, point);
        drag.overlay = shaped(drag.base, { reach: drag.value });
      }
      drag.moved = true;
      return drag.overlay;
    },
    /** One command for the whole gesture. A drag that never moved writes nothing. */
    commit() {
      if (!drag) return false;
      const { side, kind, value, moved } = drag;
      drag = null;
      return moved && value ? write(side, kind, value) : false;
    },
    /** Give up. The document was never written to, so there is nothing to undo. */
    cancel() {
      const had = Boolean(drag);
      drag = null;
      return had;
    },
    /**
     * A keyboard nudge: the same edit, in artwork units, committed on the spot.
     * One press is one command, exactly as one drag is (docs/UX21).
     */
    nudge(side, kind, { dx = 0, dy = 0 } = {}) {
      if (drag) return false;
      const base = HAND_RIG_PARTS.includes(kind) ? start(side) : null;
      if (!base) return false;
      if (kind === 'anchor') {
        return write(side, kind, handAnchorFromPoint(read(), side,
          { x: base.overlay.anchor.x + number(dx), y: base.overlay.anchor.y + number(dy) }));
      }
      return write(side, kind, {
        x: Math.max(HAND_REACH_MINIMUM, round(base.overlay.reach.rx + number(dx))),
        y: Math.max(HAND_REACH_MINIMUM, round(base.overlay.reach.ry + number(dy)))
      });
    }
  };
}
