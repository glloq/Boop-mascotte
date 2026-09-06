import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import {
  HAND_DIGITS, HAND_GRIP_TABLE, HAND_PART_IDS, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES, HAND_STYLES,
  handDigitCurlTable, handDigitTip, handElementId, handPartId, handParts
} from '../sample/hand-artwork.js';
import {
  areHandsInstalled, handDigitParameter, handFacingParameter, handGripParameter, handsMarkup, installHands, installedHandStyle,
  GENERATED_HAND_POSES, HAND_DIGIT_CONTROLS, HAND_FACING_STOPS
} from '../sample/hand-feature.js';
import { handPoseDrive } from '../hands/hand-model.js';
import { compileRigFrame, parsePath, pathsCompatible } from '../../../runtime/runtime.js';

const transform = () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 });
const element = (nodeType, d = '') => ({
  baseTransform: transform(), baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d }
});

/** The document as it is once the canvas has appended the artwork: a group of parts per side. */
function drawn(options = {}) {
  const state = createCleanProjectState();
  const markup = handsMarkup({}, options);
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${markup}</svg>`;
  state.elements = { faceRoot: element('g') };
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: [] }];
  for (const side of ['left', 'right']) {
    const group = handElementId(side);
    state.elements[group] = element('g');
    const children = [];
    for (const part of HAND_PART_IDS) {
      const id = handPartId(side, part);
      const d = new RegExp(`<path id="${id}"[^>]* d="([^"]+)"`).exec(markup)?.[1] || '';
      state.elements[id] = element('path', d);
      children.push({ id, type: 'path', name: part, children: [] });
    }
    state.layers.push({ id: group, type: 'g', name: `${side} hand`, children });
  }
  state.states = { idle: {} };
  state.activeState = 'idle';
  return state;
}

const value = (name, amount) => ({ [name]: { type: 'number', min: -1, max: 1, default: 0, value: amount } });
/** A frame of the installed pair, with everything the runtime would be handed. */
const frameOf = (state, values = {}) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { shapeKeys: state.shapeKeys, keyforms: state.keyforms, hands: state.hands });

test('a generated hand is six parts, and every pose keeps each part\'s layout', () => {
  assert.equal(HAND_DIGITS.length, 4, 'a thumb and three fingers');
  const rest = handParts('left', { at: { x: 0, y: 0 }, scale: 1 });
  assert.deepEqual(rest.order, ['palm', 'ring', 'middle', 'index', 'thumb', 'cuff']);
  // Fixed layouts: a soft palm plus the heel of the thumb, a tube plus its fold, a rounded band.
  assert.equal(parsePath(rest.paths.palm).signature, 'M C C C C C C C C C Z M C C');
  assert.equal(parsePath(rest.paths.index).signature, 'M C C C C C C C C C C M C C');
  assert.equal(parsePath(rest.paths.cuff).signature, 'M L C L C L C L C Z');
  const tables = { ...HAND_POSE_TABLES, grip: HAND_GRIP_TABLE, ...Object.fromEntries(HAND_DIGITS.map((digit) => [`curl-${digit.id}`, handDigitCurlTable(digit.id)])) };
  for (const [id, table] of Object.entries(tables)) {
    const posed = handParts('left', { at: { x: 0, y: 0 }, scale: 1, pose: table });
    for (const part of HAND_PART_IDS) assert.ok(pathsCompatible(rest.paths[part], posed.paths[part]), `${id}: ${part} must keep its layout`);
    assert.ok(HAND_PART_IDS.some((part) => posed.paths[part] !== rest.paths[part]), `${id} has to move something`);
  }
  // A profile is the same six layouts, so a facing axis can interpolate them.
  const profile = handParts('left', { at: { x: 0, y: 0 }, scale: 1, view: 'profile' });
  for (const part of HAND_PART_IDS) assert.ok(pathsCompatible(rest.paths[part], profile.paths[part]), `profile ${part}`);
  for (const [id, table] of Object.entries(HAND_PROFILE_POSE_TABLES)) {
    const posed = handParts('left', { at: { x: 0, y: 0 }, scale: 1, view: 'profile', pose: table });
    for (const part of HAND_PART_IDS) assert.ok(pathsCompatible(profile.paths[part], posed.paths[part]), `profile ${id}: ${part}`);
  }
  // The other hand is the mirror of it: the same layouts, the thumb on the other side.
  const right = handParts('right', { at: { x: 0, y: 0 }, scale: 1 });
  for (const part of HAND_PART_IDS) {
    assert.ok(pathsCompatible(rest.paths[part], right.paths[part]));
    assert.notEqual(rest.paths[part], right.paths[part]);
  }
});

