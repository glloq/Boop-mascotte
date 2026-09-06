import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, normalizeHands, softenReach, handOffset, applyElementTransform, anchorDrift } from '../../../runtime/runtime.js';
import { createSpringFollower, createInertiaGroup } from '../../../runtime/inertia.js';
import * as runtimeHands from '../../../runtime/hands.js';
import {
  assignHand, removeHand, setHandAnchor, setHandParent, setHandRestOffset, setHandReach,
  setHandDepth, setHandSoftness, setHandInertia, addHandPose, removeHandPose,
  mirrorHand, handParameters, handPoseParameter, handReachEllipse, withinReach, SUGGESTED_HAND_POSES
} from '../hands/hand-model.js';
import { validateHands } from '../validation/rig-validator.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState, createSampleProject } from '../state/store.js';
import { shapeDeltaFromPaths } from '../shape-keys/shape-key-model.js';

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const elements = () => ({
  body: { baseTransform: transform(), bindings: { translateY: { expression: 'bounce', amplitude: 10 } } },
  handLeft: { baseTransform: transform() },
  handRight: { baseTransform: transform() }
});

const rigged = () => {
  const a = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: -20, y: 40 } });
  const b = assignHand(a.hands, 'right', { element: 'handRight', parent: 'body', anchor: { x: 20, y: 40 } });
  return b.hands;
};

test('a hand is assigned per side with the parameters it needs', () => {
  const result = assignHand(null, 'left', { element: 'handLeft' });
  assert.equal(result.ok, true);
  assert.equal(result.hands.left.element, 'handLeft');
  assert.deepEqual(Object.keys(result.parameters), ['handLX', 'handLY', 'handLRotation', 'handLScale', 'handLDepth']);
  assert.deepEqual(Object.keys(assignHand(null, 'right', { element: 'handRight' }).parameters), ['handRX', 'handRY', 'handRRotation', 'handRScale', 'handRDepth']);
});

test('assigning refuses an unknown side or missing artwork with a readable reason', () => {
  assert.equal(assignHand(null, 'foot', { element: 'x' }).reason, 'unknown-side');
  assert.equal(assignHand(null, 'left', {}).reason, 'missing-artwork');
  assert.match(assignHand(null, 'left', {}).message, /Choose the artwork/);
});

test('left and right hands are independent', () => {
  const hands = rigged();
  const frame = compileRigFrame(elements(), { handLX: 1, handLY: 0, handRX: 0, handRY: 0 }, {}, {}, { hands });
  assert.ok(frame.handLeft.transform.x > 0);
  assert.equal(frame.handRight.transform.x, 0);
});

test('moving the body moves both anchors while local hand movement is preserved', () => {
  const hands = rigged();
  const still = compileRigFrame(elements(), { bounce: 0, handLX: 0.5 }, {}, {}, { hands });
  const bounced = compileRigFrame(elements(), { bounce: 1, handLX: 0.5 }, {}, {}, { hands });
  assert.equal(bounced.body.transform.y, 10);
  assert.equal(bounced.handLeft.transform.y - still.handLeft.transform.y, 10);
  assert.equal(bounced.handRight.transform.y - still.handRight.transform.y, 10);
  // Local movement survives the drift instead of being replaced by it.
  assert.equal(bounced.handLeft.transform.x, still.handLeft.transform.x);
});

test('a hand with no parent does not drift', () => {
  const hands = { left: normalizeHands({ hands: { left: { element: 'handLeft', anchor: { x: 5, y: 5 } } } }).left };
  const frame = compileRigFrame(elements(), { bounce: 1 }, {}, {}, { hands });
  assert.equal(frame.handLeft.transform.y, 0);
});

test('an anchor follows the body through rotation and scale, not just translation', () => {
  const rotated = applyElementTransform(transform({ rotation: 90, pivotX: 0, pivotY: 0 }), { x: 10, y: 0 });
  assert.ok(Math.abs(rotated.x) < 1e-9 && Math.abs(rotated.y - 10) < 1e-9);
  const scaled = applyElementTransform(transform({ scaleX: 2, scaleY: 3 }), { x: 4, y: 5 });
  assert.deepEqual(scaled, { x: 8, y: 15 });
  const drift = anchorDrift(
    { parent: 'body', anchor: { x: 10, y: 0 } },
    { body: { baseTransform: transform() } },
    { body: { transform: transform({ rotation: 90 }) } }
  );
  assert.ok(Math.abs(drift.x + 10) < 1e-9 && Math.abs(drift.y - 10) < 1e-9);
});

