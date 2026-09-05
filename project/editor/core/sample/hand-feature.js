/**
 * A pair of hands, drawn and rigged in one press (docs/HAND_RIGGING.md).
 *
 * Hand Setup could always rig a hand; what it could not do was give you one.
 * Its first step read "Choose the artwork that draws this hand", which for
 * anyone without an SVG editor open in another tab is where the feature ended.
 *
 * This is the artwork (`hand-artwork.js`), the rig, the poses and one example
 * motion, as a single undo step. Everything it writes is ordinary: hands the
 * runtime already animates, shape keys the runtime already blends, a clip like
 * any other. Nothing here is a special case afterwards.
 */
import { assignHand, addHandPose, handPoseParameter, mirrorHand, normalizeHand } from '../hands/hand-model.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { HAND_SIDES } from '../hands/hand-model.js';
import { inverseElementTransform } from '../../../runtime/runtime.js';
import { HAND_DIGITS, HAND_GRIP_CURL, HAND_PALM, HAND_REST_TILT, artboardBox, handArtwork, handElementId, handPosePath, handRestPoint, handScale, handShape, handTurnPath } from './hand-artwork.js';

export { artboardBox };

/** The poses the generated hand ships with: a shape each, so every one of them works. */
export const GENERATED_HAND_POSES = Object.freeze([
  Object.freeze({ id: 'fist', name: 'Fist' }),
  Object.freeze({ id: 'point', name: 'Point' }),
  Object.freeze({ id: 'peace', name: 'Peace' }),
  Object.freeze({ id: 'thumbsUp', name: 'Thumbs Up' }),
  Object.freeze({ id: 'spread', name: 'Spread' }),
  Object.freeze({ id: 'relax', name: 'Relax' }),
  // "Présenter": an open palm barely closed, offering something. One of the
  // brief's priority gestures and the one the list had no answer for -- a hand
  // that presents is not a fist, not a wave and not a point.
  Object.freeze({ id: 'present', name: 'Present' })
]);

/**
 * And every digit on its own.
 *
 * A pose is a whole hand at once; these are the rig underneath it — one curl
 * parameter per digit, so a hand can be posed by hand, animated finger by
 * finger, or driven from a reaction. Shape keys add, so raising Fist and
 * curling one finger further is a mouth-and-smile situation, not a fight.
 */
export const HAND_DIGIT_CONTROLS = Object.freeze([
  Object.freeze({ id: 'thumb', name: 'Thumb' }),
  Object.freeze({ id: 'index', name: 'Index' }),
  Object.freeze({ id: 'middle', name: 'Middle' }),
  Object.freeze({ id: 'ring', name: 'Ring' })
]);