test('the fold across a knuckle is hidden at rest and drawn once the finger bends', () => {
  const foldPoints = (d) => {
    // The fold is the second sub-path: `M` then two cubics; its three points are
    // the move and the two segment ends.
    const { values } = parsePath(d);
    const start = values.length - 14;
    return [[values[start], values[start + 1]], [values[start + 6], values[start + 7]], [values[start + 12], values[start + 13]]];
  };
  const rest = foldPoints(handParts('left', { at: { x: 0, y: 0 }, scale: 1 }).paths.index);
  assert.deepEqual(rest[0], rest[1]);
  assert.deepEqual(rest[1], rest[2], 'three points in one place: nothing to see');
  const bent = foldPoints(handParts('left', { at: { x: 0, y: 0 }, scale: 1, pose: handDigitCurlTable('index', 1) }).paths.index);
  assert.notDeepEqual(bent[0], bent[2], 'a line across the knuckle');
  // A finger only slightly bent shows no fold yet.
  const slight = foldPoints(handParts('left', { at: { x: 0, y: 0 }, scale: 1, pose: handDigitCurlTable('index', 0.3) }).paths.index);
  assert.deepEqual(slight[0], slight[2]);
});

test('one press draws both hands, rigs them and gives them poses', () => {
  const state = drawn();
  assert.equal(areHandsInstalled(state), false);
  assert.equal(installHands(state), true);
  assert.equal(areHandsInstalled(state), true);
  assert.deepEqual(validateRig(state), []);

  for (const side of ['left', 'right']) {
    const hand = state.hands[side];
    assert.equal(hand.element, handElementId(side), 'the record names the group');
    assert.equal(hand.parent, 'faceRoot', 'the hands hang off the head, so they travel with it');
    assert.ok(hand.reach.x > 0 && hand.reach.rotation > 0, 'and they can be moved from the first frame');
    assert.deepEqual(hand.poses.map((pose) => pose.id), GENERATED_HAND_POSES.map((pose) => pose.id));
    // Every pose is ready: its parameter drives a key on the parts it moves --
    // directly, or through the pose × facing grid of a pose drawn in profile.
    for (const pose of hand.poses) {
      assert.equal(pose.shapeKey, null, 'no key on the record: the parts carry them');
      assert.ok(['driver', 'keyform'].includes(handPoseDrive(state, pose, side)), `${pose.id} needs a driven key`);
      assert.ok(state.params[pose.parameter], `${pose.parameter} is missing`);
      const own = (id) => id.startsWith(hand.element);
      assert.ok(state.shapeKeys.some((key) => key.driver?.parameter === pose.parameter && own(key.target))
        || state.keyforms.some((keyform) => keyform.axes[0]?.parameter === pose.parameter && own(keyform.target.id)), `${pose.id} drives its own hand`);
    }
    // Every part keeps the outline its keys deform; the group keeps the tilt and the pivot.
    for (const part of HAND_PART_IDS) assert.ok(state.elements[handPartId(side, part)].restPath, `${part} has a rest outline`);
    const group = state.elements[hand.element];
    assert.equal(group.baseTransform.pivotX > 0, true, 'a wave turns the hand around itself');
    assert.equal(group.baseTransform.rotation, side === 'left' ? 200 : 160);
    assert.equal(group.restPath, undefined, 'a group has no outline of its own');
    for (const name of [handGripParameter(side), ...HAND_DIGIT_CONTROLS.map((digit) => handDigitParameter(side, digit.id))]) assert.ok(state.params[name], name);
    assert.equal(state.params[`hand${side === 'right' ? 'R' : 'L'}Flip`], undefined, 'a hand made of parts turns through its facing, not a mirror');
  }
  assert.ok(state.animationClips.some((clip) => clip.id === 'hand-wave'), 'and there is something to try');
  // Twice is a no-op rather than a second pair.
  assert.equal(installHands(state) && state.hands.left.poses.length, GENERATED_HAND_POSES.length);
});