test('hand rotation and scale are ranges around rest', () => {
  const hands = rigged();
  const frame = compileRigFrame(elements(), { handLRotation: 1, handLScale: 1 }, {}, {}, { hands });
  assert.equal(frame.handLeft.transform.rotation, 30);
  assert.ok(Math.abs(frame.handLeft.transform.scaleX - 1.2) < 1e-9);
  const negative = compileRigFrame(elements(), { handLRotation: -0.5 }, {}, {}, { hands });
  assert.equal(negative.handLeft.transform.rotation, -15);
});

test('reach maps normalized input onto the ellipse', () => {
  const hand = normalizeHands({ hands: { left: { element: 'handLeft', reach: { x: 40, y: 30 } } } }).left;
  assert.deepEqual(handOffset(hand, 1, 0), { x: 40, y: 0 });
  assert.deepEqual(handOffset(hand, 0, -1), { x: 0, y: -30 });
  assert.deepEqual(handOffset(hand, 0, 0), { x: 0, y: 0 });
});

test('reach is a soft limit: a little overshoot, never a wall', () => {
  assert.equal(softenReach(0.5), 0.5);
  assert.equal(softenReach(1), 1);
  assert.ok(softenReach(1.4, 0.25) > 1 && softenReach(1.4, 0.25) < 1.25);
  assert.ok(softenReach(50, 0.25) <= 1.25);
  // A hard limit is still available for anyone who wants one.
  assert.equal(softenReach(9, 0), 1);
  assert.equal(withinReach(0.6, 0.6), true);
  assert.equal(withinReach(1, 1), false);
});

test('a diagonal at full input stays close to the reach boundary', () => {
  const hand = normalizeHands({ hands: { left: { element: 'handLeft', reach: { x: 40, y: 40 } } } }).left;
  const offset = handOffset(hand, 1, 1);
  const radius = Math.hypot(offset.x / 40, offset.y / 40);
  assert.ok(radius > 1 && radius < 1.25, `radius ${radius}`);
});

test('the reach guide is an ellipse around the anchor in artwork coordinates', () => {
  const hands = setHandRestOffset(rigged(), 'left', { x: 5, y: -5 });
  assert.deepEqual(handReachEllipse(hands.left, elements()), { cx: -15, cy: 35, rx: 40, ry: 30, overshoot: 0.25 });
});

test('anchor, rest offset, reach, depth, softness and inertia are edited immutably', () => {
  const hands = rigged();
  assert.deepEqual(setHandAnchor(hands, 'left', { x: 1, y: 2 }).left.anchor, { x: 1, y: 2 });
  assert.deepEqual(hands.left.anchor, { x: -20, y: 40 });
  assert.equal(setHandParent(hands, 'left', 'torso').left.parent, 'torso');
  assert.equal(setHandReach(hands, 'left', { x: 99 }).left.reach.x, 99);
  assert.equal(setHandReach(hands, 'left', { x: 99 }).left.reach.y, 30);
  assert.equal(setHandDepth(hands, 'left', 0.8).left.depth, 0.8);
  assert.equal(setHandSoftness(hands, 'left', 0).left.softness, 0);
  assert.equal(setHandInertia(hands, 'left', { enabled: true }).left.inertia.enabled, true);
  assert.equal(removeHand(removeHand(hands, 'left'), 'right'), null);
});

/* Poses */

test('a pose is added with its own parameter and can be removed', () => {
  const hands = addHandPose(rigged(), 'left', { id: 'wave', name: 'Wave', shapeKey: 'handLeft-wave' });
  assert.deepEqual(hands.left.poses, [{ id: 'wave', name: 'Wave', parameter: 'handLWave', shapeKey: 'handLeft-wave', variant: null }]);
  assert.equal(handPoseParameter('right', 'thumbsUp'), 'handRThumbsUp');
  assert.deepEqual(removeHandPose(hands, 'left', 'wave').left.poses, []);
  assert.equal(SUGGESTED_HAND_POSES.length, 7);
});