const capital = (side) => (side === 'right' ? 'R' : 'L');
const named = (side, name) => `hand${capital(side)}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
/** `handLIndex`, `handRThumb`… — the same shape as every other hand parameter. */
export const handDigitParameter = (side, digit) => named(side, digit);

/**
 * The two controls a hand needs that a digit curl cannot give it.
 *
 * **Grip** closes every finger at once: the four curls are the individual
 * control and this is the group one, which is the way a hand is actually
 * animated — you close the hand, then bend one finger further.
 *
 * **Flip** turns the hand over. A flat cartoon hand seen from the back is the
 * same outline mirrored about the palm, so half a turn is a shape key rather
 * than a second drawing, and it composes with everything else.
 */
export const handGripParameter = (side) => named(side, 'grip');
export const handFlipParameter = (side) => named(side, 'flip');

/**
 * **Turn** yaws the hand about its own axis.
 *
 * Signed, −1…+1, and one shape key each way: a hand that can only translate
 * and rotate in the plane can point at things but can never *face* anywhere,
 * and what tells a viewer which way a hand faces is the silhouette and the
 * thumb (`HAND_TURN`, docs/MASCOT_DESIGN.md §6). Flip turns the hand over;
 * this is everything between the two.
 */
export const handTurnParameter = (side) => named(side, 'turn');

/** A wave is a rotation, not a shape: the hand turns, the fingers do not move. */
export const HAND_WAVE_CLIP = Object.freeze({
  id: 'hand-wave', name: 'Wave', duration: 1.4, loop: false,
  tracks: {
    handLRotation: [
      { time: 0, value: 0, easing: 'linear' }, { time: .25, value: .7, easing: 'easeInOut' },
      { time: .55, value: -.5, easing: 'easeInOut' }, { time: .85, value: .6, easing: 'easeInOut' },
      { time: 1.4, value: 0, easing: 'easeInOut' }
    ],
    handLY: [{ time: 0, value: 0, easing: 'linear' }, { time: .3, value: -.7, easing: 'easeOut' }, { time: 1.1, value: -.7 }, { time: 1.4, value: 0, easing: 'easeIn' }]
  }
});

export const HANDS_DOMAINS = ['artwork', 'layers', 'rig', 'hands', 'stateMachine', 'animation'];

/** Both hands drawn, rigged and pointing at artwork that still exists. */
export function areHandsInstalled(state = {}) {
  return HAND_SIDES.every((side) => {
    const hand = state.hands?.[side];
    return Boolean(hand?.element && state.elements?.[hand.element]);
  });
}


/* ── First placement (VNX-20, docs/VNEXT_ROADMAP.md) ───────────────────────
 *
 * ```text
 * measure the body → place one hand below and outside it → mirror it
 *        → a reach in proportion → keep the pair on the artboard
 * ```
 *
 * A pair used to arrive at the coordinates the *template* wanted: a fifth of
 * the artboard in from each edge, four fifths of the way down it. That is
 * right for a face drawn to fill its artboard and wrong for every import — a
 * mascot half the size of its canvas, or one whose head sits off-centre, got
 * hands somewhere beside it, and the author had four numbers per hand to fix
 * before anything was worth dragging.
 *
 * So the placement is measured. The measuring itself belongs to the canvas
 * (only the DOM knows how big a path really is), so it arrives as an injected
 * `measure(id)`; with nothing to measure the pair falls back to exactly where
 * it used to go, which is the right answer for the drawing that fills its
 * artboard and the honest guess for anything else.
 */

/** How far a hand may travel each way, as a share of the mascot's own size. */
const REACH_SHARE = 0.16;
/** A full half-turn either way, and a quarter of its size. */
const REACH_ROTATION = 180, REACH_SCALE = 0.25;
/** The floor Hand Setup's fields and hand mode already use (`HAND_REACH_MINIMUM`). */
const REACH_FLOOR = 1;

/**
 * How much room the hand itself takes, as a radius around its anchor, in the
 * hand's own drawing units.
 *
 * Read off the outline (`hand-artwork.js`) rather than guessed, and a radius
 * rather than a box because the pair hangs tilted: `HAND_REST_TILT` turns it
 * half a turn and twenty degrees, so no side of a box stays the side it was.
 */
const HAND_LOCAL_RADIUS = Math.max(HAND_PALM.halfWidth, HAND_PALM.wrist,
  ...HAND_DIGITS.map((digit) => Math.hypot(digit.base.x, digit.base.y) + digit.length + digit.width));

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;
const reachOf = (x, y) => ({ x: Math.max(REACH_FLOOR, x), y: Math.max(REACH_FLOOR, y), rotation: REACH_ROTATION, scale: REACH_SCALE });

/** A box worth placing against, or null when there is nothing there to measure. */
const usableBox = (box) => (number(box?.width) > 0 && number(box?.height) > 0
  ? { x: number(box.x), y: number(box.y), width: number(box.width), height: number(box.height) }
  : null);

/**
 * The element the hands hang from, and the one they are measured against.
 *
 * Never one of the hands themselves: a project whose only artwork is the pair
 * being drawn would otherwise anchor a hand to itself.
 */
export function handBodyElement(state = {}, parent = null) {
  if (parent) return parent;
  const drawn = Object.keys(state.elements || {}).filter((id) => id !== handElementId('left') && id !== handElementId('right'));
  return drawn.includes('faceRoot') ? 'faceRoot' : (drawn[0] || null);
}

/** The hand's own size and travel for a body this big. One definition, two readers. */
function handRoom(body) {
  return {
    // The hand is drawn for the artboard; at the mascot's width it is the same
    // drawing at the mascot's scale, so a small mascot does not get a hand
    // bigger than its head.
    radius: HAND_LOCAL_RADIUS * handScale({ width: body.width }),
    reach: reachOf(Math.round(REACH_SHARE * body.width), Math.round(REACH_SHARE * body.height))
  };
}

/**
 * The artboard the pair needs: the one there is, or a taller one.
 *
 * Hands hang **below** the mascot, and a drawing that fills its artboard
 * leaves nowhere for them: the pair landed on the cheeks, and their reach --
 * the whole point of a floating hand -- was whatever few pixels were left
 * between the chin and the edge. Adding hands therefore adds room, once, in
 * the same undo step. An artboard that is already tall enough is left alone.
 */
function grownArtboard(state, body) {
  const box = artboardBox(state);
  // Nothing measured: assume the drawing fills its artboard, as the shipped
  // template's face does. 4:3 leaves a band below it for the pair.
  if (!body) return { width: box.width, height: Math.max(box.height, Math.round(box.width * 1.35)) };
  // Measured: the room the pair actually needs under the mascot -- the hand,
  // its reach, and the hand again, so a hand at full reach is still drawn.
  const { radius, reach } = handRoom(body);
  return { width: box.width, height: Math.max(box.height, Math.ceil(body.y + body.height + 2 * radius + reach.y)) };
}

/** Below the mascot and outside it, as far as the artboard allows. */
function placeBesideBody(body, artboard) {
  const { radius, reach } = handRoom(body);
  const centre = body.x + body.width / 2;
  // A hand at full reach must still be on the drawing, so the anchor keeps its
  // whole ellipse -- or at least its own outline -- inside the edge.
  const margin = Math.max(radius, reach.x);
  // One distance from the mascot's middle serves both hands, so the artboard
  // can never pull one side in without the other and leave the pair lopsided.
  const room = Math.min(centre - margin, artboard.width - margin - centre);
  const dx = Math.max(radius, Math.min(body.width / 2 + radius, room));
  // `grownArtboard` has already made the room below, so the lower bound only
  // catches a caller placing against an artboard it did not grow.
  const y = Math.min(body.y + body.height + radius, artboard.height - Math.max(radius, reach.y));
  return { left: { x: round(centre - dx), y: round(y) }, mirrorX: centre, reach, size: body.width / artboard.width };
}

/**
 * Nothing to measure: the lower corners, which is where the pair has always
 * gone. Right for a drawing that fills its artboard, and the best guess when
 * nothing has said otherwise -- never (0, 0), and never off the artboard.
 */
function placeInCorners(artboard) {
  return {
    left: handRestPoint('left', artboard), mirrorX: artboard.width / 2,
    reach: reachOf(Math.round(artboard.width * 0.16), Math.round(artboard.height * 0.17)), size: 1
  };
}

/**
 * The other hand, from this one.
 *
 * Through the same function Hand Setup's "Mirror to the other side" calls, so
 * a pair drawn in one press and a pair mirrored by hand mean the same thing by
 * "the other side". Only the anchor is taken from it: a generated pair is two
 * new hands, so each side's poses and turn range are its own rather than a
 * copy of a gesture authored on the first.
 */
function mirrorPoint(point, mirrorX) {
  const pair = mirrorHand({ left: normalizeHand({ element: handElementId('left'), anchor: point }, 'left') },
    'left', { mirrorX, element: handElementId('right') });
  return { x: round(pair.right.anchor.x), y: round(pair.right.anchor.y) };
}

/**
 * Where a pair of hands goes on *this* project.
 *
 * The measuring is injected because only the canvas can do it: `measure(id)`
 * answers a box in the artboard's own units, the same way `hand-setup-panel`
 * and `head-pose-panel` already take one. Answering `null` — an empty project,
 * a caller with no canvas — is not an error, it is the fallback above.
 *
 * The artwork is appended before the rig is written, so a caller that answers
 * with the whole drawing rather than with the element asked about has to
 * measure **once** and remember it: measured again with the hands already on
 * the canvas, it would place the rig somewhere the outline is not.
 *
 * @param {object} state the document as it stands before the hands are drawn
 * @param {{measure?: ?(id: string) => ?{x,y,width,height}, parent?: ?string}} options
 * @returns {{artboard, body, parent, measured, reach, size, points, anchors}}
 */
export function handPlacement(state = {}, { measure = null, parent = null } = {}) {
  const parentId = handBodyElement(state, parent);
  const body = typeof measure === 'function' && parentId ? usableBox(measure(parentId)) : null;
  const artboard = grownArtboard(state, body);
  const placed = body ? placeBesideBody(body, artboard) : placeInCorners(artboard);
  const points = { left: placed.left, right: mirrorPoint(placed.left, placed.mirrorX) };
  // The document keeps an anchor in the *parent's* coordinates -- that is what
  // `handReachEllipse` maps back through -- while the artwork is drawn in the
  // artboard's. On a body carrying a transform of its own the two differ, and
  // an ellipse drawn around the wrong one is an ellipse beside the hand.
  const base = parentId ? state.elements?.[parentId]?.baseTransform : null;
  const anchors = Object.fromEntries(HAND_SIDES.map((side) => {
    const local = base ? inverseElementTransform(base, points[side]) : points[side];
    return [side, { x: round(local.x), y: round(local.y) }];
  }));
  return { artboard, body, parent: parentId, measured: Boolean(body), reach: placed.reach, size: placed.size, points, anchors };
}

/** The artboard a pair of hands needs, grown if the pair needs the room. */
export function handsArtboard(state = {}, options = {}) {
  return handPlacement(state, options).artboard;
}

/** The viewBox that room needs, or null when the artboard already had it. */
export function handsViewBox(state = {}, options = {}) {
  const box = artboardBox(state), grown = handsArtboard(state, options);
  return grown.height > box.height ? `0 0 ${grown.width} ${grown.height}` : null;
}

/**
 * The markup to append. Kept separate: the canvas draws it before anything is
 * authored — so it is placed by the same function that rigs it, and the
 * outline can never land somewhere its anchor is not.
 */
export const handsMarkup = (state = {}, options = {}) => {
  const placement = handPlacement(state, options);
  return HAND_SIDES.map((side) => handArtwork(side, { at: placement.points[side], box: placement.artboard })).join('');
};

/**
 * Rig the hands that `handsMarkup` just drew.
 *
 * The same `options` the markup was drawn with: both go through
 * `handPlacement`, so the rig lands on the artwork rather than beside it.
 *
 * @param {object} state a draft document that already carries the artwork
 * @param {{parent?: ?string, measure?: ?(id: string) => ?{x,y,width,height}}} options
 */
export function installHands(state, { parent = null, measure = null } = {}) {
  const placement = handPlacement(state, { parent, measure });
  const box = placement.artboard;
  const body = placement.parent;
  for (const side of HAND_SIDES) {
    const element = handElementId(side);
    if (!state.elements?.[element]) return false;
    const at = placement.points[side];
    // Room to move and a full turn, in proportion to the mascot rather than to
    // the drawing area. The reach used to be a tenth of the artboard and 34
    // degrees, which is a hand that can be nudged rather than placed; a
    // rotation that cannot pass a right angle cannot point at anything either.
    // `1` is now half a turn, so the hand reaches any angle.
    const reach = placement.reach;
    const result = assignHand(state.hands, side, { element, parent: body, anchor: placement.anchors[side], reach });
    if (!result.ok) return false;
    state.hands = result.hands;
    for (const [name, parameter] of Object.entries(result.parameters)) {
      state.params[name] ||= structuredClone(parameter);
      for (const pose of Object.values(state.states || {})) if (!(name in pose)) pose[name] = parameter.default;
    }
    // A rotation or a scale turns the hand around its own middle, and a shape
    // key needs the outline it deforms.
    const rest = handShape(side, 'open', { at, box });
    // Fingers down and thumbs inwards: the outline is drawn pointing up, and a
    // hand hanging beside a body does not. The size is a transform too, so the
    // outline stays the one the shape keys measure against: a hand drawn for
    // the artboard, shown at the mascot's own scale.
    Object.assign(state.elements[element].baseTransform,
      { pivotX: at.x, pivotY: at.y, rotation: HAND_REST_TILT[side], scaleX: placement.size, scaleY: placement.size });
    state.elements[element].restPath = rest;

    const parameter = (name, min = 0) => {
      state.params[name] ||= { type: 'number', min, max: 1, default: 0, value: 0 };
      for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = 0;
    };
    const shapeKey = (id, name, posePath, driver = null) => {
      const shape = createShapeKey({ id, target: element, name, restPath: rest, posePath, driver });
      if (!shape.ok) return false;
      state.shapeKeys = upsertShapeKey(state.shapeKeys, shape.shapeKey);
      return true;
    };

    for (const pose of GENERATED_HAND_POSES) {
      const id = `${element}-${pose.id}`;
      if (!shapeKey(id, `${pose.name} (${side})`, handPosePath(side, pose.id, { at, box }))) return false;
      state.hands = addHandPose(state.hands, side, { ...pose, shapeKey: id });
      parameter(handPoseParameter(side, pose.id));
    }
    // One curl per digit, driven by its own parameter: the poses are the quick
    // way, this is the complete one.
    for (const digit of HAND_DIGIT_CONTROLS) {
      const name = handDigitParameter(side, digit.id);
      const posePath = handShape(side, 'open', { at, box, curl: { [digit.id]: 1 } });
      if (!shapeKey(`${element}-curl-${digit.id}`, `${digit.name} curl (${side})`, posePath, { parameter: name, min: 0, max: 1 })) return false;
      parameter(name);
    }
    // And the two the digits cannot give: closing the whole hand, and turning
    // it over. Shape keys add, so a grip and one straightened finger compose.
    const grip = handGripParameter(side), flip = handFlipParameter(side);
    if (!shapeKey(`${element}-grip`, `Grip (${side})`, handShape(side, 'open', { at, box, curl: HAND_GRIP_CURL }), { parameter: grip, min: 0, max: 1 })) return false;
    parameter(grip);
    if (!shapeKey(`${element}-flip`, `Back of the hand (${side})`, handShape(side, 'open', { at, box, back: true }), { parameter: flip, min: 0, max: 1 })) return false;
    parameter(flip);
    // And the yaw, one shape key each way off a single signed parameter -- the
    // same shape as the mouth's smile and frown, and for the same reason: two
    // additive keys on one control reproduce every value in between exactly.
    const turn = handTurnParameter(side);
    for (const [suffix, amount, name] of [['out', 1, 'Turned out'], ['in', -1, 'Turned in']]) {
      if (!shapeKey(`${element}-turn-${suffix}`, `${name} (${side})`, handTurnPath(side, amount, { at, box }), { parameter: turn, min: 0, max: amount })) return false;
    }
    parameter(turn, -1);
  }
  if (!state.animationClips.some((clip) => clip.id === HAND_WAVE_CLIP.id)) state.animationClips.push(structuredClone(HAND_WAVE_CLIP));
  return true;
}

/**
 * Draw and rig both hands as one document revision.
 *
 * `options` are the ones `handsMarkup` was called with — the same measurement,
 * so the rig is placed on the artwork the canvas already holds.
 */
export function addHandsCommand(store, history, artwork, options = {}) {
  const current = store.getDocument();
  if (areHandsInstalled(current)) return false;
  for (const side of HAND_SIDES) {
    const id = handElementId(side);
    if (current.elements?.[id]) throw new Error(`SVG id collision: "${id}" already exists.`);
  }
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHands(candidate, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-pair', source: 'hands', domains: HANDS_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'shapeKeys', 'params', 'states', 'animationClips']) document[field] = structuredClone(candidate[field]);
    }
  });
  return true;
}