test('a pose reaches the parts through driven keys, and only the hand it belongs to', () => {
  const state = drawn();
  installHands(state);
  const at = (values) => frameOf(state, values);
  const rest = at({});
  const fist = at(value('handLFist', 1));
  // Nothing special about a hand pose: the parameter drives the keys, the keys
  // deform the parts. A fist bends the four digits and never touches the cuff.
  for (const digit of HAND_DIGITS) assert.notEqual(fist[handPartId('left', digit.id)].path, rest[handPartId('left', digit.id)].path, `${digit.id} changed`);
  assert.equal(fist[handPartId('left', 'cuff')].path, rest[handPartId('left', 'cuff')].path, 'the cuff stays');
  for (const part of HAND_PART_IDS) assert.equal(fist[handPartId('right', part)].path, rest[handPartId('right', part)].path, 'the other hand is untouched');
  // The hand also moves, as a whole: a reach the author can drive from the first frame.
  const reached = at({ handLX: { type: 'number', min: -1, max: 1, default: 0, value: 1 } });
  assert.ok(reached.handLeft.transform.x > rest.handLeft.transform.x);
  assert.equal(reached.handLeftIndex.transform.x, rest.handLeftIndex.transform.x, 'the parts ride inside the group');
});

test('every digit has a curl of its own, on top of the poses', () => {
  const state = drawn();
  installHands(state);
  const at = (values) => frameOf(state, values);
  const rest = at({});
  for (const digit of HAND_DIGIT_CONTROLS) {
    const name = handDigitParameter('left', digit.id);
    const curled = at(value(name, 1));
    assert.notEqual(curled[handPartId('left', digit.id)].path, rest[handPartId('left', digit.id)].path, `${digit.id} curls on its own`);
    for (const other of HAND_DIGITS.filter((item) => item.id !== digit.id)) {
      assert.equal(curled[handPartId('left', other.id)].path, rest[handPartId('left', other.id)].path, `${other.id} is left alone`);
    }
  }
  assert.equal(handDigitParameter('right', 'index'), 'handRIndex');
  // Shape keys add, so a pose and a finger of one's own compose rather than
  // one replacing the other.
  const fistAndThumb = at({ ...value('handLFist', 1), ...value('handLThumb', 1) });
  assert.notEqual(fistAndThumb.handLeftThumb.path, at(value('handLFist', 1)).handLeftThumb.path);
  // And the grip closes every finger at once.
  const grip = at(value(handGripParameter('left'), 1));
  for (const digit of HAND_DIGITS) assert.notEqual(grip[handPartId('left', digit.id)].path, rest[handPartId('left', digit.id)].path);
});