test('no pose is mandatory: a hand with none still animates', () => {
  const frame = compileRigFrame(elements(), { handLX: 1 }, {}, {}, { hands: rigged() });
  assert.equal(frame.handLeft.shapeWeights, undefined);
  assert.ok(frame.handLeft.transform.x > 0);
});

test('a shape-key pose deforms the neutral hand (method A)', () => {
  const rest = 'M0 0 L10 0 L10 10 Z';
  const withRest = { ...elements(), handLeft: { baseTransform: transform(), restPath: rest } };
  const hands = addHandPose(rigged(), 'left', { id: 'wave', shapeKey: 'wave' });
  const shapeKeys = [{ id: 'wave', target: 'handLeft', delta: shapeDeltaFromPaths(rest, 'M0 -4 L10 0 L10 10 Z') }];
  const frame = compileRigFrame(withRest, { handLWave: 0.5 }, {}, {}, { hands, shapeKeys });
  assert.equal(frame.handLeft.shapeWeights.wave, 0.5);
  assert.equal(frame.handLeft.path, 'M0 -2 L10 0 L10 10 Z');
});

test('an artwork variant cross-fades instead of cutting (method B)', () => {
  const withVariant = { ...elements(), handLeftFist: { baseTransform: transform(), baseOpacity: 1 } };
  const hands = addHandPose(rigged(), 'left', { id: 'fist', variant: 'handLeftFist' });
  const off = compileRigFrame(withVariant, { handLFist: 0 }, {}, {}, { hands });
  assert.equal(off.handLeft.opacity, 1);
  assert.equal(off.handLeftFist.opacity, 0);
  const half = compileRigFrame(withVariant, { handLFist: 0.5 }, {}, {}, { hands });
  assert.equal(half.handLeft.opacity, 0.5);
  assert.equal(half.handLeftFist.opacity, 0.5);
  const full = compileRigFrame(withVariant, { handLFist: 1 }, {}, {}, { hands });
  assert.equal(full.handLeft.opacity, 0);
  assert.equal(full.handLeftFist.opacity, 1);
});

test('a pose transition passes through intermediate weights, never a jump', () => {
  const withVariant = { ...elements(), handLeftFist: { baseTransform: transform(), baseOpacity: 1 } };
  const hands = addHandPose(rigged(), 'left', { id: 'fist', variant: 'handLeftFist' });
  const opacities = [0, 0.25, 0.5, 0.75, 1].map((weight) =>
    compileRigFrame(withVariant, { handLFist: weight }, {}, {}, { hands }).handLeftFist.opacity);
  assert.deepEqual(opacities, [0, 0.25, 0.5, 0.75, 1]);
});

test('a drawing standing in for the hand goes where the hand goes (method B follows)', () => {
  const withVariant = { ...elements(), handLeftFist: { baseTransform: transform(), baseOpacity: 1 } };
  const hands = addHandPose(rigged(), 'left', { id: 'fist', variant: 'handLeftFist' });
  const frame = compileRigFrame(withVariant, { bounce: 1, handLX: 0.5, handLRotation: 1, handLScale: 1, handLFist: 1 }, {}, {}, { hands });
  const hand = frame.handLeft.transform, drawing = frame.handLeftFist.transform;
  // The same reach, the same anchor drift, the same turn and size, around the same pivot.
  assert.deepEqual([drawing.x, drawing.y, drawing.rotation, drawing.scaleX, drawing.scaleY, drawing.pivotX, drawing.pivotY],
    [hand.x, hand.y, hand.rotation, hand.scaleX, hand.scaleY, hand.pivotX, hand.pivotY]);
  assert.ok(drawing.x > 0 && drawing.y === 10 && drawing.rotation === 30, 'reach, drift and turn all reached the drawing');
  assert.equal(frame.handLeftFist.depthBand, frame.handLeft.depthBand, 'and it sits where the hand sits in the draw order');
  assert.equal(frame.handLeftFist.opacity, 1);
  assert.equal(frame.handLeft.opacity, 0);
});

