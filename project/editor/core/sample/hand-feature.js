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
import { assignHand, addHandPose, handParameters, handPoseParameter } from '../hands/hand-model.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { HAND_SIDES } from '../hands/hand-model.js';
import { HAND_GRIP_CURL, HAND_REST_TILT, artboardBox, handArtwork, handElementId, handPosePath, handRestPoint, handShape } from './hand-artwork.js';

export { artboardBox };

/** The poses the generated hand ships with: a shape each, so every one of them works. */
export const GENERATED_HAND_POSES = Object.freeze([
  Object.freeze({ id: 'fist', name: 'Fist' }),
  Object.freeze({ id: 'point', name: 'Point' }),
  Object.freeze({ id: 'peace', name: 'Peace' }),
  Object.freeze({ id: 'thumbsUp', name: 'Thumbs Up' }),
  Object.freeze({ id: 'spread', name: 'Spread' }),
  Object.freeze({ id: 'relax', name: 'Relax' })
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


/**
 * The artboard a pair of hands needs.
 *
 * Hands hang **below** the mascot, and a face drawn to fill its artboard
 * leaves nowhere for them: the pair landed on the cheeks, and their reach --
 * the whole point of a floating hand -- was whatever few pixels were left
 * between the chin and the edge. Adding hands therefore adds room, once, in
 * the same undo step. An artboard that is already tall enough is left alone.
 */
export function handsArtboard(state = {}) {
  const box = artboardBox(state);
  return { width: box.width, height: Math.max(box.height, Math.round(box.width * 1.35)) };
}

/** The viewBox that room needs, or null when the artboard already had it. */
export function handsViewBox(state = {}) {
  const box = artboardBox(state), grown = handsArtboard(state);
  return grown.height > box.height ? `0 0 ${grown.width} ${grown.height}` : null;
}

/** The markup to append. Kept separate: the canvas draws it before anything is authored. */
export const handsMarkup = (state = {}) => {
  const box = handsArtboard(state);
  return HAND_SIDES.map((side) => handArtwork(side, { box })).join('');
};

/**
 * Rig the hands that `handsMarkup` just drew.
 *
 * @param {object} state a draft document that already carries the artwork
 * @param {{parent?: string|null}} options what the hands hang from
 */
export function installHands(state, { parent = null } = {}) {
  const box = artboardBox(state);
  const body = parent || (state.elements?.faceRoot ? 'faceRoot' : Object.keys(state.elements || {})[0] || null);
  for (const side of HAND_SIDES) {
    const element = handElementId(side);
    if (!state.elements?.[element]) return false;
    const at = handRestPoint(side, box);
    // The reach stays inside the artboard: a hand that can be sent off the
    // edge of the drawing is a hand that vanishes mid-animation.
    // Room to move and a full turn. The reach used to be a tenth of the
    // artboard and 34 degrees, which is a hand that can be nudged rather than
    // placed; a rotation that cannot pass a right angle cannot point at
    // anything either. `1` is now half a turn, so the hand reaches any angle.
    const reach = { x: Math.round(box.width * 0.16), y: Math.round(box.height * 0.17), rotation: 180, scale: 0.25 };
    const result = assignHand(state.hands, side, { element, parent: body, anchor: at, reach });
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
    // hand hanging beside a body does not.
    Object.assign(state.elements[element].baseTransform, { pivotX: at.x, pivotY: at.y, rotation: HAND_REST_TILT[side] });
    state.elements[element].restPath = rest;

    const parameter = (name) => {
      state.params[name] ||= { type: 'number', min: 0, max: 1, default: 0, value: 0 };
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
  }
  if (!state.animationClips.some((clip) => clip.id === HAND_WAVE_CLIP.id)) state.animationClips.push(structuredClone(HAND_WAVE_CLIP));
  return true;
}

/** Draw and rig both hands as one document revision. */
export function addHandsCommand(store, history, artwork) {
  const current = store.getDocument();
  if (areHandsInstalled(current)) return false;
  for (const side of HAND_SIDES) {
    const id = handElementId(side);
    if (current.elements?.[id]) throw new Error(`SVG id collision: "${id}" already exists.`);
  }
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHands(candidate)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-pair', source: 'hands', domains: HANDS_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'shapeKeys', 'params', 'states', 'animationClips']) document[field] = structuredClone(candidate[field]);
    }
  });
  return true;
}
