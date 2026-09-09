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
 * Everything else a hand can do is laid out on a console around it — the ring
 * it may reach inside, its fingers on the ring's rim, its turns in a row under
 * it, and beside the face the one slider that brings it out from behind the
 * head (`hand-console.js`).
 *
 * Pure: it reads the document and reports handles; the canvas draws them.
 */
import { handPoseDrive, handReachEllipse, SUGGESTED_HAND_POSES } from '../hands/hand-model.js';
import { HAND_DIGITS, artboardBox, handDigitTip, handPartId, handWristPoint } from '../sample/hand-artwork.js';
import { handDigitParameter, handFacingParameter, handFlipParameter, handGripParameter, handShowParameter } from '../sample/hand-feature.js';
import { HAND_CONSOLE, handConsoleLayout } from './hand-console.js';
import { HAND_SIDES, handPoseParameterName, inverseElementTransform, normalizeHand, normalizeRigHolds } from '../../../runtime/runtime.js';
import { parameterAxis } from './puppet-handles.js';

const SIDE_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * How far out the hand has to be before its console is drawn.
 *
 * A ring, five finger sliders and a row of turns around a hand nobody can see
 * is clutter around nothing, so while the pair rests behind the head the only
 * control on the canvas is the one that brings it out.
 */
export const HAND_CONSOLE_GATE = 0.05;

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
    //
    // A hand made of drawings counts as generated: its cuff is in every one of
    // them, and its group's *box* is the union of its pictures, of which all
    // but one are transparent -- a centre computed from that is not the middle
    // of the hand, and it landed squarely on the anchor handle.
    const generated = Boolean(hand.sprites) || Boolean(document.elements?.[handPartId(side, 'cuff')]);
    const wrist = generated ? handWristPoint(side, { at: drawn, box }) : null;

    let position = null;
    if (x || y) {
      position = {
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
      };
      handles.push(position);
    }

    // Everything else the hand can do is drawn on a **console** around it: the
    // fingers on the half of the ring's rim that faces away from the mascot,
    // the places it can be held to on the half that faces it, the whole-hand
    // turns in a row beneath, and the way out from behind the head beside the
    // face (`hand-console.js`). They are still members of the hand's own group,
    // so the control board lists one hand rather than a dozen controls; on the
    // canvas the ring is what gathers them, so nothing has to be opened first.
    const group = `hand-${side}`;
    // How far out from behind the head the hand is. A hand that never hides
    // has no such parameter, so it has no slider and nothing to be gated on.
    const show = parameterAxis(document.params, handShowParameter(side), `${label} out`);
    const gate = show ? { control: show.control, above: HAND_CONSOLE_GATE } : null;

    const slots = [];
    const slot = (id, kind, name, hint, axis, { shape = null, at = null } = {}) => {
      if (axis) slots.push({ id, kind, label: name, hint, axis, shape, at });
    };
    /**
     * Where a finger points, as an angle *around the ring*.
     *
     * The tip comes from the same function that draws the outline and the rest
     * tilt is the one the group carries, so a slider lands on the finger it
     * drives on any hand, at any size, and on the mirrored one without this
     * having to know that it is mirrored. The last step is the ring's own: it
     * is an ellipse, and the direction a finger points and the angle that
     * parameterises the ellipse are not the same number -- on this reach they
     * differ by ten degrees, which is a slider sitting beside its finger
     * instead of on it.
     */
    const tilt = number(document.elements[hand.element]?.baseTransform?.rotation, 0);
    const rx = Math.abs(number(ellipse ? ellipse.rx : hand.reach.x, 40)) || 1;
    const ry = Math.abs(number(ellipse ? ellipse.ry : hand.reach.y, 40)) || 1;
    const digitAngle = (id) => {
      const tip = handDigitTip(side, id, { at: drawn, box });
      if (!tip) return null;
      const points = (Math.atan2(tip.y - drawn.y, tip.x - drawn.x) * (180 / Math.PI) + tilt) * (Math.PI / 180);
      return Math.atan2(Math.sin(points) / ry, Math.cos(points) / rx) * (180 / Math.PI);
    };
    const fan = HAND_DIGITS.map((digit) => ({ digit, at: digitAngle(digit.id) })).filter((item) => item.at !== null);
    // The grip closes every finger, so it sits just past the thumb, clear of
    // the fan it closes rather than in the middle of it. Which side "past" is
    // depends on which way round the fan runs, and the mirrored hand's runs
    // the other way.
    const clockwise = fan.length > 1 ? ((fan[fan.length - 1].at - fan[0].at) % 360 + 360) % 360 <= 180 : true;
    slot(`hand-${side}-grip`, 'rim', `${label} grip`, 'Slide around the ring to close every finger at once',
      parameterAxis(document.params, handGripParameter(side), `${label} grip`),
      { at: (fan[0]?.at ?? 90) + (clockwise ? -1 : 1) * (HAND_CONSOLE.rimSpan + HAND_CONSOLE.rimGap) });
    for (const { digit, at } of fan) {
      const name = digit.name.toLowerCase();
      slot(`hand-${side}-${digit.id}`, 'rim', `${label}: ${name}`, `Slide around the ring to curl the ${name}`,
        parameterAxis(document.params, handDigitParameter(side, digit.id), `${digit.name} curl`), { at });
    }
    // The places this hand can be *held* to: one number each that puts the palm
    // on a named point of the face and turns it to match (docs/HAND_RIGGING.md,
    // "Held to the face"). They are places on the mascot, so they go on the
    // half of the rim that faces it -- the half the fingers leave empty.
    const palm = `hand.${side}.palm`;
    for (const held of normalizeRigHolds(document)) {
      if (held.hold !== palm || !held.weight) continue;
      const place = String(held.to).replace(/^face\./, '').replace(/\.(left|right)$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]+/g, ' ').toLowerCase();
      slot(`hand-${side}-hold-${place.replace(/\s+/g, '-')}`, 'hold', `${label} on the ${place}`,
        `Slide around the ring to bring the hand to the ${place}`,
        parameterAxis(document.params, held.weight, `${label} on the ${place}`));
    }

    slot(`hand-${side}-turn`, 'row', `Turn the ${label.toLowerCase()}`, 'Slide to turn the hand',
      parameterAxis(document.params, hand.parameters.rotation, `${label} turn`), { shape: 'diamond' });
    // A hand made of drawings **is** one of a handful of pictures, and picks
    // which beside the face (docs/HANDS_2D.md). What it slides here instead is
    // that picture's own animation: the fist closing, the thumb going up. A
    // hand that still deforms slides its facing axis, as it always did.
    if (hand.sprites) {
      const doing = hand.sprites.drawings.find((drawing) => drawing.id === hand.sprites.showing)?.anim;
      slot(`hand-${side}-anim`, 'row', `${label} animation`,
        doing ? `Slide to ${doing.toLowerCase()}` : "Slide to play this drawing's own animation",
        parameterAxis(document.params, hand.parameters.anim, `${label} animation`), { shape: 'square' });
    } else {
      slot(`hand-${side}-facing`, 'row', `${label} palm or side`, 'Slide to turn the hand towards its side',
        parameterAxis(document.params, handFacingParameter(side), `${label} facing`), { shape: 'square' });
    }
    slot(`hand-${side}-flip`, 'row', `${label} palm or back`, 'Slide to turn the hand over',
      parameterAxis(document.params, handFlipParameter(side), `${label} turn over`), { shape: 'ring' });

    const showId = show ? `hand-${side}-show` : null;
    const layout = handConsoleLayout({
      rest: { x: ellipse ? ellipse.cx : drawn.x, y: ellipse ? ellipse.cy : drawn.y },
      reach: { x: ellipse ? ellipse.rx : hand.reach.x, y: ellipse ? ellipse.ry : hand.reach.y },
      side, show: showId,
      rim: slots.filter((item) => item.kind === 'rim').map((item) => ({ id: item.id, at: item.at })),
      // Read from the end of the free arc the grip is next to, so the two
      // hands' consoles are mirror images of each other rather than merely
      // both correct.
      hold: (() => { const ids = slots.filter((item) => item.kind === 'hold').map((item) => item.id); return clockwise ? ids.reverse() : ids; })(),
      row: slots.filter((item) => item.kind === 'row').map((item) => item.id)
    });
    /**
     * One slider on the console: its own axis, its own track, and the gate
     * that keeps it off a canvas whose hand is still behind the head.
     */
    const knob = ({ id, label: name, hint, axis, kind, shape = null }, { track, needs }) => ({
      id, label: name, hint, group, visualParent: 'hand-rig',
      partId: `hand:${side}`, elements: [hand.element], anchor: hand.element, at: 'centre',
      mode: 'drag', grid: false, side, console: group, slot: kind,
      // The fingers in one colour, the places the hand is held to in another,
      // the whole-hand turns in a third and the way out from behind the head
      // in a fourth. The turns share a line, so each takes a shape too.
      widget: { colour: { show: 'warm', row: 'violet', hold: 'green' }[kind] || 'cool', ...(shape ? { shape } : {}) },
      x: axis, y: null, orbit: null, invertY: false, throw: 1, span: null, reach: null, point: null,
      controller: 'slider', track, needs
    });
    for (const item of slots) handles.push(knob(item, { track: layout.tracks[item.id], needs: gate }));
    // The one control that is drawn while the hand is hidden -- it is what
    // brings it out, so gating it on the hand being out already would leave a
    // hidden pair with no way back.
    if (showId) {
      handles.push(knob({ id: showId, kind: 'show', label: `${label} out`, hint: 'Slide down to bring the hand out from behind the head', axis: show },
        { track: layout.tracks[showId], needs: null }));
    }
    // The ring the console is laid out on is the reach the hand already had,
    // so the position handle carries it and the canvas draws one circle.
    if (position) { position.console = group; position.ring = layout.ring; position.needs = gate; }
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