test('two drawings raised at once share the hand instead of piling up', () => {
  const withVariants = { ...elements(), fistArt: { baseTransform: transform(), baseOpacity: 1 }, pointArt: { baseTransform: transform(), baseOpacity: 1 } };
  let hands = addHandPose(rigged(), 'left', { id: 'fist', variant: 'fistArt' });
  hands = addHandPose(hands, 'left', { id: 'point', variant: 'pointArt' });
  const both = compileRigFrame(withVariants, { handLFist: 1, handLPoint: 1 }, {}, {}, { hands });
  assert.equal(both.fistArt.opacity, 0.5);
  assert.equal(both.pointArt.opacity, 0.5);
  assert.equal(both.handLeft.opacity, 0);
  // Below one in total, nothing is rescaled: a cross-fade stays a cross-fade.
  const some = compileRigFrame(withVariants, { handLFist: 0.2, handLPoint: 0.3 }, {}, {}, { hands });
  assert.equal(some.fistArt.opacity, 0.2);
  assert.equal(some.pointArt.opacity, 0.3);
  assert.equal(some.handLeft.opacity, 0.5);
});

test('a pose is not empty when its parameter drives a shape key, a pose grid or a binding', () => {
  const hands = normalizeHands({ hands: { left: { element: 'handLeft', poses: [{ id: 'fist' }] } } });
  const base = { elements: { handLeft: {} }, params: { ...handParameters('left'), handLFist: { type: 'number', min: 0, max: 1, default: 0, value: 0 } }, hands };
  const empty = (state) => validateHands(state).some((issue) => /does nothing yet/.test(issue));
  assert.equal(empty(base), true);
  assert.equal(empty({ ...base, shapeKeys: [{ id: 'k', target: 'handLeftIndex', delta: [1], driver: { mode: 'range', parameter: 'handLFist', min: 0, max: 1 } }] }), false, 'a driven key on a part');
  assert.equal(empty({ ...base, keyforms: [{ id: 'g', target: { kind: 'element', id: 'handLeftIndex' }, channel: 'pathShape', shapeKey: 'k', axes: [{ parameter: 'handLFist', values: [0, 1] }] }] }), false, 'a pose grid over the parameter');
  assert.equal(empty({ ...base, elements: { handLeft: {}, fold: { bindings: { opacity: { enabled: true, expression: 'handLFist', curve: 'linear', amplitude: 1, offset: 0 } } } } }), false, 'a binding that reads it');
  assert.equal(empty({ ...base, shapeKeys: [{ id: 'k', target: 'x', delta: [1], driver: { mode: 'range', parameter: 'handLPoint', min: 0, max: 1 } }] }), true, 'another parameter is not this pose');
});

/* Mirroring */

test('mirroring copies a hand to the other side with corrected geometry', () => {
  let hands = addHandPose(rigged(), 'left', { id: 'wave', shapeKey: 'handLeft-wave' });
  hands = setHandRestOffset(hands, 'left', { x: 6, y: 2 });
  const mirrored = mirrorHand(hands, 'left', { mirrorX: 0, element: 'handRight', shapeKeys: { 'handLeft-wave': 'handRight-wave' } });
  assert.deepEqual(mirrored.right.anchor, { x: 20, y: 40 });
  assert.deepEqual(mirrored.right.restOffset, { x: -6, y: 2 });
  assert.equal(mirrored.right.reach.rotation, -30);
  assert.equal(mirrored.right.element, 'handRight');
  assert.deepEqual(mirrored.right.poses[0], { id: 'wave', name: 'wave', parameter: 'handRWave', shapeKey: 'handRight-wave', variant: null });
  // The source hand is untouched.
  assert.equal(hands.left.reach.rotation, 30);
});

test('mirroring around an artboard centre line places the hand symmetrically', () => {
  const hands = mirrorHand(rigged(), 'left', { mirrorX: 100, element: 'handRight' });
  assert.equal(hands.right.anchor.x, 220);
});

test('mirroring keeps a pose unlinked when no shape key is supplied for it', () => {
  const hands = addHandPose(rigged(), 'left', { id: 'wave', shapeKey: 'handLeft-wave' });
  assert.equal(mirrorHand(hands, 'left', {}).right.poses[0].shapeKey, null);
});

/* Inertia */

test('a spring follower lags, overshoots and settles', () => {
  const follower = createSpringFollower({ stiffness: 0.3, damping: 0.7, maxOvershoot: 0.4 });
  follower.reset(0);
  const samples = [];
  for (let i = 0; i < 40; i += 1) samples.push(follower.step(1));
  assert.ok(samples[0] < 1, 'lags behind at first');
  assert.ok(Math.max(...samples) > 1, 'overshoots');
  assert.ok(Math.abs(samples.at(-1) - 1) < 0.01, 'settles');
});

