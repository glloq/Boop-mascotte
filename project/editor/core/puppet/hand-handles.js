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
 * it turns inside, the row of sliders under it, and beside the face the one
 * slider that brings it out from behind the head (`hand-console.js`). There is
 * nothing on it for a finger, a curl or an angle: a hand's shape is the drawing
 * it is showing, and the picker beside the face is where that is chosen
 * (docs/HAND_STYLES.md).
 *
 * Pure: it reads the document and reports handles; the canvas draws them.
 */
import { handReachEllipse } from '../hands/hand-model.js';
// The **live** list, not the runtime's frozen vocabulary: a gesture an author
// added by dropping a file in is offered here the moment the set is read, which
// is the whole point of a set being files (docs/HAND_STYLES.md).
import { HAND_STYLE_RADIUS, handStyleAnchors, handStyleIds, handStyleLabel } from '../hands/hand-style-art.js';
import { artboardBox, handScale, handShowParameter } from '../sample/hand-feature.js';
import { handConsoleLayout } from './hand-console.js';
import { HAND_SIDES, inverseElementTransform, normalizeHand, normalizeRigHolds } from '../../../runtime/runtime.js';
import { parameterAxis } from './puppet-handles.js';

const SIDE_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
/** `face.cheek.left` → `cheek`: what an author calls the place, not what the rig does. */
const holdPlace = (to) => String(to).replace(/^face\./, '').replace(/\.(left|right)$/, '')
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]+/g, ' ').toLowerCase();