test('the facing axis turns the hand from its palm to either profile, part by part', () => {
  const state = drawn();
  installHands(state);
  const facing = handFacingParameter('left');
  assert.deepEqual([state.params[facing].min, state.params[facing].max, state.params[facing].default], [-1, 1, 0]);
  const at = (values) => frameOf(state, values);
  const part = (frame, id) => frame[handPartId('left', id)].path;
  const rest = at({});
  // The hand as installed: where the artwork is, at the artwork's size.
  const hand = state.hands.left, group = state.elements.handLeft;
  const where = { at: { x: group.baseTransform.pivotX, y: group.baseTransform.pivotY }, box: { width: 240, height: Number(/viewBox="0 0 \d+ (\d+)"/.exec(state.svgMarkup)?.[1]) || 240 } };
  assert.ok(hand.element === 'handLeft');
  // At 1 every part is the profile drawing, exactly; at -1 the same profile turned over; at 0 the palm.
  const near = at(value(facing, 1)), far = at(value(facing, -1));
  const profile = handParts('left', { ...where, view: 'profile' }), farProfile = handParts('left', { ...where, view: 'far', flip: true });
  const same = (a, b) => assert.deepEqual(Array.from(parsePath(a).values, (v) => Math.round(v * 100)), Array.from(parsePath(b).values, (v) => Math.round(v * 100)));
  for (const id of HAND_PART_IDS) {
    same(part(near, id), profile.paths[id]);
    same(part(far, id), farProfile.paths[id]);
    same(part(rest, id), state.elements[handPartId('left', id)].restPath);
  }
  // Halfway is between the two drawings, not a collapse: the palm's width is between the palm's and the profile's.
  const width = (d) => { const xs = []; const { values } = parsePath(d); for (let i = 0; i < values.length; i += 2) xs.push(values[i]); return Math.max(...xs) - Math.min(...xs); };
  const half = at(value(facing, 0.5));
  assert.ok(width(part(half, 'palm')) < width(part(rest, 'palm')) && width(part(half, 'palm')) > width(part(near, 'palm')));
  // On the far side the thumb goes behind the palm and fades, unless it is up.
  assert.equal(far.handLeftThumb.depthBand, 'behind');
  assert.equal(far.handLeftThumb.opacity, 0);
  assert.equal(near.handLeftThumb.opacity, 1);
  assert.equal(at({ ...value(facing, -1), ...value('handLThumbsUp', 1) }).handLeftThumb.opacity, 1);
  // A fist in profile is the profile fist, not the palm fist's deltas added to a profile.
  const fistNear = at({ ...value(facing, 1), ...value('handLFist', 1) });
  const profileFist = handParts('left', { ...where, view: 'profile', pose: HAND_PROFILE_POSE_TABLES.fist });
  for (const id of HAND_PART_IDS) same(part(fistNear, id), profileFist.paths[id]);
  // And in the palm view the palm fist, as before the axis existed.
  const fistPalm = at(value('handLFist', 1));
  const palmFist = handParts('left', { ...where, pose: HAND_POSE_TABLES.fist });
  for (const id of HAND_PART_IDS) same(part(fistPalm, id), palmFist.paths[id]);
  // The stops are what the View chips offer.
  assert.deepEqual(HAND_FACING_STOPS.map((stop) => stop.value), [-1, 0, 1]);
  assert.deepEqual(validateRig(state), []);
});

test('a fingertip is where the tube ends, at every pose', () => {
  const rest = handDigitTip('left', 'index', { at: { x: 100, y: 100 }, box: { width: 240, height: 240 } });
  const curled = handDigitTip('left', 'index', { at: { x: 100, y: 100 }, box: { width: 240, height: 240 }, curl: { index: 1 } });
  assert.ok(rest.y < 100, 'the finger points up from the palm');
  assert.ok(curled.y > rest.y, 'a curled finger is shorter');
  assert.equal(handDigitTip('left', 'toe', {}), null);
  // The right hand's tip is the left one's, mirrored about the palm.
  const right = handDigitTip('right', 'index', { at: { x: 100, y: 100 }, box: { width: 240, height: 240 } });
  assert.equal(Math.round((rest.x + right.x) * 10) / 10, 200);
  assert.equal(right.y, rest.y);
});

test('the look is a token: gloves by default, skin on request', () => {
  const gloves = drawn();
  assert.match(gloves.svgMarkup, new RegExp(`id="handLeftPalm"[^>]*fill="${HAND_STYLES.glove.fill}"`));
  assert.equal(installedHandStyle(gloves), 'glove');
  const skin = drawn({ style: 'skin' });
  assert.match(skin.svgMarkup, new RegExp(`id="handLeftPalm"[^>]*fill="${HAND_STYLES.skin.fill}"`));
  assert.equal(installedHandStyle(skin), 'skin');
  // Same parts, same layouts: only the paint differs.
  assert.equal(installHands(skin), true);
  assert.deepEqual(validateRig(skin), []);
  assert.equal(installedHandStyle({}), 'glove');
});