test('overshoot is capped so a stiff setting cannot throw the hand away', () => {
  const follower = createSpringFollower({ stiffness: 1, damping: 1, maxOvershoot: 0.2 });
  follower.reset(0);
  const samples = [];
  for (let i = 0; i < 60; i += 1) samples.push(follower.step(1));
  assert.ok(Math.max(...samples) <= 1.2 + 1e-9);
  assert.ok(Math.min(...samples) >= -0.2 - 1e-9);
});

test('inertia is switchable off and passes values straight through', () => {
  const group = createInertiaGroup({ enabled: false });
  assert.deepEqual(group.step({ handLX: 1 }), { handLX: 1 });
  assert.deepEqual(group.step({ handLX: -1 }), { handLX: -1 });
});

test('followAmount dials the effect down without retuning the spring', () => {
  const full = createInertiaGroup({ enabled: true, stiffness: 0.3, damping: 0.7, followAmount: 1 });
  const half = createInertiaGroup({ enabled: true, stiffness: 0.3, damping: 0.7, followAmount: 0.5 });
  full.step({ handLX: 0 }); half.step({ handLX: 0 });
  const a = full.step({ handLX: 1 }).handLX;
  const b = half.step({ handLX: 1 }).handLX;
  assert.ok(a < 1 && b < 1);
  assert.ok(Math.abs(b - 1) < Math.abs(a - 1), 'a smaller followAmount lags less');
});

test('a long stall does not launch the hand across the screen', () => {
  const follower = createSpringFollower({ stiffness: 0.4, damping: 0.7, maxOvershoot: 0.4 });
  follower.reset(0);
  assert.ok(follower.step(1, 30) <= 1.4);
});

test('the default inertia settings are stable', () => {
  const group = createInertiaGroup({ enabled: true });
  group.step({ handLX: 0 });
  let last = 0;
  for (let i = 0; i < 200; i += 1) last = group.step({ handLX: 1 }).handLX;
  assert.ok(Math.abs(last - 1) < 0.01, `settled at ${last}`);
});

/* Model plumbing */

test('hands survive normalization, snapshots and export', () => {
  const rig = normalizeRig({ params: {}, states: {}, elements: elements(), hands: rigged() });
  assert.equal(rig.hands.left.element, 'handLeft');
  assert.equal(normalizeRig({ params: {}, states: {}, elements: {} }).hands, null);

  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><g id="handLeft"><path d="M0 0L1 1"/></g></svg>';
  state.elements = elements();
  state.params = { ...state.params, ...handParameters('left'), ...handParameters('right') };
  state.hands = rigged();
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.hands, state.hands);
  assert.equal(createExportRig(restored).hands.right.element, 'handRight');
});

test('a project without hands restores as none', () => {
  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><path id="a" d="M0 0L1 1"/></svg>';
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.equal(restored.hands, null);
});

test('hand diagnostics read like advice', () => {
  const hands = normalizeHands({ hands: { left: { element: 'ghost', parent: 'nobody', reach: { x: 0, y: 10 }, poses: [{ id: 'wave' }] } } });
  const issues = validateHands({ elements: {}, params: {}, hands });
  assert.ok(issues.some((issue) => /its artwork "ghost" no longer exists/.test(issue)));
  assert.ok(issues.some((issue) => /anchored to "nobody"/.test(issue)));
  assert.ok(issues.some((issue) => /reach must be wider than zero/.test(issue)));
  assert.ok(issues.some((issue) => /does nothing yet/.test(issue)));
  assert.deepEqual(validateHands({ elements: {}, params: {} }), []);
});

test('hand diagnostics catch unstable inertia and missing pose targets', () => {
  const hands = normalizeHands({ hands: { right: { element: 'handRight', poses: [{ id: 'wave', shapeKey: 'gone' }], inertia: { enabled: true, damping: 1 } } } });
  const issues = validateHands({ elements: { handRight: {} }, params: { ...handParameters('right') }, shapeKeys: [], hands });
  assert.ok(issues.some((issue) => /shape key that no longer exists: "gone"/.test(issue)));
  assert.deepEqual(issues.filter((issue) => /stiffness/.test(issue)), []);
});

