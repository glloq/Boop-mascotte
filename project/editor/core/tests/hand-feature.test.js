import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { handPath, handPosePath, HAND_DIGITS, handRestPoint } from '../sample/hand-artwork.js';
import { areHandsInstalled, handDigitParameter, handsMarkup, installHands, GENERATED_HAND_POSES, HAND_DIGIT_CONTROLS } from '../sample/hand-feature.js';
import { compileRigFrame, pathsCompatible } from '../../../runtime/runtime.js';

/** The document as it is once the canvas has appended the artwork. */
function drawn() {
  const state = createCleanProjectState();
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${handsMarkup({})}</svg>`;
  const element = (d) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d } });
  state.elements = {
    faceRoot: element(''),
    handLeft: element(handPath({ at: handRestPoint('left') })),
    handRight: element(handPath({ at: handRestPoint('right'), mirror: true }))
  };
  state.states = { idle: {} };
  state.activeState = 'idle';
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: [] },
    { id: 'handLeft', type: 'path', name: 'Left hand', children: [] },
    { id: 'handRight', type: 'path', name: 'Right hand', children: [] }];
  return state;
}

test('a generated hand has four digits, and every pose keeps its outline', () => {
  assert.equal(HAND_DIGITS.length, 4, 'a thumb and three fingers');
  const rest = handPath({ at: { x: 0, y: 0 } });
  // One arc per digit, and one point per digit corner: the shape of the path
  // is what makes a pose a shape key rather than a second drawing.
  assert.equal((rest.match(/A /g) || []).length, 4);
  for (const pose of ['fist', 'point', 'peace', 'thumbsUp', 'spread', 'relax', 'present']) {
    const posed = handPosePath('left', pose, { at: { x: 0, y: 0 } });
    assert.ok(pathsCompatible(rest, posed), `${pose} must morph from the open hand`);
    assert.notEqual(posed, rest, `${pose} has to look different`);
  }
  // The other hand is the mirror of it: the same outline, the thumb on the
  // other side, so one drawing serves both and their poses interchange.
  const right = handPath({ at: { x: 0, y: 0 }, mirror: true });
  assert.ok(pathsCompatible(rest, right));
  assert.notEqual(right, rest);
});

test('one press draws both hands, rigs them and gives them poses', () => {
  const state = drawn();
  assert.equal(areHandsInstalled(state), false);
  assert.equal(installHands(state), true);
  assert.equal(areHandsInstalled(state), true);
  assert.deepEqual(validateRig(state), []);

  for (const side of ['left', 'right']) {
    const hand = state.hands[side];
    assert.equal(hand.parent, 'faceRoot', 'the hands hang off the head, so they travel with it');
    assert.ok(hand.reach.x > 0 && hand.reach.rotation > 0, 'and they can be moved from the first frame');
    assert.deepEqual(hand.poses.map((pose) => pose.id), GENERATED_HAND_POSES.map((pose) => pose.id));
    // Every pose is ready: it has a shape key, so pressing it does something.
    for (const pose of hand.poses) {
      assert.ok(pose.shapeKey, `${pose.id} needs a shape`);
      assert.ok(state.shapeKeys.some((key) => key.id === pose.shapeKey), `${pose.shapeKey} is missing`);
      assert.ok(state.params[pose.parameter], `${pose.parameter} is missing`);
    }
    const element = state.elements[hand.element];
    assert.ok(element.restPath, 'a shape key deforms a rest outline');
    assert.equal(element.baseTransform.pivotX > 0, true, 'a wave turns the hand around itself');
  }
  assert.ok(state.animationClips.some((clip) => clip.id === 'hand-wave'), 'and there is something to try');
  // Twice is a no-op rather than a second pair.
  assert.equal(installHands(state) && state.hands.left.poses.length, GENERATED_HAND_POSES.length);
});

test('every digit has a curl of its own, on top of the poses', () => {
  const state = drawn();
  installHands(state);
  const options = { shapeKeys: state.shapeKeys, hands: state.hands };
  const value = (name, amount) => ({ [name]: { type: 'number', min: 0, max: 1, default: 0, value: amount } });
  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, options).handLeft.path;
  const rest = at({});
  for (const digit of HAND_DIGIT_CONTROLS) {
    const name = handDigitParameter('left', digit.id);
    assert.ok(state.params[name], `${name} is missing`);
    assert.notEqual(at(value(name, 1)), rest, `${digit.id} curls on its own`);
  }
  assert.equal(handDigitParameter('right', 'index'), 'handRIndex');
  // Shape keys add, so a pose and a finger of one's own compose rather than
  // one replacing the other.
  const fistAndThumb = at({ ...value('handLFist', 1), ...value('handLThumb', 1) });
  assert.notEqual(fistAndThumb, at(value('handLFist', 1)));
});

test('a pose reaches the artwork through the ordinary hand and shape-key path', () => {
  const state = drawn();
  installHands(state);
  const options = { shapeKeys: state.shapeKeys, hands: state.hands };
  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, options);
  const rest = at({});
  const fist = at({ handLFist: { type: 'number', min: 0, max: 1, default: 0, value: 1 } });
  // Nothing special about a hand pose: the parameter raises the hand's pose,
  // the pose weights its shape key, the shape key deforms the outline.
  assert.ok(fist.handLeft.shapeWeights?.['handLeft-fist'] > 0, 'the pose raises its own shape key');
  assert.notEqual(fist.handLeft.path, rest.handLeft.path, 'a fist changes the hand');
  assert.equal(fist.handRight.path, rest.handRight.path, 'and only the hand it belongs to');
  // The hand also moves: a reach the author can drive from the first frame.
  const reached = at({ handLX: { type: 'number', min: -1, max: 1, default: 0, value: 1 } });
  assert.ok(reached.handLeft.transform.x > rest.handLeft.transform.x);
});