/**
 * How far out the hand has to be before its console is drawn.
 *
 * A ring, a row of sliders and a column of drawings around a hand nobody can
 * see is clutter around nothing, so while the pair rests behind the head the
 * only control on the canvas is the one that brings it out.
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
    // A hand the editor drew is held by its **wrist**: the anchor sits at the
    // middle of the palm, and a handle on top of it would take every drag meant
    // for the other. The wrist is a fixed point on the drawing, the same in all
    // six styles, so the grip does not move when the style does. Any other
    // artwork is grabbed at its centre, as before.
    const wrist = hand.styles
      ? (() => {
        const local = handStyleAnchors(hand.styles.showing)?.wrist || { x: 0, y: 0 };
        const size = handScale(box);
        return { x: drawn.x + local.x * size, y: drawn.y + local.y * size };
      })()
      : null;

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
    // turn on the ring, the draw order in a row beneath, and the way out from
    // behind the head beside the face (`hand-console.js`). They are still
    // members of the hand's own group, so the control board lists one hand
    // rather than a handful of controls; on the canvas the ring is what
    // gathers them, so nothing has to be opened first.
    const group = `hand-${side}`;
    // How far out from behind the head the hand is. A hand that never hides
    // has no such parameter, so it has no slider and nothing to be gated on.
    const show = parameterAxis(document.params, handShowParameter(side), `${label} out`);
    const gate = show ? { control: show.control, above: HAND_CONSOLE_GATE } : null;

    const slots = [];
    const slot = (id, kind, name, hint, axis, { shape = null } = {}) => {
      if (axis) slots.push({ id, kind, label: name, hint, axis, shape });
    };
    /*
     * What a hand can be asked for, and nothing else:
     *
     *   drag the hand    where it reaches            the position handle
     *   round the ring   how far it is turned        handLRotation
     *   under it         in front of, or behind      handLDepth
     *   beside the face  out from behind the head    handLShow
     *   beside the face  which drawing               the picker
     *
     * There is no finger here, no curl, no grip, no flip and no facing: a hand
     * is a whole drawing, and the only thing that changes its shape is which
     * drawing it is (docs/HAND_STYLES.md). The turn goes **round the hand**
     * rather than on a line under it: a turn dragged around a ring is the turn
     * itself rather than a line that stands for one.
     */
    slot(`hand-${side}-turn`, 'ring', `Turn the ${label.toLowerCase()}`, 'Drag around the ring to turn the hand',
      parameterAxis(document.params, hand.parameters.rotation, `${label} turn`), { shape: 'diamond' });
    // Which side of the mascot the hand is painted on. The reveal from behind
    // the head writes its own depth as the hand comes out; this adds to it, so
    // a hand can be held in front of the face or tucked behind it at will
    // (docs/DEPTH_PARALLAX.md).
    slot(`hand-${side}-depth`, 'row', `${label} in front`, 'Slide to bring the hand in front of the other layers, or behind them',
      parameterAxis(document.params, hand.parameters.depth, `${label} draw order`), { shape: 'ring' });
    // The places this hand can be *held* to: one number each that puts the palm
    // on a named point of the face and turns it to match (docs/HAND_RIGGING.md,
    // "Held to the face").
    //
    // Offered to **every** hand that has them. They used to be kept from a hand
    // with drawings of its own, on the reasoning that a hand you can drag where
    // it should go does not need four of them -- which is exactly backwards: a
    // hold is *one* number for a place that takes three to find by hand, and
    // the drawn pair is the recommended hand, so the rule left the recommended
    // hand as the only one that could not do it (V3-11).
    const palm = `hand.${side}.palm`;
    for (const held of normalizeRigHolds(document)) {
      if (held.hold !== palm || !held.weight) continue;
      const place = holdPlace(held.to);
      slot(`hand-${side}-hold-${place.replace(/\s+/g, '-')}`, 'hold', `${label} on the ${place}`,
        `Slide around the ring to bring the hand to the ${place}`,
        parameterAxis(document.params, held.weight, `${label} on the ${place}`));
    }

    const showId = show ? `hand-${side}-show` : null;
    const layout = handConsoleLayout({
      rest: { x: ellipse ? ellipse.cx : drawn.x, y: ellipse ? ellipse.cy : drawn.y },
      reach: { x: ellipse ? ellipse.rx : hand.reach.x, y: ellipse ? ellipse.ry : hand.reach.y },
      side, show: showId,
      hold: slots.filter((item) => item.kind === 'hold').map((item) => item.id),
      ring: slots.filter((item) => item.kind === 'ring').map((item) => item.id),
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
      // The turn in one colour, the places the hand is held to in another, the
      // draw order in a third and the way out from behind the head in a fourth.
      // The row shares a line, so each knob takes a shape too.
      widget: { colour: { show: 'warm', row: 'violet', ring: 'violet', hold: 'green' }[kind] || 'cool', ...(shape ? { shape } : {}) },
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
 * The styles a hand can show, as a row of chips (docs/HAND_STYLES.md).
 *
 * Each chip is one value of the hand's style parameter, so pressing one is
 * choosing a drawing and nothing else. A style the hand has not been drawn with
 * yet comes back as an offer, so one row covers both "show this" and "draw
 * this".
 *
 * @returns {{id,name,ready,values,added}[]}
 */
export function handStylePresets(document = {}, side = 'left') {
  const stored = document.hands?.[side];
  if (!stored?.element) return [];
  const hand = normalizeHand(stored, side);
  const library = hand.styles?.library || [];
  const parameter = hand.parameters.style;
  const added = library.map((style, index) => ({
    id: style.id, name: style.label || style.id, added: true, ready: Boolean(parameter),
    values: parameter ? { [parameter]: index } : {}, missing: parameter ? null : 'a style parameter'
  }));
  const offers = handStyleIds()
    .filter((id) => !library.some((style) => style.id === id))
    .map((id) => ({ id, name: handStyleLabel(id), added: false, ready: false, values: {}, missing: null }));
  return added.concat(offers);
}

/**
 * The named places a hand can be put, as a row of chips (V3-11).
 *
 * Placing a hand is `handLX`, `handLY` and `handLRotation` — three numbers, and
 * getting all three right for *"a hand up and out"* is something an author does
 * by nudging sliders and looking. A pose is the same thing as one press, which
 * is what `part-poses.js` already gives every part of the face; a hand had
 * none, because a hand is not a face part and never reaches that catalogue.
 *
 * Two kinds of place, in one row and in this order:
 *
 * * **where it reaches** — rest, up, down, out, in, turned. Written from the
 *   hand's *own* parameter names, so a hand whose rig names them something else
 *   is posed by the same chips;
 * * **where it is held** — the chin, a cheek, the mouth, the forehead: one hold
 *   raised to 1 with the hand brought out beside it (docs/HAND_RIGGING.md,
 *   "Held to the face"). A project with no holds simply has fewer chips.
 *
 * `out` and `in` are **mirrored by side** — out is away from the middle on
 * both hands — because that is what the words mean; every other chip writes the
 * same value on both, exactly as a control runs the same way round the ring on
 * both (docs/DIRECT_CONTROLS.md).
 *
 * Pure: it reads the document and reports what could be pressed. Every chip is
 * a plain parameter map, so a caller can preview it, key it, or put it in an
 * expression without this knowing which.
 *
 * @returns {{id,name,values,kind}[]}
 */
export function handPosePresets(document = {}, side = 'left') {
  const stored = document.hands?.[side];
  if (!stored?.element) return [];
  const hand = normalizeHand(stored, side);
  const { x, y, rotation } = hand.parameters;
  const params = document.params || {};
  const has = (name) => Boolean(name && params[name]);
  const show = handShowParameter(side);
  // A hand that rests behind the head comes out to be looked at: every place is
  // somewhere in front of the mascot, and a hand posed behind its own head is a
  // pose nobody can see.
  const out = has(show) ? { [show]: 1 } : {};
  const outward = side === 'right' ? 1 : -1;
  const places = [
    { id: 'rest', name: 'Rest', values: { ...(has(x) ? { [x]: 0 } : {}), ...(has(y) ? { [y]: 0 } : {}), ...(has(rotation) ? { [rotation]: 0 } : {}) } },
    { id: 'up', name: 'Up', values: has(y) ? { [y]: -1 } : null },
    { id: 'down', name: 'Down', values: has(y) ? { [y]: 1 } : null },
    { id: 'out', name: 'Out', values: has(x) ? { [x]: outward } : null },
    { id: 'in', name: 'In', values: has(x) ? { [x]: -outward } : null },
    { id: 'wave', name: 'Waving', values: has(y) && has(rotation) ? { [y]: -0.7, [rotation]: 0.5 } : null }
  ].filter((place) => place.values).map((place) => ({ ...place, kind: 'place', values: { ...out, ...place.values } }));
  const palm = `hand.${side}.palm`;
  const held = normalizeRigHolds(document).filter((hold) => hold.hold === palm && has(hold.weight));
  const holds = held.map((hold) => ({ id: hold.id, name: `On the ${holdPlace(hold.to)}`, kind: 'hold', values: { ...out, [hold.weight]: 1 } }));
  // Every hold this hand has, released: the way back from a hold, which is not
  // the same press as the way back to the rest place -- a hand let go of the
  // chin stays where it was put.
  const release = held.length
    ? [{ id: 'let-go', name: 'Let go', kind: 'hold', values: Object.fromEntries(held.map((hold) => [hold.weight, 0])) }]
    : [];
  return [...places, ...holds, ...release];
}

/** Back to the style the hand rests on, which is what "neutral" means for one. */
export function handStyleRest(document = {}, side = 'left') {
  const stored = document.hands?.[side];
  if (!stored?.element) return {};
  const hand = normalizeHand(stored, side);
  const library = hand.styles?.library || [];
  const index = library.findIndex((style) => style.id === hand.styles?.showing);
  return hand.parameters.style && index >= 0 ? { [hand.parameters.style]: index } : {};
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
  // Less the artwork's own move, which `handReachEllipse` adds: the anchor is
  // where the hand hangs from, the base transform where the author put it.
  const own = document?.elements?.[hand.element]?.baseTransform;
  return { x: round(local.x - (Number(own?.x) || 0)), y: round(local.y - (Number(own?.y) || 0)) };
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