/**
 * A hand's depth is its record's, plus its parameter, plus whatever the
 * artwork's own depth says: a keyform on the group is how a pair rests behind
 * the head (docs/HAND_RIGGING.md, "Behind the head").
 */
test('the artwork\'s own depth counts towards the hand\'s band', () => {
  const hands = rigged();
  const keyforms = [{ id: 'handLeft-show-depth', target: { kind: 'element', id: 'handLeft' }, channel: 'depth',
    axes: [{ parameter: 'handLShow', values: [0, 0.7, 1] }], keyforms: [{ at: [0], value: -1 }, { at: [1], value: -1 }, { at: [2], value: 0 }] }];
  const params = { handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 }, handLDepth: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  const at = (show, depth = 0) => compileRigFrame(elements(), { handLShow: show, handLDepth: depth }, {}, {}, { hands: normalizeHands({ hands }), keyforms, params });
  assert.equal(at(0).handLeft.depthBand, 'behind', 'tucked away: behind whatever it was drawn over');
  assert.equal(at(0).handLeft.depth, -1);
  assert.equal(at(1).handLeft.depthBand, 'normal', 'out: where it was drawn');
  assert.equal(at(1).handLeft.depth, 0);
  // The parameter and the record still add on top, clamped like any depth.
  assert.equal(at(1, 0.5).handLeft.depth, 0.5);
  assert.equal(at(0, 0.5).handLeft.depth, -0.5);
  assert.equal(at(0, -1).handLeft.depth, -1, 'never past the back');
  // A hand with no such keyform is exactly as before.
  assert.equal(compileRigFrame(elements(), { handLDepth: 0.2 }, {}, {}, { hands: normalizeHands({ hands }) }).handLeft.depth, 0.2);
});

/**
 * A hand asked out from behind the head travels there (docs/HAND_RIGGING.md,
 * "Behind the head"): whatever sets the show parameter, in one frame or over
 * many, the drawn value eases towards it over a fixed span.
 */
test('the reveal eases the show parameters towards what is asked, and never jumps', () => {
  const { createHandReveal, HAND_REVEAL_SECONDS } = runtimeHands;
  const reveal = createHandReveal({ handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 }, headX: {} });
  assert.deepEqual(reveal.names, ['handLShow'], 'only the show parameters the rig has');
  // The first frame is where the hand starts: nothing slides in from nowhere.
  assert.equal(reveal.step({ handLShow: 0, headX: 0.3 }, 0).handLShow, 0);
  assert.equal(reveal.settled(), true);
  // Asked out in one frame, it is on its way, not there.
  const first = reveal.step({ handLShow: 1 }, 0.05);
  assert.ok(first.handLShow > 0 && first.handLShow < 0.2, `eased in: ${first.handLShow}`);
  assert.equal(reveal.settled(), false);
  const half = reveal.step({ handLShow: 1 }, HAND_REVEAL_SECONDS / 2 - 0.05);
  assert.ok(Math.abs(half.handLShow - 0.5) < 0.01, `halfway at half the span: ${half.handLShow}`);
  const there = reveal.step({ handLShow: 1 }, HAND_REVEAL_SECONDS);
  assert.equal(there.handLShow, 1);
  assert.equal(reveal.settled(), true);
  // Sent back halfway out, it turns round from where it is.
  reveal.step({ handLShow: 0 }, 0);
  const turning = reveal.step({ handLShow: 0 }, HAND_REVEAL_SECONDS / 2);
  assert.ok(turning.handLShow > 0.4 && turning.handLShow < 0.6, `from where it was: ${turning.handLShow}`);
  reveal.step({ handLShow: 1 }, 0);
  assert.equal(reveal.step({ handLShow: 1 }, 10).handLShow, 1, 'and out again');
  // Other parameters pass through untouched; a rig with no show parameter is left exactly alone.
  assert.equal(reveal.step({ handLShow: 1, headX: 0.7 }, 0).headX, 0.7);
  const bare = { handLX: 0.4 };
  assert.equal(createHandReveal({}).step(bare, 1), bare);
  reveal.reset();
  assert.equal(reveal.step({ handLShow: 0 }, 0).handLShow, 0, 'after a reset the hand starts where it is asked');
});
