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
import { handArtwork, handElementId, handPosePath, handRestPoint, handShape } from './hand-artwork.js';

/** The poses the generated hand ships with: a shape each, so all three work at once. */
export const GENERATED_HAND_POSES = Object.freeze([
  Object.freeze({ id: 'fist', name: 'Fist' }),
  Object.freeze({ id: 'point', name: 'Point' }),
  Object.freeze({ id: 'peace', name: 'Peace' })
]);

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

/** The artboard the artwork is drawn on, so hands land beside the mascot and not on it. */
export function artboardBox(state = {}) {
  const match = /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(state.svgMarkup || '');
  if (!match) return { width: 240, height: 240 };
  return { width: Number(match[3]) || 240, height: Number(match[4]) || 240 };
}

/** The markup to append. Kept separate: the canvas draws it before anything is authored. */
export const handsMarkup = (state = {}) => {
  const box = artboardBox(state);
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
    const reach = { x: Math.round(box.width * 0.1), y: Math.round(box.height * 0.11), rotation: 34, scale: 0.18 };
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
    Object.assign(state.elements[element].baseTransform, { pivotX: at.x, pivotY: at.y });
    state.elements[element].restPath = rest;

    for (const pose of GENERATED_HAND_POSES) {
      const id = `${element}-${pose.id}`;
      const shape = createShapeKey({ id, target: element, name: `${pose.name} (${side})`, restPath: rest, posePath: handPosePath(side, pose.id, { at, box }) });
      if (!shape.ok) return false;
      state.shapeKeys = upsertShapeKey(state.shapeKeys, shape.shapeKey);
      state.hands = addHandPose(state.hands, side, { ...pose, shapeKey: id });
      const name = handPoseParameter(side, pose.id);
      state.params[name] ||= { type: 'number', min: 0, max: 1, default: 0, value: 0 };
      for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = 0;
    }
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
